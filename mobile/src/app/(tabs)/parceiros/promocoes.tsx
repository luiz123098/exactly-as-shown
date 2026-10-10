import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl } from 'react-native';

import { PromotionCard } from '@/components/partners';
import { Button, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Promotion } from '@/lib/partners';
import { supabase } from '@/lib/supabase';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

// The partner's own promotions (live, paused and ended) with how many times each was used.
export default function MyPromotions() {
  const { access } = useAuth();
  const pid = access?.partner?.id;
  const q = useQuery({
    queryKey: ['partners', 'mine', 'promos', pid],
    enabled: !!pid,
    queryFn: async () => {
      const [pr, uses] = await Promise.all([
        supabase.from('promotions').select('*').eq('partner_id', pid!).order('created_at', { ascending: false }),
        supabase.from('promotion_uses').select('promotion_id').eq('partner_id', pid!),
      ]);
      if (pr.error) throw pr.error;
      const count = new Map<string, number>();
      for (const u of uses.data ?? []) count.set(u.promotion_id, (count.get(u.promotion_id) ?? 0) + 1);
      return { promos: pr.data as Promotion[], count };
    },
  });
  useRefetchOnFocus(q.refetch);

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      <Button title="Nova promoção" onPress={() => router.push('/parceiros/promocao/nova')} />
      <Text variant="muted">Para registrar um uso, leia a carteirinha do membro na aba Ler QR e toque na promoção.</Text>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data?.promos.length ? (
        q.data.promos.map((p) => (
          <PromotionCard key={p.id} promo={p} footer={
            <>
              <Text variant="label">{q.data.count.get(p.id) ?? 0} usos registrados</Text>
              <Button title="Editar" variant="outline" onPress={() => router.push(`/parceiros/promocao/${p.id}`)} />
            </>
          } />
        ))
      ) : <Empty title="Nenhuma promoção ainda" text="Crie a primeira: ela aparece na sua página e na lista de promoções." />}
    </Screen>
  );
}
