-- Integration test of the contact of a payout ("Registrar pago", migration
-- *_payout_contact.sql): stored on the ledger row and copied to the player.
--
-- Runs as one query and ALWAYS ends with an exception, so nothing is saved:
-- the report comes back as the error message (REPORT ...). Same harness as
-- recharge_checks_in.sql: its own house, the admin's identity through the JWT
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

-- A new house with 3 players (P2 already has a contact). Returns the house id.
create function pg_temp.mk_house(p_label text) returns bigint
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
  update public.players set email = 'viejo@mail.com', phone = '111'
    where house_id = v_house and name = 'P2';
  return v_house;
end $$;

create function pg_temp.pl(p_house bigint, p_n int) returns bigint language sql as
$$ select id from public.players where house_id = p_house and name = 'P' || p_n $$;

-- The player's contact: "email|phone".
create function pg_temp.player_contact(p_house bigint, p_n int) returns text language sql as $$
  select coalesce(email, '-') || '|' || coalesce(phone, '-') from public.players where id = pg_temp.pl(p_house, p_n)
$$;

-- The contact of the player's latest payout row: "email|phone".
create function pg_temp.row_contact(p_house bigint, p_n int) returns text language sql as $$
  select coalesce(contact_email, '-') || '|' || coalesce(contact_phone, '-')
  from public.activity_log
  where type = 'payout' and player_id = pg_temp.pl(p_house, p_n)
  order by id desc limit 1
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  h bigint;
  s bigint;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  h := pg_temp.mk_house('pc');

  -- K1: an account payout with a contact: on the row and on the player ------
  perform public.record_account_payout(pg_temp.pl(h, 1), 30, 'zelle', null, gen_random_uuid(), null,
    p_contact_email => '  Ana@Mail.COM ', p_contact_phone => ' 555 1234 ');
  perform pg_temp.chk('K1 fila con contacto', 'ana@mail.com|555 1234', pg_temp.row_contact(h, 1));
  perform pg_temp.chk('K1 jugador con contacto', 'ana@mail.com|555 1234', pg_temp.player_contact(h, 1));

  -- K2: an empty contact never clears the player's ---------------------------
  perform public.record_account_payout(pg_temp.pl(h, 2), 10, 'cash', null, gen_random_uuid(), null,
    p_contact_email => '', p_contact_phone => '  ');
  perform pg_temp.chk('K2 fila sin contacto', '-|-', pg_temp.row_contact(h, 2));
  perform pg_temp.chk('K2 jugador conserva el suyo', 'viejo@mail.com|111', pg_temp.player_contact(h, 2));

  -- K3: only the phone: the email stays, the phone changes -------------------
  perform public.record_account_payout(pg_temp.pl(h, 2), 10, 'cash', null, gen_random_uuid(), null,
    p_contact_phone => '222');
  perform pg_temp.chk('K3 jugador cambia solo el teléfono', 'viejo@mail.com|222', pg_temp.player_contact(h, 2));

  -- K4: an invalid email writes nothing --------------------------------------
  perform pg_temp.chk('K4 correo inválido', 'invalid_email', pg_temp.err(format(
    $q$select public.record_account_payout(%s, 10, 'cash', null, gen_random_uuid(), null, p_contact_email => 'no-es-correo')$q$,
    pg_temp.pl(h, 3))));
  perform pg_temp.chk('K4 sin pago', '0', (
    select count(*)::text from public.activity_log where type = 'payout' and player_id = pg_temp.pl(h, 3)));

  -- K5: the old call, without the contact, still works -----------------------
  perform public.record_account_payout(pg_temp.pl(h, 3), 5, 'cash', null, gen_random_uuid());
  perform pg_temp.chk('K5 pago sin contacto', '-|-', pg_temp.row_contact(h, 3));

  -- K6: a contact never goes on another kind of row ---------------------------
  perform pg_temp.chk('K6 recarga con contacto rechazada', 'violates', substring(pg_temp.err(format(
    $q$insert into public.activity_log (request_id, house_id, type, player_id, amount, payment_method, contact_phone)
       values (gen_random_uuid(), %s, 'recharge', %s, 1, 'cash', '1')$q$,
    h, pg_temp.pl(h, 3))) from 'violates'));

  -- K7: settlement_payout stores the contact too ------------------------------
  s := public.start_game_session(h, gen_random_uuid());
  perform public.record_recharge(s, pg_temp.pl(h, 3), 50, 'cash', null, gen_random_uuid());
  perform public.end_game_session(s, gen_random_uuid());
  perform public.settlement_payout(s, pg_temp.pl(h, 3), 20, 'paypal', null, gen_random_uuid(), 'chime',
    p_contact_email => 'p3@mail.com');
  perform pg_temp.chk('K7 fila de liquidación con contacto', 'p3@mail.com|-', pg_temp.row_contact(h, 3));
  perform pg_temp.chk('K7 jugador con correo', 'p3@mail.com|-', pg_temp.player_contact(h, 3));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
