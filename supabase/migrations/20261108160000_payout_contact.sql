-- Contact of a payout (product owner, 2026-11-08): the email and phone are
-- often missing when a player is created, and the house writes them down when
-- it pays the player ("Registrar pago", in /players and in the settlement).
--
-- * activity_log.contact_email / contact_phone: the contact the payout went
--   to, written with the row (the ledger is append-only, like `bank` in
--   *_movement_bank.sql). Same checks as players.email / players.phone, and
--   only on payout rows.
-- * record_account_payout / settlement_payout take p_contact_email and
--   p_contact_phone (default null): they validate them, store them on the row
--   and copy what was given to the player (players.email / players.phone).
--   An empty value never clears the player's contact.
-- Additive: callers that don't send the contact keep working.

alter table public.activity_log
  add column contact_email text check (
    char_length(contact_email) <= 254 and contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  add column contact_phone text check (char_length(contact_phone) <= 30),
  add constraint activity_log_contact_check check (
    (contact_email is null and contact_phone is null) or type = 'payout'
  );

-- -----------------------------------------------------------------------------
-- 1. Ledger writer and cash helper: the contact of the move
-- -----------------------------------------------------------------------------

drop function private.log_activity(
  uuid, bigint, bigint, text, bigint, bigint, integer, bigint, numeric, text, text, text, bigint, bigint
);

create function private.log_activity(
  p_request_id uuid,
  p_house_id bigint,
  p_game_session_id bigint,
  p_type text,
  p_round_id bigint default null,
  p_ticket_id bigint default null,
  p_number integer default null,
  p_player_id bigint default null,
  p_amount numeric default null,
  p_payment_method text default null,
  p_note text default null,
  p_bank text default null,
  p_settlement_id bigint default null,
  p_corrects_id bigint default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns void
language sql
set search_path = ''
as $$
  insert into public.activity_log (
    request_id, house_id, game_session_id, type, round_id, ticket_id, number,
    player_id, amount, payment_method, note, bank, settlement_id, corrects_id,
    contact_email, contact_phone
  )
  values (
    p_request_id, p_house_id, p_game_session_id, p_type, p_round_id, p_ticket_id, p_number,
    p_player_id, p_amount, p_payment_method, p_note, p_bank, p_settlement_id, p_corrects_id,
    p_contact_email, p_contact_phone
  );
$$;

drop function private.record_cash(bigint, bigint, numeric, text, text, text, uuid, text, bigint);

create function private.record_cash(
  p_house_id bigint,
  p_player_id bigint,
  p_amount numeric,
  p_type text,
  p_payment_method text,
  p_note text,
  p_request_id uuid,
  p_bank text,
  p_settlement_id bigint default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_session_player public.game_session_players := private.active_session_player(p_house_id, p_player_id);
  v_balance numeric;
begin
  if v_session_player.id is not null then
    perform private.move_cash(v_session_player.id, p_amount);
    select gsp.balance into v_balance from public.game_session_players gsp where gsp.id = v_session_player.id;
  else
    perform private.move_account_cash(p_house_id, p_player_id, p_amount);
    select a.balance into v_balance from public.player_accounts a where a.player_id = p_player_id;
  end if;
  perform private.log_activity(
    p_request_id, p_house_id, v_session_player.game_session_id, p_type,
    p_round_id => (
      select r.id from public.game_session_rounds r
      where r.game_session_id = v_session_player.game_session_id and r.status = 'open'
    ),
    p_player_id => p_player_id, p_amount => p_amount,
    p_payment_method => p_payment_method, p_note => nullif(trim(p_note), ''),
    p_bank => p_bank, p_settlement_id => p_settlement_id,
    p_contact_email => p_contact_email, p_contact_phone => p_contact_phone
  );
  return v_balance;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. The contact: normalized like the players trigger, copied to the player
-- -----------------------------------------------------------------------------

-- Tidy a payout's contact (trimmed, email lowercased, empty -> null) and check
-- it; raises before anything is written.
create function private.normalize_payout_contact(
  p_email text,
  p_phone text,
  out email text,
  out phone text
)
language plpgsql
immutable
set search_path = ''
as $$
begin
  email := nullif(lower(btrim(p_email)), '');
  phone := nullif(btrim(p_phone), '');
  if email is not null
     and (char_length(email) > 254 or email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  if phone is not null and char_length(phone) > 30 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
end;
$$;

-- What the payout brought becomes the player's contact; nothing is cleared.
create function private.save_payout_contact(
  p_house_id bigint,
  p_player_id bigint,
  p_email text,
  p_phone text
)
returns void
language sql
set search_path = ''
as $$
  update public.players
  set email = coalesce(p_email, email),
      phone = coalesce(p_phone, phone)
  where id = p_player_id and house_id = p_house_id
    and (p_email is not null or p_phone is not null)
    and (email is distinct from coalesce(p_email, email)
         or phone is distinct from coalesce(p_phone, phone));
$$;

-- -----------------------------------------------------------------------------
-- 3. The payouts take the contact (bodies otherwise unchanged)
-- -----------------------------------------------------------------------------

drop function public.record_account_payout(bigint, numeric, text, text, uuid, text);

create function public.record_account_payout(
  p_player_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_request_id uuid,
  p_bank text default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house_id bigint := private.player_house(p_player_id);
  v_contact record;
begin
  perform private.require_admin(v_house_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  v_contact := private.normalize_payout_contact(p_contact_email, p_contact_phone);
  if not private.claim_request(p_request_id) then
    return;
  end if;
  perform private.record_cash(
    v_house_id, p_player_id, -p_amount, 'payout', p_payment_method, p_note, p_request_id, p_bank,
    p_contact_email => v_contact.email, p_contact_phone => v_contact.phone
  );
  perform private.save_payout_contact(v_house_id, p_player_id, v_contact.email, v_contact.phone);
end;
$$;

drop function public.settlement_payout(bigint, bigint, numeric, text, text, uuid, text);

create function public.settlement_payout(
  p_game_session_id bigint,
  p_player_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_request_id uuid,
  p_bank text default null,
  p_contact_email text default null,
  p_contact_phone text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_settlement public.settlements := private.lock_open_settlement(p_game_session_id);
  v_balance numeric;
  v_contact record;
begin
  perform private.lock_settlement_player(p_game_session_id, p_player_id);
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if p_payment_method is null then
    raise exception 'payment_method_required' using errcode = '22023';
  end if;
  v_contact := private.normalize_payout_contact(p_contact_email, p_contact_phone);
  if not private.claim_request(p_request_id) then
    return;
  end if;
  v_balance := private.record_cash(
    v_settlement.house_id, p_player_id, -p_amount, 'payout', p_payment_method, p_note,
    p_request_id, p_bank, p_game_session_id,
    p_contact_email => v_contact.email, p_contact_phone => v_contact.phone
  );
  perform private.save_payout_contact(
    v_settlement.house_id, p_player_id, v_contact.email, v_contact.phone
  );
  update public.settlement_players
  set paid = paid + p_amount,
      resolution = case when v_balance <= 0 then 'paid_out' else resolution end,
      note = case when v_balance <= 0 then null else note end,
      resolved_at = case when v_balance <= 0 then now() else resolved_at end
  where game_session_id = p_game_session_id and player_id = p_player_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Grants
-- -----------------------------------------------------------------------------

revoke all on function
  private.log_activity(
    uuid, bigint, bigint, text, bigint, bigint, integer, bigint, numeric, text, text, text, bigint, bigint,
    text, text
  ),
  private.record_cash(bigint, bigint, numeric, text, text, text, uuid, text, bigint, text, text),
  private.normalize_payout_contact(text, text),
  private.save_payout_contact(bigint, bigint, text, text)
from public, anon, authenticated;

revoke all on function
  public.record_account_payout(bigint, numeric, text, text, uuid, text, text, text),
  public.settlement_payout(bigint, bigint, numeric, text, text, uuid, text, text, text)
from public, anon;
grant execute on function
  public.record_account_payout(bigint, numeric, text, text, uuid, text, text, text),
  public.settlement_payout(bigint, bigint, numeric, text, text, uuid, text, text, text)
to authenticated;
