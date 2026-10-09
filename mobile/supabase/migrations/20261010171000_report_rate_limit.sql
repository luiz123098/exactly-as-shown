-- Reporters can't read the reports table, so the hourly limit is counted by
-- a server function instead of a subquery inside the policy.
create or replace function public.my_recent_reports()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.content_reports
   where reporter_id = auth.uid() and created_at > now() - interval '1 hour'
$$;
revoke execute on function public.my_recent_reports() from public, anon;
grant execute on function public.my_recent_reports() to authenticated;

alter policy "reports: file own" on public.content_reports
  with check (
    reporter_id = (select auth.uid())
    and reported_user <> (select auth.uid())
    and (car_id is null or exists (select 1 from public.cars c where c.id = car_id and c.owner_id = reported_user))
    and (select public.my_recent_reports()) < 10
  );
