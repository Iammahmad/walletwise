alter table public.budget_categories
  add column if not exists category_ids uuid[] not null default '{}';

update public.budget_categories
set category_ids = array[source_category_id]
where source_category_id is not null
  and cardinality(category_ids) = 0;

alter table public.transactions
  add column if not exists budget_assignment_mode text not null default 'auto';

update public.transactions t
set budget_assignment_mode = case
  when t.type <> 'expense' or t.budget_category_id is null then 'none'
  when exists (
    select 1
    from public.budget_categories bc
    where bc.id = t.budget_category_id
      and bc.source_category_id = t.category_id
  ) then 'auto'
  else 'explicit'
end;

update public.transactions
set budget_category_id = null
where budget_assignment_mode = 'auto';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'budget_categories_category_ids_limit_check'
      and conrelid = 'public.budget_categories'::regclass
  ) then
    alter table public.budget_categories
      add constraint budget_categories_category_ids_limit_check
      check (cardinality(category_ids) <= 100);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_budget_assignment_mode_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_budget_assignment_mode_check
      check (budget_assignment_mode in ('auto', 'explicit', 'none'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_budget_assignment_consistency_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_budget_assignment_consistency_check
      check (
        (budget_assignment_mode = 'explicit' and budget_category_id is not null)
        or (budget_assignment_mode in ('auto', 'none') and budget_category_id is null)
      );
  end if;
end
$$;

create or replace function public.validate_finance_row_ownership()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'budget_categories' then
    if new.source_category_id is not null and not exists (
      select 1 from public.categories
      where id = new.source_category_id and user_id = new.user_id
    ) then
      raise exception 'Budget category source must belong to the same user';
    end if;
    if cardinality(new.category_ids) <> (
      select count(distinct member.category_id)
      from unnest(new.category_ids) as member(category_id)
    ) then
      raise exception 'Budget category members must be unique';
    end if;
    if exists (
      select 1
      from unnest(new.category_ids) as member(category_id)
      left join public.categories c on c.id = member.category_id
      where c.id is null
        or c.user_id <> new.user_id
        or c.transaction_type <> 'expense'
        or c.deleted_at is not null
    ) then
      raise exception 'Budget category members must be active expense categories owned by the same user';
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

create index if not exists budget_categories_category_ids_idx
  on public.budget_categories using gin(category_ids);
create index if not exists transactions_user_budget_assignment_idx
  on public.transactions(user_id, budget_assignment_mode, category_id, budget_category_id, occurred_at desc);
