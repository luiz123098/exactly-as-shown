-- Phase 4 (part 1): news.
-- Feed = curated automotive news (RSS, summaries + link only), Exotic Motors
-- posts (Instagram import or written by an admin) and partner posts, filtered by
-- the partners' niches. Partners post directly; admins can remove with a reason.
-- Only Exotic Motors posts and admin highlights notify users. Everything is
-- deleted after 45 days by the news-sync function.

-- ---------------------------------------------------------------- niches
create table public.niches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  suggested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index niches_name_idx on public.niches (lower(name));
alter table public.niches enable row level security;
revoke all on public.niches from anon, authenticated;
grant select on public.niches to authenticated;
grant insert (name, suggested_by) on public.niches to authenticated;
create policy "niches: approved, own suggestion or admin" on public.niches for select to authenticated
  using (status = 'approved' or suggested_by = (select auth.uid()) or (select public.is_admin()));
create policy "niches: suggest" on public.niches for insert to authenticated
  with check (suggested_by = (select auth.uid()));

insert into public.niches (name, status) values
  ('Postos de combustível', 'approved'), ('Estética automotiva', 'approved'), ('Oficinas e serviços', 'approved'),
  ('Concessionárias', 'approved'), ('Pneus e rodas', 'approved'), ('Seguros', 'approved'),
  ('Restaurantes', 'approved'), ('Hotéis e turismo', 'approved'), ('Moda e acessórios', 'approved'),
  ('Eventos', 'approved');

create or replace function public.notify_new_niche()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' then
    perform public.notify_admins('niche', 'Novo nicho para aprovar', new.name, '/admin?aba=parceiros');
  end if;
  return null;
end $$;
revoke execute on function public.notify_new_niche() from public, anon, authenticated;
create trigger niches_notify after insert on public.niches for each row execute function public.notify_new_niche();

create or replace function public.admin_review_niche(_niche uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare n public.niches;
begin
  perform public.require_admin();
  update public.niches set status = case when _approve then 'approved' else 'rejected' end
   where id = _niche returning * into n;
  if n.id is null then raise exception 'Nicho não encontrado'; end if;
  if n.suggested_by is not null then
    perform public.notify(n.suggested_by, 'niche',
      case when _approve then 'Nicho aprovado' else 'Nicho não aprovado' end,
      n.name || case when _approve then ' já aparece nos filtros das notícias.' else ' não foi aprovado. Fale com a equipe para escolher outro.' end,
      '/perfil');
  end if;
  perform public.audit(case when _approve then 'niche.approve' else 'niche.reject' end, 'niche', n.id::text, '{}');
end $$;
revoke execute on function public.admin_review_niche(uuid, boolean) from public, anon;
grant execute on function public.admin_review_niche(uuid, boolean) to authenticated;

-- Partners point at a niche; the old free-text niche stays as its display name.
alter table public.partners add column niche_id uuid references public.niches(id) on delete set null;
grant insert (niche_id) on public.partners to authenticated;
-- Existing partners: their typed niche becomes a suggestion for the admin.
insert into public.niches (name, status)
  select distinct initcap(trim(niche)), 'pending' from public.partners
  on conflict do nothing;
update public.partners p set niche_id = n.id from public.niches n where lower(n.name) = lower(trim(p.niche));

-- ---------------------------------------------------------------- articles
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  origin text not null check (origin in ('auto', 'exotic', 'partner')),
  title text not null check (char_length(title) between 3 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 400),
  body text not null default '' check (char_length(body) <= 5000),
  -- External image (RSS) or a file in the news bucket.
  cover_url text check (char_length(cover_url) <= 1000),
  cover_path text check (char_length(cover_path) <= 300),
  external_url text unique check (char_length(external_url) <= 1000),
  source_name text check (char_length(source_name) <= 80),
  category text check (char_length(category) <= 40),
  partner_id uuid references public.partners(id) on delete cascade,
  niche_id uuid references public.niches(id) on delete set null,
  author_id uuid references public.profiles(id) on delete set null,
  featured boolean not null default false,
  score int not null default 0,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (origin <> 'partner' or partner_id is not null),
  check (cover_path is null or split_part(cover_path, '/', 1) = author_id::text)
);
create index articles_feed_idx on public.articles (published_at desc);
create index articles_niche_idx on public.articles (niche_id, published_at desc);
create index articles_partner_idx on public.articles (partner_id);
alter table public.articles enable row level security;
revoke all on public.articles from anon, authenticated;
grant select on public.articles to authenticated;
grant insert (origin, title, excerpt, body, cover_path, partner_id, author_id) on public.articles to authenticated;
grant update (title, excerpt, body, cover_path) on public.articles to authenticated;
grant delete on public.articles to authenticated;

-- Partner posts disappear while the partner is inactive.
create policy "articles: read" on public.articles for select to authenticated
  using (origin <> 'partner' or public.is_active_partner((select owner_id from public.partners where id = partner_id))
         or (select public.is_admin()));
create policy "articles: partners and admins post" on public.articles for insert to authenticated
  with check (
    author_id = (select auth.uid()) and (
      (origin = 'partner' and partner_id = (select public.my_partner_id()))
      or (origin = 'exotic' and partner_id is null and (select public.is_admin()))
    )
  );
