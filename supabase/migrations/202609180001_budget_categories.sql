create table if not exists public.budget_categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_category_id uuid references public.categories(id),
  name text not null check (char_length(name) between 1 and 80),
  icon text not null,
  color text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

insert into public.budget_categories
  (id, user_id, source_category_id, name, icon, color, created_at, updated_at, deleted_at)
select id, user_id, id, name, icon, color, created_at, updated_at, deleted_at
from public.categories
where transaction_type = 'expense'
on conflict (id) do nothing;

alter table public.transactions
  add column if not exists budget_category_id uuid references public.budget_categories(id);
alter table public.budgets
  add column if not exists budget_category_id uuid references public.budget_categories(id);

update public.transactions t
set budget_category_id = bc.id
from public.budget_categories bc
where t.type = 'expense'
  and t.budget_category_id is null
  and bc.user_id = t.user_id
  and bc.source_category_id = t.category_id;

update public.budgets b
set budget_category_id = bc.id
from public.budget_categories bc
where b.category_id is not null
  and b.budget_category_id is null
  and bc.user_id = b.user_id
  and bc.source_category_id = b.category_id;

create trigger budget_categories_updated_at
before update on public.budget_categories
for each row execute function public.set_updated_at();

create or replace function public.validate_finance_row_ownership()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'budget_categories' and new.source_category_id is not null then
    if not exists (
      select 1 from public.categories
      where id = new.source_category_id and user_id = new.user_id
    ) then
      raise exception 'Budget category source must belong to the same user';
    end if;
  elsif tg_table_name = 'transactions' then
    if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id)
      or not exists (select 1 from public.categories where id = new.category_id and user_id = new.user_id)
      or (new.budget_category_id is not null and not exists (
        select 1 from public.budget_categories
        where id = new.budget_category_id and user_id = new.user_id
      )) then
      raise exception 'Transaction relationships must belong to the same user';
    end if;
  elsif tg_table_name = 'budgets' and new.budget_category_id is not null then
    if not exists (
      select 1 from public.budget_categories
      where id = new.budget_category_id and user_id = new.user_id
    ) then
      raise exception 'Budget category must belong to the same user';
    end if;
  end if;
  return new;
end;
$$;

create trigger budget_categories_validate_ownership
before insert or update on public.budget_categories
for each row execute function public.validate_finance_row_ownership();

create unique index budget_categories_user_source_active_idx
  on public.budget_categories(user_id, source_category_id)
  where source_category_id is not null and deleted_at is null;
create index budget_categories_user_updated_idx
  on public.budget_categories(user_id, updated_at);
create index transactions_user_budget_category_idx
  on public.transactions(user_id, budget_category_id, occurred_at desc);
create index budgets_user_budget_category_idx
  on public.budgets(user_id, budget_category_id, start_date);

alter table public.budget_categories enable row level security;

create policy budget_categories_select_own on public.budget_categories
  for select using ((select auth.uid()) = user_id);
create policy budget_categories_insert_own on public.budget_categories
  for insert with check ((select auth.uid()) = user_id);
create policy budget_categories_update_own on public.budget_categories
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy budget_categories_delete_own on public.budget_categories
  for delete using ((select auth.uid()) = user_id);
