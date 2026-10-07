
create type public.app_role as enum ('admin','sponsor','member');
create type public.approval_status as enum ('pending','approved','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  city text,
  avatar_url text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- plans
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  price numeric(10,2) not null,
  level int not null default 1,
  description text,
  features text[] not null default '{}',
  highlighted boolean not null default false
);
grant select on public.plans to anon, authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy "plans public" on public.plans for select using (true);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references public.plans(id),
  status text not null default 'active',
  started_at timestamptz not null default now(),
  renews_at timestamptz not null default now() + interval '30 days',
  canceled_at timestamptz
);
grant select, insert, update on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create policy "own subs read" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own subs insert" on public.subscriptions for insert to authenticated with check (user_id = auth.uid());
create policy "own subs update" on public.subscriptions for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.member_level(_uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(p.level),0) from public.subscriptions s join public.plans p on p.id = s.plan_id
  where s.user_id = _uid and s.status = 'active'
$$;

-- sponsors
create table public.sponsors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  description text not null default '',
  category text not null default 'Outros',
  logo_url text,
  cover_url text,
  address text not null default '',
  city text not null default 'Goiânia',
  lat double precision,
  lng double precision,
  phone text,
  whatsapp text,
  website text,
  instagram text,
  hours text,
  status approval_status not null default 'pending',
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.sponsors to anon;
grant select, insert, update, delete on public.sponsors to authenticated;
grant all on public.sponsors to service_role;
alter table public.sponsors enable row level security;
create policy "sponsors read" on public.sponsors for select using (status = 'approved' or owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "sponsors insert" on public.sponsors for insert to authenticated with check (owner_id = auth.uid() and (public.has_role(auth.uid(),'sponsor') or public.has_role(auth.uid(),'admin')));
create policy "sponsors update" on public.sponsors for update to authenticated using (owner_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "sponsors delete" on public.sponsors for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create or replace function public.is_sponsor_owner(_sponsor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sponsors where id = _sponsor and owner_id = auth.uid())
$$;
create or replace function public.sponsor_approved(_sponsor uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sponsors where id = _sponsor and status = 'approved')
$$;

-- non-admins cannot set status/featured
create or replace function public.guard_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.has_role(auth.uid(),'admin') or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending'; new.featured := false;
  else
    new.featured := old.featured;
    if tg_table_name = 'sponsors' then new.status := old.status;
    else
      -- edits to promotions go back to review
      if row(new.title,new.description,new.discount_label,new.image_url) is distinct from row(old.title,old.description,old.discount_label,old.image_url) then new.status := 'pending'; else new.status := old.status; end if;
    end if;
  end if;
  return new;
end $$;
create trigger sponsors_guard before insert or update on public.sponsors for each row execute function public.guard_moderation();

-- benefits
create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  title text not null,
  description text not null default '',
  discount_label text not null default '',
  rules text,
  category text not null default 'Outros',
  min_plan_level int not null default 1,
  active boolean not null default true,
  expires_at date,
  created_at timestamptz not null default now()
);
grant select on public.benefits to anon;
grant select, insert, update, delete on public.benefits to authenticated;
grant all on public.benefits to service_role;
alter table public.benefits enable row level security;
create policy "benefits read" on public.benefits for select using ((active and public.sponsor_approved(sponsor_id)) or public.is_sponsor_owner(sponsor_id) or public.has_role(auth.uid(),'admin'));
create policy "benefits write" on public.benefits for all to authenticated using (public.is_sponsor_owner(sponsor_id) or public.has_role(auth.uid(),'admin')) with check (public.is_sponsor_owner(sponsor_id) or public.has_role(auth.uid(),'admin'));

-- promotions
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  title text not null,
  description text not null default '',
  discount_label text not null default '',
  image_url text,
  category text not null default 'Outros',
  min_plan_level int not null default 1,
  starts_at date not null default current_date,
  ends_at date,
  status approval_status not null default 'pending',
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.promotions to anon;
grant select, insert, update, delete on public.promotions to authenticated;
grant all on public.promotions to service_role;
alter table public.promotions enable row level security;
create policy "promos read" on public.promotions for select using ((status='approved' and public.sponsor_approved(sponsor_id)) or public.is_sponsor_owner(sponsor_id) or public.has_role(auth.uid(),'admin'));
create policy "promos write" on public.promotions for all to authenticated using (public.is_sponsor_owner(sponsor_id) or public.has_role(auth.uid(),'admin')) with check (public.is_sponsor_owner(sponsor_id) or public.has_role(auth.uid(),'admin'));
create trigger promotions_guard before insert or update on public.promotions for each row execute function public.guard_moderation();

-- favorites
create table public.favorites (
  user_id uuid not null,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, benefit_id)
);
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "own favs" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- usage history
create table public.benefit_usages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now()
);
grant select, insert on public.benefit_usages to authenticated;
grant all on public.benefit_usages to service_role;
alter table public.benefit_usages enable row level security;
create policy "own usages read" on public.benefit_usages for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or exists (select 1 from public.benefits b where b.id = benefit_id and public.is_sponsor_owner(b.sponsor_id)));
create policy "own usages insert" on public.benefit_usages for insert to authenticated with check (user_id = auth.uid() and public.member_level(auth.uid()) >= (select min_plan_level from public.benefits where id = benefit_id));

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null default '',
  kind text not null default 'info',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifs" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notifs update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "own notifs delete" on public.notifications for delete to authenticated using (user_id = auth.uid());
