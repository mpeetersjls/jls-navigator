-- Documents & e-Sign — in-house DocuSign-style signing workflow.
-- Originals + signed PDFs in a public bucket (writes happen server-side via the
-- service role); anonymous signers never touch these tables directly — all
-- public reads/writes go through token-validated server functions.

-- Storage bucket
insert into storage.buckets (id, name, public) values ('esign-documents','esign-documents', true)
on conflict (id) do nothing;

drop policy if exists "esign public read" on storage.objects;
create policy "esign public read" on storage.objects for select using (bucket_id = 'esign-documents');
drop policy if exists "esign auth write" on storage.objects;
create policy "esign auth write" on storage.objects for insert to authenticated with check (bucket_id = 'esign-documents');
drop policy if exists "esign auth update" on storage.objects;
create policy "esign auth update" on storage.objects for update to authenticated using (bucket_id = 'esign-documents');
drop policy if exists "esign auth delete" on storage.objects;
create policy "esign auth delete" on storage.objects for delete to authenticated using (bucket_id = 'esign-documents');

-- Auto reference DOC-0001, DOC-0002 …
create sequence if not exists public.esign_doc_seq;

create table if not exists public.esign_documents (
  id               uuid        primary key default gen_random_uuid(),
  reference        text        unique,
  title            text        not null,
  description      text,
  file_path        text        not null,
  file_name        text,
  signer_name      text        not null,
  signer_email     text        not null,
  message          text,
  status           text        not null default 'draft',
  signing_token    text        unique,
  token_expires_at timestamptz,
  sent_at          timestamptz,
  viewed_at        timestamptz,
  signed_at        timestamptz,
  signed_file_path text,
  declined_reason  text,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create or replace function public.esign_set_reference()
returns trigger language plpgsql as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'DOC-' || lpad(nextval('public.esign_doc_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists esign_set_reference on public.esign_documents;
create trigger esign_set_reference
  before insert on public.esign_documents
  for each row execute function public.esign_set_reference();

drop trigger if exists esign_documents_updated_at on public.esign_documents;
create trigger esign_documents_updated_at
  before update on public.esign_documents
  for each row execute function public.set_updated_at();

create table if not exists public.esign_events (
  id          uuid        primary key default gen_random_uuid(),
  document_id uuid        not null references public.esign_documents(id) on delete cascade,
  event       text        not null,
  actor       text,
  ip_address  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists esign_events_document_idx on public.esign_events (document_id, created_at);

alter table public.esign_documents enable row level security;
alter table public.esign_events    enable row level security;

drop policy if exists "Authenticated manage esign_documents" on public.esign_documents;
create policy "Authenticated manage esign_documents" on public.esign_documents for all using (auth.role() = 'authenticated');
drop policy if exists "Authenticated manage esign_events" on public.esign_events;
create policy "Authenticated manage esign_events" on public.esign_events for all using (auth.role() = 'authenticated');
