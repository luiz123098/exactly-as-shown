import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';

import { askReason, useAdminAction } from '@/components/admin';
import { CarCard } from '@/components/garage';
import { Button, Card, Empty, Text } from '@/components/ui';
import { carTitle, removeCarPhoto, type Car } from '@/lib/garage';
import { removeNewsImage } from '@/lib/news';
import { removePartnerImage } from '@/lib/partners';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

// Admin moderation of the garages: photos waiting for approval and reports.

type PendingCar = Car & { owner: { full_name: string } | null };
type Report = {
  id: string; reason: string; created_at: string; car_id: string | null; article_id: string | null; reported_user: string;
  reported: { full_name: string } | null; car: Pick<Car, 'brand' | 'model' | 'version' | 'year' | 'photo_path'> | null;
  article: { title: string } | null;
  promotion_id: string | null;
  promotion: { title: string; partner_id: string; image_path: string | null } | null;
};
type PendingNiche = { id: string; name: string; created_at: string };

export function usePendingNiches() {
  return useQuery({
    queryKey: ['admin', 'niches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('niches').select('id, name, created_at').eq('status', 'pending').order('created_at');
      if (error) throw error;
      return data as PendingNiche[];
    },
  });
}

// Segments: the admins keep the list companies pick from (old suggestions
// still waiting are approved or refused here). A segment shows up as a news
// filter once one of its companies publishes.
export function NicheQueue({ niches }: { niches: PendingNiche[] }) {
  const { busy, run } = useAdminAction(['niches'], ['news']);
  function add() {
    Alert.prompt('Novo segmento', 'Ex.: Produtos de limpeza automotiva', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Adicionar', onPress: (name?: string) => name?.trim() && run('add', 'admin_add_niche', { _name: name }, 'Segmento adicionado') },
    ], 'plain-text');
  }
  return (
    <Card>
      <Text variant="heading">Segmentos</Text>
      <Text variant="muted">As empresas escolhem o segmento desta lista. Ele aparece nas Notícias quando alguma empresa publicar.</Text>
      {niches.map((n) => (
        <View key={n.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Text style={{ flex: 1 }}>{n.name} <Text variant="muted">(sugerido)</Text></Text>
          <Button title="Aprovar" loading={busy === n.id} onPress={() => run(n.id, 'admin_review_niche', { _niche: n.id, _approve: true })} />
          <Button title="Recusar" variant="outline" disabled={busy === n.id}
            onPress={() => run(n.id, 'admin_review_niche', { _niche: n.id, _approve: false })} />
        </View>
      ))}
      <Button title="Adicionar segmento" variant="outline" loading={busy === 'add'} onPress={add} />
    </Card>
  );
}

export function usePendingPhotos() {
  return useQuery({
    queryKey: ['admin', 'photos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cars').select('*, owner:profiles!cars_owner_id_fkey(full_name)')
        .eq('photo_status', 'pending').not('photo_path', 'is', null).order('created_at');
      if (error) throw error;
      return data as PendingCar[];
    },
  });
}

export function useOpenReports() {
  return useQuery({
    queryKey: ['admin', 'reports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('content_reports')
        .select('id, reason, created_at, car_id, article_id, reported_user, reported:profiles!content_reports_reported_user_fkey(full_name), car:cars(brand, model, version, year, photo_path), article:articles(title), promotion_id, promotion:promotions(title, partner_id, image_path)')
        .eq('status', 'open').order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as Report[];
    },
  });
}

export function PhotoQueue({ cars }: { cars: PendingCar[] }) {
  const { busy, run } = useAdminAction(['garages'], ['garage']);
  // _seen_at: the server refuses the decision if the owner changed the car since.
  const review = (car: PendingCar, approve: boolean, reason?: string) =>
    run(car.id, 'admin_review_car', { _car: car.id, _approve: approve, _reason: reason ?? null, _seen_at: car.updated_at });

  if (!cars.length) return <Empty title="Nenhum carro aguardando aprovação" />;
  return cars.map((car) => (
    <CarCard key={car.id} car={car} footer={
      <View style={{ gap: space.sm, marginTop: space.xs }}>
        <Text variant="muted">De {car.owner?.full_name ?? 'membro'}</Text>
        <Button title="Ver garagem" variant="outline" onPress={() => router.push(`/admin/garagem/${car.owner_id}`)} />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title="Aprovar" style={{ flex: 1 }} loading={busy === car.id} onPress={() => review(car, true)} />
          <Button title="Reprovar" variant="outline" style={{ flex: 1 }} disabled={busy === car.id}
            onPress={() => askReason('Reprovar carro', (reason) => review(car, false, reason))} />
        </View>
      </View>
    } />
  ));
}

