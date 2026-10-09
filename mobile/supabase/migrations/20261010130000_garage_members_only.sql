-- Garages belong to members only: a partner company account can't add or edit
-- cars, even if it also has an active membership.
drop policy "cars: subscribers add own" on public.cars;
drop policy "cars: subscribers edit own" on public.cars;
create policy "cars: subscribers add own" on public.cars for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_subscriber((select auth.uid()))
              and not public.is_active_partner((select auth.uid())));
create policy "cars: subscribers edit own" on public.cars for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_subscriber((select auth.uid()))
         and not public.is_active_partner((select auth.uid())))
  with check (owner_id = (select auth.uid()));
