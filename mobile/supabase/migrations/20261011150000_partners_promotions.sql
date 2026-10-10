-- Phase 4 (part 2): partner pages and promotions.
-- Everyone sees partner pages and promotions; only active subscribers use them.
-- A use is recorded when the partner scans the member card and picks the
-- promotion; each promotion has its own usage limit per member.

-- ---------------------------------------------------------------- partner page
alter table public.partners
  add column public_whatsapp text check (char_length(public_whatsapp) <= 30),
  add column website text check (website is null or website ~ '^https?://' and char_length(website) <= 200);
grant select (niche_id, public_whatsapp, website) on public.partners to authenticated;
grant update (public_whatsapp, website) on public.partners to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('partners', 'partners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']);
create policy "partner images: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'partners' and (storage.foldername(name))[1] = (select auth.uid())::text
              and (select public.my_partner_id()) is not null);
create policy "partner images: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'partners' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

-- ---------------------------------------------------------------- promotions
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  discount_label text check (char_length(discount_label) <= 40),
  image_path text check (char_length(image_path) <= 300),
  usage_limit text not null default 'unlimited' check (usage_limit in ('once', 'daily', 'monthly', 'unlimited')),
  ends_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index promotions_partner_idx on public.promotions (partner_id, created_at desc);
alter table public.promotions enable row level security;
revoke all on public.promotions from anon, authenticated;
grant select on public.promotions to authenticated;
grant insert (partner_id, title, description, discount_label, image_path, usage_limit, ends_at) on public.promotions to authenticated;
grant update (title, description, discount_label, image_path, usage_limit, ends_at, active) on public.promotions to authenticated;
grant delete on public.promotions to authenticated;

create or replace function public.promotion_is_live(p public.promotions)
returns boolean language sql stable set search_path = public as $$
  select p.active and (p.ends_at is null or p.ends_at > now())
$$;

-- Others see live promotions of active partners; the owner and admins see all.
create policy "promotions: read" on public.promotions for select to authenticated using (
  partner_id = (select public.my_partner_id()) or (select public.is_admin())
  or (active and (ends_at is null or ends_at > now())
      and public.is_active_partner((select owner_id from public.partners where id = partner_id)))
);
create policy "promotions: partner creates" on public.promotions for insert to authenticated
  with check (partner_id = (select public.my_partner_id()));
create policy "promotions: partner edits" on public.promotions for update to authenticated
  using (partner_id = (select public.my_partner_id())) with check (partner_id = (select public.my_partner_id()));
create policy "promotions: partner or admin deletes" on public.promotions for delete to authenticated
  using (partner_id = (select public.my_partner_id()) or (select public.is_admin()));
create trigger promotions_touch before update on public.promotions
  for each row execute function public.touch_updated_at();

create or replace function public.admin_remove_promotion(_promotion uuid, _reason text)
returns text language plpgsql security definer set search_path = public as $$
declare p public.promotions; owner uuid; reason text := nullif(left(trim(coalesce(_reason, '')), 500), '');
begin
  perform public.require_admin();
  if reason is null then raise exception 'Informe o motivo da remoção'; end if;
  update public.content_reports set status = 'resolved' where promotion_id = _promotion and status = 'open';
  delete from public.promotions where id = _promotion returning * into p;
  if p.id is null then raise exception 'Promoção não encontrada'; end if;
  select owner_id into owner from public.partners where id = p.partner_id;
  perform public.notify(owner, 'promotion', 'Promoção removida',
    left(p.title, 80) || ' foi removida pela equipe. Motivo: ' || reason, '/parceiros');
  perform public.audit('promotion.remove', 'promotion', p.id::text, jsonb_build_object('reason', reason));
  return p.image_path;
end $$;
revoke execute on function public.admin_remove_promotion(uuid, text) from public, anon;
grant execute on function public.admin_remove_promotion(uuid, text) to authenticated;

-- ---------------------------------------------------------------- uses
create table public.promotion_uses (
  id bigint generated always as identity primary key,
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  partner_id uuid not null references public.partners(id) on delete cascade,
  member_id uuid not null references public.profiles(id) on delete cascade,
  scan_id bigint references public.card_scans(id) on delete set null,
  used_at timestamptz not null default now()
);
create index promotion_uses_member_idx on public.promotion_uses (promotion_id, member_id, used_at desc);
create index promotion_uses_partner_idx on public.promotion_uses (partner_id, used_at desc);
alter table public.promotion_uses enable row level security;
revoke all on public.promotion_uses from anon, authenticated;
grant select on public.promotion_uses to authenticated;
create policy "uses: member, partner or admin" on public.promotion_uses for select to authenticated
  using (member_id = (select auth.uid()) or partner_id = (select public.my_partner_id()) or (select public.is_admin()));

-- The scan result now carries its id so the partner can register a use with it.
create or replace function public.partner_scan_card(_code text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  pid uuid := public.my_partner_id();
  code text := regexp_replace(upper(regexp_replace(coalesce(_code, ''), '^\s*EXC:', '', 'i')), '[^A-Z0-9]', '', 'g');
  member uuid;
  ok boolean;
  p public.profiles;
  until timestamptz;
  sid bigint;
begin
  if pid is null and not public.is_admin() then
    raise exception 'Apenas parceiros ativos podem validar carteirinhas';
  end if;
  select user_id into member from public.card_tokens where token = code and expires_at > now();
  if member is null then
    return json_build_object('valid', false,
      'reason', 'Código expirado ou inválido. Peça para o membro abrir a carteirinha de novo.');
  end if;
  ok := public.is_subscriber(member);
  select * into p from public.profiles where id = member;
  select max(expires_at) into until from public.memberships
   where user_id = member and suspended_at is null and starts_at <= now();
  insert into public.card_scans (partner_id, member_id, scanned_by, valid) values (pid, member, uid, ok) returning id into sid;
  return json_build_object(
    'valid', ok, 'scan_id', sid,
    'full_name', p.full_name, 'avatar_path', p.avatar_path, 'instagram', p.instagram,
    'expires_at', until,
    'reason', case when ok then null else 'A anuidade deste membro não está ativa.' end);
end $$;

-- Registers a promotion use for the member just scanned (within 15 minutes),
-- enforcing the promotion's limit for that member.
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
revoke execute on function public.partner_redeem_promotion(bigint, uuid) from public, anon;
grant execute on function public.partner_redeem_promotion(bigint, uuid) to authenticated;

-- Reports can also point at a promotion.
alter table public.content_reports add column promotion_id uuid references public.promotions(id) on delete set null;
grant insert (promotion_id) on public.content_reports to authenticated;
alter policy "reports: file own" on public.content_reports
  with check (
    reporter_id = (select auth.uid())
    and reported_user <> (select auth.uid())
    and (car_id is null or exists (select 1 from public.cars c where c.id = car_id and c.owner_id = reported_user))
    and (article_id is null or exists (select 1 from public.articles a where a.id = article_id and a.author_id = reported_user))
    and (promotion_id is null or exists (select 1 from public.promotions pr join public.partners pa on pa.id = pr.partner_id
                                         where pr.id = promotion_id and pa.owner_id = reported_user))
    and (select public.my_recent_reports()) < 10
  );

-- Translation of English news (news-sync uses it when GOOGLE_TRANSLATE_KEY is set).
alter table public.news_sources add column lang text not null default 'pt';
update public.news_sources set lang = 'en' where name in ('Carscoops', 'Motorsport F1');
