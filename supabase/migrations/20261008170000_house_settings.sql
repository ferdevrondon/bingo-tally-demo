-- Configuración: the admin edits their house (product owner, 2026-10-07).
--
-- /settings was a prototype. Now the house admin edits the name, the
-- identifier, the time zone, a phone and a logo; observers only read them.
-- `houses` stays select-only for the app: writes go through these functions.
--
-- * houses.phone and houses.logo_path (the file's path in the house-logos
--   bucket). Both optional.
-- * update_house / set_house_logo: admin only (single admin session), by
--   request_id, each leaves a `house_updated` ledger row (no game session) so
--   every open screen refreshes (LiveRefresh), like any other write.
-- * Storage bucket house-logos: public read (a logo isn't sensitive and shows
--   without signed URLs), 1 MB, images only; only the house admin writes
--   under `{house_id}/`.
-- Additive only: no existing call changes.

alter table public.houses
  add column phone text check (char_length(phone) <= 30),
  add column logo_path text check (char_length(logo_path) <= 200);

alter table public.activity_log
  drop constraint activity_log_type_check,
  add constraint activity_log_type_check check (type in (
    'game_session_started', 'game_session_ended',
    'player_added', 'player_removed',
    'ticket_added',
    'number_purchased', 'number_released', 'number_reassigned', 'number_moved',
    'number_gifted', 'number_ungifted',
    'recharge', 'check_in', 'check_in_undone',
    'round_started', 'round_closed', 'prize_won', 'margin_adjustment',
    'carryover_kept', 'carryover_released',
    'payout', 'adjustment',
    'balance_opened', 'balance_closed',
    'credit_kept_for_play', 'credit_payout_pending', 'debt_noted',
    'settlement_closed',
    'house_updated'
  )),
  drop constraint activity_log_game_session_check,
  add constraint activity_log_game_session_check check (
    game_session_id is not null
    or type in (
      'recharge', 'payout', 'credit_kept_for_play', 'credit_payout_pending', 'debt_noted',
      'house_updated'
    )
  );

-- -----------------------------------------------------------------------------
-- 1. House details
-- -----------------------------------------------------------------------------

create function public.update_house(
  p_house_id bigint,
  p_name text,
  p_identifier text,
  p_timezone text,
  p_phone text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(p_name);
  v_identifier text := upper(btrim(p_identifier));
  v_phone text := nullif(btrim(p_phone), '');
begin
  perform private.require_admin(p_house_id);
  if v_name is null or char_length(v_name) not between 1 and 60 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;
  if v_identifier is null or v_identifier !~ '^[A-Z0-9-]{3,30}$' then
    raise exception 'invalid_identifier' using errcode = '22023';
  end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  if v_phone is not null and char_length(v_phone) > 30 then
    raise exception 'invalid_phone' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.houses h where h.identifier = v_identifier and h.id <> p_house_id
  ) then
    raise exception 'identifier_taken' using errcode = '23505';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;

  update public.houses
  set name = v_name, identifier = v_identifier, timezone = p_timezone, phone = v_phone
  where id = p_house_id;

  perform private.log_activity(p_request_id, p_house_id, null, 'house_updated');
end;
$$;

-- The logo's path in house-logos (uploaded first by the admin), or null to
-- remove it.
create function public.set_house_logo(
  p_house_id bigint,
  p_logo_path text,
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin(p_house_id);
  if p_logo_path is not null
    and (p_logo_path !~ ('^' || p_house_id || '/[A-Za-z0-9._-]+$') or char_length(p_logo_path) > 200)
  then
    raise exception 'invalid_logo_path' using errcode = '22023';
  end if;
  if not private.claim_request(p_request_id) then
    return;
  end if;

  update public.houses set logo_path = p_logo_path where id = p_house_id;

  perform private.log_activity(p_request_id, p_house_id, null, 'house_updated');
end;
$$;

revoke all on function
  public.update_house(bigint, text, text, text, text, uuid),
  public.set_house_logo(bigint, text, uuid)
from public, anon;
grant execute on function
  public.update_house(bigint, text, text, text, text, uuid),
  public.set_house_logo(bigint, text, uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Logo storage
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'house-logos', 'house-logos', true, 1048576,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
);

-- The first folder of the path is the house id; only its admin writes there
-- (and lists it, which removing a file needs). Reads go through the public
-- URL. A folder that isn't a number never matches.
create function private.is_logo_admin(p_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when (storage.foldername(p_name))[1] ~ '^[0-9]+$'
      then private.is_house_admin(((storage.foldername(p_name))[1])::bigint)
    else false
  end;
$$;

create policy "house-logos: admin reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'house-logos' and private.is_logo_admin(name));

create policy "house-logos: admin inserts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'house-logos' and private.is_logo_admin(name));

create policy "house-logos: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'house-logos' and private.is_logo_admin(name));

revoke all on function private.is_logo_admin(text) from public, anon;
grant execute on function private.is_logo_admin(text) to authenticated;
