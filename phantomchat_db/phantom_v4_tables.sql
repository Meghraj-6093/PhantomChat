-- ═══════════════════════════════════════════════════════════
--  PHANTOM v4 — NEW TABLES (Purpose-Bound Communities)
--  Run AFTER phantomChat.ini has been executed
--  Safe to re-run (uses IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════

-- ── PHANTOMS ────────────────────────────────────────────────
create table if not exists public.phantoms (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null,
  description   text,
  icon          text default '👻',
  banner_url    text,
  purpose       text,
  expires_at    timestamptz not null,
  timer_option  int default 10080,
  max_members   int default 50,
  is_public     boolean default false,
  archived      boolean default false,
  created_by    uuid not null references public.users(id) on delete cascade,
  created_at    timestamptz default now()
);

-- ── PHANTOM MEMBERS ──────────────────────────────────────────
create table if not exists public.phantom_members (
  id          uuid primary key default uuid_generate_v4(),
  phantom_id  uuid not null references public.phantoms(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        text default 'member' check (role in ('admin','moderator','member')),
  joined_at   timestamptz default now(),
  unique(phantom_id, user_id)
);

-- ── CHANNELS ──────────────────────────────────────────────────
create table if not exists public.channels (
  id          uuid primary key default uuid_generate_v4(),
  phantom_id  uuid not null references public.phantoms(id) on delete cascade,
  name        text not null,
  type        text not null check (type in ('text','voice','spatial','build_log')),
  position    int default 0,
  created_at  timestamptz default now()
);

-- ── TASKS ─────────────────────────────────────────────────────
create table if not exists public.tasks (
  id          uuid primary key default uuid_generate_v4(),
  phantom_id  uuid not null references public.phantoms(id) on delete cascade,
  created_by  uuid not null references public.users(id) on delete cascade,
  title       text not null,
  description text,
  assigned_to uuid references public.users(id),
  status      text default 'todo' check (status in ('todo','in_progress','done')),
  position    int default 0,
  due_at      timestamptz,
  created_at  timestamptz default now()
);

-- ── NOTES ─────────────────────────────────────────────────────
create table if not exists public.notes (
  id          uuid primary key default uuid_generate_v4(),
  phantom_id  uuid not null references public.phantoms(id) on delete cascade,
  created_by  uuid not null references public.users(id) on delete cascade,
  title       text not null,
  content     text,
  updated_at  timestamptz default now(),
  created_at  timestamptz default now()
);

-- ── PHANTOM FILES ─────────────────────────────────────────────
create table if not exists public.phantom_files (
  id          uuid primary key default uuid_generate_v4(),
  phantom_id  uuid not null references public.phantoms(id) on delete cascade,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  file_url    text not null,
  file_name   text not null,
  file_size   int,
  file_type   text,
  created_at  timestamptz default now()
);

-- ── BUILD LOG POSTS ───────────────────────────────────────────
create table if not exists public.build_posts (
  id            uuid primary key default uuid_generate_v4(),
  channel_id    uuid not null references public.channels(id) on delete cascade,
  phantom_id    uuid not null references public.phantoms(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  text_content  text,
  media_url     text,
  media_type    text default 'text',
  bg_color      text,
  expires_at    timestamptz not null default (now() + interval '48 hours'),
  created_at    timestamptz default now()
);

-- ── BUILD POST LIKES ─────────────────────────────────────────
create table if not exists public.build_likes (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references public.build_posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  unique(post_id, user_id)
);

-- ── BUILD POST COMMENTS ──────────────────────────────────────
create table if not exists public.build_comments (
  id         uuid primary key default uuid_generate_v4(),
  post_id    uuid not null references public.build_posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  text       text not null,
  created_at timestamptz default now()
);

-- ── TIME CAPSULES ─────────────────────────────────────────────
create table if not exists public.time_capsules (
  id          uuid primary key default uuid_generate_v4(),
  phantom_id  uuid not null references public.phantoms(id) on delete cascade,
  summary     jsonb,
  snapshot_at timestamptz default now()
);

-- ── MILESTONES ──────────────────────────────────────────────
create table if not exists public.milestones (
  id          uuid primary key default uuid_generate_v4(),
  phantom_id  uuid not null references public.phantoms(id) on delete cascade,
  title       text not null,
  reached     boolean default false,
  reached_at  timestamptz,
  created_at  timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════
--  REPLICA IDENTITY (for Supabase Realtime)
-- ═══════════════════════════════════════════════════════════
alter table public.phantoms        replica identity full;
alter table public.phantom_members  replica identity full;
alter table public.channels        replica identity full;
alter table public.build_posts     replica identity full;
alter table public.build_likes     replica identity full;
alter table public.build_comments  replica identity full;
alter table public.tasks           replica identity full;
alter table public.notes           replica identity full;
alter table public.phantom_files   replica identity full;
alter table public.time_capsules   replica identity full;
alter table public.milestones      replica identity full;

-- ═══════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════
alter table public.phantoms        enable row level security;
alter table public.phantom_members  enable row level security;
alter table public.channels        enable row level security;
alter table public.build_posts     enable row level security;
alter table public.build_likes     enable row level security;
alter table public.build_comments  enable row level security;
alter table public.tasks           enable row level security;
alter table public.notes           enable row level security;
alter table public.phantom_files   enable row level security;
alter table public.time_capsules   enable row level security;
alter table public.milestones      enable row level security;

-- ── Phantoms ────────────────────────────────────────────
drop policy if exists "phantoms_select" on public.phantoms;
drop policy if exists "phantoms_insert" on public.phantoms;
drop policy if exists "phantoms_update" on public.phantoms;
drop policy if exists "phantoms_delete" on public.phantoms;
create policy "phantoms_select" on public.phantoms for select using (
  auth.role() = 'authenticated'
  and (is_public = true or archived = false)
);
create policy "phantoms_insert" on public.phantoms for insert with check (auth.uid() = created_by);
create policy "phantoms_update" on public.phantoms for update using (auth.uid() = created_by);
create policy "phantoms_delete" on public.phantoms for delete using (auth.uid() = created_by);

-- ── Phantom Members ────────────────────────────────────
drop policy if exists "pmembers_select" on public.phantom_members;
drop policy if exists "pmembers_insert" on public.phantom_members;
drop policy if exists "pmembers_update" on public.phantom_members;
drop policy if exists "pmembers_delete" on public.phantom_members;
create policy "pmembers_select" on public.phantom_members for select using (auth.role() = 'authenticated');
create policy "pmembers_insert" on public.phantom_members for insert with check (auth.role() = 'authenticated');
create policy "pmembers_update" on public.phantom_members for update using (user_id = auth.uid() or auth.uid() in (
  select created_by from public.phantoms where id = phantom_id
));
create policy "pmembers_delete" on public.phantom_members for delete using (
  user_id = auth.uid() or auth.uid() in (
    select created_by from public.phantoms where id = phantom_id
  )
);

-- ── Channels ───────────────────────────────────────────
drop policy if exists "channels_select" on public.channels;
drop policy if exists "channels_insert" on public.channels;
drop policy if exists "channels_update" on public.channels;
drop policy if exists "channels_delete" on public.channels;
create policy "channels_select" on public.channels for select using (
  exists(select 1 from public.phantom_members where phantom_id = channels.phantom_id and user_id = auth.uid())
  or exists(select 1 from public.phantoms where id = channels.phantom_id and is_public = true)
);
create policy "channels_insert" on public.channels for insert with check (
  auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);
create policy "channels_update" on public.channels for update using (
  auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);
create policy "channels_delete" on public.channels for delete using (
  auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);

-- ── Build Posts ────────────────────────────────────────
drop policy if exists "bposts_select" on public.build_posts;
drop policy if exists "bposts_insert" on public.build_posts;
drop policy if exists "bposts_update" on public.build_posts;
drop policy if exists "bposts_delete" on public.build_posts;
create policy "bposts_select" on public.build_posts for select using (
  exists(select 1 from public.phantom_members where phantom_id = build_posts.phantom_id and user_id = auth.uid())
);
create policy "bposts_insert" on public.build_posts for insert with check (user_id = auth.uid());
create policy "bposts_update" on public.build_posts for update using (user_id = auth.uid());
create policy "bposts_delete" on public.build_posts for delete using (user_id = auth.uid());

-- ── Build Likes ────────────────────────────────────────
drop policy if exists "blikes_select" on public.build_likes;
drop policy if exists "blikes_insert" on public.build_likes;
drop policy if exists "blikes_delete" on public.build_likes;
create policy "blikes_select" on public.build_likes for select using (auth.role() = 'authenticated');
create policy "blikes_insert" on public.build_likes for insert with check (user_id = auth.uid());
create policy "blikes_delete" on public.build_likes for delete using (user_id = auth.uid());

-- ── Build Comments ─────────────────────────────────────
drop policy if exists "bcomments_select" on public.build_comments;
drop policy if exists "bcomments_insert" on public.build_comments;
drop policy if exists "bcomments_delete" on public.build_comments;
create policy "bcomments_select" on public.build_comments for select using (auth.role() = 'authenticated');
create policy "bcomments_insert" on public.build_comments for insert with check (user_id = auth.uid());
create policy "bcomments_delete" on public.build_comments for delete using (user_id = auth.uid());

-- ── Tasks ──────────────────────────────────────────────
drop policy if exists "tasks_select" on public.tasks;
drop policy if exists "tasks_insert" on public.tasks;
drop policy if exists "tasks_update" on public.tasks;
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_select" on public.tasks for select using (
  exists(select 1 from public.phantom_members where phantom_id = tasks.phantom_id and user_id = auth.uid())
);
create policy "tasks_insert" on public.tasks for insert with check (
  auth.role() = 'authenticated'
  and exists(select 1 from public.phantom_members where phantom_id = tasks.phantom_id and user_id = auth.uid())
);
create policy "tasks_update" on public.tasks for update using (
  auth.uid() = created_by
  or auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);
create policy "tasks_delete" on public.tasks for delete using (
  auth.uid() = created_by
  or auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);

-- ── Notes ──────────────────────────────────────────────
drop policy if exists "notes_select" on public.notes;
drop policy if exists "notes_insert" on public.notes;
drop policy if exists "notes_update" on public.notes;
drop policy if exists "notes_delete" on public.notes;
create policy "notes_select" on public.notes for select using (
  exists(select 1 from public.phantom_members where phantom_id = notes.phantom_id and user_id = auth.uid())
);
create policy "notes_insert" on public.notes for insert with check (
  auth.role() = 'authenticated'
  and exists(select 1 from public.phantom_members where phantom_id = notes.phantom_id and user_id = auth.uid())
);
create policy "notes_update" on public.notes for update using (
  auth.uid() = created_by
  or auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);
create policy "notes_delete" on public.notes for delete using (
  auth.uid() = created_by
  or auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);

-- ── Phantom Files ──────────────────────────────────────
drop policy if exists "pfiles_select" on public.phantom_files;
drop policy if exists "pfiles_insert" on public.phantom_files;
drop policy if exists "pfiles_delete" on public.phantom_files;
create policy "pfiles_select" on public.phantom_files for select using (
  exists(select 1 from public.phantom_members where phantom_id = phantom_files.phantom_id and user_id = auth.uid())
);
create policy "pfiles_insert" on public.phantom_files for insert with check (
  auth.role() = 'authenticated'
  and exists(select 1 from public.phantom_members where phantom_id = phantom_files.phantom_id and user_id = auth.uid())
);
create policy "pfiles_delete" on public.phantom_files for delete using (
  uploaded_by = auth.uid()
  or auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);

-- ── Time Capsules ──────────────────────────────────────
drop policy if exists "tcapsules_select" on public.time_capsules;
drop policy if exists "tcapsules_insert" on public.time_capsules;
create policy "tcapsules_select" on public.time_capsules for select using (
  exists(select 1 from public.phantom_members where phantom_id = time_capsules.phantom_id and user_id = auth.uid())
);
create policy "tcapsules_insert" on public.time_capsules for insert with check (
  auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);

-- ── Milestones ─────────────────────────────────────────
drop policy if exists "milestones_select" on public.milestones;
drop policy if exists "milestones_insert" on public.milestones;
drop policy if exists "milestones_update" on public.milestones;
drop policy if exists "milestones_delete" on public.milestones;
create policy "milestones_select" on public.milestones for select using (
  exists(select 1 from public.phantom_members where phantom_id = milestones.phantom_id and user_id = auth.uid())
);
create policy "milestones_insert" on public.milestones for insert with check (
  auth.role() = 'authenticated'
  and exists(select 1 from public.phantom_members where phantom_id = milestones.phantom_id and user_id = auth.uid())
);
create policy "milestones_update" on public.milestones for update using (
  auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);
create policy "milestones_delete" on public.milestones for delete using (
  auth.uid() in (select created_by from public.phantoms where id = phantom_id)
);

-- ═══════════════════════════════════════════════════════════
--  REALTIME PUBLICATION
-- ═══════════════════════════════════════════════════════════
do $$ begin alter publication supabase_realtime add table public.phantoms;        exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.phantom_members;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.channels;        exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.build_posts;     exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.build_likes;     exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.build_comments;  exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.tasks;           exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.notes;           exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.phantom_files;   exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.time_capsules;   exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.milestones;      exception when others then null; end $$;
