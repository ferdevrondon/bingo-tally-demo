-- Integration test of correct_movement (migration *_movement_corrections.sql).
--
-- Runs as one query and ALWAYS ends with an exception, so nothing is saved:
-- the report comes back as the error message (REPORT ...). It builds its own
-- houses (never touches real data) and borrows the identity of the admin
-- through the JWT claims of the transaction, like auto_assign_and_compact.sql.

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

-- A new house with 3 players (P1..P3). Returns the house id.
create function pg_temp.mk(p_label text) returns bigint
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
  return v_house;
end $$;

create function pg_temp.pl(p_house bigint, p_n int) returns bigint language sql as
$$ select id from public.players where house_id = p_house and name = 'P' || p_n $$;

create function pg_temp.acc(p_house bigint, p_n int) returns text language sql as
$$ select balance::numeric(12, 2)::text from public.player_accounts where player_id = pg_temp.pl(p_house, p_n) $$;

create function pg_temp.gsp(p_sid bigint, p_n int) returns text language sql as $$
  select balance::numeric(12, 2)::text from public.game_session_players
  where game_session_id = p_sid
    and player_id = pg_temp.pl((select house_id from public.game_sessions where id = p_sid), p_n)
$$;

-- The player's last ledger row of a type (the move to correct).
create function pg_temp.last_move(p_house bigint, p_n int, p_type text) returns bigint language sql as $$
  select max(id) from public.activity_log
  where house_id = p_house and player_id = pg_temp.pl(p_house, p_n) and type = p_type and corrects_id is null
$$;

-- Net of a type for a player, as every report sums it.
create function pg_temp.net(p_house bigint, p_n int, p_type text) returns text language sql as $$
  select coalesce(sum(amount), 0)::numeric(12, 2)::text from public.activity_log
  where house_id = p_house and player_id = pg_temp.pl(p_house, p_n) and type = p_type
$$;

create function pg_temp.fix(p_move bigint, p_amount numeric, p_reason text default 'error de dedo') returns text
language sql as $$
  select pg_temp.err(format('select public.correct_movement(%s, %s, %L, %L)',
    p_move, p_amount, p_reason, gen_random_uuid()))
$$;