export function ReportList({ reports }: { reports: Report[] }) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([['admin'], ['garages'], ['garage']].map((queryKey) => qc.invalidateQueries({ queryKey })));

  async function resolve(id: string) {
    const { error } = await supabase.from('content_reports').update({ status: 'resolved' }).eq('id', id);
    if (error) return void Alert.alert('Não foi possível concluir', error.message);
    await refresh();
  }

  // The owner gets a notification with this reason; the car's open reports are resolved.
  function removeCar(r: Report) {
    askReason('Remover carro', async (reason) => {
      const { data, error } = await supabase.rpc('admin_remove_car', { _car: r.car_id, _reason: reason });
      if (error) return void Alert.alert('Não foi possível remover', error.message);
      await removeCarPhoto(data as string | null);
      await refresh();
    }, { action: 'Remover', required: true });
  }

  function removePost(r: Report) {
    askReason('Remover post', async (reason) => {
      const { data, error } = await supabase.rpc('admin_remove_article', { _article: r.article_id, _reason: reason });
      if (error) return void Alert.alert('Não foi possível remover', error.message);
      await removeNewsImage(data as string | null);
      await resolve(r.id);
      qc.invalidateQueries({ queryKey: ['news'] });
    }, { action: 'Remover', required: true });
  }

  function removePromotion(r: Report) {
    askReason('Remover promoção', async (reason) => {
      const { data, error } = await supabase.rpc('admin_remove_promotion', { _promotion: r.promotion_id, _reason: reason });
      if (error) return void Alert.alert('Não foi possível remover', error.message);
      await removePartnerImage(data as string | null);
      await refresh();
      qc.invalidateQueries({ queryKey: ['partners'] });
    }, { action: 'Remover', required: true });
  }

  if (!reports.length) return <Empty title="Nenhuma denúncia aberta" />;
  return reports.map((r) => (
    <Card key={r.id}>
      <Text variant="label">{new Date(r.created_at).toLocaleString('pt-BR')}</Text>
      <Text variant="heading">
        {r.car ? carTitle(r.car) : r.article ? `Post: ${r.article.title}` : r.promotion ? `Promoção: ${r.promotion.title}`
          : `Usuário: ${r.reported?.full_name ?? '—'}`}
      </Text>
      {(r.car || r.article || r.promotion) && <Text variant="muted">De {r.reported?.full_name ?? 'membro'}</Text>}
      <Text>“{r.reason}”</Text>
      {r.promotion ? (
        <Button title="Ver empresa" variant="outline" onPress={() => router.push(`/parceiros/${r.promotion!.partner_id}`)} />
      ) : r.article_id ? (
        <Button title="Ver post" variant="outline" onPress={() => router.push(`/noticia/${r.article_id}`)} />
      ) : (
        <Button title="Ver garagem" variant="outline" onPress={() => router.push(`/admin/garagem/${r.reported_user}`)} />
      )}
      {r.promotion_id && (
        <Button title="Remover promoção" variant="ghost" onPress={() => removePromotion(r)} style={{ borderWidth: 1, borderColor: colors.danger }} />
      )}
      {r.article_id && (
        <Button title="Remover post" variant="ghost" onPress={() => removePost(r)} style={{ borderWidth: 1, borderColor: colors.danger }} />
      )}
      {r.car_id && (
        <Button title="Remover carro" variant="ghost" onPress={() => removeCar(r)} style={{ borderWidth: 1, borderColor: colors.danger }} />
      )}
      <Button title="Marcar como resolvida" variant="ink" onPress={() => resolve(r.id)} />
    </Card>
  ));
}
