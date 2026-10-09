-- Admin notifications open the right part of the panel (/admin?aba=...), and
-- admins see garages with photos to approve at the top of the list.

create or replace function public.notify_new_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'partners' then
    perform public.notify_admins('partner', 'Nova solicitação de parceria', new.company_name, '/admin?aba=parceiros');
  elsif tg_op = 'INSERT' or old.status = 'rejected' then
    perform public.notify_admins('application', 'Nova solicitação de membro', new.full_name, '/admin?aba=membros');
  end if;
  return null;
end $$;

create or replace function public.notify_car_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.photo_path is not null and new.photo_status = 'pending'
     and (tg_op = 'INSERT' or new.photo_path is distinct from old.photo_path) then
    perform public.notify_admins('garage', 'Foto de carro para aprovar',
      new.brand || ' ' || new.model || ' ' || new.year, '/admin?aba=fotos');
  end if;
  return null;
end $$;

create or replace function public.notify_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notify_admins('report', 'Nova denúncia', left(new.reason, 120), '/admin?aba=denuncias');
  return null;
end $$;

-- Existing notifications follow the same links.
update public.notifications set link = '/admin?aba=fotos' where kind = 'garage' and link = '/admin';
update public.notifications set link = '/admin?aba=denuncias' where kind = 'report' and link = '/admin';
update public.notifications set link = '/admin?aba=membros' where kind = 'application' and link = '/admin';
update public.notifications set link = '/admin?aba=parceiros' where kind = 'partner' and link = '/admin';

-- New column (photos waiting for approval), so the function is recreated.
drop function public.list_garages();
create function public.list_garages()
returns table (owner_id uuid, full_name text, avatar_path text, instagram text,
               cars_count int, likes int, cover_path text, is_public boolean, pending_count int)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid, public.is_admin() as admin)
  select p.id, p.full_name, p.avatar_path, p.instagram,
         count(c.id)::int, coalesce(sum(c.likes_count), 0)::int,
         (array_agg(c.photo_path order by (c.photo_status = 'approved') desc, c.likes_count desc, c.created_at)
            filter (where c.photo_path is not null and (c.photo_status = 'approved' or me.admin)))[1],
         public.garage_is_public(p.id),
         case when me.admin then (count(*) filter (where c.photo_status = 'pending' and c.photo_path is not null))::int else 0 end
    from public.profiles p
    join public.cars c on c.owner_id = p.id
    cross join me
   where me.uid is not null
     and (me.admin or (c.photo_status = 'approved' and public.garage_is_public(p.id)
                       and not public.is_blocked_between(me.uid, p.id)))
   group by p.id, me.admin
   order by count(*) filter (where me.admin and c.photo_status = 'pending' and c.photo_path is not null) > 0 desc,
            sum(c.likes_count) desc, max(c.created_at) desc
$$;
revoke execute on function public.list_garages() from public, anon;
grant execute on function public.list_garages() to authenticated;