alter publication supabase_realtime add table public.notifications;

-- notify active members when promotion is approved
create or replace function public.notify_promotion()
returns trigger language plpgsql security definer set search_path = public as $$
declare sname text;
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select name into sname from public.sponsors where id = new.sponsor_id;
    insert into public.notifications (user_id, title, body, kind, link)
    select distinct s.user_id, 'Nova promoção: ' || new.title, coalesce(sname,'') || ' — ' || new.discount_label, 'promotion', '/app/promocoes'
    from public.subscriptions s where s.status = 'active';
  end if;
  return new;
end $$;
create trigger promotions_notify after insert or update on public.promotions for each row execute function public.notify_promotion();

-- admin broadcast
create or replace function public.broadcast_notification(_title text, _body text, _target text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  insert into public.notifications (user_id, title, body, kind)
  select r.user_id, _title, _body, 'admin' from public.user_roles r
  where (_target = 'all') or (_target = 'members' and r.role='member') or (_target='sponsors' and r.role='sponsor');
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_set_role(_user uuid, _role app_role, _grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  if _grant then insert into public.user_roles(user_id, role) values (_user,_role) on conflict do nothing;
  else delete from public.user_roles where user_id=_user and role=_role; end if;
end $$;

-- signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare r text;
begin
  insert into public.profiles (id, full_name, phone, city)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.raw_user_meta_data->>'phone', new.raw_user_meta_data->>'city');
  r := coalesce(new.raw_user_meta_data->>'account_type','member');
  if r = 'sponsor' then insert into public.user_roles(user_id, role) values (new.id,'sponsor');
  else insert into public.user_roles(user_id, role) values (new.id,'member'); end if;
  if not exists (select 1 from public.user_roles where role='admin') then
    insert into public.user_roles(user_id, role) values (new.id,'admin');
  end if;
  insert into public.notifications(user_id,title,body,kind) values (new.id,'Bem-vindo à Exotic Experience','Sua conta foi criada. Explore os benefícios do clube.','info');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- seed
insert into public.plans (slug,name,price,level,description,features,highlighted) values
('basico','Essencial',39.90,1,'Para começar a viver o clube.',array['Acesso aos benefícios essenciais','Promoções semanais','Mapa de parceiros','Notificações personalizadas'],false),
('premium','Premium',89.90,2,'A experiência completa e exclusiva.',array['Todos os benefícios Essencial','Benefícios exclusivos Premium','Promoções antecipadas','Eventos privados de membros','Atendimento prioritário'],true);

insert into public.sponsors (id,name,description,category,address,city,lat,lng,phone,whatsapp,website,instagram,hours,status,featured,cover_url) values
('11111111-0000-0000-0000-000000000001','Casa Baru Gastronomia','Cozinha autoral do cerrado em ambiente intimista no Setor Marista.','Restaurantes','Rua 146, 300 - Setor Marista','Goiânia',-16.7016,-49.2585,'(62) 3241-0001','62999990001','https://example.com','@casabaru','Ter–Dom 12h–23h','approved',true,'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200'),
('11111111-0000-0000-0000-000000000002','Iron Club Academia','Academia premium com personal trainers e área funcional.','Academias','Av. T-63, 1200 - Setor Bueno','Goiânia',-16.7093,-49.2740,'(62) 3241-0002','62999990002',null,'@ironclub','Seg–Sex 5h–23h','approved',true,'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200'),
('11111111-0000-0000-0000-000000000003','Solaris Spa & Estética','Spa urbano com tratamentos faciais, massagens e day spa.','Saúde e bem-estar','Av. 85, 2000 - Setor Sul','Goiânia',-16.6929,-49.2589,'(62) 3241-0003','62999990003',null,'@solarisspa','Seg–Sáb 9h–20h','approved',false,'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200'),
('11111111-0000-0000-0000-000000000004','Ateliê Oeste Moda','Moda autoral masculina e feminina com peças exclusivas.','Moda','Rua 9, 450 - Setor Oeste','Goiânia',-16.6799,-49.2696,'(62) 3241-0004','62999990004',null,'@ateliêoeste','Seg–Sáb 10h–19h','approved',false,'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200'),
('11111111-0000-0000-0000-000000000005','Rota Goyaz Turismo','Roteiros para Pirenópolis, Chapada dos Veadeiros e Caldas Novas.','Viagens','Av. Jamel Cecílio, 3300 - Jardim Goiás','Goiânia',-16.7068,-49.2390,'(62) 3241-0005','62999990005',null,'@rotagoyaz','Seg–Sex 9h–18h','approved',true,'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200'),
('11111111-0000-0000-0000-000000000006','Vértice Automotiva','Estética automotiva, lavagem detalhada e cristalização.','Automotivo','Av. Anhanguera, 5000 - Centro','Goiânia',-16.6786,-49.2550,'(62) 3241-0006','62999990006',null,'@verticeauto','Seg–Sáb 8h–18h','approved',false,'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1200'),
('11111111-0000-0000-0000-000000000007','Mirante Bar','Coquetelaria autoral com vista para o Parque Vaca Brava.','Bares','Av. T-10, 700 - Setor Bueno','Goiânia',-16.7037,-49.2700,'(62) 3241-0007','62999990007',null,'@mirantebar','Qua–Dom 18h–2h','approved',false,'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=1200'),
('11111111-0000-0000-0000-000000000008','Pousada Serra dos Pireneus','Pousada boutique no centro histórico de Pirenópolis.','Hotéis','Rua do Rosário, 20','Pirenópolis',-15.8519,-48.9590,'(62) 3331-0008','62999990008',null,'@serrapireneus','Todos os dias','approved',true,'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200'),
('11111111-0000-0000-0000-000000000009','Clínica Vitta','Clínica médica e odontológica com check-ups completos.','Saúde e bem-estar','Av. Portugal, 1500 - Setor Marista','Goiânia',-16.7055,-49.2630,'(62) 3241-0009','62999990009',null,'@clinicavitta','Seg–Sex 7h–19h','approved',false,'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200'),
('11111111-0000-0000-0000-000000000010','Termas Quentes Resort','Resort com parque aquático de águas termais.','Hotéis','Av. Orcalino Santos, 100','Caldas Novas',-17.7441,-48.6250,'(64) 3453-0010','64999990010',null,'@termasquentes','Todos os dias','approved',false,'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1200');

insert into public.benefits (sponsor_id,title,description,discount_label,rules,category,min_plan_level) values
('11111111-0000-0000-0000-000000000001','Menu degustação','Desconto no menu degustação de 7 tempos.','20% OFF','Válido de terça a quinta. Reserva antecipada.','Restaurantes',1),
('11111111-0000-0000-0000-000000000001','Sobremesa cortesia','Sobremesa da casa em pedidos acima de R$150.','Cortesia','1 por mesa.','Restaurantes',2),
('11111111-0000-0000-0000-000000000002','Matrícula grátis','Isenção total da taxa de matrícula.','Isenção','Plano mínimo trimestral.','Academias',1),
('11111111-0000-0000-0000-000000000002','Mensalidade Black','Desconto na mensalidade do plano Black.','25% OFF','Enquanto a assinatura estiver ativa.','Academias',2),
('11111111-0000-0000-0000-000000000003','Day spa','Desconto no pacote day spa completo.','30% OFF','Agendamento pelo WhatsApp.','Saúde e bem-estar',2),
('11111111-0000-0000-0000-000000000003','Massagem relaxante','Desconto em massagens de 60 min.','15% OFF',null,'Saúde e bem-estar',1),
('11111111-0000-0000-0000-000000000004','Coleção nova','Desconto em toda a coleção atual.','15% OFF','Não cumulativo.','Moda',1),
('11111111-0000-0000-0000-000000000005','Pacote Chapada','Desconto no pacote de 3 dias na Chapada.','R$300 OFF','Sujeito à disponibilidade.','Viagens',2),
('11111111-0000-0000-0000-000000000005','Bate-volta Pirenópolis','Desconto no passeio bate-volta.','10% OFF',null,'Viagens',1),
('11111111-0000-0000-0000-000000000006','Lavagem detalhada','Desconto em lavagem detalhada.','20% OFF',null,'Automotivo',1),
('11111111-0000-0000-0000-000000000007','Drink de boas-vindas','Um drink autoral cortesia por visita.','Cortesia','1 por membro por noite.','Bares',1),
('11111111-0000-0000-0000-000000000008','Diária extra','Na compra de 2 diárias, a 3ª é cortesia.','3ª diária grátis','Exceto feriados.','Hotéis',2),
('11111111-0000-0000-0000-000000000009','Check-up completo','Desconto em check-up executivo.','25% OFF',null,'Saúde e bem-estar',1),
('11111111-0000-0000-0000-000000000010','Day use','Desconto no day use do parque.','20% OFF',null,'Hotéis',1);

insert into public.promotions (sponsor_id,title,description,discount_label,category,min_plan_level,ends_at,status,featured,image_url) values
('11111111-0000-0000-0000-000000000001','Noite do Cerrado','Jantar harmonizado com vinhos nacionais, só esta semana.','35% OFF','Restaurantes',1,current_date + 7,'approved',true,'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200'),
('11111111-0000-0000-0000-000000000005','Feriado na Chapada','Pacote exclusivo para membros Premium.','40% OFF','Viagens',2,current_date + 20,'approved',true,'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200'),
('11111111-0000-0000-0000-000000000002','Primeiro mês','Primeiro mês pela metade do preço.','50% OFF','Academias',1,current_date + 3,'approved',false,'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200'),
('11111111-0000-0000-0000-000000000003','Semana do bem-estar','Pacote facial + massagem.','30% OFF','Saúde e bem-estar',1,current_date + 10,'approved',false,'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200'),
('11111111-0000-0000-0000-000000000008','Inverno em Piri','Diárias com café colonial incluso.','25% OFF','Hotéis',1,current_date + 30,'approved',true,'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200');
