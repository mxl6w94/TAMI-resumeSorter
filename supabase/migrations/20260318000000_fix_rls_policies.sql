-- Fix RLS policies: add explicit WITH CHECK for INSERT operations
-- and fix storage path check (user.id is folder [1], not [2])

-- ── Drop old policies ──────────────────────────────────────────────────────────
drop policy if exists "resumes: owner access"        on public.resumes;
drop policy if exists "folders: owner access"        on public.folders;
drop policy if exists "folder_resumes: folder owner access" on public.folder_resumes;
drop policy if exists "criteria_units: folder owner access" on public.criteria_units;
drop policy if exists "evaluations: folder owner access"    on public.evaluations;
drop policy if exists "resume_chunks: resume owner access"  on public.resume_chunks;

-- ── resumes ───────────────────────────────────────────────────────────────────
create policy "resumes: select own"
  on public.resumes for select
  using (uploaded_by = auth.uid());

create policy "resumes: insert own"
  on public.resumes for insert
  with check (uploaded_by = auth.uid());

create policy "resumes: update own"
  on public.resumes for update
  using (uploaded_by = auth.uid())
  with check (uploaded_by = auth.uid());

create policy "resumes: delete own"
  on public.resumes for delete
  using (uploaded_by = auth.uid());

-- ── folders ───────────────────────────────────────────────────────────────────
create policy "folders: select own"
  on public.folders for select
  using (owner_id = auth.uid());

create policy "folders: insert own"
  on public.folders for insert
  with check (owner_id = auth.uid());

create policy "folders: update own"
  on public.folders for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "folders: delete own"
  on public.folders for delete
  using (owner_id = auth.uid());

-- ── folder_resumes ────────────────────────────────────────────────────────────
create policy "folder_resumes: select"
  on public.folder_resumes for select
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

create policy "folder_resumes: insert"
  on public.folder_resumes for insert
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

create policy "folder_resumes: delete"
  on public.folder_resumes for delete
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

-- ── criteria_units ────────────────────────────────────────────────────────────
create policy "criteria_units: select"
  on public.criteria_units for select
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

create policy "criteria_units: insert"
  on public.criteria_units for insert
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

create policy "criteria_units: update"
  on public.criteria_units for update
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

create policy "criteria_units: delete"
  on public.criteria_units for delete
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

-- ── evaluations ───────────────────────────────────────────────────────────────
create policy "evaluations: select"
  on public.evaluations for select
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

create policy "evaluations: insert"
  on public.evaluations for insert
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

create policy "evaluations: update"
  on public.evaluations for update
  using (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = auth.uid())
  );

-- ── resume_chunks ─────────────────────────────────────────────────────────────
create policy "resume_chunks: select"
  on public.resume_chunks for select
  using (
    exists (select 1 from public.resumes r where r.id = resume_id and r.uploaded_by = auth.uid())
  );

create policy "resume_chunks: insert"
  on public.resume_chunks for insert
  with check (
    exists (select 1 from public.resumes r where r.id = resume_id and r.uploaded_by = auth.uid())
  );

-- ── Storage bucket policies (fix: user.id is foldername[1]) ──────────────────
drop policy if exists "resumes bucket: owner upload" on storage.objects;
drop policy if exists "resumes bucket: owner read"   on storage.objects;
drop policy if exists "resumes bucket: owner delete" on storage.objects;

create policy "resumes bucket: owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "resumes bucket: owner read"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "resumes bucket: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
