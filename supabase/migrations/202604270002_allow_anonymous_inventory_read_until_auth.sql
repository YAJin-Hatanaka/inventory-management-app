drop policy if exists inventory_items_select_anon on public.inventory_items;
create policy inventory_items_select_anon
  on public.inventory_items
  for select
  to anon
  using (true);

drop policy if exists inventory_transactions_select_anon on public.inventory_transactions;
create policy inventory_transactions_select_anon
  on public.inventory_transactions
  for select
  to anon
  using (true);

grant select on public.inventory_stock_summary to anon;
