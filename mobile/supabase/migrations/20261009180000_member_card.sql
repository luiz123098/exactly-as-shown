-- Phase 2: member card with a dynamic QR code and the partner scanner.
-- The app asks for a short-lived code (60 s) and shows it as a QR; a screenshot
-- stops working within a minute. Partners validate codes and every check is logged.

create table public.card_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null
);
create index card_tokens_user_idx on public.card_tokens (user_id);
alter table public.card_tokens enable row level security;
revoke all on public.card_tokens from anon, authenticated;

create table public.card_scans (
  id bigint generated always as identity primary key,
  -- Null when an admin checked the card.
  partner_id uuid references public.partners(id) on delete cascade,
  member_id uuid not null references auth.users(id) on delete cascade,
  scanned_by uuid references auth.users(id) on delete set null,
  valid boolean not null,
  created_at timestamptz not null default now()
);
create index card_scans_partner_idx on public.card_scans (partner_id, created_at desc);
create index card_scans_member_idx on public.card_scans (member_id, created_at desc);
alter table public.card_scans enable row level security;
revoke all on public.card_scans from anon, authenticated;
grant select on public.card_scans to authenticated;
create policy "card scans: own partner, own member or admin" on public.card_scans for select to authenticated
  using (member_id = auth.uid() or partner_id = public.my_partner_id() or public.is_admin());

-- 8 characters from an alphabet without look-alikes (no 0/O, 1/I), ~40 bits.
create or replace function public.new_card_code()
returns text language sql volatile set search_path = public as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(b, i) % 32 + 1, 1), '' order by i)
  from (select uuid_send(gen_random_uuid()) as b) r, generate_series(0, 7) as i
$$;
revoke execute on function public.new_card_code() from public, anon, authenticated;

create or replace function public.member_card_token()
returns json language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); code text; exp timestamptz := now() + interval '60 seconds';
begin
  if uid is null or not public.is_subscriber(uid) then
    raise exception 'A carteirinha é exclusiva para assinantes ativos';
  end if;
  delete from public.card_tokens where expires_at < now();
  loop
    code := public.new_card_code();
    begin
      insert into public.card_tokens (token, user_id, expires_at) values (code, uid, exp);
      exit;
    exception when unique_violation then
      -- Astronomically rare; just draw another code.
    end;
  end loop;
  return json_build_object('token', code, 'expires_at', exp);
end $$;
revoke execute on function public.member_card_token() from public, anon;
grant execute on function public.member_card_token() to authenticated;

-- Accepts the raw QR content ("EXC:ABCD2345") or the code typed by hand ("abcd-2345").
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
  insert into public.card_scans (partner_id, member_id, scanned_by, valid) values (pid, member, uid, ok);
  return json_build_object(
    'valid', ok,
    'full_name', p.full_name,
    'avatar_path', p.avatar_path,
    'instagram', p.instagram,
    'expires_at', until,
    'reason', case when ok then null else 'A anuidade deste membro não está ativa.' end);
end $$;
revoke execute on function public.partner_scan_card(text) from public, anon;
grant execute on function public.partner_scan_card(text) to authenticated;
