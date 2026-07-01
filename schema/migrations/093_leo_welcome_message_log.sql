-- Migration 093: LEO dynamic welcome message anti-repeat log
--
-- Supports a rotating, non-repeating welcome message for the floating
-- Ask-Leo chat (src/components/leo/LeoChat.tsx), computed in
-- src/routes/api.leo.welcome.ts from the same assembleLeoContext() data
-- already used for the briefing -- no separate SQL signal-aggregation
-- function, to avoid a second, parallel "what can this user see" query
-- path alongside the existing ACCESS_CAPS-gated one.
--
-- This table exists purely so a message isn't repeated to the same user
-- within the rotation window; it has no other purpose.

create table if not exists public.leo_welcome_message_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  message_key text not null,
  module_name text,
  shown_at timestamptz not null default now()
);

create index if not exists idx_leo_welcome_log_user_shown
  on public.leo_welcome_message_log (user_id, shown_at desc);

alter table public.leo_welcome_message_log enable row level security;

create policy leo_welcome_log_select_own
  on public.leo_welcome_message_log for select
  using (user_id = auth.uid());

create policy leo_welcome_log_insert_own
  on public.leo_welcome_message_log for insert
  with check (user_id = auth.uid());

-- No update/delete policy — it's an append-only log; rows age out by not
-- being queried past the rotation window, nothing needs to mutate them.
