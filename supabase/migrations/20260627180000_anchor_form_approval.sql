-- DMA approval workflow: an ordered approver chain, the signing signatory, and an audit log.
alter table public.anchor_form_submissions add column if not exists approval_status text not null default 'none'; -- none|pending|approved|rejected
alter table public.anchor_form_submissions add column if not exists approval_chain jsonb;     -- [{ name, email }]
alter table public.anchor_form_submissions add column if not exists approval_step int not null default 0;
alter table public.anchor_form_submissions add column if not exists approval_log jsonb not null default '[]'::jsonb;
alter table public.anchor_form_submissions add column if not exists signatory_id uuid references public.jls_signatories(id) on delete set null;
alter table public.anchor_form_submissions add column if not exists authority_email text;
alter table public.anchor_form_submissions add column if not exists signed_pdf_path text;
