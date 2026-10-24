-- Integration test of the house result on a cash basis: sales - prizes paid
-- (migration *_house_result_cash_basis.sql). 15 numbers of $10, prize $50.
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

create function pg_temp.buy(p_sid bigint, p_num int, p_n int) returns void
language plpgsql as $$
begin
  perform public.record_purchase(p_sid, p_num, pg_temp.pl(p_sid, p_n), gen_random_uuid());
end $$;

create function pg_temp.open_round(p_sid bigint) returns bigint language sql as $$
  select id from public.game_session_rounds where game_session_id = p_sid and status = 'open'
$$;

-- Numbers 1..p_sold bought by the players in turn.
create function pg_temp.sell(p_sid bigint, p_sold int) returns void
language plpgsql as $$
begin
  for i in 1..p_sold loop
    perform pg_temp.buy(p_sid, i, (i % 6) + 1);
  end loop;
end $$;

-- Every player must be checked in before a prize can be awarded.
create function pg_temp.checkin(p_sid bigint) returns void
language plpgsql as $$
begin
  for i in 1..6 loop
    perform public.record_check_in(p_sid, pg_temp.pl(p_sid, i), gen_random_uuid());
  end loop;
end $$;

create function pg_temp.house(p_sid bigint) returns text language sql as $$
  select house_balance::text from public.game_sessions where id = p_sid
$$;

create function pg_temp.margin(p_sid bigint) returns text language sql as $$
  select margin_adjustment::text from public.game_session_rounds where game_session_id = p_sid and seq = 1
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

  -- H1: 14 sold (140), a player wins 50, number 15 unsold: 140 - 50 = 90.
  s := pg_temp.mk('h1', 1);
  select id into v_tpl from public.round_templates where house_id = pg_temp.hid(s) limit 1;
  perform pg_temp.sell(s, 14);
  perform pg_temp.checkin(s);
  perform public.award_prize(pg_temp.open_round(s), 0, 1, gen_random_uuid());
  perform public.close_round(pg_temp.open_round(s), v_tpl, gen_random_uuid());
  perform pg_temp.chk('H1 sin vender no resta: 140 - 50', '90.00', pg_temp.house(s));
  perform pg_temp.chk('H1 margen de la ronda en 0', '0.00', pg_temp.margin(s));

  -- H2: the unsold number 15 wins: the house keeps the 140.
  s := pg_temp.mk('h2', 1);
  select id into v_tpl from public.round_templates where house_id = pg_temp.hid(s) limit 1;
  perform pg_temp.sell(s, 14);
  perform pg_temp.checkin(s);
  perform public.award_prize(pg_temp.open_round(s), 0, 15, gen_random_uuid());
  perform public.close_round(pg_temp.open_round(s), v_tpl, gen_random_uuid());
  perform pg_temp.chk('H2 gana el número de la casa: 140', '140.00', pg_temp.house(s));

  -- H3: 13 paid + number 14 gifted, 15 unsold; a paid number wins 50: 130 - 50 = 80.
  s := pg_temp.mk('h3', 1);
  select id into v_tpl from public.round_templates where house_id = pg_temp.hid(s) limit 1;
  perform pg_temp.sell(s, 14);
  perform public.toggle_gift(pg_temp.tk(s, 1), 14, pg_temp.pl(s, (14 % 6) + 1), gen_random_uuid());
  perform pg_temp.checkin(s);
  perform public.award_prize(pg_temp.open_round(s), 0, 1, gen_random_uuid());
  perform public.close_round(pg_temp.open_round(s), v_tpl, gen_random_uuid());
  perform pg_temp.chk('H3 regalo que no gana no resta: 130 - 50', '80.00', pg_temp.house(s));

  -- H4: the gifted number wins: pays 50 - 10 = 40, house 130 - 40 = 90.
  s := pg_temp.mk('h4', 1);
  select id into v_tpl from public.round_templates where house_id = pg_temp.hid(s) limit 1;
  perform pg_temp.sell(s, 14);
  perform public.toggle_gift(pg_temp.tk(s, 1), 14, pg_temp.pl(s, (14 % 6) + 1), gen_random_uuid());
  perform pg_temp.checkin(s);
  perform public.award_prize(pg_temp.open_round(s), 0, 14, gen_random_uuid());
  perform public.close_round(pg_temp.open_round(s), v_tpl, gen_random_uuid());
  perform pg_temp.chk('H4 regalo que gana paga premio - P: 130 - 40', '90.00', pg_temp.house(s));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
