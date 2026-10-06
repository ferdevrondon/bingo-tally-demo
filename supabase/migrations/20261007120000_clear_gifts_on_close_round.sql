-- Gifts are cleared when a round closes (rule C: a gift lasts only its round).
--
-- Until now the is_gift flag stayed on in the new round until the player kept
-- or released their numbers (resolve_carryover turns it off), so the screen
-- still showed those numbers as gifts. close_round now clears the flag right
-- after the round's margin is computed. No money moves: resolve_carryover
-- already charges every kept number, gifts included, at the new price.
--
-- One-off cleanup: the flags of players who are waiting on that decision now
-- belong to a round that already closed.

create or replace function public.close_round(p_round_id bigint, p_next_round_template_id bigint, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_session_id bigint := private.round_game_session(p_round_id);
  v_house_id bigint := private.lock_game_session(v_game_session_id);
  v_round public.game_session_rounds;
  v_template public.round_templates;
  v_next_round_id bigint;
begin
  if not private.claim_request(p_request_id) then
    return (
      select a.round_id from public.activity_log a
      where a.request_id = private.request_id_for(p_request_id, 2)
    );
  end if;
  v_round := private.open_round(v_game_session_id);
  if v_round.id <> p_round_id then
    raise exception 'round_not_open';
  end if;
  if not private.round_fully_awarded(v_round) then
    raise exception 'round_in_progress';
  end if;
  v_template := private.round_template(v_house_id, p_next_round_template_id);

  perform private.close_played_round(
    v_house_id, v_round, p_request_id, private.request_id_for(p_request_id, 1)
  );
  -- A gift lasts only its round (rule C). The margin of the round was just
  -- computed from is_gift, and the history reads the ledger, so the flag can
  -- go now: the numbers show as normal ones in the new round and
  -- resolve_carryover charges every kept number the same either way.
  update public.ticket_numbers
  set is_gift = false
  where game_session_id = v_game_session_id and is_gift;
  v_next_round_id := private.insert_round(
    v_house_id, v_game_session_id, v_template, private.request_id_for(p_request_id, 2)
  );

  update public.game_session_players gsp
  set pending_carryover = true, checked_in = false
  where gsp.game_session_id = v_game_session_id
    and gsp.removed_at is null
    and exists (
      select 1 from public.ticket_numbers tn
      where tn.game_session_id = v_game_session_id and tn.player_id = gsp.player_id
    );
  return v_next_round_id;
end;
$$;

update public.ticket_numbers tn
set is_gift = false
from public.game_session_players gsp
where tn.is_gift
  and gsp.game_session_id = tn.game_session_id
  and gsp.player_id = tn.player_id
  and gsp.pending_carryover;
