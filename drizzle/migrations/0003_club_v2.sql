
-- profiles: interests + member code
alter table public.profiles add column if not exists interests text[] not null default '{}';
alter table public.profiles add column if not exists member_code text unique default upper(substr(md5(random()::text || clock_timestamp()::text),1,8));
update public.profiles set member_code = upper(substr(md5(random()::text || id::text),1,8)) where member_code is null;

-- benefit usages: validation
alter table public.benefit_usages add column if not exists status text not null default 'pending';
alter table public.benefit_usages add column if not exists validated_at timestamptz;
alter table public.benefit_usages add column if not exists saved_amount numeric(10,2) not null default 0;
alter table public.benefit_usages add column if not exists sponsor_id uuid;
update public.benefit_usages u set sponsor_id = b.sponsor_id from public.benefits b where b.id = u.benefit_id and u.sponsor_id is null;

create or replace function public.fill_usage_sponsor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select sponsor_id into new.sponsor_id from public.benefits where id = new.benefit_id;
  new.status := 'pending'; new.validated_at := null; new.saved_amount := 0;
  return new;
end $$;
create trigger usage_fill before insert on public.benefit_usages for each row execute function public.fill_usage_sponsor();

create or replace function public.validate_usage(_code text, _amount numeric)
returns json language plpgsql security definer set search_path = public as $$
declare u record; bname text; mname text;
begin
  select bu.* into u from public.benefit_usages bu
   where upper(bu.code) = upper(trim(_code)) and public.is_sponsor_owner(bu.sponsor_id)
   order by created_at desc limit 1;
  if u.id is null then raise exception 'Código não encontrado para sua empresa'; end if;
  if u.status = 'validated' then raise exception 'Este código já foi utilizado'; end if;
  if u.created_at < now() - interval '24 hours' then raise exception 'Código expirado'; end if;
  update public.benefit_usages set status='validated', validated_at=now(), saved_amount=greatest(coalesce(_amount,0),0) where id=u.id;
  select title into bname from public.benefits where id=u.benefit_id;
  select full_name into mname from public.profiles where id=u.user_id;
  insert into public.notifications(user_id,title,body,kind,link) values (u.user_id,'Benefício utilizado ✓', coalesce(bname,''), 'usage', '/app/economia');
  return json_build_object('member', mname, 'benefit', bname);
end $$;

-- sponsor analytics
create table public.sponsor_events (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('view','click','directions','promo_view')),
  created_at timestamptz not null default now()
);
grant select, insert on public.sponsor_events to authenticated;
grant all on public.sponsor_events to service_role;
alter table public.sponsor_events enable row level security;
create policy "track insert" on public.sponsor_events for insert to authenticated with check (user_id = auth.uid());
create policy "track read" on public.sponsor_events for select to authenticated using (public.is_sponsor_owner(sponsor_id) or public.has_role(auth.uid(),'admin'));

-- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text not null default 'Encontro',
  description text not null default '',
  image_url text,
  starts_at timestamptz not null,
  location text not null default '',
  capacity int not null default 50,
  price numeric(10,2) not null default 0,
  status text not null default 'open' check (status in ('open','closed','finished')),
  min_plan_level int not null default 1,
  featured boolean not null default false,
  sponsor_ids uuid[] not null default '{}',
  gallery text[] not null default '{}',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "events read" on public.events for select to authenticated using (true);
create policy "events admin" on public.events for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  guests int not null default 0 check (guests between 0 and 3),
  status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  code text not null default upper(substr(md5(random()::text),1,8)),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
grant select, insert, update on public.event_registrations to authenticated;
grant all on public.event_registrations to service_role;
alter table public.event_registrations enable row level security;
create policy "regs read" on public.event_registrations for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "regs insert" on public.event_registrations for insert to authenticated with check (user_id = auth.uid() and public.member_level(auth.uid()) >= (select min_plan_level from public.events where id = event_id));
create policy "regs update" on public.event_registrations for update to authenticated using (user_id = auth.uid());

create or replace function public.event_taken(_event uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(1 + guests),0)::int from public.event_registrations where event_id=_event and status='confirmed'
$$;

create or replace function public.notify_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'open' and (tg_op='INSERT' or old.status is distinct from 'open') then
    insert into public.notifications(user_id,title,body,kind,link)
    select distinct s.user_id, '🎉 Nova experiência: ' || new.title, 'Inscrições abertas.', 'event', '/app/eventos/' || new.id
    from public.subscriptions s where s.status='active';
  end if;
  return new;
end $$;
create trigger events_notify after insert or update on public.events for each row execute function public.notify_event();

create or replace function public.notify_sponsor()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and tg_op='UPDATE' and old.status is distinct from 'approved' then
    insert into public.notifications(user_id,title,body,kind,link)
    select distinct s.user_id, 'Novo parceiro no clube', new.name || ' acaba de entrar para a EXOTIC.', 'sponsor', '/app/parceiros/' || new.id
    from public.subscriptions s where s.status='active';
  end if;
  return new;
end $$;
create trigger sponsors_notify after update on public.sponsors for each row execute function public.notify_sponsor();

