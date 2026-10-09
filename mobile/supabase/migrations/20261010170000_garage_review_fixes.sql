-- Fixes from the Phase 3 code review.

-- A car can only point at a photo inside its owner's own folder; otherwise a
-- member could read (or get published, or get deleted) someone else's file.
alter table public.cars add constraint cars_photo_in_owner_folder
  check (photo_path is null or split_part(photo_path, '/', 1) = owner_id::text);

-- Any change to what others see (photo or text) goes back to the admins.
create or replace function public.guard_car()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and not public.is_admin()
     and (new.photo_path, new.brand, new.model, new.version, new.year, new.color, new.nickname, new.description)
         is distinct from
         (old.photo_path, old.brand, old.model, old.version, old.year, old.color, old.nickname, old.description) then
    new.photo_status := 'pending';
    new.photo_reject_reason := null;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- Re-notify the admins for edits too, not only new photos.
drop trigger cars_notify_photo on public.cars;
create or replace function public.notify_car_photo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.photo_path is not null and new.photo_status = 'pending'
     and (tg_op = 'INSERT' or old.photo_status is distinct from 'pending' or new.photo_path is distinct from old.photo_path) then
    perform public.notify_admins('garage', 'Carro para aprovar',
      new.brand || ' ' || new.model || ' ' || new.year, '/admin?aba=fotos');
  end if;
  return null;
end $$;
create trigger cars_notify_photo after insert or update on public.cars
  for each row execute function public.notify_car_photo();

-- The admin approves exactly what they looked at: if the owner changed the car
-- in the meantime, the review is refused and the queue reloads.
drop function public.admin_review_car(uuid, boolean, text);
create function public.admin_review_car(_car uuid, _approve boolean, _reason text default null, _seen_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
declare c public.cars;
begin
  perform public.require_admin();
  select * into c from public.cars where id = _car;
  if c.id is null then raise exception 'Carro não encontrado'; end if;
  if _seen_at is not null and c.updated_at <> _seen_at then
    raise exception 'O membro alterou este carro agora há pouco. Confira a versão nova antes de decidir.';
  end if;
  update public.cars
     set photo_status = case when _approve then 'approved' else 'rejected' end::public.photo_status,
         photo_reject_reason = case when _approve then null else nullif(left(trim(_reason), 500), '') end
   where id = _car returning * into c;
  perform public.notify(c.owner_id, 'garage',
    case when _approve then 'Carro aprovado' else 'Carro não aprovado' end,
    c.brand || ' ' || c.model || case when _approve then ' já aparece na sua garagem.'
      else coalesce('. Motivo: ' || c.photo_reject_reason, '. Revise e envie de novo.') end,
    '/garagem/minha');
  perform public.audit(case when _approve then 'car.approve' else 'car.reject' end, 'car', c.id::text,
    jsonb_build_object('reason', c.photo_reject_reason));
end $$;
revoke execute on function public.admin_review_car(uuid, boolean, text, timestamptz) from public, anon;
grant execute on function public.admin_review_car(uuid, boolean, text, timestamptz) to authenticated;

-- No liking your own car (likes rank the garages).
alter policy "likes: like visible cars" on public.car_likes
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.cars c where c.id = car_id and c.owner_id <> (select auth.uid())));

-- A report about a car must name that car's owner, and the reporter must be able
-- to see the car; at most 10 reports per person per hour.
alter policy "reports: file own" on public.content_reports
  with check (
    reporter_id = (select auth.uid())
    and reported_user <> (select auth.uid())
    and (car_id is null or exists (select 1 from public.cars c where c.id = car_id and c.owner_id = reported_user))
    and (select count(*) from public.content_reports r
          where r.reporter_id = (select auth.uid()) and r.created_at > now() - interval '1 hour') < 10
  );
