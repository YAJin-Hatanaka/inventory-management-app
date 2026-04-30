create extension if not exists pgcrypto;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_code bigint generated always as identity unique not null,
  name text unique not null,
  category text,
  unit text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_name_not_blank check (btrim(name) <> ''),
  constraint inventory_items_unit_not_blank check (btrim(unit) <> ''),
  constraint inventory_items_category_not_blank_when_present
    check (category is null or btrim(category) <> '')
);

create table if not exists public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  transaction_type text not null,
  quantity integer not null,
  transaction_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  constraint inventory_transactions_type_check
    check (transaction_type in ('inbound', 'outbound')),
  constraint inventory_transactions_quantity_check check (quantity >= 1),
  constraint inventory_transactions_note_not_blank_when_present
    check (note is null or btrim(note) <> '')
);

create index if not exists inventory_items_item_code_idx
  on public.inventory_items (item_code);

create index if not exists inventory_items_name_idx
  on public.inventory_items (name);

create index if not exists inventory_transactions_item_id_idx
  on public.inventory_transactions (item_id);

create index if not exists inventory_transactions_item_id_type_idx
  on public.inventory_transactions (item_id, transaction_type);

create index if not exists inventory_transactions_transaction_date_idx
  on public.inventory_transactions (transaction_date);

create or replace function public.set_inventory_items_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row
  execute function public.set_inventory_items_updated_at();

create or replace view public.inventory_stock_summary
with (security_invoker = true) as
select
  i.id as item_id,
  i.item_code,
  i.name,
  i.category,
  i.unit,
  coalesce(sum(t.quantity) filter (where t.transaction_type = 'inbound'), 0) as inbound_quantity,
  coalesce(sum(t.quantity) filter (where t.transaction_type = 'outbound'), 0) as outbound_quantity,
  coalesce(sum(t.quantity) filter (where t.transaction_type = 'inbound'), 0)
    - coalesce(sum(t.quantity) filter (where t.transaction_type = 'outbound'), 0) as current_quantity
from public.inventory_items i
left join public.inventory_transactions t on t.item_id = i.id
group by i.id, i.item_code, i.name, i.category, i.unit;

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists inventory_items_select_authenticated on public.inventory_items;
create policy inventory_items_select_authenticated
  on public.inventory_items
  for select
  to authenticated
  using (true);

drop policy if exists inventory_transactions_select_authenticated on public.inventory_transactions;
create policy inventory_transactions_select_authenticated
  on public.inventory_transactions
  for select
  to authenticated
  using (true);

grant select on public.inventory_stock_summary to authenticated;
