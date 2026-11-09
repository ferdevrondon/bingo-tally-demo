-- Integration test of the balances on the player_removed row
-- (migrations *_remove_player_balances.sql, *_remove_player_prizes.sql and
-- *_remove_player_summary.sql).
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

create function pg_temp.rel(p_sid bigint, p_idx int, p_num int, p_n int) returns void language sql as $$
  select public.release_number(pg_temp.tk(p_sid, p_idx), p_num, pg_temp.pl(p_sid, p_n), gen_random_uuid())
$$;

-- Invariants: no hole in front of a play of the same number (when asked) and
-- the money is conserved (players' balances + house result = 0).
create function pg_temp.inv(p_sid bigint, p_label text, p_holes boolean, p_money boolean) returns void
language plpgsql as $$
begin
  if p_holes then
    perform pg_temp.chk(p_label || ' sin huecos delante', '0', (
      select count(distinct a.number)::text
      from public.ticket_numbers a join public.tickets ta on ta.id = a.ticket_id
      join public.ticket_numbers b on b.game_session_id = a.game_session_id and b.number = a.number
      join public.tickets tb on tb.id = b.ticket_id
      where a.game_session_id = p_sid and a.player_id is null and b.player_id is not null
        and ta.removed_at is null and ta.index < tb.index));
  end if;
  if p_money then
    perform pg_temp.chk(p_label || ' dinero conservado', '0.00', (
      select (coalesce((select sum(balance) from public.game_session_players where game_session_id = p_sid), 0)
              + (select house_balance from public.game_sessions where id = p_sid))::numeric(12, 2)::text));
  end if;
end $$;

-- The player_removed row of player Pn:
-- "amount|opening|recharges|played|prizes|payouts|transfers".
create function pg_temp.removed_row(p_sid bigint, p_n int) returns text language sql as $$
  select string_agg(
    coalesce(amount::text, 'NULL')
      || '|' || coalesce(note::json ->> 'opening', 'NULL')
      || '|' || coalesce(note::json ->> 'recharges', 'NULL')
      || '|' || coalesce(note::json ->> 'played', 'NULL')
      || '|' || coalesce(note::json ->> 'prizes', 'NULL')
      || '|' || coalesce(note::json ->> 'payouts', 'NULL')
      || '|' || coalesce(note::json ->> 'transfers', 'NULL'), ';')
  from public.activity_log
  where game_session_id = p_sid and type = 'player_removed' and player_id = pg_temp.pl(p_sid, p_n)
$$;

-- opening + recharges - played + prizes + payouts + transfers = amount.
create function pg_temp.adds_up(p_sid bigint, p_n int) returns text language sql as $$
  select ((note::json ->> 'opening')::numeric + (note::json ->> 'recharges')::numeric
          - (note::json ->> 'played')::numeric + (note::json ->> 'prizes')::numeric
          + (note::json ->> 'payouts')::numeric + (note::json ->> 'transfers')::numeric
          - amount)::numeric(12, 2)::text
  from public.activity_log
  where game_session_id = p_sid and type = 'player_removed' and player_id = pg_temp.pl(p_sid, p_n)
$$;

create function pg_temp.set_account(p_sid bigint, p_n int, p_balance numeric) returns void language sql as $$
  insert into public.player_accounts (house_id, player_id, balance)
  values (pg_temp.hid(p_sid), pg_temp.pl(p_sid, p_n), p_balance)
  on conflict (player_id) do update set balance = excluded.balance
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  s bigint;
  v_req uuid;
  v_tpl bigint;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  -- B1: opens owing 20, buys two plays (10 each), the removal voids them ---
  s := pg_temp.mk('b1', 2);
  perform pg_temp.set_account(s, 1, -20);
  perform pg_temp.buy(s, 3, 1);
  perform pg_temp.buy(s, 7, 1);
  perform pg_temp.chk('B1 saldo en juego', '-40.00',
    (select balance::text from public.game_session_players
     where game_session_id = s and player_id = pg_temp.pl(s, 1)));
  perform public.remove_player(s, pg_temp.pl(s, 1), gen_random_uuid());
  perform pg_temp.chk('B1 resumen', '-20.00|-20.00|0|0.00|0|0|0', pg_temp.removed_row(s, 1));
  perform pg_temp.inv(s, 'B1', true, false);

  -- B2: opens with 15 in favor, idempotent by request_id -------------------
  s := pg_temp.mk('b2', 1);
  perform pg_temp.set_account(s, 2, 15);
  perform pg_temp.buy(s, 5, 2);
  v_req := gen_random_uuid();
  perform public.remove_player(s, pg_temp.pl(s, 2), v_req);
  perform public.remove_player(s, pg_temp.pl(s, 2), v_req);
  perform pg_temp.chk('B2 una sola fila', '15.00|15.00|0|0.00|0|0|0', pg_temp.removed_row(s, 2));
  perform pg_temp.chk('B2 número libre', '-', pg_temp.row_of(s, 5));
  perform pg_temp.inv(s, 'B2', true, false);

  -- B3: wins a prize of 50 in a closed round, then leaves ------------------
  s := pg_temp.mk('b3', 1);
  select id into v_tpl from public.round_templates where house_id = pg_temp.hid(s) limit 1;
  for i in 1..6 loop
    perform pg_temp.buy(s, i, i);
    perform public.record_check_in(s, pg_temp.pl(s, i), gen_random_uuid());
  end loop;
  perform public.award_prize(
    (select id from public.game_session_rounds where game_session_id = s and status = 'open'),
    0, 1, gen_random_uuid());
  perform public.close_round(
    (select id from public.game_session_rounds where game_session_id = s and status = 'open'),
    v_tpl, gen_random_uuid());
  perform public.remove_player(s, pg_temp.pl(s, 1), gen_random_uuid());
  perform pg_temp.chk('B3 resumen con premio', '40.00|0.00|0|10.00|50.00|0|0', pg_temp.removed_row(s, 1));
  perform public.remove_player(s, pg_temp.pl(s, 2), gen_random_uuid());
  perform pg_temp.chk('B3 sin premio', '-10.00|0.00|0|10.00|0|0|0', pg_temp.removed_row(s, 2));

  perform pg_temp.chk('B3 cuadra (P1)', '0.00', pg_temp.adds_up(s, 1));
  perform pg_temp.chk('B3 cuadra (P2)', '0.00', pg_temp.adds_up(s, 2));

  -- B4: a recharge of 30, buys two plays in the open round and leaves ------
  s := pg_temp.mk('b4', 1);
  perform pg_temp.set_account(s, 3, -5);
  perform public.record_recharge(s, pg_temp.pl(s, 3), 30, 'cash', null, gen_random_uuid());
  perform pg_temp.buy(s, 4, 3);
  perform pg_temp.buy(s, 9, 3);
  perform public.remove_player(s, pg_temp.pl(s, 3), gen_random_uuid());
  perform pg_temp.chk('B4 recarga, jugadas devueltas', '25.00|-5.00|30.00|0.00|0|0|0', pg_temp.removed_row(s, 3));
  perform pg_temp.chk('B4 cuadra', '0.00', pg_temp.adds_up(s, 3));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
