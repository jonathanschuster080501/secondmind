-- ============================================================
-- SecondMind – Supabase Schema
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────
create extension if not exists "unaccent";          -- accent-insensitive FTS
create extension if not exists "pg_trgm";           -- optional: trigram similarity


-- ────────────────────────────────────────────────────────────
-- HELPER: auto-update updated_at
-- ────────────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ════════════════════════════════════════════════════════════
-- TABLE: categories
-- ════════════════════════════════════════════════════════════
create table if not exists categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  icon         text,
  color        text,
  entry_type   text check (entry_type in ('quick_note', 'todo', 'concept', 'diary', 'bullets')),
  created_at   timestamptz not null default now()
);

-- Indexes
create index if not exists categories_user_id_idx
  on categories (user_id);

create index if not exists categories_created_at_idx
  on categories (created_at desc);

-- RLS
alter table categories enable row level security;

create policy "categories: select own"
  on categories for select
  using (auth.uid() = user_id);

create policy "categories: insert own"
  on categories for insert
  with check (auth.uid() = user_id);

create policy "categories: update own"
  on categories for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "categories: delete own"
  on categories for delete
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- TABLE: entries
-- ════════════════════════════════════════════════════════════
create table if not exists entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null default '',
  content       text not null default '',
  category_id   uuid references categories(id) on delete set null,
  entry_type    text not null check (entry_type in ('quick_note', 'todo', 'concept', 'diary', 'bullets')),
  source        text not null default 'pwa' check (source in ('pwa', 'claude')),
  remind_at     timestamptz,
  search_vector tsvector generated always as (
                  to_tsvector('german', coalesce(title, '') || ' ' || coalesce(content, ''))
                ) stored,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Indexes
create index if not exists entries_user_id_idx
  on entries (user_id);

create index if not exists entries_created_at_idx
  on entries (created_at desc);

create index if not exists entries_user_created_idx
  on entries (user_id, created_at desc);

create index if not exists entries_category_idx
  on entries (category_id);

create index if not exists entries_search_vector_idx
  on entries using gin (search_vector);

-- Trigger: keep updated_at fresh
create trigger entries_updated_at
  before update on entries
  for each row
  execute function update_updated_at();

-- RLS
alter table entries enable row level security;

create policy "entries: select own"
  on entries for select
  using (auth.uid() = user_id);

create policy "entries: insert own"
  on entries for insert
  with check (auth.uid() = user_id);

create policy "entries: update own"
  on entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "entries: delete own"
  on entries for delete
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- TABLE: user_preferences
-- ════════════════════════════════════════════════════════════
create table if not exists user_preferences (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  theme       text not null default 'midnight_void'
                check (theme in ('midnight_void', 'paper_light')),
  layout      text not null default 'grid'
                check (layout in ('grid', 'list', 'kanban', 'timeline')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Trigger: keep updated_at fresh
create trigger user_preferences_updated_at
  before update on user_preferences
  for each row
  execute function update_updated_at();

-- RLS
alter table user_preferences enable row level security;

create policy "user_preferences: select own"
  on user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences: insert own"
  on user_preferences for insert
  with check (auth.uid() = user_id);

create policy "user_preferences: update own"
  on user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_preferences: delete own"
  on user_preferences for delete
  using (auth.uid() = user_id);


-- ════════════════════════════════════════════════════════════
-- HELPER FUNCTION: full-text search on entries
-- Usage: select * from search_entries('mein suchbegriff');
-- ════════════════════════════════════════════════════════════
create or replace function search_entries(query text)
returns setof entries
language sql
stable
security invoker
as $$
  select *
  from entries
  where user_id = auth.uid()
    and search_vector @@ websearch_to_tsquery('german', query)
  order by ts_rank(search_vector, websearch_to_tsquery('german', query)) desc,
           created_at desc;
$$;
