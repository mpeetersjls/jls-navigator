-- Signature field placement: where the signature stamps on the document
-- (array of { page, pos } e.g. [{ "page": 1, "pos": "bottom-right" }]).
alter table public.esign_documents add column if not exists signature_fields jsonb;
