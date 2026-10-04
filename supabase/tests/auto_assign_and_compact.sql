-- Integration test of the ticket auto-assignment and the row compaction
-- (migrations *_auto_assign_ticket.sql and *_compact_ticket_rows.sql).
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

create function pg_temp.bal(p_sid bigint, p_n int) returns text language sql as $$
  select balance::text from public.game_session_players
  where game_session_id = p_sid and player_id = pg_temp.pl(p_sid, p_n)
$$;

create function pg_temp.moved(p_sid bigint) returns text language sql as $$
  select count(*)::text || '/' || coalesce(sum(abs(amount)), 0)::text
  from public.activity_log where game_session_id = p_sid and type = 'number_moved'
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
        and ta.index < tb.index));
  end if;
  if p_money then
    perform pg_temp.chk(p_label || ' dinero conservado', '0.00', (
      select (coalesce((select sum(balance) from public.game_session_players where game_session_id = p_sid), 0)
              + (select house_balance from public.game_sessions where id = p_sid))::numeric(12, 2)::text));
  end if;
end $$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  s bigint;
  v_req uuid;
  v_r1 text;
  v_bal text;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  -- S1: purchases ------------------------------------------------------------
  s := pg_temp.mk('s1', 5);
  perform pg_temp.chk('S1 todo libre -> cartón 1', '1', pg_temp.buy(s, 6, 1));
  perform pg_temp.chk('S1 segunda compra -> cartón 2', '2', pg_temp.buy(s, 6, 2));
  perform pg_temp.chk('S1 fila de la línea 6', '1,2,-,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S1 independencia: línea 2 -> cartón 1', '1', pg_temp.buy(s, 2, 3));
  perform pg_temp.chk('S1 cuatro jugadas de la línea 4 -> 1,2,3,4',
    '1,2,3,4', pg_temp.buy(s, 4, 1) || ',' || pg_temp.buy(s, 4, 2) || ',' || pg_temp.buy(s, 4, 3) || ',' || pg_temp.buy(s, 4, 4));
  perform pg_temp.chk('S1 línea 0 rechazada', 'invalid_number',
    pg_temp.err(format('select public.record_purchase(%s, 0, %s, %L)', s, pg_temp.pl(s, 1), gen_random_uuid())));
  perform pg_temp.chk('S1 línea 16 rechazada', 'invalid_number',
    pg_temp.err(format('select public.record_purchase(%s, 16, %s, %L)', s, pg_temp.pl(s, 1), gen_random_uuid())));
  for i in 1..5 loop perform pg_temp.buy(s, 9, i); end loop;
  perform pg_temp.chk('S1 línea 9 llena en 5 cartones', '1,2,3,4,5', pg_temp.row_of(s, 9) );
  perform pg_temp.chk('S1 línea llena -> no_free_ticket', 'no_free_ticket',
    pg_temp.err(format('select public.record_purchase(%s, 9, %s, %L)', s, pg_temp.pl(s, 6), gen_random_uuid())));
  v_req := gen_random_uuid();
  v_r1 := public.record_purchase(s, 10, pg_temp.pl(s, 1), v_req)::text;
  v_bal := pg_temp.bal(s, 1);
  perform pg_temp.chk('S1 reintento idempotente: mismo cartón', v_r1, public.record_purchase(s, 10, pg_temp.pl(s, 1), v_req)::text);
  perform pg_temp.chk('S1 reintento no cobra dos veces', v_bal, pg_temp.bal(s, 1));
  perform pg_temp.chk('S1 línea 10 con una sola jugada', '1,-,-,-,-', pg_temp.row_of(s, 10));
  perform pg_temp.chk('S1 saldo de P1 (6, 4, 9 y 10)', '-40.00', pg_temp.bal(s, 1));
  perform pg_temp.inv(s, 'S1', true, true);

  -- S2: release compacts, the gift travels, no money moves -------------------
  s := pg_temp.mk('s2', 5);
  for i in 1..4 loop perform pg_temp.buy(s, 6, i); end loop;
  perform public.toggle_gift(pg_temp.tk(s, 3), 6, pg_temp.pl(s, 3), gen_random_uuid());
  perform pg_temp.chk('S2 antes de liberar', '1,2,3g,4,-', pg_temp.row_of(s, 6));
  perform pg_temp.rel(s, 1, 6, 1);
  perform pg_temp.chk('S2 tras liberar a P1', '2,3g,4,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S2 tres jugadas movidas, monto 0', '3/0.00', pg_temp.moved(s));
  perform pg_temp.chk('S2 origen de cada movimiento', '1<-2,2<-3,3<-4', (
    select string_agg(t.index || '<-' || a.note, ',' order by t.index)
    from public.activity_log a join public.tickets t on t.id = a.ticket_id
    where a.game_session_id = s and a.type = 'number_moved'));
  perform pg_temp.chk('S2 P1 reembolsado', '0.00', pg_temp.bal(s, 1));
  perform pg_temp.chk('S2 P2 sin cambio', '-10.00', pg_temp.bal(s, 2));
  perform pg_temp.chk('S2 P3 (regalo) sin cambio', '0.00', pg_temp.bal(s, 3));
  perform pg_temp.chk('S2 P4 sin cambio', '-10.00', pg_temp.bal(s, 4));
  perform pg_temp.inv(s, 'S2', true, true);
  perform pg_temp.rel(s, 3, 6, 4);
  perform pg_temp.chk('S2 liberar la última no mueve nada', '2,3g,-,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S2 sigue en 3 movimientos', '3/0.00', pg_temp.moved(s));
  perform pg_temp.inv(s, 'S2b', true, true);

  -- S3: old holes close the first time the line is compacted -----------------
  s := pg_temp.mk('s3', 5);
  for i in 1..4 loop perform pg_temp.buy(s, 6, i); end loop;
  update public.ticket_numbers set player_id = null, is_gift = false
    where ticket_id = pg_temp.tk(s, 2) and number = 6;
  perform pg_temp.chk('S3 hueco antiguo', '1,-,3,4,-', pg_temp.row_of(s, 6));
  perform pg_temp.rel(s, 1, 6, 1);
  perform pg_temp.chk('S3 hueco cerrado al compactar', '3,4,-,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.inv(s, 'S3', true, false);

  -- S4: the "Editar jugada" dialog ------------------------------------------
  s := pg_temp.mk('s4', 6);
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 6, 2);
  perform pg_temp.buy(s, 7, 1); perform pg_temp.buy(s, 7, 2);
  perform pg_temp.buy(s, 9, 1); perform pg_temp.buy(s, 9, 2);
  perform pg_temp.chk('S4 antes: línea 6', '1,1,2,-,-,-', pg_temp.row_of(s, 6));
  perform public.edit_player_numbers(s, pg_temp.pl(s, 1), jsonb_build_array(
    jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 6, 'owned', false, 'is_gift', false),
    jsonb_build_object('ticket_id', pg_temp.tk(s, 2), 'number', 6, 'owned', false, 'is_gift', false),
    jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 7, 'owned', false, 'is_gift', false),
    jsonb_build_object('ticket_id', pg_temp.tk(s, 5), 'number', 8, 'owned', true, 'is_gift', false),
    jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 9, 'owned', false, 'is_gift', false),
    jsonb_build_object('ticket_id', pg_temp.tk(s, 3), 'number', 9, 'owned', true, 'is_gift', false)
  ), gen_random_uuid());
  perform pg_temp.chk('S4 línea 6 compactada una vez', '2,-,-,-,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S4 línea 7 compactada', '2,-,-,-,-,-', pg_temp.row_of(s, 7));
  perform pg_temp.chk('S4 compra de la línea 8 ignora el cartón 5 -> cartón 1', '1,-,-,-,-,-', pg_temp.row_of(s, 8));
  perform pg_temp.chk('S4 liberar y comprar la línea 9 en la misma edición', '1,2,-,-,-,-', pg_temp.row_of(s, 9));
  perform pg_temp.chk('S4 saldo de P1', '-20.00', pg_temp.bal(s, 1));
  perform pg_temp.chk('S4 saldo de P2', '-30.00', pg_temp.bal(s, 2));
  perform pg_temp.chk('S4 movimientos (P2 en 6 y 7)', '2/0.00', pg_temp.moved(s));
  perform pg_temp.inv(s, 'S4', true, true);

  -- S5: removing a player ----------------------------------------------------
  s := pg_temp.mk('s5', 4);
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 7, 1);
  perform pg_temp.buy(s, 6, 2); perform pg_temp.buy(s, 7, 2);
  perform pg_temp.buy(s, 6, 3);
  perform public.remove_player(s, pg_temp.pl(s, 1), gen_random_uuid());
  perform pg_temp.chk('S5 línea 6 tras retirar a P1', '2,3,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S5 línea 7 tras retirar a P1', '2,-,-,-', pg_temp.row_of(s, 7));
  perform pg_temp.chk('S5 tres jugadas movidas', '3/0.00', pg_temp.moved(s));
  perform pg_temp.chk('S5 sin reembolso al retirar', '-20.00', pg_temp.bal(s, 1));

  -- S6: releasing while deciding the carry-over ------------------------------
  s := pg_temp.mk('s6', 4);
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 6, 2); perform pg_temp.buy(s, 6, 3);
  update public.game_session_players set pending_carryover = true
    where game_session_id = s and player_id = pg_temp.pl(s, 1);
  perform public.resolve_carryover(s, pg_temp.pl(s, 1),
    jsonb_build_array(jsonb_build_object('ticket_id', pg_temp.tk(s, 1), 'number', 6)), gen_random_uuid());
  perform pg_temp.chk('S6 línea 6 compactada', '2,3,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S6 dos jugadas movidas', '2/0.00', pg_temp.moved(s));

  -- S7: winning numbers already entered: no compaction -----------------------
  s := pg_temp.mk('s7', 4);
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 6, 2); perform pg_temp.buy(s, 6, 3);
  update public.game_session_rounds set winning_numbers = array[5]::smallint[]
    where game_session_id = s and status = 'open';
  perform pg_temp.rel(s, 1, 6, 1);
  perform pg_temp.chk('S7 con premios el hueco se queda', '-,2,3,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S7 sin movimientos', '0/0', pg_temp.moved(s));
  perform pg_temp.chk('S7 la siguiente compra llena el hueco', '1', pg_temp.buy(s, 6, 4));
  perform pg_temp.chk('S7 fila final', '4,2,3,-', pg_temp.row_of(s, 6));

  -- S8: handing a play to another player moves nothing -----------------------
  s := pg_temp.mk('s8', 4);
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 6, 2);
  perform public.reassign_number(pg_temp.tk(s, 1), 6, pg_temp.pl(s, 1), pg_temp.pl(s, 3), gen_random_uuid());
  perform pg_temp.chk('S8 reasignar no mueve', '3,2,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S8 sin number_moved', '0/0', pg_temp.moved(s));
  perform pg_temp.inv(s, 'S8', true, true);

  -- S9: the Ana / Beto / Caro / Dani example ---------------------------------
  s := pg_temp.mk('s9', 4);
  for i in 1..4 loop perform pg_temp.buy(s, 6, i); end loop;
  perform pg_temp.rel(s, 1, 6, 1);
  perform pg_temp.chk('S9 sale Ana', '2,3,4,-', pg_temp.row_of(s, 6));
  perform pg_temp.rel(s, 1, 6, 2);
  perform pg_temp.chk('S9 sale Beto', '3,4,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.chk('S9 Dani juega el 6 y cae en el cartón 3', '3', pg_temp.buy(s, 6, 5));
  perform pg_temp.chk('S9 fila final', '3,4,5,-', pg_temp.row_of(s, 6));
  perform pg_temp.inv(s, 'S9', true, true);

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
