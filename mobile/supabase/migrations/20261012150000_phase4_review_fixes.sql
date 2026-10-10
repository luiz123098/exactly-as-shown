-- Fixes from the Phase 4 code review.

-- 1) Removed imported news / Instagram posts must not come back on the next sync.
create table public.removed_external_urls (
  url text primary key,
  removed_at timestamptz not null default now()
);
alter table public.removed_external_urls enable row level security;
revoke all on public.removed_external_urls from anon, authenticated;

-- 2) Removing a post also resolves its open reports.
create or replace function public.admin_remove_article(_article uuid, _reason text)
returns text language plpgsql security definer set search_path = public as $$
declare a public.articles; owner uuid; reason text := nullif(left(trim(coalesce(_reason, '')), 500), '');
begin
  perform public.require_admin();
  update public.content_reports set status = 'resolved' where article_id = _article and status = 'open';
  delete from public.articles where id = _article returning * into a;
  if a.id is null then raise exception 'Notícia não encontrada'; end if;
  if a.external_url is not null then
    insert into public.removed_external_urls (url) values (a.external_url) on conflict do nothing;
  end if;
  if a.origin = 'partner' then
    select owner_id into owner from public.partners where id = a.partner_id;
    perform public.notify(owner, 'news', 'Post removido',
      left(a.title, 80) || ' foi removido pela equipe.' || coalesce(' Motivo: ' || reason, ''), '/noticias');
  end if;
  perform public.audit('article.remove', 'article', a.id::text, jsonb_build_object('reason', reason));
  return a.cover_path;
end $$;

-- 3) Only recent Exotic posts notify (the first Instagram sync brings older ones too).
create or replace function public.notify_exotic_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origin = 'exotic' and new.published_at > now() - interval '2 days' then
    perform public.notify_all('news', 'Novo post da Exotic Motors', left(new.title, 120), '/noticia/' || new.id);
  end if;
  return null;
end $$;

-- 4) Two devices redeeming at the same moment can't both pass the usage limit.
create or replace function public.partner_redeem_promotion(_scan bigint, _promotion uuid)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  pid uuid := public.my_partner_id();
  s public.card_scans;
  pr public.promotions;
  last_use timestamptz;
  company text;
begin
  if pid is null then raise exception 'Apenas parceiros ativos podem registrar promoções'; end if;
  select * into s from public.card_scans where id = _scan and partner_id = pid;
  if s.id is null or not s.valid or s.created_at < now() - interval '15 minutes' then
    raise exception 'Leia a carteirinha do membro de novo para registrar a promoção';
  end if;
  select * into pr from public.promotions where id = _promotion and partner_id = pid;
  if pr.id is null or not public.promotion_is_live(pr) then raise exception 'Esta promoção não está ativa'; end if;
  if not public.is_subscriber(s.member_id) then raise exception 'A anuidade deste membro não está ativa'; end if;

  -- Serialize per (promotion, member) until the end of this transaction.
  perform pg_advisory_xact_lock(hashtextextended(pr.id::text || ':' || s.member_id::text, 0));
  select max(used_at) into last_use from public.promotion_uses where promotion_id = pr.id and member_id = s.member_id;
  if last_use is not null and (
       pr.usage_limit = 'once'
    or (pr.usage_limit = 'daily' and (last_use at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date)
    or (pr.usage_limit = 'monthly' and date_trunc('month', last_use at time zone 'America/Sao_Paulo') = date_trunc('month', now() at time zone 'America/Sao_Paulo'))
  ) then
    raise exception 'O membro já usou esta promoção (%)', case pr.usage_limit
      when 'once' then 'uso único' when 'daily' then 'limite de 1 por dia' else 'limite de 1 por mês' end;
  end if;

  insert into public.promotion_uses (promotion_id, partner_id, member_id, scan_id) values (pr.id, pid, s.member_id, s.id);
  select company_name into company from public.partners where id = pid;
  perform public.notify(s.member_id, 'promotion', 'Promoção usada', pr.title || ' em ' || company || '.', '/parceiros/' || pid);
  return json_build_object('ok', true, 'title', pr.title);
end $$;

-- 5) News filters: approved segments with posts, without downloading every post.
create or replace function public.news_niches()
returns table (id uuid, name text)
language sql stable security definer set search_path = public as $$
  select n.id, n.name from public.niches n
   where n.status = 'approved'
     and exists (select 1 from public.articles a join public.partners p on p.id = a.partner_id
                 where a.niche_id = n.id and p.status = 'approved' and p.active)
   order by n.name
$$;
revoke execute on function public.news_niches() from public, anon;
grant execute on function public.news_niches() to authenticated;
