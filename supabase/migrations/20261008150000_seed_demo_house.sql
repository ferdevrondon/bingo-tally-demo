-- =============================================================================
-- Demo house for the client's review (product owner, 2026-10-07).
--
-- "CASA DEMO DAIRY" lives in the same project as "Casa Bingo ED": RLS keeps
-- each house to its own members, and getCurrentHouse() opens the user's
-- oldest membership, so the demo account only ever sees this house.
--
-- Its admin is looked up by email in exactly one place (seed_admin below);
-- the account is created by hand in Authentication → Users first. To hand
-- the house to the client later, add a migration that updates house_members
-- (one admin per house).
--
-- A ready catalog and no game sessions: the client starts the first one.
-- Names are uppercased by the players trigger; banks and payment methods use
-- the current lists (lib/banks.ts, lib/payment-methods.ts).
-- =============================================================================

with seed_admin as (
  select id from auth.users where lower(email) = 'guiaaliadabingoo@gmail.com'
),
house as (
  insert into public.houses (name, identifier, timezone)
  values ('CASA DEMO DAIRY', 'CASA-DEMO-DAIRY', 'America/Chicago')
  returning id
),
admin_membership as (
  insert into public.house_members (house_id, user_id, role)
  select house.id, seed_admin.id, 'admin' from house, seed_admin
  returning house_id
),
seeded_players as (
  insert into public.players (house_id, name, nickname, payment_method, bank, is_vip)
  select house.id, p.name, p.nickname, p.payment_method, p.bank, p.is_vip
  from house,
    (values
      ('Rosa Martínez', 'ROSITA', 'zelle', 'chase', true),
      ('Miguel Herrera', 'MIKE', 'cash', null, false),
      ('Lucía Fernández', 'LUCY', 'venmo', 'bank_of_america', false),
      ('Jorge Ramírez', 'JR', 'zelle', 'wells_fargo', true),
      ('Patricia Gómez', 'PATY', 'paypal', 'chime', false),
      ('Daniel Torres', 'DANY', 'cash', null, false),
      ('Gabriela Ruiz', 'GABY', 'zelle', 'frost_bank', false),
      ('Fernando Castillo', 'FER', 'square', 'capital_one', false),
      ('Carmen Vargas', 'CARMEN', 'venmo', 'pnc_personal', false),
      ('Ricardo Mendoza', 'RICKY', 'majority', 'td_bank', false),
      ('Elena Morales', 'ELE', 'zelle', 'ufcu_bank', true),
      ('Alberto Silva', 'BETO', 'cash', 'other', false)
    ) as p (name, nickname, payment_method, bank, is_vip)
  returning id
)
insert into public.round_templates (house_id, name, line_price, prizes)
select house.id, r.name, r.line_price, r.prizes
from house,
  (values
    ('Regular', 10.00, array[50.00]::numeric(12, 2)[]),
    ('Doble', 10.00, array[50.00, 30.00]::numeric(12, 2)[]),
    ('Especial', 20.00, array[100.00, 50.00]::numeric(12, 2)[]),
    ('Gran Bingo', 25.00, array[150.00, 75.00, 40.00]::numeric(12, 2)[])
  ) as r (name, line_price, prizes);

-- Fail the whole migration if the admin account does not exist yet.
do $$
begin
  if not exists (
    select 1 from public.house_members m
    join public.houses h on h.id = m.house_id
    join auth.users u on u.id = m.user_id
    where h.identifier = 'CASA-DEMO-DAIRY'
      and m.role = 'admin'
      and lower(u.email) = 'guiaaliadabingoo@gmail.com'
  ) then
    raise exception 'Demo house admin not found: create guiaaliadabingoo@gmail.com in Authentication → Users first';
  end if;
end;
$$;
