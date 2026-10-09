-- updated_at is the car's version for the admin review check; use the real
-- clock so two changes in the same transaction still get different versions.
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
  new.updated_at := clock_timestamp();
  return new;
end $$;
