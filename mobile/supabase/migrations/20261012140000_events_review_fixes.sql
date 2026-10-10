-- One rule for "the event is over": its end time, or 6 hours after the start
-- when no end is set. Used by the list, the info screen and RSVPs.
create or replace function public.event_ends_at(_event uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select coalesce(d.ends_at, d.starts_at + interval '6 hours') from public.event_details d where d.event_id = _event
$$;
revoke execute on function public.event_ends_at(uuid) from public, anon;
grant execute on function public.event_ends_at(uuid) to authenticated;

-- No confirmations for events that are over.
alter policy "rsvp: eligible confirm" on public.event_rsvps
  with check (user_id = (select auth.uid()) and (select public.can_see_event_info())
              and public.event_ends_at(event_id) > now());

drop function public.list_events();
create function public.list_events()
returns table (id uuid, title text, cover_path text, is_past boolean, starts_at timestamptz,
               media_count int, going int, i_am_going boolean)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.can_see_event_info() as ok),
  ev as (select e.*, coalesce(public.event_ends_at(e.id), e.starts_at + interval '6 hours') < now() as past from public.events e)
  select ev.id, ev.title, ev.cover_path, ev.past,
         case when me.ok then ev.starts_at end,
         (select count(*) from public.event_media m where m.event_id = ev.id)::int,
         case when me.ok then (select count(*) from public.event_rsvps r where r.event_id = ev.id)::int end,
         exists (select 1 from public.event_rsvps r where r.event_id = ev.id and r.user_id = me.uid)
    from ev cross join me
   where me.uid is not null
   order by ev.past, case when not ev.past then ev.starts_at end asc, ev.starts_at desc
$$;
revoke execute on function public.list_events() from public, anon;
grant execute on function public.list_events() to authenticated;
