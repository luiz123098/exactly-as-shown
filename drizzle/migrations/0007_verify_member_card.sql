create or replace function public.verify_member(_code text)
returns json language plpgsql stable security definer set search_path = public as $$
declare p record; pl record;
begin
  if not (public.has_role(auth.uid(),'admin') or exists (select 1 from public.sponsors where owner_id = auth.uid())) then
    raise exception 'Apenas parceiros podem validar carteirinhas';
  end if;
  select id, full_name, avatar_url, city, member_code into p from public.profiles
   where upper(member_code) = upper(trim(regexp_replace(_code, '^EXOTIC-MEMBER:', '', 'i')));
  if p.id is null then raise exception 'Carteirinha não encontrada'; end if;
  select pl2.name, s.renews_at into pl from public.subscriptions s join public.plans pl2 on pl2.id = s.plan_id
   where s.user_id = p.id and s.status = 'active' order by pl2.level desc limit 1;
  return json_build_object('name', p.full_name, 'avatar_url', p.avatar_url, 'city', p.city, 'code', p.member_code,
    'active', pl.name is not null, 'plan', pl.name, 'renews_at', pl.renews_at);
end $$;
grant execute on function public.verify_member(text) to authenticated;