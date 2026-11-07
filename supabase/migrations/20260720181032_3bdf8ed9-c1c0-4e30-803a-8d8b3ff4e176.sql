
create type public.feedback_category as enum (
  'feature_request','bug_report','product_feedback','ai_feedback','listener_feedback','support'
);

create table public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  category public.feedback_category not null,
  subject text,
  message text not null check (char_length(message) between 4 and 4000),
  email text,
  page text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

grant select, insert on public.feedback_submissions to authenticated;
grant insert on public.feedback_submissions to anon;
grant all on public.feedback_submissions to service_role;

alter table public.feedback_submissions enable row level security;

create policy "Anyone can submit feedback"
  on public.feedback_submissions
  for insert
  to anon, authenticated
  with check (true);

create policy "Users can view their own feedback"
  on public.feedback_submissions
  for select
  to authenticated
  using (user_id = auth.uid());
