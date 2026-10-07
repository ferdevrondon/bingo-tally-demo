-- Players: nickname, names in uppercase and more banks (product owner,
-- 2026-10-07).
--
-- * players.username becomes players.nickname ("Nickname" in the UI). No SQL
--   function, view or policy reads it.
-- * The name and the nickname are always stored in uppercase: a trigger
--   normalizes every insert and update (trimmed, uppercase; an empty nickname
--   is null), and the existing rows go through it once here.
-- * players.bank keeps every bank and adds Capital One, First One Bank, UFCU
--   Bank, Regional Bank, Southwest Bank, SouthState Bank, Frost Bank, Mid Bank
--   and PNC (business and personal).

alter table public.players rename column username to nickname;

create or replace function private.normalize_player_names()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := upper(btrim(new.name));
  new.nickname := nullif(upper(btrim(new.nickname)), '');
  return new;
end;
$$;

create trigger players_normalize_names
  before insert or update of name, nickname on public.players
  for each row execute function private.normalize_player_names();

update public.players set name = name, nickname = nickname;

alter table public.players drop constraint players_bank_check;
alter table public.players add constraint players_bank_check
  check (bank in (
    'chase', 'bank_of_america', 'td_bank', 'wells_fargo', 'chime',
    'capital_one', 'first_one_bank', 'ufcu_bank', 'regional_bank', 'southwest_bank',
    'southstate_bank', 'frost_bank', 'mid_bank', 'pnc_business', 'pnc_personal',
    'other'
  ));
