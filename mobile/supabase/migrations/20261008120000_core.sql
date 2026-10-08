-- Exotic Club — core schema (phase 0).
-- Every privileged action goes through SECURITY DEFINER functions that check
-- the caller's role; tables only expose what each profile may read or write.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- roles
create type public.app_role as enum ('admin', 'partner');

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table public.user_roles enable row level security;
revoke all on public.user_roles from anon, authenticated;
grant select on public.user_roles to authenticated;

create or replace function public.has_role(_uid uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _uid and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin')
$$;

create policy "roles: own or admin" on public.user_roles
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- No insert/update/delete policy: roles change only through admin functions
-- or directly in the backend (admins are created with make_admin below).

-- ---------------------------------------------------------------- settings
create table public.app_settings (
  id int primary key default 1 check (id = 1),
  owners_email text not null default 'luiznetopaluti@gmail.com',
  require_promotion_approval boolean not null default false,
  require_partner_news_approval boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (1);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select, update (owners_email, require_promotion_approval, require_partner_news_approval) on public.app_settings to authenticated;
create policy "settings: admin read" on public.app_settings for select to authenticated using (public.is_admin());
create policy "settings: admin update" on public.app_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  city text check (char_length(city) <= 80),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  avatar_path text check (char_length(avatar_path) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
-- Profiles are visible to signed-in users (garage owners, partner validation),
-- except phone: the owner reads it through my_profile(), admins through admin functions.
grant select (id, full_name, city, instagram, avatar_path, created_at, updated_at) on public.profiles to authenticated;
grant update (full_name, phone, city, instagram, avatar_path) on public.profiles to authenticated;
create policy "profiles: read signed-in" on public.profiles for select to authenticated using (true);
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.my_profile()
returns public.profiles language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'full_name', ''), 120));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- member applications
create type public.application_status as enum ('pending', 'approved', 'rejected');

create table public.member_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 255),
  phone text not null check (char_length(phone) between 8 and 30),
  city text not null check (char_length(city) between 2 and 80),
  profession text not null check (char_length(profession) between 2 and 120),
  instagram text not null check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  cars text check (char_length(cars) <= 500),
  reason text not null check (char_length(reason) between 10 and 2000),
  status public.application_status not null default 'pending',
  decision_reason text check (char_length(decision_reason) <= 500),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.member_applications enable row level security;
revoke all on public.member_applications from anon, authenticated;
grant select, insert on public.member_applications to authenticated;
grant update (full_name, email, phone, city, profession, instagram, cars, reason) on public.member_applications to authenticated;
create policy "member app: read own or admin" on public.member_applications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "member app: insert own" on public.member_applications for insert to authenticated
  with check (user_id = auth.uid());
-- A rejected applicant may edit and resubmit; the guard resets the status.
create policy "member app: resubmit own" on public.member_applications for update to authenticated
  using (user_id = auth.uid() and status = 'rejected') with check (user_id = auth.uid());

create or replace function public.guard_member_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := 'pending';
    new.decision_reason := null;
    new.reviewed_by := null;
    new.reviewed_at := null;
    if tg_op = 'UPDATE' then new.user_id := old.user_id; new.created_at := old.created_at; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger member_applications_guard before insert or update on public.member_applications
  for each row execute function public.guard_member_application();

-- ---------------------------------------------------------------- partners
create type public.partner_status as enum
  ('pending', 'meeting_proposed', 'meeting_confirmed', 'approved', 'rejected');

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  responsible_name text not null check (char_length(responsible_name) between 2 and 120),
  email text not null check (char_length(email) <= 255),
  phone text not null check (char_length(phone) between 8 and 30),
  company_name text not null check (char_length(company_name) between 2 and 120),
  niche text not null check (char_length(niche) between 2 and 60),
  instagram_responsible text not null check (instagram_responsible ~ '^[A-Za-z0-9._]{1,30}$'),
  instagram_company text not null check (instagram_company ~ '^[A-Za-z0-9._]{1,30}$'),
  reason text not null check (char_length(reason) between 10 and 2000),
  logo_path text check (char_length(logo_path) <= 300),
  description text not null default '' check (char_length(description) <= 1000),
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 80),
  lat double precision,
  lng double precision,
  status public.partner_status not null default 'pending',
  active boolean not null default true,
  decision_reason text check (char_length(decision_reason) <= 500),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partners enable row level security;
