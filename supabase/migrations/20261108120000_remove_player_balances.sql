-- The player_removed row now says how the player leaves the game session:
-- `amount` is their balance after the removal (once the open round's plays are
-- voided) and `note` the balance they opened the game session with, as text.
-- Like balance_opened / balance_closed, a player_removed row is not money:
-- every sum over the ledger filters by type (saleAmount, end_game_session's
-- refunds, the cash lines), so its amount moves no total. Older rows keep
-- amount 0 and no note.
--
-- Same body as *_remove_player_voids_open_round.sql otherwise; same signature.

create or replace function public.remove_player(p_game_session_id bigint, p_player_id bigint, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_session_player_id bigint;
  v_pending boolean;
  v_round public.game_session_rounds;
  v_play record;
  v_numbers integer[] := '{}';
  v_number integer;
  v_n integer := 1;
  v_c integer := 1000;
  v_opening numeric;
  v_closing numeric;
begin
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_session_player_id := private.session_player(p_game_session_id, p_player_id);
  select gsp.pending_carryover into v_pending
  from public.game_session_players gsp where gsp.id = v_session_player_id;

  select r.* into v_round
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open'
  for update;

  if found and not v_pending then
    -- Void the open round's plays (apply_release must run while the player is
    -- still in the session).
    for v_play in
      select tn.ticket_id, tn.number
      from public.ticket_numbers tn
      join public.tickets t on t.id = tn.ticket_id
      where tn.game_session_id = p_game_session_id and tn.player_id = p_player_id
      order by t.index, tn.number
    loop
      perform private.apply_release(
        v_house_id, v_round, v_play.ticket_id, v_play.number, p_player_id,
        private.request_id_for(p_request_id, v_n)
      );
      v_n := v_n + 1;
      if not v_play.number = any(v_numbers) then
        v_numbers := v_numbers || v_play.number;
      end if;
    end loop;
  else
    select coalesce(array_agg(distinct tn.number order by tn.number), '{}') into v_numbers
    from public.ticket_numbers tn
    where tn.game_session_id = p_game_session_id and tn.player_id = p_player_id;
    update public.ticket_numbers
    set player_id = null, is_gift = false
    where game_session_id = p_game_session_id and player_id = p_player_id;
  end if;

  update public.game_session_players
  set removed_at = now(), checked_in = false, pending_carryover = false
  where id = v_session_player_id
  returning opening_balance, balance into v_opening, v_closing;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'player_removed',
    p_player_id => p_player_id, p_amount => v_closing, p_note => v_opening::text
  );

  foreach v_number in array v_numbers loop
    perform private.compact_line(
      v_house_id, p_game_session_id, v_number, private.request_id_for(p_request_id, v_c)
    );
    v_c := v_c + 1;
  end loop;
end;
$$;

revoke all on function public.remove_player(bigint, bigint, uuid) from public, anon;
grant execute on function public.remove_player(bigint, bigint, uuid) to authenticated;
