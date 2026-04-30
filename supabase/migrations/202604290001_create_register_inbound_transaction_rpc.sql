create or replace function public.register_inbound_transaction(
  p_item_id uuid,
  p_quantity integer,
  p_transaction_date date,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_transaction_id uuid;
begin
  if p_item_id is null then
    raise exception 'item_id is required';
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

  if not exists (
    select 1
    from public.inventory_items
    where id = p_item_id
  ) then
    raise exception 'inventory item does not exist';
  end if;

  insert into public.inventory_transactions (
    item_id,
    transaction_type,
    quantity,
    transaction_date,
    note
  )
  values (
    p_item_id,
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
  uuid,
  integer,
  date,
  text
) from public, anon, authenticated;

grant execute on function public.register_inbound_transaction(
  uuid,
  integer,
  date,
  text
) to service_role;
