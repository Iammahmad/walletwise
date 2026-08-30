create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_currency text not null check (default_currency ~ '^[A-Z]{3}$'),
  locale text not null,
  timezone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  type text not null check (type in ('cash', 'bank', 'wallet', 'credit', 'other')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  opening_balance_minor bigint not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text not null,
  color text not null,
  transaction_type text not null check (transaction_type in ('expense', 'income')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  category_id uuid not null references public.categories(id),
  type text not null check (type in ('expense', 'income')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  merchant text check (merchant is null or char_length(merchant) <= 160),
  note text check (note is null or char_length(note) <= 500),
  occurred_at timestamptz not null,
  source text not null check (source in ('manual', 'voice')),
  original_transcript text check (original_transcript is null or char_length(original_transcript) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.budgets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  period text not null check (period = 'monthly'),
  start_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.ai_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  primary key (user_id, window_started_at)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.updated_at is null or new.updated_at <= old.updated_at then
    new.updated_at = greatest(now(), old.updated_at + interval '1 millisecond');
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger accounts_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger transactions_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger budgets_updated_at before update on public.budgets for each row execute function public.set_updated_at();

create or replace function public.validate_finance_row_ownership()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_table_name = 'transactions' then
    if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id)
      or not exists (select 1 from public.categories where id = new.category_id and user_id = new.user_id) then
      raise exception 'Transaction relationships must belong to the same user';
    end if;
  elsif tg_table_name = 'budgets' and new.category_id is not null then
    if not exists (select 1 from public.categories where id = new.category_id and user_id = new.user_id) then
      raise exception 'Budget category must belong to the same user';
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_validate_ownership before insert or update on public.transactions for each row execute function public.validate_finance_row_ownership();
create trigger budgets_validate_ownership before insert or update on public.budgets for each row execute function public.validate_finance_row_ownership();

create index accounts_user_updated_idx on public.accounts(user_id, updated_at);
create index categories_user_updated_idx on public.categories(user_id, updated_at);
create index transactions_user_occurred_idx on public.transactions(user_id, occurred_at desc);
create index transactions_user_updated_idx on public.transactions(user_id, updated_at);
create index transactions_filter_idx on public.transactions(user_id, type, account_id, category_id, occurred_at desc);
create index budgets_user_updated_idx on public.budgets(user_id, updated_at);

alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.ai_rate_limits enable row level security;

create policy profiles_select_own on public.profiles for select using ((select auth.uid()) = user_id);
create policy profiles_insert_own on public.profiles for insert with check ((select auth.uid()) = user_id);
create policy profiles_update_own on public.profiles for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profiles_delete_own on public.profiles for delete using ((select auth.uid()) = user_id);

create policy accounts_select_own on public.accounts for select using ((select auth.uid()) = user_id);
create policy accounts_insert_own on public.accounts for insert with check ((select auth.uid()) = user_id);
create policy accounts_update_own on public.accounts for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy accounts_delete_own on public.accounts for delete using ((select auth.uid()) = user_id);

create policy categories_select_own on public.categories for select using ((select auth.uid()) = user_id);
create policy categories_insert_own on public.categories for insert with check ((select auth.uid()) = user_id);
create policy categories_update_own on public.categories for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy categories_delete_own on public.categories for delete using ((select auth.uid()) = user_id);

create policy transactions_select_own on public.transactions for select using ((select auth.uid()) = user_id);
create policy transactions_insert_own on public.transactions for insert with check ((select auth.uid()) = user_id);
create policy transactions_update_own on public.transactions for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy transactions_delete_own on public.transactions for delete using ((select auth.uid()) = user_id);

create policy budgets_select_own on public.budgets for select using ((select auth.uid()) = user_id);
create policy budgets_insert_own on public.budgets for insert with check ((select auth.uid()) = user_id);
create policy budgets_update_own on public.budgets for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy budgets_delete_own on public.budgets for delete using ((select auth.uid()) = user_id);

-- No client policies are created for ai_rate_limits. Only the service role can access it.

create or replace function public.check_ai_rate_limit(p_user_id uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  bucket timestamptz := date_trunc('hour', now());
  new_count integer;
begin
  if p_limit < 1 or p_limit > 1000 then return false; end if;
  insert into public.ai_rate_limits(user_id, window_started_at, request_count)
  values (p_user_id, bucket, 1)
  on conflict (user_id, window_started_at)
  do update set request_count = public.ai_rate_limits.request_count + 1
  returning request_count into new_count;
  delete from public.ai_rate_limits where window_started_at < now() - interval '48 hours';
  return new_count <= p_limit;
end;
$$;

revoke all on function public.check_ai_rate_limit(uuid, integer) from public, anon, authenticated;
grant execute on function public.check_ai_rate_limit(uuid, integer) to service_role;

revoke all on table public.ai_rate_limits from anon, authenticated;
