-- Phase 3: members' garages.
-- Active subscribers add cars; each photo is approved by an admin before other
-- users see it. Everyone signed in can browse visible garages and like cars.
-- Report and block exist because garages are user-generated content (App Store 1.2).
-- A garage is hidden while the owner's membership is not active.

alter table public.profiles add column garage_visible boolean not null default true;
grant select (garage_visible), update (garage_visible) on public.profiles to authenticated;

create type public.photo_status as enum ('pending', 'approved', 'rejected');

create table public.cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  brand text not null check (char_length(brand) between 1 and 40),
  model text not null check (char_length(model) between 1 and 60),
  version text check (char_length(version) <= 60),
  year int not null check (year between 1900 and 2100),
  color text check (char_length(color) <= 30),
  nickname text check (char_length(nickname) <= 60),
  description text check (char_length(description) <= 500),
  -- 'ai' is reserved for generated images (service still to be chosen).
  photo_source text not null default 'upload' check (photo_source in ('upload', 'ai')),
  photo_path text check (char_length(photo_path) <= 300),
  photo_status public.photo_status not null default 'pending',
  photo_reject_reason text check (char_length(photo_reject_reason) <= 500),
  likes_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cars_owner_idx on public.cars (owner_id, created_at);
create index cars_pending_idx on public.cars (created_at) where photo_status = 'pending';
alter table public.cars enable row level security;
revoke all on public.cars from anon, authenticated;
grant select on public.cars to authenticated;
grant insert (owner_id, brand, model, version, year, color, nickname, description, photo_source, photo_path)
  on public.cars to authenticated;
grant update (brand, model, version, year, color, nickname, description, photo_source, photo_path)
  on public.cars to authenticated;
grant delete on public.cars to authenticated;

-- ---------------------------------------------------------------- blocks
create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
create policy "blocks: own" on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create or replace function public.is_blocked_between(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks
                 where (blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a))
$$;

create or replace function public.garage_is_public(_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select garage_visible from public.profiles where id = _owner), false)
     and public.is_subscriber(_owner)
$$;

-- ---------------------------------------------------------------- car rules
create policy "cars: own, admin or visible" on public.cars for select to authenticated using (
  owner_id = (select auth.uid()) or (select public.is_admin())
  or (photo_status = 'approved' and public.garage_is_public(owner_id)
      and not public.is_blocked_between((select auth.uid()), owner_id))
);
create policy "cars: subscribers add own" on public.cars for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_subscriber((select auth.uid())));
create policy "cars: subscribers edit own" on public.cars for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_subscriber((select auth.uid())))
  with check (owner_id = (select auth.uid()));
create policy "cars: owner or admin delete" on public.cars for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

-- A new or changed photo goes back to the admins for approval.
create or replace function public.guard_car()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.photo_path is distinct from old.photo_path and not public.is_admin() then
    new.photo_status := 'pending';
    new.photo_reject_reason := null;
  end if;
  new.updated_at := now();
  return new;
end $$;
revoke execute on function public.guard_car() from public, anon, authenticated;
create trigger cars_guard before update on public.cars for each row execute function public.guard_car();

create or replace function public.notify_car_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.photo_path is not null and new.photo_status = 'pending'
     and (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path) then
    perform public.notify_admins('garage', 'Foto de carro para aprovar',
      new.brand || ' ' || new.model || ' ' || new.year, '/admin');
  end if;
  return null;
end $$;
revoke execute on function public.notify_car_photo() from public, anon, authenticated;
create trigger cars_notify_photo after insert or update of photo_path on public.cars
  for each row execute function public.notify_car_photo();

-- ---------------------------------------------------------------- likes
create table public.car_likes (
  car_id uuid not null references public.cars(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (car_id, user_id)
);
create index car_likes_user_idx on public.car_likes (user_id);
alter table public.car_likes enable row level security;
revoke all on public.car_likes from anon, authenticated;
grant select, insert, delete on public.car_likes to authenticated;
create policy "likes: read own" on public.car_likes for select to authenticated using (user_id = (select auth.uid()));
-- Only cars the user can see (the cars policy applies inside the subquery).
create policy "likes: like visible cars" on public.car_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.cars c where c.id = car_id));
create policy "likes: unlike own" on public.car_likes for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.count_car_like()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.cars set likes_count = likes_count + 1 where id = new.car_id;
  else
    update public.cars set likes_count = greatest(likes_count - 1, 0) where id = old.car_id;
  end if;
  return null;