create function pg_temp.sp(p_sid bigint, p_n int) returns text language sql as $$
  select received::numeric(12, 2) || '/' || paid::numeric(12, 2) || '/' || coalesce(resolution, '-')
  from public.settlement_players
  where game_session_id = p_sid
    and player_id = pg_temp.pl((select house_id from public.game_sessions where id = p_sid), p_n)
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  h bigint;
  s bigint;
  m bigint;
  v_req uuid;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  -- C1: a recharge on the account, 1000 instead of 100 -----------------------
  h := pg_temp.mk('c1');
  perform public.record_account_recharge(pg_temp.pl(h, 1), 1000, 'cash', null, gen_random_uuid(), 'chase');
  m := pg_temp.last_move(h, 1, 'recharge');
  perform pg_temp.chk('C1 sin motivo', 'reason_required', pg_temp.fix(m, 100, '  '));
  perform pg_temp.chk('C1 monto negativo', 'invalid_amount', pg_temp.fix(m, -1));
  perform pg_temp.chk('C1 mismo monto', 'amount_unchanged', pg_temp.fix(m, 1000));
  v_req := gen_random_uuid();
  perform public.correct_movement(m, 100, 'error de dedo', v_req);
  perform public.correct_movement(m, 100, 'error de dedo', v_req);
  perform pg_temp.chk('C1 saldo de la cuenta', '100.00', pg_temp.acc(h, 1));
  perform pg_temp.chk('C1 recargas netas', '100.00', pg_temp.net(h, 1, 'recharge'));
  perform pg_temp.chk('C1 pagos (ninguno)', '0.00', pg_temp.net(h, 1, 'payout'));
  perform pg_temp.chk('C1 la corrección copia método y banco', 'recharge/-900.00/cash/chase/error de dedo', (
    select type || '/' || amount::numeric(12, 2) || '/' || payment_method || '/' || bank || '/' || note
    from public.activity_log where corrects_id = m));
  perform pg_temp.chk('C1 una sola fila con el mismo request', '1',
    (select count(*)::text from public.activity_log where corrects_id = m));
  perform pg_temp.chk('C1 segunda corrección', 'movement_already_corrected', pg_temp.fix(m, 50));
  perform pg_temp.chk('C1 corregir la corrección', 'movement_not_correctable',
    pg_temp.fix((select id from public.activity_log where corrects_id = m), 50));

  -- C2: a payout voided (correct amount 0) ----------------------------------
  perform public.record_account_payout(pg_temp.pl(h, 2), 50, 'zelle', null, gen_random_uuid(), null);
  perform pg_temp.chk('C2 debe 50', '-50.00', pg_temp.acc(h, 2));
  perform pg_temp.chk('C2 anular', 'ok', pg_temp.fix(pg_temp.last_move(h, 2, 'payout'), 0));
  perform pg_temp.chk('C2 saldo de vuelta en 0', '0.00', pg_temp.acc(h, 2));
  perform pg_temp.chk('C2 pagos netos', '0.00', pg_temp.net(h, 2, 'payout'));

  -- C3: a payout of 30 that was 80 ------------------------------------------
  perform public.record_account_recharge(pg_temp.pl(h, 3), 100, 'cash', null, gen_random_uuid(), null);
  perform public.record_account_payout(pg_temp.pl(h, 3), 30, 'cash', null, gen_random_uuid(), null);
  perform pg_temp.chk('C3 corregir a 80', 'ok', pg_temp.fix(pg_temp.last_move(h, 3, 'payout'), 80));
  perform pg_temp.chk('C3 saldo', '20.00', pg_temp.acc(h, 3));
  perform pg_temp.chk('C3 pagos netos', '-80.00', pg_temp.net(h, 3, 'payout'));

  -- C4: once a game session started, account moves are closed ---------------
  perform public.record_account_recharge(pg_temp.pl(h, 3), 10, 'cash', null, gen_random_uuid(), null);
  m := pg_temp.last_move(h, 3, 'recharge');
  s := public.start_game_session(h, gen_random_uuid());
  -- One transaction has a single now(): move the start past the recharge.
  update public.game_sessions set started_at = now() + interval '1 minute' where id = s;
  perform pg_temp.chk('C4 cuenta tras iniciar jornada', 'movement_closed', pg_temp.fix(m, 5));

  -- C5: a recharge in the live game session ----------------------------------
  perform public.record_recharge(s, pg_temp.pl(h, 2), 500, 'cash', null, gen_random_uuid(), null);
  m := pg_temp.last_move(h, 2, 'recharge');
  perform pg_temp.chk('C5 en jornada', 'ok', pg_temp.fix(m, 50));
  perform pg_temp.chk('C5 saldo en la jornada', '50.00', pg_temp.gsp(s, 2));
  perform pg_temp.chk('C5 la corrección queda en la jornada', s::text,
    (select game_session_id::text from public.activity_log where corrects_id = m));
  perform pg_temp.chk('C5 la cuenta no cambia', '0.00', pg_temp.acc(h, 2));
  perform public.record_recharge(s, pg_temp.pl(h, 2), 20, 'cash', null, gen_random_uuid(), null);
  m := pg_temp.last_move(h, 2, 'recharge');

  -- C6: settlement moves -----------------------------------------------------
  -- P1 has 100 and recharges 0 in the game; P3 opens with 20 and gets paid.
  perform public.record_recharge(s, pg_temp.pl(h, 1), 1, 'cash', null, gen_random_uuid(), null);
  perform public.record_recharge(s, pg_temp.pl(h, 3), 1, 'cash', null, gen_random_uuid(), null);
  perform public.end_game_session(s, gen_random_uuid());
  update public.game_sessions set started_at = now() - interval '1 hour' where id = s;
  perform pg_temp.chk('C6 jornada cerrada', 'movement_closed', pg_temp.fix(m, 5));
  -- P1 is owed 101: paid 1010 by mistake (should be 101).
  perform public.settlement_payout(s, pg_temp.pl(h, 1), 1010, 'cash', null, gen_random_uuid(), null);
  perform pg_temp.chk('C6 pago de más', '0.00/1010.00/paid_out', pg_temp.sp(s, 1));
  perform pg_temp.chk('C6 corregir pago', 'ok', pg_temp.fix(pg_temp.last_move(h, 1, 'payout'), 101));
  perform pg_temp.chk('C6 liquidación tras corregir', '0.00/101.00/paid_out', pg_temp.sp(s, 1));
  perform pg_temp.chk('C6 saldo en 0', '0.00', pg_temp.acc(h, 1));
  -- P3 is owed 31 (20 + the 10 of C4 + 1): paid 21, but it was 10 -> owed 21, no longer paid_out.
  perform public.settlement_payout(s, pg_temp.pl(h, 3), 21, 'cash', null, gen_random_uuid(), null);
  perform pg_temp.chk('C6 corregir a menos', 'ok', pg_temp.fix(pg_temp.last_move(h, 3, 'payout'), 10));
  perform pg_temp.chk('C6 vuelve a pendiente', '0.00/10.00/-', pg_temp.sp(s, 3));
  perform pg_temp.chk('C6 saldo a favor', '21.00', pg_temp.acc(h, 3));
  perform pg_temp.chk('C6 la corrección es de la liquidación', s::text, (
    select settlement_id::text from public.activity_log where corrects_id = pg_temp.last_move(h, 3, 'payout')));
  -- After the settlement closes, its moves are closed.
  perform public.settlement_payout(s, pg_temp.pl(h, 3), 11, 'cash', null, gen_random_uuid(), null);
  perform public.close_settlement(s, gen_random_uuid());
  perform pg_temp.chk('C6 liquidación cerrada', 'movement_closed',
    pg_temp.fix(pg_temp.last_move(h, 3, 'payout'), 5));

  -- C7: other rows can't be corrected ---------------------------------------
  perform pg_temp.chk('C7 no es caja', 'movement_not_correctable', pg_temp.fix(
    (select id from public.activity_log where game_session_id = s and type = 'game_session_started'), 5));
  perform pg_temp.chk('C7 no existe', 'movement_not_found', pg_temp.fix(-1, 5));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
