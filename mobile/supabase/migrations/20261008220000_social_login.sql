-- Sign in with Apple: refresh tokens kept only so account deletion can revoke
-- them (App Store requirement). Readable only by the server (service role).
create table public.apple_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;
revoke all on public.apple_tokens from anon, authenticated;
