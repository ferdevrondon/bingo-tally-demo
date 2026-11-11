-- Integration test of automatic game sessions (migration *_round_pattern.sql).
--
-- Runs as one query and ALWAYS ends with an exception, so nothing is saved:
-- the report comes back as the error message (REPORT ...). It builds its own
-- houses (never touches real data), borrows the identity of a house admin
-- through the JWT claims of the transaction, and checks each scenario with
-- small helpers. Run it with the Supabase SQL Editor or execute_sql (for a
-- dry run before the migration is applied, send the migration first in the
-- same query: the final exception rolls it back too).

create temp table t_results (n serial, name text, ok boolean, detail text) on commit drop;

create function pg_temp.chk(p_name text, p_expected text, p_actual text) returns void
language plpgsql as $$
begin
  insert into pg_temp.t_results (name, ok, detail)
  values (p_name, p_expected is not distinct from p_actual,
          'esperado=' || coalesce(p_expected, 'NULL') || ' real=' || coalesce(p_actual, 'NULL'));
end $$;

-- Error message of a statement ('ok' when it succeeds).
create function pg_temp.err(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

-- A new house with 3 players and two templates: 'Especial' (kind special,
-- 2 prizes) and 'Regular' (1 prize). No game session. Returns the house id.
create function pg_temp.mkhouse(p_label text) returns bigint
language plpgsql as $$
declare
  v_admin uuid;
  v_house bigint;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  insert into public.houses (name, identifier) values ('test ' || p_label, 'test-' || p_label || '-' || gen_random_uuid())
    returning id into v_house;
  insert into public.house_members (house_id, user_id, role) values (v_house, v_admin, 'admin');
  insert into public.players (house_id, name) select v_house, 'P' || g from generate_series(1, 3) g;
  insert into public.round_templates (house_id, name, kind, line_price, prizes)
    values (v_house, 'Especial', 'special', 10, '{100,50}');
  insert into public.round_templates (house_id, name, line_price, prizes)
    values (v_house, 'Regular', 10, '{100}');
  return v_house;
end $$;

create function pg_temp.tpl(p_house bigint, p_name text) returns bigint language sql as
$$ select id from public.round_templates where house_id = p_house and name = p_name $$;

create function pg_temp.pl(p_house bigint, p_n int) returns bigint language sql as
$$ select id from public.players where house_id = p_house and name = 'P' || p_n $$;

-- The pattern [Especial ×2, Regular ×1] of a house, as start_game_session takes it.
create function pg_temp.pattern(p_house bigint) returns jsonb language sql as $$
  select jsonb_build_array(
    jsonb_build_object('round_template_id', pg_temp.tpl(p_house, 'Especial'), 'repeat_count', 2),
    jsonb_build_object('round_template_id', pg_temp.tpl(p_house, 'Regular'), 'repeat_count', 1)
  )
$$;

create function pg_temp.start_err(p_house bigint, p_mode text, p_pattern jsonb) returns text
language sql as $$
  select pg_temp.err(format(
    'select public.start_game_session(%s, gen_random_uuid(), %L, %L::jsonb)',
    p_house, p_mode, p_pattern::text
  ))
$$;

create function pg_temp.open_round(p_sid bigint) returns bigint language sql as $$
  select id from public.game_session_rounds where game_session_id = p_sid and status = 'open'
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  h bigint;
  h2 bigint;
  s bigint;
  v_req uuid;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  -- T1 Kind: the default is regular, the check rejects anything else.
  h := pg_temp.mkhouse('kind');
  perform pg_temp.chk('T1 kind por defecto = regular', 'regular',
    (select kind from public.round_templates where id = pg_temp.tpl(h, 'Regular')));
  perform pg_temp.chk('T1 kind inválido rechazado', 'new row for relation "round_templates" violates check constraint "round_templates_kind_check"',
    pg_temp.err(format('insert into public.round_templates (house_id, name, kind, line_price, prizes) values (%s, %L, %L, 10, %L)',
      h, 'X', 'bonus', '{10}')));

  -- T2 Manual, the old two-argument call: as before.
  h := pg_temp.mkhouse('manual');
  s := public.start_game_session(h, gen_random_uuid());
  perform pg_temp.chk('T2 manual: modo', 'manual', (select round_mode from public.game_sessions where id = s));
  perform pg_temp.chk('T2 manual: sin rondas', '0',
    (select count(*)::text from public.game_session_rounds where game_session_id = s));
  perform pg_temp.chk('T2 manual: sin patrón', '0',
    (select count(*)::text from public.game_session_round_pattern where game_session_id = s));

  -- T3 Manual with a round: discard still refused (unchanged rule).
  perform public.start_round(s, pg_temp.tpl(h, 'Regular'), gen_random_uuid());
  perform pg_temp.chk('T3 manual con ronda: no se puede descartar', 'game_session_has_rounds',
    pg_temp.err(format('select public.discard_game_session(%s, gen_random_uuid())', s)));

  -- T4 Auto: stores the pattern and opens the first block's round.
  h := pg_temp.mkhouse('auto');
  v_req := gen_random_uuid();
  s := public.start_game_session(h, v_req, 'auto', pg_temp.pattern(h));
  perform pg_temp.chk('T4 auto: modo', 'auto', (select round_mode from public.game_sessions where id = s));
  perform pg_temp.chk('T4 auto: bloques en orden', 'Especial×2,Regular×1',
    (select string_agg(rt.name || '×' || p.repeat_count, ',' order by p.position)
     from public.game_session_round_pattern p join public.round_templates rt on rt.id = p.round_template_id
     where p.game_session_id = s));
  perform pg_temp.chk('T4 auto: ronda 1 abierta con el primer bloque', '1 Especial open {100.00,50.00}',
    (select r.seq || ' ' || r.name || ' ' || r.status || ' ' || r.prizes::text
     from public.game_session_rounds r where r.game_session_id = s));
  perform pg_temp.chk('T4 auto: round_started registrado', '1',
    (select count(*)::text from public.activity_log where game_session_id = s and type = 'round_started'));
  perform pg_temp.chk('T4 mismo request: misma jornada', s::text,
    public.start_game_session(h, v_req, 'auto', pg_temp.pattern(h))::text);
  perform pg_temp.chk('T4 con jornada activa: devuelve la activa sin tocarla', s::text,
    public.start_game_session(h, gen_random_uuid(), 'manual')::text);
  perform pg_temp.chk('T4 sigue siendo una sola ronda', '1',
    (select count(*)::text from public.game_session_rounds where game_session_id = s));

  -- T5 Auto: the untouched first round doesn't block discarding it.
  perform pg_temp.chk('T5 auto con la ronda inicial intacta: se descarta', 'ok',
    pg_temp.err(format('select public.discard_game_session(%s, gen_random_uuid())', s)));
  perform pg_temp.chk('T5 la jornada ya no existe', '0',
    (select count(*)::text from public.game_sessions where id = s));
  perform pg_temp.chk('T5 su patrón tampoco', '0',
    (select count(*)::text from public.game_session_round_pattern where game_session_id = s));

  -- T6 Auto with a play in the round: discard refused.
  s := public.start_game_session(h, gen_random_uuid(), 'auto', pg_temp.pattern(h));
  perform public.add_ticket(s, gen_random_uuid());
  perform public.record_purchase(s, 5, pg_temp.pl(h, 1), gen_random_uuid());
  perform pg_temp.chk('T6 auto con una jugada: no se puede descartar', 'game_session_has_rounds',
    pg_temp.err(format('select public.discard_game_session(%s, gen_random_uuid())', s)));

  -- T7 The live game doesn't change: draw both prizes and close with the
  -- next block's template (sent by the app).
  perform public.record_check_in(s, pg_temp.pl(h, 1), gen_random_uuid());
  perform public.award_prize(pg_temp.open_round(s), 0, 5, gen_random_uuid());
  perform public.award_prize(pg_temp.open_round(s), 1, 6, gen_random_uuid());
  perform public.close_round(pg_temp.open_round(s), pg_temp.tpl(h, 'Especial'), gen_random_uuid());
  perform pg_temp.chk('T7 ronda 2 abierta (Especial)', '2 Especial',
    (select seq || ' ' || name from public.game_session_rounds where id = pg_temp.open_round(s)));
  perform pg_temp.chk('T7 la ronda 1 cerrada', 'closed',
    (select status from public.game_session_rounds where game_session_id = s and seq = 1));

  -- T8 Invalid patterns: nothing is created.
  h := pg_temp.mkhouse('bad');
  h2 := pg_temp.mkhouse('other');
  perform pg_temp.chk('T8 modo desconocido', 'invalid_round_pattern', pg_temp.start_err(h, 'loop', null));
  perform pg_temp.chk('T8 auto sin patrón', 'invalid_round_pattern', pg_temp.start_err(h, 'auto', null));
  perform pg_temp.chk('T8 auto con patrón vacío', 'invalid_round_pattern', pg_temp.start_err(h, 'auto', '[]'));
  perform pg_temp.chk('T8 patrón que no es lista', 'invalid_round_pattern', pg_temp.start_err(h, 'auto', '{"a":1}'));
  perform pg_temp.chk('T8 cantidad 0', 'invalid_round_pattern', pg_temp.start_err(h, 'auto',
    jsonb_build_array(jsonb_build_object('round_template_id', pg_temp.tpl(h, 'Regular'), 'repeat_count', 0))));
  perform pg_temp.chk('T8 cantidad 21', 'invalid_round_pattern', pg_temp.start_err(h, 'auto',
    jsonb_build_array(jsonb_build_object('round_template_id', pg_temp.tpl(h, 'Regular'), 'repeat_count', 21))));
  perform pg_temp.chk('T8 cantidad no numérica', 'invalid_round_pattern', pg_temp.start_err(h, 'auto',
    jsonb_build_array(jsonb_build_object('round_template_id', pg_temp.tpl(h, 'Regular'), 'repeat_count', 'x'))));
  perform pg_temp.chk('T8 sin ronda', 'invalid_round_pattern', pg_temp.start_err(h, 'auto',
    jsonb_build_array(jsonb_build_object('repeat_count', 1))));
  perform pg_temp.chk('T8 21 bloques', 'invalid_round_pattern', pg_temp.start_err(h, 'auto',
    (select jsonb_agg(jsonb_build_object('round_template_id', pg_temp.tpl(h, 'Regular'), 'repeat_count', 1))
     from generate_series(1, 21))));
  perform pg_temp.chk('T8 ronda de otra casa', 'round_template_not_found', pg_temp.start_err(h, 'auto',
    jsonb_build_array(jsonb_build_object('round_template_id', pg_temp.tpl(h2, 'Regular'), 'repeat_count', 1))));
  update public.round_templates set active = false where id = pg_temp.tpl(h, 'Especial');
  perform pg_temp.chk('T8 ronda desactivada', 'round_template_not_found', pg_temp.start_err(h, 'auto', pg_temp.pattern(h)));
  perform pg_temp.chk('T8 ninguna jornada creada', '0',
    (select count(*)::text from public.game_sessions where house_id = h));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
