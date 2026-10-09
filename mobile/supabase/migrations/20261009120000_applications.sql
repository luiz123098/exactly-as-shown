-- Phase 2: partner meeting scheduling and admin review of applications.
-- The admin proposes a date/time/place; the applicant confirms it or asks for
-- another time (which sends the application back to 'pending').

alter table public.partners
  add column meeting_at timestamptz,
  add column meeting_place text check (char_length(meeting_place) <= 200),
  add column meeting_request text check (char_length(meeting_request) <= 500);
-- No column grants: owners read these through my_partner()/my_access(),
-- admins through admin_partner()/admin_list_partners().

-- Server functions that change a row on the applicant's behalf set this flag so
-- the guard trigger lets their status change through.
create or replace function public.guard_partner()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin()
     and current_setting('exotic.trusted', true) is distinct from 'on' then
    if tg_op = 'INSERT' then
      new.status := 'pending'; new.active := true; new.decision_reason := null; new.approved_at := null;
      new.meeting_at := null; new.meeting_place := null; new.meeting_request := null;
    else
      -- Owners edit their company data; status/activation belong to admins.
      new.status := old.status; new.active := old.active; new.owner_id := old.owner_id;
      new.decision_reason := old.decision_reason; new.approved_at := old.approved_at;
      new.created_at := old.created_at;
      new.meeting_at := old.meeting_at; new.meeting_place := old.meeting_place; new.meeting_request := old.meeting_request;
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.notify_admins(_kind text, _title text, _body text, _link text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, title, body, link)
  select user_id, _kind, _title, _body, _link from public.user_roles where role = 'admin'
$$;
revoke execute on function public.notify_admins(text, text, text, text) from public, anon, authenticated;

create or replace function public.meeting_label(_at timestamptz, _place text)
returns text language sql stable set search_path = public as $$
  select to_char(_at at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') || ' · ' || _place
$$;

-- ---------------------------------------------------------------- admin side
create or replace function public.admin_list_partners()
returns setof public.partners language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query select * from public.partners order by created_at desc;
end $$;

create or replace function public.admin_propose_meeting(_partner uuid, _at timestamptz, _place text)
returns void language plpgsql security definer set search_path = public as $$
declare p public.partners; place text := left(trim(coalesce(_place, '')), 200);
begin
  perform public.require_admin();
  if _at is null or _at <= now() then raise exception 'Escolha uma data futura para a reunião'; end if;
  if char_length(place) < 2 then raise exception 'Informe o local ou o link da reunião'; end if;
  update public.partners
     set status = 'meeting_proposed', meeting_at = _at, meeting_place = place, meeting_request = null
   where id = _partner and status in ('pending', 'meeting_proposed', 'meeting_confirmed')
  returning * into p;
  if p.id is null then raise exception 'Esta solicitação já foi decidida'; end if;
  perform public.notify(p.owner_id, 'partner', 'Reunião proposta',
    public.meeting_label(_at, place) || '. Abra seu perfil para confirmar.', '/perfil');
  perform public.audit('partner.meeting', 'partner', p.id::text, jsonb_build_object('at', _at, 'place', place));
end $$;

-- Same as before, plus a notification when the application is rejected.
create or replace function public.admin_set_partner_status(_partner uuid, _status public.partner_status, _reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.partners;
begin
  perform public.require_admin();
  update public.partners set status = _status, decision_reason = nullif(left(trim(_reason), 500), ''),
         approved_at = case when _status = 'approved' then now() else approved_at end
   where id = _partner returning * into p;
  if p.id is null then raise exception 'not found'; end if;
  if _status = 'approved' then
    insert into public.user_roles (user_id, role) values (p.owner_id, 'partner') on conflict do nothing;
    perform public.notify(p.owner_id, 'partner', 'Parceria aprovada', 'Sua conta de parceiro está ativa.', '/parceiro');
  elsif _status = 'rejected' then
    delete from public.user_roles where user_id = p.owner_id and role = 'partner';
    perform public.notify(p.owner_id, 'partner', 'Parceria não aprovada',
      coalesce('Motivo: ' || p.decision_reason, 'Entre em contato para mais informações.'), '/perfil');
  end if;
  perform public.audit('partner.status', 'partner', p.id::text, jsonb_build_object('status', _status, 'reason', p.decision_reason));
end $$;

-- ---------------------------------------------------------------- applicant side
create or replace function public.partner_respond_meeting(_confirm boolean, _request text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.partners;
begin
  perform set_config('exotic.trusted', 'on', true);
  update public.partners
     set status = case when _confirm then 'meeting_confirmed' else 'pending' end::public.partner_status,
         meeting_request = case when _confirm then null else nullif(left(trim(_request), 500), '') end
   where owner_id = auth.uid() and status = 'meeting_proposed'
  returning * into p;
  perform set_config('exotic.trusted', 'off', true);
  if p.id is null then raise exception 'Nenhuma reunião aguardando confirmação'; end if;
  if _confirm then
    perform public.notify_admins('partner', 'Reunião confirmada',
      p.company_name || ': ' || public.meeting_label(p.meeting_at, p.meeting_place), '/admin');
  else
    perform public.notify_admins('partner', 'Pedido de outro horário',
      p.company_name || coalesce(': ' || p.meeting_request, ''), '/admin');
  end if;
end $$;
revoke execute on function public.partner_respond_meeting(boolean, text) from public, anon;
grant execute on function public.partner_respond_meeting(boolean, text) to authenticated;

-- New applications show up for the admins.
create or replace function public.notify_new_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'partners' then
    perform public.notify_admins('partner', 'Nova solicitação de parceria', new.company_name, '/admin');
  elsif tg_op = 'INSERT' or old.status = 'rejected' then
    perform public.notify_admins('application', 'Nova solicitação de membro', new.full_name, '/admin');
  end if;
  return null;
end $$;
revoke execute on function public.notify_new_application() from public, anon, authenticated;
create trigger partners_notify_new after insert on public.partners
  for each row execute function public.notify_new_application();
create trigger member_applications_notify_new after insert or update of reason on public.member_applications
  for each row execute function public.notify_new_application();

-- my_access now also carries what the profile screen shows about each application.
create or replace function public.my_access()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'is_admin', public.has_role(auth.uid(), 'admin'),
    'is_subscriber', public.is_subscriber(auth.uid()),
    'membership_expires_at', (select max(expires_at) from public.memberships
       where user_id = auth.uid() and suspended_at is null and starts_at <= now()),
    'member_application', (select json_build_object('status', status, 'decision_reason', decision_reason)
       from public.member_applications where user_id = auth.uid()),
    'partner', (select json_build_object('id', id, 'status', status, 'active', active, 'company_name', company_name,
       'decision_reason', decision_reason, 'meeting_at', meeting_at, 'meeting_place', meeting_place,
       'meeting_request', meeting_request)
       from public.partners where owner_id = auth.uid())
  )
$$;
