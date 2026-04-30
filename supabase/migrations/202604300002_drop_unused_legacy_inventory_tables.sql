drop view if exists public.inventory_list;

drop table if exists public.stock_movements;
drop table if exists public.items;

notify pgrst, 'reload schema';
