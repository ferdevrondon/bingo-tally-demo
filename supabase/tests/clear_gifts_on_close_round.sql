-- Integration test of the gifts being cleared when a round closes
-- (migration *_clear_gifts_on_close_round.sql).
--
-- Runs as one query and ALWAYS ends with an exception, so nothing is saved:
-- the report comes back as the error message (REPORT ...). It builds its own
-- house (never touches real data), borrows the identity of the house's admin
-- through the JWT claims of the transaction, and checks each scenario with
-- small helpers. Run it with the Supabase SQL Editor or execute_sql.

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

create function pg_temp.hid(p_sid bigint) returns bigint language sql as
$$ select house_id from public.game_sessions where id = p_sid $$;

create function pg_temp.pl(p_sid bigint, p_n int) returns bigint language sql as
$$ select id from public.players where house_id = pg_temp.hid(p_sid) and name = 'P' || p_n $$;

create function pg_temp.tk(p_sid bigint, p_idx int) returns bigint language sql as
$$ select id from public.tickets where game_session_id = p_sid and index = p_idx $$;

-- A new house with 6 players, a template, an active game session with n
-- tickets and its round started. Returns the game session id.
create function pg_temp.mk(p_label text, p_tickets int) returns bigint
language plpgsql as $$
declare
  v_admin uuid;
  v_house bigint;
  v_sid bigint;
  v_tpl bigint;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  insert into public.houses (name, identifier) values ('test ' || p_label, 'test-' || p_label || '-' || gen_random_uuid())
    returning id into v_house;
  insert into public.house_members (house_id, user_id, role) values (v_house, v_admin, 'admin');
  insert into public.players (house_id, name) select v_house, 'P' || g from generate_series(1, 6) g;
  insert into public.round_templates (house_id, name, line_price, prizes)
    values (v_house, 'Regular', 10, '{50}') returning id into v_tpl;
  v_sid := public.start_game_session(v_house, gen_random_uuid());
  for i in 1..p_tickets loop
    perform public.add_ticket(v_sid, gen_random_uuid());
  end loop;
  perform public.start_round(v_sid, v_tpl, gen_random_uuid());
  return v_sid;
end $$;

create function pg_temp.bal(p_sid bigint, p_n int) returns text language sql as $$
  select balance::text from public.game_session_players
  where game_session_id = p_sid and player_id = pg_temp.pl(p_sid, p_n)
$$;

create function pg_temp.buy(p_sid bigint, p_num int, p_n int) returns void
language plpgsql as $$
begin
  perform public.record_purchase(p_sid, p_num, pg_temp.pl(p_sid, p_n), gen_random_uuid());
end $$;

create function pg_temp.gifts(p_sid bigint) returns text language sql as $$
  select count(*)::text from public.ticket_numbers where game_session_id = p_sid and is_gift
$$;

create function pg_temp.open_round(p_sid bigint) returns bigint language sql as $$
  select id from public.game_session_rounds where game_session_id = p_sid and status = 'open'
$$;

create function pg_temp.round_margin(p_sid bigint, p_seq int) returns text language sql as $$
  select margin_gifts::text from public.game_session_rounds where game_session_id = p_sid and seq = p_seq
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  s bigint;
  v_tpl bigint;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  s := pg_temp.mk('g1', 3);
  select id into v_tpl from public.round_templates where house_id = pg_temp.hid(s) limit 1;

  -- P1 plays 6 and 7 and gets 7 as a gift; P2 plays 8 (the winning number);
  -- P3 plays 9 and gets it as a gift too, and it wins nothing.
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 7, 1);
  perform public.toggle_gift(pg_temp.tk(s, 1), 7, pg_temp.pl(s, 1), gen_random_uuid());
  perform pg_temp.buy(s, 8, 2);
  perform pg_temp.buy(s, 9, 3);
  perform public.toggle_gift(pg_temp.tk(s, 1), 9, pg_temp.pl(s, 3), gen_random_uuid());
  perform public.record_check_in(s, pg_temp.pl(s, 1), gen_random_uuid());
  perform public.record_check_in(s, pg_temp.pl(s, 2), gen_random_uuid());
  perform public.record_check_in(s, pg_temp.pl(s, 3), gen_random_uuid());
  perform pg_temp.chk('S1 dos regalos activos en la ronda', '2', pg_temp.gifts(s));

  perform public.award_prize(pg_temp.open_round(s), 0, 8, gen_random_uuid());
  perform public.close_round(pg_temp.open_round(s), v_tpl, gen_random_uuid());

  perform pg_temp.chk('S2 al cerrar la ronda no queda ningún regalo', '0', pg_temp.gifts(s));
  perform pg_temp.chk('S2 el margen de regalos de la ronda 1 se calculó antes (-2P)', '-20.00', pg_temp.round_margin(s, 1));

  -- The player who had the gift keeps everything: charged for both numbers.
  perform public.resolve_carryover(s, pg_temp.pl(s, 1), '[]'::jsonb, gen_random_uuid());
  perform pg_temp.chk('S3 mantener cobra los dos números (-10 -10 +10 de regalo -20)', '-30.00',
    (select balance::text from public.game_session_players where game_session_id = s and player_id = pg_temp.pl(s, 1)));
  perform pg_temp.chk('S3 check-in automático', 'true',
    (select checked_in::text from public.game_session_players where game_session_id = s and player_id = pg_temp.pl(s, 1)));

  -- A player without gifts is charged the same as before.
  perform public.resolve_carryover(s, pg_temp.pl(s, 2), '[]'::jsonb, gen_random_uuid());
  perform pg_temp.chk('S4 jugador sin regalos: +50 de premio -10 de compra -10 de mantener', '30.00',
    (select balance::text from public.game_session_players where game_session_id = s and player_id = pg_temp.pl(s, 2)));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
