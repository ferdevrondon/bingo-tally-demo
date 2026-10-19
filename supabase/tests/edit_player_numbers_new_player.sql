-- Integration test of edit_player_numbers with a player who is new to the game
-- session (migration *_edit_player_numbers_new_player.sql).
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

create function pg_temp.ed(p_sid bigint, p_n int, p_changes jsonb) returns text language sql as $$
  select pg_temp.err(format('select public.edit_player_numbers(%s, %s, %L::jsonb, gen_random_uuid())',
    p_sid, pg_temp.pl(p_sid, p_n), p_changes))
$$;

create function pg_temp.own(p_sid bigint, p_idx int, p_num int, p_gift boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('ticket_id', pg_temp.tk(p_sid, p_idx), 'number', p_num, 'owned', true, 'is_gift', p_gift)
$$;

create function pg_temp.cnt(p_sid bigint, p_n int, p_type text) returns text language sql as $$
  select count(*)::text from public.activity_log
  where game_session_id = p_sid and type = p_type and player_id = pg_temp.pl(p_sid, p_n)
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

  -- S1: a player new to the game session joins through the edit dialog ---------
  s := pg_temp.mk('n1', 3);
  perform pg_temp.chk('S1 jugador nuevo, un número', 'ok',
    pg_temp.ed(s, 1, jsonb_build_array(pg_temp.own(s, 1, 10))));
  perform pg_temp.chk('S1 entró a la jornada', '1', pg_temp.cnt(s, 1, 'player_added'));
  perform pg_temp.chk('S1 saldo inicial registrado', '1', pg_temp.cnt(s, 1, 'balance_opened'));
  perform pg_temp.chk('S1 compra registrada', '1', pg_temp.cnt(s, 1, 'number_purchased'));
  perform pg_temp.chk('S1 saldo = -P', '-10.00', pg_temp.bal(s, 1));

  -- S2: several numbers, one of them a gift, in one edit -----------------------
  perform pg_temp.chk('S2 jugador nuevo, tres números con un regalo', 'ok',
    pg_temp.ed(s, 2, jsonb_build_array(pg_temp.own(s, 1, 1), pg_temp.own(s, 1, 2), pg_temp.own(s, 1, 3, true))));
  perform pg_temp.chk('S2 tres compras', '3', pg_temp.cnt(s, 2, 'number_purchased'));
  perform pg_temp.chk('S2 un regalo', '1', pg_temp.cnt(s, 2, 'number_gifted'));
  perform pg_temp.chk('S2 saldo = -2P (el regalo no se cobra)', '-20.00', pg_temp.bal(s, 2));

  -- S3: a player already in the game session keeps working ---------------------
  perform pg_temp.chk('S3 el mismo jugador agrega otro número', 'ok',
    pg_temp.ed(s, 1, jsonb_build_array(pg_temp.own(s, 1, 11))));
  perform pg_temp.chk('S3 sigue habiendo una sola entrada', '1', pg_temp.cnt(s, 1, 'player_added'));
  perform pg_temp.chk('S3 saldo = -2P', '-20.00', pg_temp.bal(s, 1));

  -- S4: a removed player coming back through the edit dialog -------------------
  perform public.remove_player(s, pg_temp.pl(s, 2), gen_random_uuid());
  perform pg_temp.chk('S4 jugador retirado vuelve con un número', 'ok',
    pg_temp.ed(s, 2, jsonb_build_array(pg_temp.own(s, 2, 12))));

  -- S5: a new player joins while another one still has to decide ---------------
  perform public.record_purchase(s, 13, pg_temp.pl(s, 3), gen_random_uuid());
  update public.game_session_players set pending_carryover = true, checked_in = false
    where game_session_id = s and player_id = pg_temp.pl(s, 3);
  perform pg_temp.chk('S5 jugador nuevo entra con otro pendiente', 'ok',
    pg_temp.ed(s, 4, jsonb_build_array(pg_temp.own(s, 2, 5))));
  perform pg_temp.chk('S5 pero no puede quitarle un número al pendiente', 'pending_carryover',
    pg_temp.ed(s, 4, jsonb_build_array(
      jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 13, 'owned', true, 'is_gift', false,
                         'expected_owner_id', pg_temp.pl(s, 3)))));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
