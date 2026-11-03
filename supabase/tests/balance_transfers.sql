-- Integration test of record_balance_transfer / void_balance_transfer
-- (migration *_balance_transfers.sql).
--
-- Runs as one query and ALWAYS ends with an exception, so nothing is saved:
-- the report comes back as the error message (REPORT ...). It builds its own
-- houses (never touches real data) and borrows the identity of the admin
-- through the JWT claims of the transaction, like movement_corrections.sql.
-- To dry-run the migration too, run the migration file first in the same
-- query (DDL is transactional).

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

-- Transfer from Pa to Pb; returns the error ('ok' when it succeeds).
create function pg_temp.tr(p_house bigint, p_from int, p_to int, p_amount numeric, p_req uuid default gen_random_uuid())
returns text language sql as $$
  select pg_temp.err(format('select public.record_balance_transfer(%s, %s, %s, null, %L)',
    pg_temp.pl(p_house, p_from), pg_temp.pl(p_house, p_to), p_amount, p_req))
$$;

-- transfer_id of the last transfer from Pa to Pb.
create function pg_temp.tid(p_house bigint, p_from int, p_to int) returns uuid language sql as $$
  select transfer_id from public.activity_log
  where house_id = p_house and type = 'balance_transfer' and corrects_id is null
    and player_id = pg_temp.pl(p_house, p_from) and counterparty_player_id = pg_temp.pl(p_house, p_to)
    and amount < 0
  order by id desc limit 1
$$;

create function pg_temp.void(p_tid uuid, p_reason text default 'error de dedo') returns text
language sql as $$
  select pg_temp.err(format('select public.void_balance_transfer(%L, %L, %L)', p_tid, p_reason, gen_random_uuid()))
$$;