end $$;
revoke execute on function public.count_car_like() from public, anon, authenticated;
create trigger car_likes_count after insert or delete on public.car_likes
  for each row execute function public.count_car_like();

-- ---------------------------------------------------------------- reports
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user uuid not null references public.profiles(id) on delete cascade,
  car_id uuid references public.cars(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);
create index content_reports_open_idx on public.content_reports (created_at desc) where status = 'open';
alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated;
grant insert (reporter_id, reported_user, car_id, reason) on public.content_reports to authenticated;
grant select, update (status) on public.content_reports to authenticated;
create policy "reports: file own" on public.content_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "reports: admin read" on public.content_reports for select to authenticated using ((select public.is_admin()));
create policy "reports: admin resolve" on public.content_reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create or replace function public.notify_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admins('report', 'Nova denúncia', left(new.reason, 120), '/admin');
  return null;
end $$;
revoke execute on function public.notify_report() from public, anon, authenticated;
create trigger content_reports_notify after insert on public.content_reports
  for each row execute function public.notify_report();

-- ---------------------------------------------------------------- listing and admin
-- Garages to browse: owner info, number of cars and a cover photo. Admins also
-- see hidden garages and cars waiting for approval.
create or replace function public.list_garages()
returns table (owner_id uuid, full_name text, avatar_path text, instagram text,
               cars_count int, likes int, cover_path text, is_public boolean)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.is_admin() as admin)
  select p.id, p.full_name, p.avatar_path, p.instagram,
         count(c.id)::int, coalesce(sum(c.likes_count), 0)::int,
         (array_agg(c.photo_path order by c.likes_count desc, c.created_at)
            filter (where c.photo_status = 'approved'))[1],
         public.garage_is_public(p.id)
    from public.profiles p
    join public.cars c on c.owner_id = p.id
    cross join me
   where me.uid is not null
     and (me.admin or (c.photo_status = 'approved' and public.garage_is_public(p.id)
                       and not public.is_blocked_between(me.uid, p.id)))
   group by p.id
   order by sum(c.likes_count) desc, max(c.created_at) desc
$$;
revoke execute on function public.list_garages() from public, anon;
grant execute on function public.list_garages() to authenticated;

create or replace function public.admin_review_car(_car uuid, _approve boolean, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.cars;
begin
  perform public.require_admin();
  update public.cars
     set photo_status = case when _approve then 'approved' else 'rejected' end::public.photo_status,
         photo_reject_reason = case when _approve then null else nullif(left(trim(_reason), 500), '') end
   where id = _car returning * into c;
  if c.id is null then raise exception 'Carro não encontrado'; end if;
  perform public.notify(c.owner_id, 'garage',
    case when _approve then 'Foto aprovada' else 'Foto não aprovada' end,
    c.brand || ' ' || c.model || case when _approve then ' já aparece na sua garagem.'
      else coalesce('. Motivo: ' || c.photo_reject_reason, '. Envie outra foto.') end,
    '/garagem');
  perform public.audit(case when _approve then 'car.approve' else 'car.reject' end, 'car', c.id::text,
    jsonb_build_object('reason', c.photo_reject_reason));
end $$;
revoke execute on function public.admin_review_car(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_car(uuid, boolean, text) to authenticated;

revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
revoke execute on function public.garage_is_public(uuid) from public, anon;
grant execute on function public.garage_is_public(uuid) to authenticated;

-- ---------------------------------------------------------------- photos
-- Private bucket: owners manage their folder; others can read a photo only
-- when they can see the car that uses it (the cars policy decides).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cars', 'cars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy "cars photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'cars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cars photos: update own" on storage.objects for update to authenticated
  using (bucket_id = 'cars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "cars photos: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'cars' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));
create policy "cars photos: read visible" on storage.objects for select to authenticated
  using (bucket_id = 'cars' and ((storage.foldername(name))[1] = (select auth.uid())::text
         or exists (select 1 from public.cars c where c.photo_path = name)));
