-- ═══════════════════════════════════════════════════════════
--  PHANTOMCHAT v5 — DATABASE SCHEMA UPDATES
--  Run in Supabase SQL Editor to support the new features
-- ═══════════════════════════════════════════════════════════

-- ── 1. EXTEND USERS TABLE ───────────────────────────────────
alter table public.users add column if not exists role text default 'user' check (role in ('owner', 'admin', 'moderator', 'premium', 'user', 'guest'));
alter table public.users add column if not exists is_verified boolean default false;
alter table public.users add column if not exists is_banned boolean default false;
alter table public.users add column if not exists badge text default 'none';

-- Set first user as owner automatically if no other owner exists
create or replace function public.auto_set_owner()
returns trigger as $$
begin
  if not exists (select 1 from public.users where role = 'owner') then
    new.role := 'owner';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_user_signup_owner on public.users;
create trigger on_user_signup_owner
  before insert on public.users
  for each row execute function public.auto_set_owner();

-- ── 2. EXTEND CONVERSATIONS TABLE ────────────────────────────
alter table public.conversations add column if not exists tags text default '';
alter table public.conversations add column if not exists is_private boolean default false;
alter table public.conversations add column if not exists views int default 0;

-- ── 3. EXTEND MESSAGES TABLE ──────────────────────────────────
alter table public.messages add column if not exists starred_by uuid[] default '{}';
alter table public.messages add column if not exists thread_parent_id uuid references public.messages(id) on delete cascade;

-- ── 4. RLS POLICY OVERRIDES FOR ADMINS ────────────────────────

-- Reports Table policies: Admins/Moderators can select any report
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports for select using (
  auth.uid() = reporter_id
  or exists (
    select 1 from public.users u 
    where u.id = auth.uid() 
    and u.role in ('owner', 'admin', 'moderator')
  )
);

-- Users Table policies: Admins/Owners can update other users (ban/verify)
drop policy if exists "users_update" on public.users;
create policy "users_update" on public.users for update using (
  auth.uid() = id
  or exists (
    select 1 from public.users u 
    where u.id = auth.uid() 
    and u.role in ('owner', 'admin')
  )
);

-- Messages Table policies: Admins/Moderators can delete reported messages
drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages for delete using (
  sender_id = auth.uid()
  or exists (
    select 1 from public.users u 
    where u.id = auth.uid() 
    and u.role in ('owner', 'admin', 'moderator')
  )
);

-- Ensure all tables are exposed to real-time replication
alter table public.reports replica identity full;
do $$ begin alter publication supabase_realtime add table public.reports; exception when others then null; end $$;
