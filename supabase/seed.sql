insert into public.inventory_items (name, category, unit)
values
  ('ニトリル手袋', '消耗品', '箱'),
  ('マスク', '消耗品', '箱'),
  ('消毒液', '衛生用品', '本'),
  ('コピー用紙', '事務用品', '冊')
on conflict (name) do nothing;

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 20, current_date, '初期入庫'
from public.inventory_items
where name = 'ニトリル手袋'
  and not exists (
    select 1
    from public.inventory_transactions
    where item_id = inventory_items.id
      and transaction_type = 'inbound'
      and quantity = 20
      and note = '初期入庫'
  );

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'outbound', 3, current_date, '初期出庫'
from public.inventory_items
where name = 'ニトリル手袋'
  and not exists (
    select 1
    from public.inventory_transactions
    where item_id = inventory_items.id
      and transaction_type = 'outbound'
      and quantity = 3
      and note = '初期出庫'
  );

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 15, current_date, '初期入庫'
from public.inventory_items
where name = 'マスク'
  and not exists (
    select 1
    from public.inventory_transactions
    where item_id = inventory_items.id
      and transaction_type = 'inbound'
      and quantity = 15
      and note = '初期入庫'
  );

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 8, current_date, '初期入庫'
from public.inventory_items
where name = '消毒液'
  and not exists (
    select 1
    from public.inventory_transactions
    where item_id = inventory_items.id
      and transaction_type = 'inbound'
      and quantity = 8
      and note = '初期入庫'
  );

insert into public.inventory_transactions (item_id, transaction_type, quantity, transaction_date, note)
select id, 'inbound', 12, current_date, '初期入庫'
from public.inventory_items
where name = 'コピー用紙'
  and not exists (
    select 1
    from public.inventory_transactions
    where item_id = inventory_items.id
      and transaction_type = 'inbound'
      and quantity = 12
      and note = '初期入庫'
  );
