-- Integration test of removing and bringing back tickets
-- (migration *_remove_ticket.sql).
--
-- Runs as one query and ALWAYS ends with an exception, so nothing is saved:
-- the report comes back as the error message (REPORT ...). Same harness as
-- auto_assign_and_compact.sql: its own house, the admin's identity through
-- the JWT claims of the transaction. Run it with the SQL Editor or execute_sql.

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

create function pg_temp.active(p_sid bigint) returns text language sql as $$
  select coalesce(string_agg(index::text, ',' order by index), '')
  from public.tickets where game_session_id = p_sid and removed_at is null
$$;

create function pg_temp.rm(p_sid bigint, p_idx int) returns text language sql as $$
  select pg_temp.err(format('select public.remove_ticket(%s, %s, %L)', p_sid, pg_temp.tk(p_sid, p_idx), gen_random_uuid()))
$$;

create function pg_temp.logs(p_sid bigint, p_type text) returns text language sql as $$
  select count(*)::text from public.activity_log where game_session_id = p_sid and type = p_type
$$;

do $test$
declare
  v_admin uuid;
  v_sess uuid;
  s bigint;
  v_req uuid;
  v_t3 bigint;
  v_report text;
begin
  select user_id into v_admin from public.house_members where role = 'admin' limit 1;
  select session_id into v_sess from public.admin_auth_sessions where user_id = v_admin;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated', 'session_id', v_sess)::text, true);

  -- R1: remove an empty ticket, its rows stay ------------------------------
  s := pg_temp.mk('r1', 4);
  v_t3 := pg_temp.tk(s, 3);
  perform pg_temp.chk('R1 retirar cartón 4 vacío', 'ok', pg_temp.rm(s, 4));
  perform pg_temp.chk('R1 activos', '1,2,3', pg_temp.active(s));
  perform pg_temp.chk('R1 la fila del cartón 4 sigue', '15',
    (select count(*)::text from public.ticket_numbers where ticket_id = pg_temp.tk(s, 4)));
  perform pg_temp.chk('R1 log ticket_removed', '1', pg_temp.logs(s, 'ticket_removed'));
  perform pg_temp.chk('R1 ya retirado -> ticket_not_found', 'ticket_not_found', pg_temp.rm(s, 4));

  -- R2: idempotent by request_id -------------------------------------------
  v_req := gen_random_uuid();
  perform public.remove_ticket(s, v_t3, v_req);
  perform pg_temp.chk('R2 reintento con el mismo request_id', 'ok',
    pg_temp.err(format('select public.remove_ticket(%s, %s, %L)', s, v_t3, v_req)));
  perform pg_temp.chk('R2 un solo log', '2', pg_temp.logs(s, 'ticket_removed'));
  perform pg_temp.chk('R2 activos', '1,2', pg_temp.active(s));

  -- R3: add brings back the lowest removed index ---------------------------
  perform pg_temp.chk('R3 agregar devuelve el cartón 3', v_t3::text,
    public.add_ticket(s, gen_random_uuid())::text);
  perform pg_temp.chk('R3 activos', '1,2,3', pg_temp.active(s));
  perform pg_temp.chk('R3 log ticket_restored', '1', pg_temp.logs(s, 'ticket_restored'));
  perform public.add_ticket(s, gen_random_uuid());
  perform pg_temp.chk('R3 vuelve el 4', '1,2,3,4', pg_temp.active(s));
  perform public.add_ticket(s, gen_random_uuid());
  perform pg_temp.chk('R3 sin retirados se crea el 5', '1,2,3,4,5', pg_temp.active(s));
  perform pg_temp.chk('R3 total de filas de cartón', '5',
    (select count(*)::text from public.tickets where game_session_id = s));

  -- R4: not empty / last ticket --------------------------------------------
  s := pg_temp.mk('r4', 2);
  perform pg_temp.buy(s, 6, 1); perform pg_temp.buy(s, 6, 2);
  perform pg_temp.chk('R4 con jugadas -> ticket_not_empty', 'ticket_not_empty', pg_temp.rm(s, 2));
  perform pg_temp.rel(s, 2, 6, 2);
  perform pg_temp.chk('R4 liberado, ya se puede', 'ok', pg_temp.rm(s, 2));
  perform pg_temp.rel(s, 1, 6, 1);
  perform pg_temp.chk('R4 último cartón -> last_ticket', 'last_ticket', pg_temp.rm(s, 1));
  perform pg_temp.inv(s, 'R4', true, true);

  -- R5: purchases and compaction skip removed tickets ----------------------
  s := pg_temp.mk('r5', 3);
  perform pg_temp.buy(s, 6, 1);
  perform pg_temp.rm(s, 2);
  perform pg_temp.chk('R5 la compra salta el retirado', '3', pg_temp.buy(s, 6, 2));
  perform pg_temp.rel(s, 1, 6, 1);
  perform pg_temp.chk('R5 compactar baja al 1, no al retirado', '2,-,-', pg_temp.row_of(s, 6));
  perform pg_temp.rm(s, 3);
  perform pg_temp.chk('R5 sin lugar -> no_free_ticket', 'no_free_ticket',
    pg_temp.err(format('select public.record_purchase(%s, 6, %s, %L)', s, pg_temp.pl(s, 3), gen_random_uuid())));
  perform pg_temp.inv(s, 'R5', true, true);

  -- R6: open round with winning numbers ------------------------------------
  s := pg_temp.mk('r6', 3);
  update public.game_session_rounds set winning_numbers = array[5]::smallint[]
    where game_session_id = s and status = 'open';
  perform pg_temp.chk('R6 con ganadores -> round_has_winners', 'round_has_winners', pg_temp.rm(s, 3));

  -- R7: tickets_count snapshot when the round closes -----------------------
  s := pg_temp.mk('r7', 4);
  perform pg_temp.rm(s, 4);
  update public.game_session_rounds set status = 'closed', closed_at = now()
    where game_session_id = s and status = 'open';
  perform pg_temp.chk('R7 tickets_count al cerrar', '3',
    (select tickets_count::text from public.game_session_rounds where game_session_id = s));

  select string_agg(case when ok then 'OK    ' else 'FALLA ' end || name || '  (' || detail || ')', E'\n' order by n)
    into v_report from pg_temp.t_results;
  raise exception E'REPORT (todo revertido)\n%', v_report;
end
$test$;
