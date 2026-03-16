begin;

create table if not exists public.basics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  headline text,
  phone_number text,
  location text,
  desired_role text,
  experience_years integer,
  visibility text default 'PUBLIC',
  about text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.experience (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text,
  title text,
  location text,
  start_date date,
  end_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  technologies text[] not null default '{}',
  description text,
  github_link text,
  linkedin_link text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  organization text,
  issue_date date,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  description text,
  date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skills text[] not null default '{}',
  skill_levels jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  languages jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  interests text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_url text,
  uploaded_at timestamptz not null default now()
);

-- Enable RLS for all tables
alter table public.basics enable row level security;
alter table public.experience enable row level security;
alter table public.projects enable row level security;
alter table public.certifications enable row level security;
alter table public.achievements enable row level security;
alter table public.skills enable row level security;
alter table public.languages enable row level security;
alter table public.resumes enable row level security;

-- Policy builder helper
-- all operations restricted to owner where auth.uid() equals user_id

create policy if not exists "select_basics" on public.basics for select using (auth.uid() = user_id);
create policy if not exists "insert_basics" on public.basics for insert with check (auth.uid() = user_id);
create policy if not exists "update_basics" on public.basics for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_basics" on public.basics for delete using (auth.uid() = user_id);

create policy if not exists "select_experience" on public.experience for select using (auth.uid() = user_id);
create policy if not exists "insert_experience" on public.experience for insert with check (auth.uid() = user_id);
create policy if not exists "update_experience" on public.experience for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_experience" on public.experience for delete using (auth.uid() = user_id);

create policy if not exists "select_projects" on public.projects for select using (auth.uid() = user_id);
create policy if not exists "insert_projects" on public.projects for insert with check (auth.uid() = user_id);
create policy if not exists "update_projects" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_projects" on public.projects for delete using (auth.uid() = user_id);

create policy if not exists "select_certifications" on public.certifications for select using (auth.uid() = user_id);
create policy if not exists "insert_certifications" on public.certifications for insert with check (auth.uid() = user_id);
create policy if not exists "update_certifications" on public.certifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_certifications" on public.certifications for delete using (auth.uid() = user_id);

create policy if not exists "select_achievements" on public.achievements for select using (auth.uid() = user_id);
create policy if not exists "insert_achievements" on public.achievements for insert with check (auth.uid() = user_id);
create policy if not exists "update_achievements" on public.achievements for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_achievements" on public.achievements for delete using (auth.uid() = user_id);

create policy if not exists "select_skills" on public.skills for select using (auth.uid() = user_id);
create policy if not exists "insert_skills" on public.skills for insert with check (auth.uid() = user_id);
create policy if not exists "update_skills" on public.skills for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_skills" on public.skills for delete using (auth.uid() = user_id);

create policy if not exists "select_languages" on public.languages for select using (auth.uid() = user_id);
create policy if not exists "insert_languages" on public.languages for insert with check (auth.uid() = user_id);
create policy if not exists "update_languages" on public.languages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_languages" on public.languages for delete using (auth.uid() = user_id);

create policy if not exists "select_resumes" on public.resumes for select using (auth.uid() = user_id);
create policy if not exists "insert_resumes" on public.resumes for insert with check (auth.uid() = user_id);
create policy if not exists "update_resumes" on public.resumes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists "delete_resumes" on public.resumes for delete using (auth.uid() = user_id);

commit;
