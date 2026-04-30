create or replace function public.create_inventory_item(
  p_name text,
  p_category text default null,
  p_unit text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_name text;
  v_category text;
  v_unit text;
begin
  v_name := btrim(coalesce(p_name, ''));
  v_category := nullif(btrim(coalesce(p_category, '')), '');
  v_unit := btrim(coalesce(p_unit, ''));

  if v_name = '' then
    raise exception 'item_name is required';
  end if;

  if v_unit = '' then
    raise exception 'unit is required';
  end if;

  insert into public.inventory_items (name, category, unit)
  values (v_name, v_category, v_unit)
  returning id into v_item_id;

  return v_item_id;
exception
  when unique_violation then
    raise exception 'item_name already exists';
end;
$$;

create or replace function public.update_inventory_item(
  p_item_id uuid,
  p_name text,
  p_category text default null,
  p_unit text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_name text;
  v_category text;
  v_unit text;
begin
  if p_item_id is null then
    raise exception 'item_id is required';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  v_category := nullif(btrim(coalesce(p_category, '')), '');
  v_unit := btrim(coalesce(p_unit, ''));

  if v_name = '' then
    raise exception 'item_name is required';
  end if;

  if v_unit = '' then
    raise exception 'unit is required';
  end if;

  update public.inventory_items
  set
    name = v_name,
    category = v_category,
    unit = v_unit
  where id = p_item_id
  returning id into v_item_id;

  if v_item_id is null then
    raise exception 'item not found';
  end if;

  return v_item_id;
exception
  when unique_violation then
    raise exception 'item_name already exists';
end;
$$;

create or replace function public.delete_inventory_item(
  p_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
begin
  if p_item_id is null then
    raise exception 'item_id is required';
  end if;

  delete from public.inventory_items
  where id = p_item_id
  returning id into v_item_id;

  if v_item_id is null then
    raise exception 'item not found';
  end if;

  return v_item_id;
end;
$$;

revoke execute on function public.create_inventory_item(
  text,
  text,
  text
) from public, anon, authenticated;

revoke execute on function public.update_inventory_item(
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

revoke execute on function public.delete_inventory_item(
  uuid
) from public, anon, authenticated;

grant execute on function public.create_inventory_item(
  text,
  text,
  text
) to service_role;

grant execute on function public.update_inventory_item(
  uuid,
  text,
  text,
  text
) to service_role;

grant execute on function public.delete_inventory_item(
  uuid
) to service_role;
