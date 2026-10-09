-- Admins see the cover photo of a garage even while it is still under review.
create or replace function public.list_garages()
returns table (owner_id uuid, full_name text, avatar_path text, instagram text,
               cars_count int, likes int, cover_path text, is_public boolean)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.is_admin() as admin)
  select p.id, p.full_name, p.avatar_path, p.instagram,
         count(c.id)::int, coalesce(sum(c.likes_count), 0)::int,
         (array_agg(c.photo_path order by (c.photo_status = 'approved') desc, c.likes_count desc, c.created_at)
            filter (where c.photo_path is not null and (c.photo_status = 'approved' or me.admin)))[1],
         public.garage_is_public(p.id)
    from public.profiles p
    join public.cars c on c.owner_id = p.id
    cross join me
   where me.uid is not null
     and (me.admin or (c.photo_status = 'approved' and public.garage_is_public(p.id)
                       and not public.is_blocked_between(me.uid, p.id)))
   group by p.id, me.admin
   order by sum(c.likes_count) desc, max(c.created_at) desc
$$;