revoke all on public.partners from anon, authenticated;
-- Contact data (phone, email, reason, decision) stays private: the owner reads it
-- through my_partner(), admins through admin_partner().
grant select (id, owner_id, responsible_name, company_name, niche, instagram_responsible, instagram_company,
  logo_path, description, address, city, lat, lng, status, active, approved_at, created_at, updated_at)
  on public.partners to authenticated;
grant insert on public.partners to authenticated;
grant update (responsible_name, email, phone, company_name, niche, instagram_responsible, instagram_company,
  reason, logo_path, description, address, city, lat, lng) on public.partners to authenticated;

create or replace function public.is_active_partner(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.partners where owner_id = _uid and status = 'approved' and active)
$$;

create or replace function public.my_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.partners where owner_id = auth.uid() and status = 'approved' and active
$$;

create policy "partners: approved public, own, admin" on public.partners for select to authenticated
  using ((status = 'approved' and active) or owner_id = auth.uid() or public.is_admin());
create policy "partners: apply own" on public.partners for insert to authenticated
  with check (owner_id = auth.uid());
create policy "partners: edit own" on public.partners for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace function public.guard_partner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.active := true; new.decision_reason := null; new.approved_at := null;
    else
      -- Owners edit their company data; status/activation belong to admins.
      new.status := old.status; new.active := old.active; new.owner_id := old.owner_id;
      new.decision_reason := old.decision_reason; new.approved_at := old.approved_at;
      new.created_at := old.created_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger partners_guard before insert or update on public.partners
  for each row execute function public.guard_partner();

-- Owner reads their own private columns through this function.
create or replace function public.my_partner()
returns public.partners language sql stable security definer set search_path = public as $$
  select * from public.partners where owner_id = auth.uid()
$$;

-- ---------------------------------------------------------------- memberships (annual fee)
-- One row per activation/renewal. A user is a subscriber while an approved
-- application exists and a non-suspended membership covers now().
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  suspended_at timestamptz,
  note text check (char_length(note) <= 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at)
);
create index memberships_user_idx on public.memberships (user_id, expires_at desc);
alter table public.memberships enable row level security;
revoke all on public.memberships from anon, authenticated;
grant select on public.memberships to authenticated;
create policy "memberships: own or admin" on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create or replace function public.is_subscriber(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.member_applications a where a.user_id = _uid and a.status = 'approved')
     and exists (select 1 from public.memberships m where m.user_id = _uid and m.suspended_at is null
                 and m.starts_at <= now() and m.expires_at > now())
$$;

-- What the app needs to decide which screens to show, in one round trip.
create or replace function public.my_access()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'is_admin', public.has_role(auth.uid(), 'admin'),
    'is_subscriber', public.is_subscriber(auth.uid()),
    'membership_expires_at', (select max(expires_at) from public.memberships
       where user_id = auth.uid() and suspended_at is null and starts_at <= now()),
    'member_application', (select json_build_object('status', status, 'decision_reason', decision_reason)
       from public.member_applications where user_id = auth.uid()),
    'partner', (select json_build_object('id', id, 'status', status, 'active', active, 'company_name', company_name)
       from public.partners where owner_id = auth.uid())
  )
$$;

-- ---------------------------------------------------------------- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "notifications: own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications: own mark read" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notifications: own delete" on public.notifications for delete to authenticated using (user_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

create or replace function public.notify(_user uuid, _kind text, _title text, _body text, _link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link) values (_user, _kind, _title, _body, _link)
$$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- admin audit log
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;
grant select on public.admin_audit_log to authenticated;
create policy "audit: admin read" on public.admin_audit_log for select to authenticated using (public.is_admin());

