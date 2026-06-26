-- Anchor Digital Forms — stored submissions (generated PDFs live in the
-- esign-documents bucket under a forms/ prefix; status tracks the chosen action).
create table if not exists anchor_form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_key text not null,
  title text,
  values jsonb not null default '{}'::jsonb,
  status text not null default 'completed',   -- completed | emailed | sent_for_signature
  pdf_path text,
  esign_document_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table anchor_form_submissions enable row level security;
do $$ begin
  create policy "anchor_forms_authenticated" on anchor_form_submissions
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
create index if not exists anchor_form_submissions_created_idx on anchor_form_submissions (created_at desc);
