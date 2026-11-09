-- The player_removed row keeps the whole summary of the player's game
-- session, so the balance they leave with is explained on record:
--   note = {"opening", "recharges", "played", "prizes", "payouts", "transfers"}
--   opening + recharges - played + prizes + payouts + transfers = amount
-- (`amount` is still the closing balance; payouts are negative, transfers
-- signed, `played` is net of releases, of this removal's refund and of
-- unplayed round refunds). Notes of the two previous formats
-- (*_remove_player_balances.sql, *_remove_player_prizes.sql) are still read.
--
-- Same body as *_remove_player_prizes.sql otherwise; same signature.

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
  v_totals record;
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

  -- What moved their balance in this game session, by kind. With the
  -- opening balance they add up to the closing one (the reconciliation of
  -- player_accounts.sql / balance_transfers.sql); `played` is what their
  -- numbers cost, net of releases, of this removal's refund and of unplayed
  -- round refunds (adjustment).
  select
    coalesce(sum(a.amount) filter (where a.type = 'recharge'), 0) as recharges,
    coalesce(sum(a.amount) filter (where a.type in (
      'number_purchased', 'number_released', 'number_reassigned',
      'number_gifted', 'number_ungifted', 'carryover_kept'
    )), 0)
      - coalesce(sum(a.amount) filter (where a.type = 'adjustment'), 0) as played,
    coalesce(sum(a.amount) filter (where a.type = 'prize_won'), 0) as prizes,
    coalesce(sum(a.amount) filter (where a.type = 'payout'), 0) as payouts,
    coalesce(sum(a.amount) filter (where a.type = 'balance_transfer'), 0) as transfers
  into v_totals
  from public.activity_log a
  where a.game_session_id = p_game_session_id
    and a.player_id = p_player_id;

  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'player_removed',
    p_player_id => p_player_id, p_amount => v_closing,
    p_note => json_build_object(
      'opening', v_opening,
      'recharges', v_totals.recharges,
      'played', v_totals.played,
      'prizes', v_totals.prizes,
      'payouts', v_totals.payouts,
      'transfers', v_totals.transfers
    )::text
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
