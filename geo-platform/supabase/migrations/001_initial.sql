-- Enable extensions
create extension if not exists "uuid-ossp";

-- Workspaces
create table workspaces (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  plan text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_status text default 'inactive',
  seats integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Workspace members
create table workspace_members (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  invited_at timestamptz default now(),
  joined_at timestamptz,
  unique(workspace_id, user_id)
);

-- GEO Projects
create table geo_projects (
  id uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  url text not null,
  keywords text[] default '{}',
  brand text not null,
  competitors text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- GEO Scores (scan results)
create table geo_scores (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references geo_projects(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  total_score integer not null,
  ai_readability integer not null default 0,
  semantic_relevance integer not null default 0,
  authority_signals integer not null default 0,
  content_structure integer not null default 0,
  schema_implementation integer not null default 0,
  faq_optimization integer not null default 0,
  external_mentions integer not null default 0,
  citation_quality integer not null default 0,
  recommendations jsonb default '[]'
);

-- Full scan results (raw data)
create table scan_results (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references geo_projects(id) on delete cascade,
  geo_score_id uuid references geo_scores(id) on delete set null,
  scanned_at timestamptz not null default now(),
  url text not null,
  title text,
  meta_description text,
  schema_types text[] default '{}',
  has_faq boolean default false,
  has_how_to boolean default false,
  word_count integer default 0,
  reading_level text,
  internal_links integer default 0,
  external_links integer default 0,
  images_with_alt integer default 0,
  eeat_signals jsonb default '{}',
  issues jsonb default '[]',
  heading_structure jsonb default '[]'
);

-- AI Mentions
create table ai_mentions (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references geo_projects(id) on delete cascade,
  prompt text not null,
  platform text not null,
  mentioned boolean not null default false,
  position integer,
  snippet text,
  competitors_mentioned text[] default '{}',
  checked_at timestamptz not null default now()
);

-- Tracked Prompts
create table tracked_prompts (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references geo_projects(id) on delete cascade,
  prompt text not null,
  category text,
  is_active boolean default true,
  created_at timestamptz not null default now()
);

-- Content Pieces
create table content_pieces (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references geo_projects(id) on delete cascade,
  type text not null,
  topic text not null,
  content text not null,
  keywords text[] default '{}',
  schema_markup text,
  geo_score integer,
  created_at timestamptz not null default now()
);

-- Competitors
create table competitors (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references geo_projects(id) on delete cascade,
  name text not null,
  url text not null,
  last_scanned_at timestamptz,
  geo_score integer,
  scan_data jsonb
);

-- Authority Signals
create table authority_signals (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references geo_projects(id) on delete cascade,
  type text not null,
  source text not null,
  url text,
  description text,
  impact_score integer default 5,
  verified boolean default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index on geo_scores(project_id, scanned_at desc);
create index on ai_mentions(project_id, checked_at desc);
create index on scan_results(project_id, scanned_at desc);
create index on content_pieces(project_id, created_at desc);
create index on tracked_prompts(project_id);
create index on competitors(project_id);

-- Row level security
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
alter table geo_projects enable row level security;
alter table geo_scores enable row level security;
alter table scan_results enable row level security;
alter table ai_mentions enable row level security;
alter table tracked_prompts enable row level security;
alter table content_pieces enable row level security;
alter table competitors enable row level security;
alter table authority_signals enable row level security;

-- RLS policies: users can only access their own workspace data
create policy "workspace_owner" on workspaces
  for all using (owner_id = auth.uid());

create policy "workspace_member_read" on workspaces
  for select using (
    id in (select workspace_id from workspace_members where user_id = auth.uid())
  );

create policy "workspace_members_policy" on workspace_members
  for all using (
    workspace_id in (select id from workspaces where owner_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "geo_projects_policy" on geo_projects
  for all using (
    workspace_id in (
      select id from workspaces where owner_id = auth.uid()
      union
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );

create policy "geo_scores_policy" on geo_scores
  for all using (
    project_id in (
      select id from geo_projects where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
        union
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "scan_results_policy" on scan_results
  for all using (
    project_id in (
      select id from geo_projects where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
        union
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "ai_mentions_policy" on ai_mentions
  for all using (
    project_id in (
      select id from geo_projects where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
        union
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "tracked_prompts_policy" on tracked_prompts
  for all using (
    project_id in (
      select id from geo_projects where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
        union
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "content_pieces_policy" on content_pieces
  for all using (
    project_id in (
      select id from geo_projects where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
        union
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "competitors_policy" on competitors
  for all using (
    project_id in (
      select id from geo_projects where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
        union
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

create policy "authority_signals_policy" on authority_signals
  for all using (
    project_id in (
      select id from geo_projects where workspace_id in (
        select id from workspaces where owner_id = auth.uid()
        union
        select workspace_id from workspace_members where user_id = auth.uid()
      )
    )
  );

-- Function to auto-create workspace on user signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into workspaces (owner_id, name, plan)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)) || '''s Workspace', 'free');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_updated_at before update on workspaces
  for each row execute procedure update_updated_at();

create trigger geo_projects_updated_at before update on geo_projects
  for each row execute procedure update_updated_at();
