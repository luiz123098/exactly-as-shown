-- Segments are a fixed list kept by the admins: companies only pick one.
-- (Replaces partner suggestions; pending suggestions can still be approved.)
drop policy "niches: suggest" on public.niches;
revoke insert on public.niches from authenticated;
drop trigger niches_notify on public.niches;
drop function public.notify_new_niche();

insert into public.niches (name, status) values
  ('Produtos de limpeza automotiva', 'approved'), ('Envelopamento e películas', 'approved'),
  ('Som e acessórios', 'approved'), ('Blindagem', 'approved'), ('Lava-rápido', 'approved'),
  ('Funilaria e pintura', 'approved'), ('Peças e performance', 'approved'), ('Locadoras', 'approved'),
  ('Bebidas e charutaria', 'approved'), ('Saúde e bem-estar', 'approved')
on conflict do nothing;

create or replace function public.admin_add_niche(_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare nid uuid; clean text := initcap(trim(coalesce(_name, '')));
begin
  perform public.require_admin();
  if char_length(clean) < 2 or char_length(clean) > 40 then raise exception 'O nome precisa ter entre 2 e 40 caracteres'; end if;
  insert into public.niches (name, status) values (clean, 'approved')
  on conflict (lower(name)) do update set status = 'approved'
  returning id into nid;
  perform public.audit('niche.add', 'niche', nid::text, jsonb_build_object('name', clean));
  return nid;
end $$;
revoke execute on function public.admin_add_niche(text) from public, anon;
grant execute on function public.admin_add_niche(text) to authenticated;

-- Moving a company to another segment also moves its posts.
create or replace function public.admin_set_partner_niche(_partner uuid, _niche uuid)
returns void language plpgsql security definer set search_path = public as $$
declare n public.niches;
begin
  perform public.require_admin();
  select * into n from public.niches where id = _niche and status = 'approved';
  if n.id is null then raise exception 'Escolha um segmento aprovado'; end if;
  update public.partners set niche_id = n.id, niche = n.name where id = _partner;
  if not found then raise exception 'Parceiro não encontrado'; end if;
  update public.articles set niche_id = n.id where partner_id = _partner;
  perform public.audit('partner.niche', 'partner', _partner::text, jsonb_build_object('niche', n.name));
end $$;
revoke execute on function public.admin_set_partner_niche(uuid, uuid) from public, anon;
grant execute on function public.admin_set_partner_niche(uuid, uuid) to authenticated;