-- Net of a type for a player, as every report sums it.
create function pg_temp.net(p_house bigint, p_n int, p_type text) returns text language sql as $$
  select coalesce(sum(amount), 0)::numeric(12, 2)::text from public.activity_log
  where house_id = p_house and player_id = pg_temp.pl(p_house, p_n) and type = p_type
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  v_claims text;
  h bigint;
  s bigint;
  t1 uuid;
  t2 uuid;
  t3 uuid;
  t4 uuid;
  t5 uuid;
  v_req uuid;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  v_claims := json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text;
  perform set_config('request.jwt.claims', v_claims, true);

  h := pg_temp.mk('t1');

  -- T1: both on the account -------------------------------------------------
  perform public.record_account_recharge(pg_temp.pl(h, 1), 100, 'cash', null, gen_random_uuid(), 'chase');
  perform pg_temp.chk('T1 mismo jugador', 'transfer_same_player', pg_temp.tr(h, 1, 1, 10));
  perform pg_temp.chk('T1 monto cero', 'invalid_amount', pg_temp.tr(h, 1, 2, 0));
  perform pg_temp.chk('T1 monto negativo', 'invalid_amount', pg_temp.tr(h, 1, 2, -5));
  perform pg_temp.chk('T1 sin saldo', 'insufficient_balance', pg_temp.tr(h, 3, 1, 1));
  perform pg_temp.chk('T1 más que su saldo', 'insufficient_balance', pg_temp.tr(h, 1, 2, 101));
  v_req := gen_random_uuid();
  perform pg_temp.chk('T1 transferir 40', 'ok', pg_temp.tr(h, 1, 2, 40, v_req));
  perform pg_temp.chk('T1 mismo request', 'ok', pg_temp.tr(h, 1, 2, 40, v_req));
  perform pg_temp.chk('T1 saldo emisor', '60.00', pg_temp.acc(h, 1));
  perform pg_temp.chk('T1 saldo receptor', '40.00', pg_temp.acc(h, 2));
  perform pg_temp.chk('T1 dos filas, una por jugador', '-40.00/40.00', (
    select string_agg(amount::numeric(12, 2)::text, '/' order by amount)
    from public.activity_log where type = 'balance_transfer' and house_id = h));
  perform pg_temp.chk('T1 fila del emisor: contraparte y sin jornada', 'P2/-', (
    select cp.name || '/' || coalesce(a.game_session_id::text, '-')
    from public.activity_log a join public.players cp on cp.id = a.counterparty_player_id
    where a.house_id = h and a.type = 'balance_transfer' and a.amount < 0));
  perform pg_temp.chk('T1 las dos filas comparten transfer_id', '1', (
    select count(distinct transfer_id)::text from public.activity_log
    where house_id = h and type = 'balance_transfer'));
  perform pg_temp.chk('T1 sin movimiento de caja: recargas del receptor', '0.00', pg_temp.net(h, 2, 'recharge'));
  perform pg_temp.chk('T1 sin movimiento de caja: pagos del receptor', '0.00', pg_temp.net(h, 2, 'payout'));
  perform pg_temp.chk('T1 recargas del emisor intactas', '100.00', pg_temp.net(h, 1, 'recharge'));
  perform pg_temp.chk('T1 el total de las cuentas no cambia', '100.00', (
    select coalesce(sum(balance), 0)::numeric(12, 2)::text from public.player_accounts where house_id = h));

  -- T2: the receiver has a debt (it goes down) -------------------------------
  perform public.record_account_payout(pg_temp.pl(h, 3), 30, 'cash', null, gen_random_uuid(), null);
  perform pg_temp.chk('T2 el receptor debe 30', '-30.00', pg_temp.acc(h, 3));
  perform pg_temp.chk('T2 transferir 20 a quien debe', 'ok', pg_temp.tr(h, 1, 3, 20));
  perform pg_temp.chk('T2 la deuda baja', '-10.00', pg_temp.acc(h, 3));
  perform pg_temp.chk('T2 saldo emisor', '40.00', pg_temp.acc(h, 1));

  -- T3: void ----------------------------------------------------------------
  t1 := pg_temp.tid(h, 1, 2);
  t2 := pg_temp.tid(h, 1, 3);
  perform pg_temp.chk('T3 sin motivo', 'reason_required', pg_temp.void(t1, '  '));
  perform pg_temp.chk('T3 no existe', 'transfer_not_found', pg_temp.void(gen_random_uuid()));
  perform pg_temp.chk('T3 anular', 'ok', pg_temp.void(t1));
  perform pg_temp.chk('T3 saldo emisor de vuelta', '80.00', pg_temp.acc(h, 1));
  perform pg_temp.chk('T3 saldo receptor de vuelta', '0.00', pg_temp.acc(h, 2));
  perform pg_temp.chk('T3 segunda anulación', 'transfer_already_voided', pg_temp.void(t1));
  perform pg_temp.chk('T3 las filas de anulación llevan motivo y enlace', '2/error de dedo', (
    select count(*)::text || '/' || min(note) from public.activity_log
    where corrects_id is not null and transfer_id = t1));
  perform pg_temp.chk('T3 neto de transferencias del emisor (-40 +40 -20)', '-20.00', pg_temp.net(h, 1, 'balance_transfer'));

  -- T4: the receiver spent it -----------------------------------------------
  perform pg_temp.tr(h, 1, 2, 10);
  t3 := pg_temp.tid(h, 1, 2);
  perform public.record_account_payout(pg_temp.pl(h, 2), 8, 'cash', null, gen_random_uuid(), null);
  perform pg_temp.chk('T4 receptor ya gastó', 'insufficient_balance', pg_temp.void(t3));
  perform pg_temp.chk('T4 saldos sin cambio', '70.00/2.00', pg_temp.acc(h, 1) || '/' || pg_temp.acc(h, 2));

  -- T5: not an admin ---------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', gen_random_uuid(), 'role', 'authenticated', 'session_id', gen_random_uuid())::text, true);
  perform pg_temp.chk('T5 no admin: transferir', 'not_admin', pg_temp.tr(h, 1, 2, 5));
  perform pg_temp.chk('T5 no admin: anular', 'not_admin', pg_temp.void(t2));
  perform set_config('request.jwt.claims', v_claims, true);

  -- T6: once a game session started, account transfers can't be voided -----
  s := public.start_game_session(h, gen_random_uuid());
  -- One transaction has a single now(): move the start past the transfers.
  update public.game_sessions set started_at = now() + interval '1 minute' where id = s;
  perform pg_temp.chk('T6 cuenta tras iniciar jornada', 'transfer_closed', pg_temp.void(t2));

  -- T7: mixed (sender in the game session, receiver on the account) -------
  perform public.record_recharge(s, pg_temp.pl(h, 1), 1, 'cash', null, gen_random_uuid(), null);
  perform pg_temp.chk('T7 P1 entra con su saldo + 1', '71.00', pg_temp.gsp(s, 1));
  perform pg_temp.chk('T7 mixto: sesión -> cuenta', 'ok', pg_temp.tr(h, 1, 2, 11));
  t4 := pg_temp.tid(h, 1, 2);
  perform pg_temp.chk('T7 saldo del emisor en la jornada', '60.00', pg_temp.gsp(s, 1));
  perform pg_temp.chk('T7 la cuenta del emisor no se toca', '70.00', pg_temp.acc(h, 1));
  perform pg_temp.chk('T7 cuenta del receptor', '13.00', pg_temp.acc(h, 2));
  perform pg_temp.chk('T7 cada fila lleva la jornada de su lado', s::text || '/-', (
    select string_agg(coalesce(game_session_id::text, '-'), '/' order by amount)
    from public.activity_log where transfer_id = t4));
  perform pg_temp.chk('T7 mixto: cuenta -> sesión', 'ok', pg_temp.tr(h, 2, 1, 3));
  t5 := pg_temp.tid(h, 2, 1);
  perform pg_temp.chk('T7 receptor en la jornada', '63.00', pg_temp.gsp(s, 1));
  perform pg_temp.chk('T7 cuenta del emisor', '10.00', pg_temp.acc(h, 2));

  -- T8: both in the game session -----------------------------------------------
  perform public.record_recharge(s, pg_temp.pl(h, 2), 1, 'cash', null, gen_random_uuid(), null);
  perform pg_temp.chk('T8 P2 entra con su saldo + 1', '11.00', pg_temp.gsp(s, 2));
  perform pg_temp.chk('T8 dentro de la jornada', 'ok', pg_temp.tr(h, 2, 1, 5));
  perform pg_temp.chk('T8 saldo emisor', '6.00', pg_temp.gsp(s, 2));
  perform pg_temp.chk('T8 saldo receptor', '68.00', pg_temp.gsp(s, 1));
  perform pg_temp.chk('T8 más que su saldo en la jornada', 'insufficient_balance', pg_temp.tr(h, 2, 1, 100));
  update public.game_session_players set pending_carryover = true
  where game_session_id = s and player_id = pg_temp.pl(h, 1);
  perform pg_temp.chk('T8 receptor con arrastre pendiente', 'pending_carryover', pg_temp.tr(h, 2, 1, 1));
  perform pg_temp.chk('T8 emisor con arrastre pendiente', 'pending_carryover', pg_temp.tr(h, 1, 2, 1));
  update public.game_session_players set pending_carryover = false
  where game_session_id = s and player_id = pg_temp.pl(h, 1);

  -- T9: void inside the game session ---------------------------------------
  perform pg_temp.chk('T9 anular dentro de la jornada', 'ok', pg_temp.void(pg_temp.tid(h, 2, 1), 'se equivocó de jugador'));
  perform pg_temp.chk('T9 saldos de vuelta', '11.00/63.00', pg_temp.gsp(s, 2) || '/' || pg_temp.gsp(s, 1));
  perform pg_temp.chk('T9 mixto cuando el receptor ya entró a la jornada', 'transfer_closed', pg_temp.void(t4));
  perform pg_temp.chk('T9 mixto cuando el emisor ya entró a la jornada', 'transfer_closed', pg_temp.void(t5));

  -- T10: end of the game session --------------------------------------------
  perform pg_temp.chk('T10 conciliación de P1: apertura + libro = saldo', 'true', (
    select (gsp.opening_balance + coalesce((
      select sum(a.amount) from public.activity_log a
      where a.game_session_id = s and a.player_id = gsp.player_id and a.type in ('recharge', 'balance_transfer')
    ), 0) = gsp.balance)::text
    from public.game_session_players gsp where gsp.game_session_id = s and gsp.player_id = pg_temp.pl(h, 1)));
  perform pg_temp.chk('T10 conciliación de P2', 'true', (
    select (gsp.opening_balance + coalesce((
      select sum(a.amount) from public.activity_log a
      where a.game_session_id = s and a.player_id = gsp.player_id and a.type in ('recharge', 'balance_transfer')
    ), 0) = gsp.balance)::text
    from public.game_session_players gsp where gsp.game_session_id = s and gsp.player_id = pg_temp.pl(h, 2)));
  perform pg_temp.chk('T10 la casa no ganó ni perdió por transferir', '0.00', (
    select house_balance::numeric(12, 2)::text from public.game_sessions where id = s));
  perform pg_temp.chk('T10 no se descarta una jornada con transferencias', 'game_session_has_payments', pg_temp.err(
    format('select public.discard_game_session(%s, %L)', s, gen_random_uuid())));
  perform public.end_game_session(s, gen_random_uuid());
  perform pg_temp.chk('T10 el saldo de la jornada vuelve a la cuenta', '63.00/11.00',
    pg_temp.acc(h, 1) || '/' || pg_temp.acc(h, 2));
  perform pg_temp.chk('T10 jornada cerrada: no se anula', 'transfer_closed', pg_temp.void(t5));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
