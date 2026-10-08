alter table public.articles
  add column if not exists status text not null default 'published',
  add column if not exists origin text not null default 'editorial',
  add column if not exists sponsor_id uuid,
  add column if not exists author_id uuid,
  add column if not exists source_name text,
  add column if not exists source_url text,
  add column if not exists external_url text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists publish_at timestamptz,
  add column if not exists score int not null default 0,
  add column if not exists cta_kind text,
  add column if not exists cta_id uuid;
alter table public.articles add constraint articles_status_chk check (status in ('draft','pending','approved','published','rejected'));
alter table public.articles add constraint articles_origin_chk check (origin in ('editorial','auto','partner'));
create unique index if not exists articles_external_url_key on public.articles(external_url);
create index if not exists articles_status_idx on public.articles(status, publish_at);
update public.articles set status = case when published then 'published' else 'draft' end;
update public.articles set category = case category when 'Automotive' then 'Automotivo' when 'Travel' then 'Viagens' when 'Gastronomia' then 'Lifestyle' when 'Experiences' then 'Experiências' else category end;

alter table public.sponsors add column if not exists niche text not null default 'Lifestyle';

create or replace function public.niche_category(_niche text) returns text language sql immutable as $$
  select case _niche when 'Gastronomia' then 'Lifestyle' when 'Serviços' then 'Business' when 'Outros' then 'Lifestyle' else coalesce(_niche,'Lifestyle') end
$$;

create or replace function public.guard_article() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.has_role(auth.uid(),'admin') then
    new.published := (new.status = 'published');
    return new;
  end if;
  if new.sponsor_id is null or not public.is_sponsor_owner(new.sponsor_id) then raise exception 'not allowed'; end if;
  if tg_op = 'UPDATE' and old.status not in ('draft','pending','rejected') then raise exception 'Conteúdo já aprovado não pode ser editado'; end if;
  if new.status not in ('draft','pending') then new.status := 'pending'; end if;
  new.origin := 'partner';
  new.author_id := auth.uid();
  new.featured := false;
  new.published := false;
  new.publish_at := null;
  new.category := public.niche_category((select niche from public.sponsors where id = new.sponsor_id));
  new.cta_kind := 'sponsor'; new.cta_id := new.sponsor_id;
  return new;
end $$;
create trigger articles_guard before insert or update on public.articles for each row execute function public.guard_article();

drop policy if exists "articles read" on public.articles;
create policy "articles read" on public.articles for select to authenticated using (
  (published and (publish_at is null or publish_at <= now()))
  or public.has_role(auth.uid(),'admin')
  or (sponsor_id is not null and public.is_sponsor_owner(sponsor_id)));
create policy "articles partner insert" on public.articles for insert to authenticated with check (sponsor_id is not null and public.is_sponsor_owner(sponsor_id));
create policy "articles partner update" on public.articles for update to authenticated using (sponsor_id is not null and public.is_sponsor_owner(sponsor_id) and status in ('draft','pending','rejected')) with check (sponsor_id is not null and public.is_sponsor_owner(sponsor_id));
create policy "articles partner delete" on public.articles for delete to authenticated using (sponsor_id is not null and public.is_sponsor_owner(sponsor_id) and status <> 'published');

create table public.news_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null unique,
  category text not null default 'Automotivo',
  active boolean not null default true,
  last_synced_at timestamptz,
  last_status text,
  last_count int not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.news_sources to authenticated;
grant all on public.news_sources to service_role;
alter table public.news_sources enable row level security;
create policy "sources admin" on public.news_sources for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.news_settings (
  id int primary key default 1 check (id = 1),
  interval_minutes int not null default 60 check (interval_minutes between 15 and 1440),
  auto_publish boolean not null default true,
  min_score int not null default 1,
  last_run_at timestamptz
);
grant select, insert, update on public.news_settings to authenticated;
grant all on public.news_settings to service_role;
alter table public.news_settings enable row level security;
create policy "settings admin" on public.news_settings for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.news_settings (id) values (1) on conflict do nothing;

insert into public.news_sources (name, url, category) values
  ('Motor1 Brasil','https://motor1.uol.com.br/rss/news/all/','Automotivo'),
  ('Quatro Rodas','https://quatrorodas.abril.com.br/feed/','Automotivo'),
  ('Carscoops','https://www.carscoops.com/feed/','Automotivo'),
  ('Motorsport.com F1','https://www.motorsport.com/rss/f1/news/','Automotivo')
on conflict do nothing;

create table public.article_reads (
  user_id uuid not null,
  article_id uuid not null references public.articles(id) on delete cascade,
  category text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, article_id)
);
grant select, insert, update on public.article_reads to authenticated;
grant all on public.article_reads to service_role;
alter table public.article_reads enable row level security;
create policy "reads own" on public.article_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());