-- community
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 1000),
  image_url text,
  created_at timestamptz not null default now()
);
create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  primary key (post_id, user_id)
);
create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.posts, public.post_likes, public.post_comments to authenticated;
grant all on public.posts, public.post_likes, public.post_comments to service_role;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
create policy "posts read" on public.posts for select to authenticated using (public.member_level(auth.uid()) >= 1 or public.has_role(auth.uid(),'admin'));
create policy "posts insert" on public.posts for insert to authenticated with check (user_id = auth.uid() and (public.member_level(auth.uid()) >= 1 or public.has_role(auth.uid(),'admin')));
create policy "posts delete" on public.posts for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "likes read" on public.post_likes for select to authenticated using (true);
create policy "likes own" on public.post_likes for insert to authenticated with check (user_id = auth.uid());
create policy "likes del" on public.post_likes for delete to authenticated using (user_id = auth.uid());
create policy "comments read" on public.post_comments for select to authenticated using (public.member_level(auth.uid()) >= 1 or public.has_role(auth.uid(),'admin'));
create policy "comments insert" on public.post_comments for insert to authenticated with check (user_id = auth.uid() and (public.member_level(auth.uid()) >= 1 or public.has_role(auth.uid(),'admin')));
create policy "comments delete" on public.post_comments for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.fill_author()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(nullif(full_name,''),'Membro') into new.author_name from public.profiles where id = new.user_id;
  return new;
end $$;
create trigger posts_author before insert on public.posts for each row execute function public.fill_author();
create trigger comments_author before insert on public.post_comments for each row execute function public.fill_author();

-- content
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Lifestyle',
  excerpt text not null default '',
  body text not null default '',
  cover_url text,
  video_url text,
  featured boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.articles to authenticated;
grant all on public.articles to service_role;
alter table public.articles enable row level security;
create policy "articles read" on public.articles for select to authenticated using (published or public.has_role(auth.uid(),'admin'));
create policy "articles admin" on public.articles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- home config (admin controlled)
create table public.home_config (
  id int primary key default 1 check (id = 1),
  sections text[] not null default array['featured','benefits','promotions','categories','nearby','events','content','map'],
  hero_title text not null default 'Seu acesso. Seus benefícios.',
  hero_subtitle text not null default 'Descubra esta experiência exclusiva.',
  hero_image text,
  hero_link text,
  hero_badge text not null default 'EXOTIC EXPERIENCE',
  updated_at timestamptz not null default now()
);
grant select, update on public.home_config to authenticated;
grant all on public.home_config to service_role;
alter table public.home_config enable row level security;
create policy "home read" on public.home_config for select to authenticated using (true);
create policy "home admin" on public.home_config for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.home_config (id, hero_image, hero_link) values (1, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600', '/app/eventos');

-- seeds
insert into public.events (title, kind, description, image_url, starts_at, location, capacity, price, featured) values
('EXOTIC Track Day', 'Track day', 'Um dia inteiro na pista com instrutores, carros esportivos e hospitalidade premium para membros.', 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=1600', now() + interval '18 days', 'Autódromo Internacional de Goiânia', 40, 450, true),
('Jantar Harmonizado EXOTIC', 'Jantar', 'Menu degustação de 7 tempos com harmonização de vinhos, em mesa exclusiva para membros.', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1600', now() + interval '9 days', 'Setor Marista, Goiânia', 24, 290, false),
('Encontro de Supercarros', 'Encontro', 'Café da manhã, exposição de carros e networking entre membros e parceiros.', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1600', now() + interval '4 days', 'Flamboyant, Goiânia', 120, 0, false),
('Noite EXOTIC — Lançamento', 'Festa', 'Festa de lançamento da temporada com DJ, open bar e convidados especiais.', 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1600', now() + interval '30 days', 'Setor Bueno, Goiânia', 200, 150, false);

insert into public.articles (title, category, excerpt, body, cover_url, featured) values
('Guia: 5 estradas para dirigir em Goiás', 'Automotive', 'Roteiros para aproveitar curvas, paisagens e boa gastronomia no caminho.', 'Goiás guarda estradas perfeitas para quem gosta de dirigir. Separamos cinco roteiros com paradas em parceiros EXOTIC ao longo do caminho, da Serra Dourada a Pirenópolis.', 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1600', true),
('Onde jantar bem em Goiânia', 'Gastronomia', 'A curadoria EXOTIC das mesas que valem a reserva.', 'Do contemporâneo ao clássico, reunimos as casas que oferecem condições exclusivas aos membros do clube.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600', false),
('Entrevista: o luxo como experiência', 'Business', 'Conversamos com empreendedores sobre o novo consumo premium.', 'O luxo deixou de ser apenas produto e passou a ser experiência. Nesta entrevista, parceiros do clube contam como pensam o atendimento para membros.', 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600', false),
('Fim de semana em Pirenópolis', 'Travel', 'Pousadas, cachoeiras e gastronomia a 2 horas de Goiânia.', 'Um roteiro completo para um fim de semana de descanso com o melhor da cidade histórica.', 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1600', false),
('Bem-estar para quem vive em alta performance', 'Lifestyle', 'Rotinas de recuperação, treino e cuidado que cabem na agenda.', 'Spa, academia e nutrição: como montar uma rotina de alta performance com os parceiros EXOTIC.', 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1600', false);
