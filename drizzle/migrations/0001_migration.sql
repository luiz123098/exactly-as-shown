
create table public.saved_items (
  user_id uuid not null,
  kind text not null check (kind in ('sponsor','promotion')),
  item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
grant select, insert, delete on public.saved_items to authenticated;
grant all on public.saved_items to service_role;
alter table public.saved_items enable row level security;
create policy "own saved" on public.saved_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

update public.sponsors set category = case category
  when 'Saúde e bem-estar' then 'Saúde' when 'Moda' then 'Compras' when 'Bares' then 'Entretenimento'
  when 'Viagens' then 'Entretenimento' when 'Automotivo' then 'Serviços' else category end;
update public.sponsors set category='Beleza' where name='Solaris Spa & Estética';
update public.benefits set category = case category
  when 'Saúde e bem-estar' then 'Saúde' when 'Moda' then 'Compras' when 'Bares' then 'Entretenimento'
  when 'Viagens' then 'Entretenimento' when 'Automotivo' then 'Serviços' else category end;
update public.benefits b set category='Beleza' from public.sponsors s where s.id=b.sponsor_id and s.name='Solaris Spa & Estética';
update public.promotions set category = case category
  when 'Saúde e bem-estar' then 'Saúde' when 'Moda' then 'Compras' when 'Bares' then 'Entretenimento'
  when 'Viagens' then 'Entretenimento' when 'Automotivo' then 'Serviços' else category end;
update public.promotions p set category='Beleza' from public.sponsors s where s.id=p.sponsor_id and s.name='Solaris Spa & Estética';
