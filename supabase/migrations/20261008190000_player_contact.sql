-- Player contact: phone and email (product owner, 2026-10-07; agreed in the
-- 2026-09-25 meeting). Only the name is required.
--
-- * players.phone (free text, up to 30) and players.email (up to 254, a basic
--   shape check). Both optional.
-- * The players trigger now also tidies them: the email trimmed and
--   lowercased, the phone trimmed, empty values become null.
-- Additive only: older code that doesn't send them keeps working.

alter table public.players
  add column phone text check (char_length(phone) <= 30),
  add column email text check (
    char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

create or replace function private.normalize_player_names()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := upper(btrim(new.name));
  new.nickname := nullif(upper(btrim(new.nickname)), '');
  new.phone := nullif(btrim(new.phone), '');
  new.email := nullif(lower(btrim(new.email)), '');
  return new;
end;
$$;

drop trigger players_normalize_names on public.players;
create trigger players_normalize_names
  before insert or update of name, nickname, phone, email on public.players
  for each row execute function private.normalize_player_names();