create policy "articles: edit own" on public.articles for update to authenticated
  using (author_id = (select auth.uid()) and origin <> 'auto') with check (author_id = (select auth.uid()));
create policy "articles: delete own or admin" on public.articles for delete to authenticated
  using ((author_id = (select auth.uid()) and origin <> 'auto') or (select public.is_admin()));

-- Partner posts go to the partner's niche; Exotic posts notify everyone.
create or replace function public.prepare_article()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origin = 'partner' then
    new.niche_id := (select niche_id from public.partners where id = new.partner_id);
    new.source_name := (select company_name from public.partners where id = new.partner_id);
  elsif new.origin = 'exotic' then
    new.source_name := coalesce(new.source_name, 'Exotic Motors');
    new.niche_id := null;
  end if;
  if tg_op = 'INSERT' and not public.is_admin() then new.featured := false; end if;
  return new;
end $$;
revoke execute on function public.prepare_article() from public, anon, authenticated;
create trigger articles_prepare before insert on public.articles
  for each row execute function public.prepare_article();

create or replace function public.notify_all(_kind text, _title text, _body text, _link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select id, _kind, _title, _body, _link from public.profiles
$$;
revoke execute on function public.notify_all(text, text, text, text) from public, anon, authenticated;

create or replace function public.notify_exotic_post()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.origin = 'exotic' then
    perform public.notify_all('news', 'Novo post da Exotic Motors', left(new.title, 120), '/noticia/' || new.id);
  end if;
  return null;
end $$;
revoke execute on function public.notify_exotic_post() from public, anon, authenticated;
create trigger articles_notify_exotic after insert on public.articles
  for each row execute function public.notify_exotic_post();

create or replace function public.admin_feature_article(_article uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.articles;
begin
  perform public.require_admin();
  update public.articles set featured = true where id = _article and not featured returning * into a;
  if a.id is null then raise exception 'Notícia não encontrada ou já em destaque'; end if;
  perform public.notify_all('news', 'Destaque Exotic Club', left(a.title, 120), '/noticia/' || a.id);
  perform public.audit('article.feature', 'article', a.id::text, '{}');
end $$;
revoke execute on function public.admin_feature_article(uuid) from public, anon;
grant execute on function public.admin_feature_article(uuid) to authenticated;

create or replace function public.admin_remove_article(_article uuid, _reason text)
returns text language plpgsql security definer set search_path = public as $$
declare a public.articles; owner uuid; reason text := nullif(left(trim(coalesce(_reason, '')), 500), '');
begin
  perform public.require_admin();
  delete from public.articles where id = _article returning * into a;
  if a.id is null then raise exception 'Notícia não encontrada'; end if;
  if a.origin = 'partner' then
    select owner_id into owner from public.partners where id = a.partner_id;
    perform public.notify(owner, 'news', 'Post removido',
      left(a.title, 80) || ' foi removido pela equipe.' || coalesce(' Motivo: ' || reason, ''), '/noticias');
  end if;
  perform public.audit('article.remove', 'article', a.id::text, jsonb_build_object('reason', reason));
  return a.cover_path;
end $$;
revoke execute on function public.admin_remove_article(uuid, text) from public, anon;
grant execute on function public.admin_remove_article(uuid, text) to authenticated;

-- Reports can also point at a post.
alter table public.content_reports add column article_id uuid references public.articles(id) on delete set null;
grant insert (article_id) on public.content_reports to authenticated;
alter policy "reports: file own" on public.content_reports
  with check (
    reporter_id = (select auth.uid())
    and reported_user <> (select auth.uid())
    and (car_id is null or exists (select 1 from public.cars c where c.id = car_id and c.owner_id = reported_user))
    and (article_id is null or exists (select 1 from public.articles a where a.id = article_id and a.author_id = reported_user))
    and (select public.my_recent_reports()) < 10
  );

-- ---------------------------------------------------------------- images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy "news images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'news' and (storage.foldername(name))[1] = (select auth.uid())::text
              and ((select public.my_partner_id()) is not null or (select public.is_admin())));
create policy "news images: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'news' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ---------------------------------------------------------------- sync state
-- Read by the news-sync function (service role); the admin sees the status.
create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  category text not null,
  active boolean not null default true,
  last_synced_at timestamptz,
  last_status text,
  last_count int
);
alter table public.news_sources enable row level security;
revoke all on public.news_sources from anon, authenticated;
grant select on public.news_sources to authenticated;
create policy "news sources: admin read" on public.news_sources for select to authenticated using ((select public.is_admin()));
insert into public.news_sources (name, url, category) values
  ('Motor1', 'https://motor1.uol.com.br/rss/news/all/', 'Automotivo'),
  ('Quatro Rodas', 'https://quatrorodas.abril.com.br/feed/', 'Automotivo'),
  ('Carscoops', 'https://www.carscoops.com/feed/', 'Automotivo'),
  ('Motorsport F1', 'https://www.motorsport.com/rss/f1/news/', 'Motorsport');
