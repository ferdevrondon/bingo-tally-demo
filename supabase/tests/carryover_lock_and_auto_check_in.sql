-- Integration test of the carryover lock and the automatic check-in
-- (migration *_carryover_lock_and_auto_check_in.sql).
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

create function pg_temp.pend(p_sid bigint, p_n int) returns void language sql as $$
  update public.game_session_players set pending_carryover = true, checked_in = false
  where game_session_id = p_sid and player_id = pg_temp.pl(p_sid, p_n)
$$;

create function pg_temp.checked(p_sid bigint, p_n int) returns text language sql as $$
  select checked_in::text from public.game_session_players
  where game_session_id = p_sid and player_id = pg_temp.pl(p_sid, p_n)
$$;

create function pg_temp.auto_rows(p_sid bigint, p_n int) returns text language sql as $$
  select count(*)::text from public.activity_log
  where game_session_id = p_sid and type = 'check_in' and note = 'auto' and player_id = pg_temp.pl(p_sid, p_n)
$$;

create function pg_temp.keep(p_sid bigint, p_n int, p_release jsonb) returns void language sql as $$
  select public.resolve_carryover(p_sid, pg_temp.pl(p_sid, p_n), p_release, gen_random_uuid())
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  s bigint;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  -- S1: a pending player can't change their play ------------------------------
  s := pg_temp.mk('c1', 4);
  perform pg_temp.buy(s, 6, 1);
  perform pg_temp.buy(s, 7, 2);
  perform pg_temp.pend(s, 1);
  perform pg_temp.chk('S1 comprar', 'pending_carryover', pg_temp.err(format(
    'select public.record_purchase(%s, 8, %s, gen_random_uuid())', s, pg_temp.pl(s, 1))));
  perform pg_temp.chk('S1 liberar', 'pending_carryover', pg_temp.err(format(
    'select public.release_number(%s, 6, %s, gen_random_uuid())', pg_temp.tk(s, 1), pg_temp.pl(s, 1))));
  perform pg_temp.chk('S1 regalar', 'pending_carryover', pg_temp.err(format(
    'select public.toggle_gift(%s, 6, %s, gen_random_uuid())', pg_temp.tk(s, 1), pg_temp.pl(s, 1))));
  perform pg_temp.chk('S1 quitarle un número a otro jugador', 'pending_carryover', pg_temp.err(format(
    'select public.reassign_number(%s, 6, %s, %s, gen_random_uuid())',
    pg_temp.tk(s, 1), pg_temp.pl(s, 1), pg_temp.pl(s, 3))));
  perform pg_temp.chk('S1 dárselo a un jugador pendiente', 'pending_carryover', pg_temp.err(format(
    'select public.reassign_number(%s, 7, %s, %s, gen_random_uuid())',
    pg_temp.tk(s, 1), pg_temp.pl(s, 2), pg_temp.pl(s, 1))));
  perform pg_temp.chk('S1 editar jugada', 'pending_carryover', pg_temp.err(format(
    'select public.edit_player_numbers(%s, %s, %L::jsonb, gen_random_uuid())',
    s, pg_temp.pl(s, 1),
    jsonb_build_array(jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 9, 'owned', true, 'is_gift', false)))));
  perform pg_temp.chk('S1 otro jugador sí puede comprar', 'ok', pg_temp.err(format(
    'select public.record_purchase(%s, 9, %s, gen_random_uuid())', s, pg_temp.pl(s, 3))));
  perform pg_temp.chk('S1 el saldo del pendiente no cambió', '-10.00', pg_temp.bal(s, 1));

  -- S2: keep everything -> automatic check-in, then it can edit ---------------
  perform pg_temp.keep(s, 1, '[]'::jsonb);
  perform pg_temp.chk('S2 queda con check-in', 'true', pg_temp.checked(s, 1));
  perform pg_temp.chk('S2 una fila check_in automática', '1', pg_temp.auto_rows(s, 1));
  perform pg_temp.chk('S2 ya puede comprar', 'ok', pg_temp.err(format(
    'select public.record_purchase(%s, 8, %s, gen_random_uuid())', s, pg_temp.pl(s, 1))));

  -- S3: release part -> still checked in --------------------------------------
  s := pg_temp.mk('c3', 4);
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 7, 1);
  perform pg_temp.pend(s, 1);
  perform pg_temp.keep(s, 1, jsonb_build_array(jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 6)));
  perform pg_temp.chk('S3 liberar una parte -> check-in', 'true', pg_temp.checked(s, 1));
  perform pg_temp.chk('S3 una fila automática', '1', pg_temp.auto_rows(s, 1));

  -- S4: release everything -> no check-in --------------------------------------
  s := pg_temp.mk('c4', 4);
  perform pg_temp.buy(s, 6, 1);
  perform pg_temp.pend(s, 1);
  perform pg_temp.keep(s, 1, jsonb_build_array(jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 6)));
  perform pg_temp.chk('S4 libera todo -> sin check-in', 'false', pg_temp.checked(s, 1));
  perform pg_temp.chk('S4 sin fila automática', '0', pg_temp.auto_rows(s, 1));
  perform pg_temp.chk('S4 puede comprar de nuevo y entonces hace check-in', 'ok', pg_temp.err(format(
    'select public.record_purchase(%s, 8, %s, gen_random_uuid())', s, pg_temp.pl(s, 1))));
  perform pg_temp.chk('S4 sigue sin check-in', 'false', pg_temp.checked(s, 1));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
