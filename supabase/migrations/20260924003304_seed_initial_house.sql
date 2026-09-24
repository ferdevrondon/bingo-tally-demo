-- =============================================================================
-- BACKEND_PLAN.md Phase 1 — seed: the first house, its admin, and the catalog
-- that used to live in app/(app)/players/data.json and rounds/data.json.
--
-- The admin is looked up by email in exactly one place (seed_admin below).
-- It is temporary: to hand the house to another account later, add a new
-- migration that updates house_members (the one-admin index allows only one).
-- No observers yet; add them when their emails are known.
-- =============================================================================

with seed_admin as (
  select id from auth.users where email = 'ferdevrondon@gmail.com'
),
house as (
  insert into public.houses (name, identifier, timezone)
  values ('Casa Bingo ED', 'CASA-BINGO-ED', 'America/Mexico_City')
  returning id
),
admin_membership as (
  insert into public.house_members (house_id, user_id, role)
  select house.id, seed_admin.id, 'admin' from house, seed_admin
  returning house_id
),
seeded_players as (
  insert into public.players (house_id, name, username, payment_method)
  select house.id, p.name, p.username, p.payment_method
  from house,
    (values
      ('Juan amor', '@amor_j', 'paypal'),
      ('Maria Fernanda', '@mafer', 'credit_card'),
      ('Carlos Ruiz', '@carlosr', 'transfer'),
      ('Ana Torres', '@anatorres', 'paypal'),
      ('Luis Gómez', '@luisgomez', 'cash'),
      ('Sofía Castro', '@sofiacastro', 'debit_card'),
      ('Pedro Sánchez', '@pedrosanchez', 'paypal'),
      ('Valentina Ríos', '@valerios', 'transfer')
    ) as p (name, username, payment_method)
  returning id
)
insert into public.round_templates (house_id, name, kind, winner_count, line_price, prizes)
select house.id, r.name, r.kind, r.winner_count, 10, r.prizes
from house,
  (values
    ('Regular', 'regular', 1::smallint, array[100]::numeric(12, 2)[]),
    ('Especial', 'special', 2::smallint, array[100, 50]::numeric(12, 2)[])
  ) as r (name, kind, winner_count, prizes);

-- Fail the whole migration (nothing is committed) if the admin account does
-- not exist yet, instead of leaving a house without an admin.
do $$
begin
  if not exists (
    select 1 from public.house_members m
    join public.houses h on h.id = m.house_id
    where h.identifier = 'CASA-BINGO-ED' and m.role = 'admin'
  ) then
    raise exception 'seed admin ferdevrondon@gmail.com not found in auth.users';
  end if;
end;
$$;
