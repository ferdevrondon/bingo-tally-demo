-- =============================================================================
-- BACKEND_PLAN.md Phase 3 — first observer of "Casa Bingo ED".
--
-- The account signs in with email + password (created in the Supabase
-- dashboard, Authentication → Users). The observer is looked up by email in
-- exactly one place (seed_observer below). Observers read the whole house but
-- cannot write (RLS + private.is_house_admin).
-- =============================================================================

with seed_observer as (
  select id from auth.users where email = 'rondon.fernanda11@gmail.com'
),
house as (
  select id from public.houses where identifier = 'CASA-BINGO-ED'
)
insert into public.house_members (house_id, user_id, role)
select house.id, seed_observer.id, 'observer' from house, seed_observer
on conflict (house_id, user_id) do nothing;

-- Fail the whole migration if the account does not exist yet.
do $$
begin
  if not exists (
    select 1 from public.house_members m
    join public.houses h on h.id = m.house_id
    join auth.users u on u.id = m.user_id
    where h.identifier = 'CASA-BINGO-ED'
      and m.role = 'observer'
      and u.email = 'rondon.fernanda11@gmail.com'
  ) then
    raise exception 'seed observer rondon.fernanda11@gmail.com not found in auth.users';
  end if;
end;
$$;
