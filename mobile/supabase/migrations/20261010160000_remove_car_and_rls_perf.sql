-- 1) Admin removes a reported car: the owner is told why, and the car's open
--    reports are resolved in the same step.
create or replace function public.admin_remove_car(_car uuid, _reason text)
returns text language plpgsql security definer set search_path = public as $$
declare c public.cars; reason text := nullif(left(trim(coalesce(_reason, '')), 500), '');
begin
  perform public.require_admin();
  if reason is null then raise exception 'Informe o motivo da remoção'; end if;
  update public.content_reports set status = 'resolved' where car_id = _car and status = 'open';
  delete from public.cars where id = _car returning * into c;
  if c.id is null then raise exception 'Carro não encontrado'; end if;
  perform public.notify(c.owner_id, 'garage', 'Carro removido da sua garagem',
    c.brand || ' ' || c.model || ' foi removido pela equipe. Motivo: ' || reason, '/garagem/minha');
  perform public.audit('car.remove', 'car', c.id::text, jsonb_build_object('owner', c.owner_id, 'reason', reason));
  -- The app deletes the photo file with this path.
  return c.photo_path;
end $$;
revoke execute on function public.admin_remove_car(uuid, text) from public, anon;
grant execute on function public.admin_remove_car(uuid, text) to authenticated;

-- 2) Performance (Supabase advisor auth_rls_initplan): evaluate auth.uid() and
--    is_admin() once per query instead of once per row.
alter policy "audit: admin read" on public.admin_audit_log using ((select public.is_admin()));
alter policy "settings: admin read" on public.app_settings using ((select public.is_admin()));
alter policy "settings: admin update" on public.app_settings
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "card scans: own partner, own member or admin" on public.card_scans
  using (member_id = (select auth.uid()) or partner_id = (select public.my_partner_id()) or (select public.is_admin()));
alter policy "member app: read own or admin" on public.member_applications
  using (user_id = (select auth.uid()) or (select public.is_admin()));
alter policy "member app: insert own" on public.member_applications with check (user_id = (select auth.uid()));
alter policy "member app: resubmit own" on public.member_applications
  using (user_id = (select auth.uid()) and status = 'rejected') with check (user_id = (select auth.uid()));
alter policy "memberships: own or admin" on public.memberships
  using (user_id = (select auth.uid()) or (select public.is_admin()));
alter policy "notifications: own delete" on public.notifications using (user_id = (select auth.uid()));
alter policy "notifications: own read" on public.notifications using (user_id = (select auth.uid()));
alter policy "notifications: own mark read" on public.notifications
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "partners: edit own" on public.partners
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
alter policy "partners: approved public, own, admin" on public.partners
  using ((status = 'approved' and active) or owner_id = (select auth.uid()) or (select public.is_admin()));
alter policy "partners: apply own" on public.partners with check (owner_id = (select auth.uid()));
alter policy "profiles: update own" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "roles: own or admin" on public.user_roles
  using (user_id = (select auth.uid()) or (select public.is_admin()));
alter policy "avatars: update own" on storage.objects
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter policy "avatars: delete own" on storage.objects
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
alter policy "avatars: upload own" on storage.objects
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3) Housekeeping: expired card codes are also cleared when a code is issued;
--    this index keeps that delete cheap.
create index if not exists card_tokens_expires_idx on public.card_tokens (expires_at);
