-- Phase 4 (part 3): Exotic Experience events.
-- Everyone signed in sees the event cards and their media. The event
-- information (date, place, programme, rules, RSVP) is only for active
-- subscribers, approved partners and admins. Media come from the Exotic
-- Experience Instagram (an admin assigns each post to one event; a post in one
-- event is locked for the others) or are posted by admins in the app.

create or replace function public.can_see_event_info()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or public.is_subscriber(auth.uid()) or public.is_active_partner(auth.uid())
$$;
revoke execute on function public.can_see_event_info() from public, anon;
grant execute on function public.can_see_event_info() to authenticated;

-- ---------------------------------------------------------------- events (public card)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  cover_path text check (char_length(cover_path) <= 300),
  -- Ordering only; the date itself is shown from event_details.
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index events_starts_idx on public.events (starts_at desc);
alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
-- starts_at is not granted: people without access only learn upcoming/past.
grant select (id, title, cover_path, created_at) on public.events to authenticated;
create policy "events: read" on public.events for select to authenticated using (true);

-- ---------------------------------------------------------------- details (private)
create table public.event_details (
  event_id uuid primary key references public.events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text check (char_length(venue) <= 120),
  address text check (char_length(address) <= 200),
  city text check (char_length(city) <= 80),
  program text not null default '' check (char_length(program) <= 4000),
  rules text not null default '' check (char_length(rules) <= 4000),
  check (ends_at is null or ends_at > starts_at)
);
alter table public.event_details enable row level security;
revoke all on public.event_details from anon, authenticated;
grant select on public.event_details to authenticated;
create policy "event details: members, partners, admins" on public.event_details for select to authenticated
  using ((select public.can_see_event_info()));

-- ---------------------------------------------------------------- RSVP
create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_rsvps enable row level security;
revoke all on public.event_rsvps from anon, authenticated;
grant select, insert, delete on public.event_rsvps to authenticated;
create policy "rsvp: own or admin read" on public.event_rsvps for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "rsvp: eligible confirm" on public.event_rsvps for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.can_see_event_info()));
create policy "rsvp: own cancel" on public.event_rsvps for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- media
create table public.event_media (
  id uuid primary key default gen_random_uuid(),
  -- Null = Instagram post not assigned to any event yet (admin pool).
  event_id uuid references public.events(id) on delete set null,
  source text not null check (source in ('instagram', 'app')),
  ig_id text unique,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  media_path text check (char_length(media_path) <= 300),
  caption text not null default '' check (char_length(caption) <= 2200),
  permalink text check (char_length(permalink) <= 500),
  taken_at timestamptz not null default now(),
  author_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (source = 'instagram' or event_id is not null)
);
create index event_media_event_idx on public.event_media (event_id, taken_at desc);
alter table public.event_media enable row level security;
revoke all on public.event_media from anon, authenticated;
grant select on public.event_media to authenticated;
grant insert (event_id, source, media_path, caption, author_id) on public.event_media to authenticated;
grant update (event_id, caption) on public.event_media to authenticated;
grant delete on public.event_media to authenticated;
create policy "media: assigned for all, pool for admins" on public.event_media for select to authenticated
  using (event_id is not null or (select public.is_admin()));
create policy "media: admins post" on public.event_media for insert to authenticated
  with check ((select public.is_admin()) and source = 'app' and author_id = (select auth.uid()));
create policy "media: admins edit" on public.event_media for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "media: admins delete" on public.event_media for delete to authenticated using ((select public.is_admin()));

-- An Instagram post can only be moved into an event from the pool (or back to
-- it): a post already in another event is locked.
create or replace function public.guard_event_media()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.event_id is not null and new.event_id is not null and new.event_id <> old.event_id then
    raise exception 'Este post já está em outro evento. Remova de lá primeiro.';
  end if;
  return new;
end $$;
create trigger event_media_guard before update of event_id on public.event_media
  for each row execute function public.guard_event_media();

