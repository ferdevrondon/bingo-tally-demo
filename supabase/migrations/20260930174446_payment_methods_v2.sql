-- Phase 6a2: payment methods v2 and the player's bank (BACKEND_PLAN.md,
-- decided with the product owner on 2026-09-30).
--
-- * Payment method (chosen on every recharge, collection and payout, and the
--   player's default): cash, zelle, venmo, majority, paypal, square, other.
-- * transfer, credit_card and debit_card are retired: ledger rows that
--   already carry them stay as they are (activity_log is immutable), but no
--   new row can use them. Players whose default was one of them move to other.
-- * The player's bank (players.bank, optional, edited on /players): chase,
--   bank_of_america, td_bank, wells_fargo, chime, other.

-- players ---------------------------------------------------------------------

update public.players
set payment_method = 'other'
where payment_method in ('transfer', 'credit_card', 'debit_card');

alter table public.players drop constraint players_payment_method_check;
alter table public.players add constraint players_payment_method_check
  check (payment_method in ('cash', 'zelle', 'venmo', 'majority', 'paypal', 'square', 'other'));

alter table public.players add column bank text
  constraint players_bank_check
  check (bank in ('chase', 'bank_of_america', 'td_bank', 'wells_fargo', 'chime', 'other'));

-- activity_log ----------------------------------------------------------------

alter table public.activity_log drop constraint activity_log_payment_method_check;
alter table public.activity_log add constraint activity_log_payment_method_check
  check (payment_method in (
    'cash', 'zelle', 'venmo', 'majority', 'paypal', 'square', 'other',
    -- retired: only on rows written before Phase 6a2
    'transfer', 'credit_card', 'debit_card'
  ));

-- New rows can't use a retired method, whichever function writes them.
create function private.reject_retired_payment_method()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_method in ('transfer', 'credit_card', 'debit_card') then
    raise exception 'payment_method_retired' using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function private.reject_retired_payment_method() from public, anon, authenticated;

create trigger activity_log_reject_retired_payment_method
  before insert on public.activity_log
  for each row execute function private.reject_retired_payment_method();