create or replace function public.audit(_action text, _type text, _id text, _details jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), _action, _type, _id, _details)
$$;
revoke execute on function public.audit(text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- admin actions
create or replace function public.require_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

create or replace function public.admin_review_member(_application uuid, _approve boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.member_applications;
begin
  perform public.require_admin();
  update public.member_applications
     set status = case when _approve then 'approved' else 'rejected' end::public.application_status,
         decision_reason = nullif(left(trim(_reason), 500), ''), reviewed_by = auth.uid(), reviewed_at = now()
   where id = _application returning * into a;
  if a.id is null then raise exception 'not found'; end if;
  perform public.audit(case when _approve then 'member.approve' else 'member.reject' end, 'member_application', a.id::text,
                       jsonb_build_object('user_id', a.user_id, 'reason', a.decision_reason));
  perform public.notify(a.user_id, 'application',
    case when _approve then 'Solicitação aprovada' else 'Solicitação não aprovada' end,
    case when _approve then 'Bem-vindo ao Exotic Club! Sua anuidade será ativada pelos donos.'
         else coalesce('Motivo: ' || a.decision_reason, 'Entre em contato para mais informações.') end,
    '/status');
end $$;

create or replace function public.admin_set_membership(_user uuid, _expires_at timestamptz, _note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare mid uuid;
begin
  perform public.require_admin();
  if not exists (select 1 from public.member_applications where user_id = _user and status = 'approved') then
    raise exception 'A solicitação deste usuário ainda não foi aprovada';
  end if;
  if _expires_at <= now() then raise exception 'A validade precisa ser uma data futura'; end if;
  insert into public.memberships (user_id, expires_at, note, created_by)
  values (_user, _expires_at, nullif(left(trim(_note), 500), ''), auth.uid()) returning id into mid;
  perform public.audit('membership.activate', 'user', _user::text, jsonb_build_object('expires_at', _expires_at));
  perform public.notify(_user, 'membership', 'Anuidade ativada',
    'Sua anuidade está ativa até ' || to_char(_expires_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY') || '.', '/carteirinha');
  return mid;
end $$;

create or replace function public.admin_suspend_membership(_user uuid, _note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.memberships set suspended_at = now(), note = coalesce(nullif(left(trim(_note), 500), ''), note)
   where user_id = _user and suspended_at is null and expires_at > now();
  perform public.audit('membership.suspend', 'user', _user::text, jsonb_build_object('note', _note));
end $$;

create or replace function public.admin_set_partner_status(_partner uuid, _status public.partner_status, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.partners;
begin
  perform public.require_admin();
  update public.partners set status = _status, decision_reason = nullif(left(trim(_reason), 500), ''),
         approved_at = case when _status = 'approved' then now() else approved_at end
   where id = _partner returning * into p;
  if p.id is null then raise exception 'not found'; end if;
  if _status = 'approved' then
    insert into public.user_roles (user_id, role) values (p.owner_id, 'partner') on conflict do nothing;
    perform public.notify(p.owner_id, 'partner', 'Parceria aprovada', 'Sua conta de parceiro está ativa.', '/parceiro');
  elsif _status = 'rejected' then
    delete from public.user_roles where user_id = p.owner_id and role = 'partner';
  end if;
  perform public.audit('partner.status', 'partner', p.id::text, jsonb_build_object('status', _status, 'reason', p.decision_reason));
end $$;

create or replace function public.admin_set_partner_active(_partner uuid, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.partners set active = _active where id = _partner;
  perform public.audit(case when _active then 'partner.activate' else 'partner.deactivate' end, 'partner', _partner::text);
end $$;

-- Backend-only: promote an existing account to admin. Run in the SQL editor:
--   select public.make_admin('dono@exemplo.com');
create or replace function public.make_admin(_email text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(trim(_email));
  if uid is null then raise exception 'Usuário % não encontrado', _email; end if;
  insert into public.user_roles (user_id, role) values (uid, 'admin') on conflict do nothing;
end $$;
revoke execute on function public.make_admin(text) from public, anon, authenticated;

-- Admin-only read of private contact data.
create or replace function public.admin_partner(_partner uuid)
returns public.partners language plpgsql stable security definer set search_path = public as $$
declare p public.partners;
begin
  perform public.require_admin();
  select * into p from public.partners where id = _partner;
  return p;
end $$;

-- Internal helpers must not be callable from the API.
revoke execute on function public.require_admin() from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_member_application() from public, anon, authenticated;
revoke execute on function public.guard_partner() from public, anon, authenticated;

-- ---------------------------------------------------------------- storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Files live under "<user id>/...": each user writes only their own folder.
create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: update own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