-- ---------------------------------------------------------------- admin writes
create or replace function public.admin_save_event(_id uuid, _title text, _cover_path text, _starts_at timestamptz,
  _ends_at timestamptz, _venue text, _address text, _city text, _program text, _rules text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid := _id; is_new boolean := _id is null;
begin
  perform public.require_admin();
  if is_new then
    insert into public.events (title, cover_path, starts_at) values (trim(_title), _cover_path, _starts_at) returning id into eid;
  else
    update public.events set title = trim(_title), cover_path = _cover_path, starts_at = _starts_at where id = eid;
    if not found then raise exception 'Evento não encontrado'; end if;
  end if;
  insert into public.event_details (event_id, starts_at, ends_at, venue, address, city, program, rules)
  values (eid, _starts_at, _ends_at, nullif(trim(_venue), ''), nullif(trim(_address), ''), nullif(trim(_city), ''),
          coalesce(_program, ''), coalesce(_rules, ''))
  on conflict (event_id) do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at, venue = excluded.venue,
    address = excluded.address, city = excluded.city, program = excluded.program, rules = excluded.rules;
  if is_new and _starts_at > now() then
    perform public.notify_all('event', 'Novo evento Exotic Experience', left(trim(_title), 120), '/eventos/' || eid);
  end if;
  perform public.audit(case when is_new then 'event.create' else 'event.update' end, 'event', eid::text, '{}');
  return eid;
end $$;
revoke execute on function public.admin_save_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_event(uuid, text, text, timestamptz, timestamptz, text, text, text, text, text) to authenticated;

create or replace function public.admin_delete_event(_id uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare files text[];
begin
  perform public.require_admin();
  -- App posts and the cover are deleted; Instagram posts go back to the pool.
  select array_agg(p) into files from (
    select cover_path p from public.events where id = _id and cover_path is not null
    union all select media_path from public.event_media where event_id = _id and source = 'app' and media_path is not null) f;
  delete from public.event_media where event_id = _id and source = 'app';
  delete from public.events where id = _id;
  if not found then raise exception 'Evento não encontrado'; end if;
  perform public.audit('event.delete', 'event', _id::text, '{}');
  return coalesce(files, '{}');
end $$;
revoke execute on function public.admin_delete_event(uuid) from public, anon;
grant execute on function public.admin_delete_event(uuid) to authenticated;

-- Cards for the Events tab: upcoming first (soonest), then past (latest).
-- The date and RSVP numbers are only filled in for people with access.
create or replace function public.list_events()
returns table (id uuid, title text, cover_path text, is_past boolean, starts_at timestamptz,
               media_count int, going int, i_am_going boolean)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.can_see_event_info() as ok)
  select e.id, e.title, e.cover_path, e.starts_at < now() - interval '1 day',
         case when me.ok then e.starts_at end,
         (select count(*) from public.event_media m where m.event_id = e.id)::int,
         case when me.ok then (select count(*) from public.event_rsvps r where r.event_id = e.id)::int end,
         exists (select 1 from public.event_rsvps r where r.event_id = e.id and r.user_id = me.uid)
    from public.events e cross join me
   where me.uid is not null
   order by (e.starts_at < now() - interval '1 day'), case when e.starts_at >= now() - interval '1 day' then e.starts_at end asc,
            e.starts_at desc
$$;
revoke execute on function public.list_events() from public, anon;
grant execute on function public.list_events() to authenticated;

-- Admin: who confirmed.
create or replace function public.admin_event_rsvps(_event uuid)
returns table (full_name text, avatar_path text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query select p.full_name, p.avatar_path, r.created_at from public.event_rsvps r
    join public.profiles p on p.id = r.user_id where r.event_id = _event order by r.created_at;
end $$;
revoke execute on function public.admin_event_rsvps(uuid) from public, anon;
grant execute on function public.admin_event_rsvps(uuid) to authenticated;

-- ---------------------------------------------------------------- images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('events', 'events', true, 10485760, array['image/jpeg', 'image/png', 'image/webp']);
create policy "event images: admins upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'events' and (select public.is_admin()));
create policy "event images: admins delete" on storage.objects for delete to authenticated
  using (bucket_id = 'events' and (select public.is_admin()));
