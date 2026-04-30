create or replace function public.register_inbound_transaction(
  p_item_name text,
  p_quantity integer,
  p_transaction_date date,
  p_note text default null,
  p_unit text default '個',
  p_category text default 'その他'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_item_name text;
  v_unit text;
  v_category text;
  v_transaction_id uuid;
begin
  v_item_name := btrim(coalesce(p_item_name, ''));
  v_unit := btrim(coalesce(p_unit, '個'));
  v_category := btrim(coalesce(p_category, 'その他'));

  if v_item_name = '' then
    raise exception 'item_name is required';
  end if;

  if v_unit = '' then
    v_unit := '個';
  end if;

  if v_category = '' then
    v_category := 'その他';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'quantity must be greater than or equal to 1';
  end if;

  if p_transaction_date is null then
    raise exception 'transaction_date is required';
  end if;

  if p_note is not null and btrim(p_note) = '' then
    p_note := null;
  end if;

  insert into public.inventory_items (name, category, unit)
  values (v_item_name, v_category, v_unit)
  on conflict (name) do update
    set
      name = excluded.name,
      category = coalesce(public.inventory_items.category, excluded.category)
  returning id into v_item_id;

  insert into public.inventory_transactions (
    item_id,
    transaction_type,
    quantity,
    transaction_date,
    note
  )
  values (
    v_item_id,
    'inbound',
    p_quantity,
    p_transaction_date,
    p_note
  )
  returning id into v_transaction_id;

  return v_transaction_id;
end;
$$;

revoke execute on function public.register_inbound_transaction(
  text,
  integer,
  date,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.register_inbound_transaction(
  text,
  integer,
  date,
  text,
  text,
  text
) to service_role;
