-- Integration test of the check-in made by a recharge in the live game
-- (migration *_recharge_checks_in.sql).
--
-- Runs as one query and ALWAYS ends with an exception, so nothing is saved:
-- the report comes back as the error message (REPORT ...). Same harness as
-- remove_ticket.sql: its own house, the admin's identity through the JWT
-- claims of the transaction. Run it with the SQL Editor or execute_sql.

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

-- Holders of a number by ticket index: "1,2g,-" (g = gift, - = free).
create function pg_temp.row_of(p_sid bigint, p_num int) returns text language sql as $$
  select string_agg(
    coalesce(substr(p.name, 2) || case when tn.is_gift then 'g' else '' end, '-'), ',' order by t.index)
  from public.tickets t
  join public.ticket_numbers tn on tn.ticket_id = t.id and tn.number = p_num
  left join public.players p on p.id = tn.player_id
  where t.game_session_id = p_sid
$$;

-- Buys a number and returns the index of the ticket the database chose.
create function pg_temp.buy(p_sid bigint, p_num int, p_n int) returns text
language plpgsql as $$
declare
  v_ticket bigint;
begin
  v_ticket := public.record_purchase(p_sid, p_num, pg_temp.pl(p_sid, p_n), gen_random_uuid());
  return (select index::text from public.tickets where id = v_ticket);
end $$;

create function pg_temp.checked(p_sid bigint, p_n int) returns text language sql as $$
  select checked_in::text from public.game_session_players
  where game_session_id = p_sid and player_id = pg_temp.pl(p_sid, p_n)
$$;

-- The check_in rows of player Pn: "count|notes".
create function pg_temp.checkins(p_sid bigint, p_n int) returns text language sql as $$
  select count(*)::text || '|' || coalesce(string_agg(coalesce(note, '-'), ',' order by id), '')
  from public.activity_log
  where game_session_id = p_sid and type = 'check_in' and player_id = pg_temp.pl(p_sid, p_n)
$$;

create function pg_temp.recharge(p_sid bigint, p_n int, p_req uuid) returns void language sql as $$
  select public.record_recharge(p_sid, pg_temp.pl(p_sid, p_n), 20, 'cash', null, p_req)
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  s bigint;
  v_req uuid;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  s := pg_temp.mk('c', 1);

  -- C1: a recharge checks in a player who wasn't --------------------------
  perform pg_temp.buy(s, 3, 1);
  perform pg_temp.chk('C1 antes sin check-in', 'false', pg_temp.checked(s, 1));
  perform pg_temp.recharge(s, 1, gen_random_uuid());
  perform pg_temp.chk('C1 queda con check-in', 'true', pg_temp.checked(s, 1));
  perform pg_temp.chk('C1 una fila check_in por recarga', '1|recharge', pg_temp.checkins(s, 1));

  -- C2: already checked in: no new row ------------------------------------
  perform pg_temp.recharge(s, 1, gen_random_uuid());
  perform pg_temp.chk('C2 sin fila nueva', '1|recharge', pg_temp.checkins(s, 1));

  -- C3: a retry with the same request_id checks in once -------------------
  v_req := gen_random_uuid();
  perform pg_temp.recharge(s, 2, v_req);
  perform pg_temp.recharge(s, 2, v_req);
  perform pg_temp.chk('C3 un solo check-in', '1|recharge', pg_temp.checkins(s, 2));
  perform pg_temp.chk('C3 una sola recarga', '1', (
    select count(*)::text from public.activity_log
    where game_session_id = s and type = 'recharge' and player_id = pg_temp.pl(s, 2)));

  -- C4: still deciding keep or release: no check-in -----------------------
  perform pg_temp.buy(s, 5, 3);
  update public.game_session_players set pending_carryover = true
    where game_session_id = s and player_id = pg_temp.pl(s, 3);
  perform pg_temp.recharge(s, 3, gen_random_uuid());
  perform pg_temp.chk('C4 sin check-in', 'false', pg_temp.checked(s, 3));
  perform pg_temp.chk('C4 sin fila check_in', '0|', pg_temp.checkins(s, 3));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
