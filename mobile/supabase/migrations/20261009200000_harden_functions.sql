-- Security advisor fixes: nothing in the app calls the database before signing
-- in, so the API functions are only executable by signed-in users. Each one
-- still checks permissions itself (admins, owners, subscribers).
do $$
declare f text;
begin
  foreach f in array array[
    'public.admin_list_partners()',
    'public.admin_partner(uuid)',
    'public.admin_propose_meeting(uuid, timestamptz, text)',
    'public.admin_review_member(uuid, boolean, text)',
    'public.admin_set_membership(uuid, timestamptz, text)',
    'public.admin_set_partner_active(uuid, boolean)',
    'public.admin_set_partner_status(uuid, public.partner_status, text)',
    'public.admin_suspend_membership(uuid, text)',
    'public.has_role(uuid, public.app_role)',
    'public.is_active_partner(uuid)',
    'public.is_admin()',
    'public.is_subscriber(uuid)',
    'public.my_access()',
    'public.my_partner()',
    'public.my_partner_id()',
    'public.my_profile()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

alter function public.touch_updated_at() set search_path = public;
