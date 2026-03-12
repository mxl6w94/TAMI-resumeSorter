-- TAMI v2 — Initial Schema Migration
-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- ─── resumes ──────────────────────────────────────────────────────────────────
create table public.resumes (
  id                uuid primary key default uuid_generate_v4(),
  file_hash         text not null unique,       -- sha256; deduplication key
  file_name         text not null,
  file_url          text not null,
  file_size_bytes   integer not null check (file_size_bytes <= 5242880),  -- 5 MB
  page_count        integer not null check (page_count <= 50),
  raw_text          text,
  uploaded_by       uuid not null references auth.users(id) on delete cascade,
  created_at        timestamptz not null default now()
);

-- ─── folders ──────────────────────────────────────────────────────────────────
create table public.folders (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── folder_resumes (many-to-many join) ───────────────────────────────────────
create table public.folder_resumes (
  folder_id  uuid not null references public.folders(id) on delete cascade,
  resume_id  uuid not null references public.resumes(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (folder_id, resume_id)
);

-- ─── criteria_units ───────────────────────────────────────────────────────────
create type public.evaluation_type as enum ('keyword_match', 'semantic_match', 'manual');

create table public.criteria_units (
  id               uuid primary key default uuid_generate_v4(),
  folder_id        uuid not null references public.folders(id) on delete cascade,
  name             text not null,
  description      text,
  is_ai_powered    boolean not null default true,
  weight           integer not null check (weight between 1 and 100),
  evaluation_type  public.evaluation_type not null default 'semantic_match',
  prompt           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Enforce: all criteria weights for a folder must sum to exactly 100
create or replace function public.check_criteria_weight_sum()
returns trigger language plpgsql as $$
declare
  total integer;
begin
  select coalesce(sum(weight), 0)
    into total
    from public.criteria_units
   where folder_id = coalesce(new.folder_id, old.folder_id);

  if total > 100 then
    raise exception 'Criteria weights for folder exceed 100 (current sum: %)', total;
  end if;
  return coalesce(new, old);
end;
$$;

create constraint trigger criteria_weight_sum_check
  after insert or update or delete on public.criteria_units
  deferrable initially deferred
  for each row execute function public.check_criteria_weight_sum();

-- ─── evaluations ──────────────────────────────────────────────────────────────
create type public.analysis_status as enum ('pending', 'processing', 'completed', 'failed');

create table public.evaluations (
  id                uuid primary key default uuid_generate_v4(),
  folder_id         uuid not null references public.folders(id) on delete cascade,
  resume_id         uuid not null references public.resumes(id) on delete cascade,
  criteria_unit_id  uuid not null references public.criteria_units(id) on delete cascade,
  score             numeric(5,2) not null default 0 check (score between 0 and 100),
  justification     text,
  exact_quote       text,
  status            public.analysis_status not null default 'pending',
  error_message     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (folder_id, resume_id, criteria_unit_id)
);

-- ─── resume_chunks (pgvector RAG) ─────────────────────────────────────────────
create table public.resume_chunks (
  id           uuid primary key default uuid_generate_v4(),
  resume_id    uuid not null references public.resumes(id) on delete cascade,
  chunk_index  integer not null,
  chunk_text   text not null,
  embedding    vector(1536),      -- text-embedding-3-small dimensions
  created_at   timestamptz not null default now(),
  unique (resume_id, chunk_index)
);

-- IVFFlat index for fast approximate nearest-neighbor search
create index resume_chunks_embedding_idx
  on public.resume_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- ─── updated_at triggers ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger folders_updated_at
  before update on public.folders
  for each row execute function public.set_updated_at();

create trigger criteria_units_updated_at
  before update on public.criteria_units
  for each row execute function public.set_updated_at();

create trigger evaluations_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.resumes        enable row level security;
alter table public.folders        enable row level security;
alter table public.folder_resumes enable row level security;
alter table public.criteria_units enable row level security;
alter table public.evaluations    enable row level security;
alter table public.resume_chunks  enable row level security;

-- resumes: owner full access
create policy "resumes: owner access"
  on public.resumes for all
  using (uploaded_by = auth.uid());

-- folders: owner full access
create policy "folders: owner access"
  on public.folders for all
  using (owner_id = auth.uid());

-- folder_resumes: folder owner access
create policy "folder_resumes: folder owner access"
  on public.folder_resumes for all
  using (
    exists (
      select 1 from public.folders f
       where f.id = folder_id and f.owner_id = auth.uid()
    )
  );

-- criteria_units: folder owner access
create policy "criteria_units: folder owner access"
  on public.criteria_units for all
  using (
    exists (
      select 1 from public.folders f
       where f.id = folder_id and f.owner_id = auth.uid()
    )
  );

-- evaluations: folder owner access
create policy "evaluations: folder owner access"
  on public.evaluations for all
  using (
    exists (
      select 1 from public.folders f
       where f.id = folder_id and f.owner_id = auth.uid()
    )
  );

-- resume_chunks: resume owner access
create policy "resume_chunks: resume owner access"
  on public.resume_chunks for all
  using (
    exists (
      select 1 from public.resumes r
       where r.id = resume_id and r.uploaded_by = auth.uid()
    )
  );

-- ─── Helper: similarity search function ───────────────────────────────────────
create or replace function public.match_resume_chunks(
  query_embedding  vector(1536),
  match_threshold  float,
  match_count      int,
  p_resume_id      uuid default null
)
returns table (
  id          uuid,
  resume_id   uuid,
  chunk_text  text,
  similarity  float
)
language sql stable as $$
  select
    rc.id,
    rc.resume_id,
    rc.chunk_text,
    1 - (rc.embedding <=> query_embedding) as similarity
  from public.resume_chunks rc
  where
    (p_resume_id is null or rc.resume_id = p_resume_id)
    and 1 - (rc.embedding <=> query_embedding) > match_threshold
  order by rc.embedding <=> query_embedding
  limit match_count;
$$;
