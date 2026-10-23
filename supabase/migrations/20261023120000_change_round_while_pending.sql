-- The open round can be swapped while nothing in it has been charged: only
-- its own start and check-ins (no money) are allowed. Players with a pending
-- carryover decision are charged by resolve_carryover at the round's price
-- when they decide, so the new price applies. Mirrors canChangeRound()
-- (lib/round-draft/selectors.ts).
create or replace function public.start_round(p_game_session_id bigint, p_round_template_id bigint, p_request_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.lock_game_session(p_game_session_id);
  v_template public.round_templates;
  v_open public.game_session_rounds;
begin
  if not private.claim_request(p_request_id) then
    return (select a.round_id from public.activity_log a where a.request_id = p_request_id);
  end if;
  v_template := private.round_template(v_house_id, p_round_template_id);

  select r.* into v_open
  from public.game_session_rounds r
  where r.game_session_id = p_game_session_id and r.status = 'open'
  for update;
  if not found then
    return private.insert_round(v_house_id, p_game_session_id, v_template, p_request_id);
  end if;

  if private.round_has_awards(v_open) or exists (
    select 1 from public.activity_log a
    where a.round_id = v_open.id
      and a.type not in ('round_started', 'check_in', 'check_in_undone')
  ) then
    raise exception 'round_in_progress';
  end if;

  update public.game_session_rounds
  set round_template_id = v_template.id,
      name = v_template.name,
      line_price = v_template.line_price,
      prizes = v_template.prizes,
      winning_numbers = array_fill(null::smallint, array[cardinality(v_template.prizes)])
  where id = v_open.id;
  perform private.log_activity(
    p_request_id, v_house_id, p_game_session_id, 'round_started', p_round_id => v_open.id
  );
  return v_open.id;
end;
$$;
