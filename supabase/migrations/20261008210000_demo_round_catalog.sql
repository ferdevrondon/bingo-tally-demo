-- Demo house round catalog from the documented dynamics (product owner,
-- 2026-10-07). The seed (20261008150000_seed_demo_house.sql) had invented
-- rounds; none was played yet.
--
-- Dynamics: Regular = 1 prize of 10 × the line; Especial = 2 prizes of
-- 10 × and 5 × the line (played alternating Regular → Especial). Plus the
-- same two at a $20 line. "Doble" and "Gran Bingo" are deactivated, not
-- deleted. Only CASA-DEMO-DAIRY changes.

with house as (
  select id from public.houses where identifier = 'CASA-DEMO-DAIRY'
)
update public.round_templates r
set line_price = 10.00, prizes = array[100.00]::numeric(12, 2)[], active = true
from house where r.house_id = house.id and r.name = 'Regular';

with house as (
  select id from public.houses where identifier = 'CASA-DEMO-DAIRY'
)
update public.round_templates r
set line_price = 10.00, prizes = array[100.00, 50.00]::numeric(12, 2)[], active = true
from house where r.house_id = house.id and r.name = 'Especial';

with house as (
  select id from public.houses where identifier = 'CASA-DEMO-DAIRY'
)
update public.round_templates r
set active = false
from house where r.house_id = house.id and r.name in ('Doble', 'Gran Bingo');

insert into public.round_templates (house_id, name, line_price, prizes)
select h.id, t.name, t.line_price, t.prizes
from public.houses h,
  (values
    ('Regular $20', 20.00, array[200.00]::numeric(12, 2)[]),
    ('Especial $20', 20.00, array[200.00, 100.00]::numeric(12, 2)[])
  ) as t (name, line_price, prizes)
where h.identifier = 'CASA-DEMO-DAIRY';

-- Fail the whole migration unless the active catalog is exactly this.
do $$
declare
  v_catalog text;
begin
  select string_agg(r.name || ':' || r.line_price || ':' || array_to_string(r.prizes, '/'), ', ' order by r.name)
    into v_catalog
  from public.round_templates r
  join public.houses h on h.id = r.house_id
  where h.identifier = 'CASA-DEMO-DAIRY' and r.active;
  if v_catalog is distinct from
    'Especial:10.00:100.00/50.00, Especial $20:20.00:200.00/100.00, Regular:10.00:100.00, Regular $20:20.00:200.00'
  then
    raise exception 'Unexpected demo round catalog: %', v_catalog;
  end if;
end;
$$;
