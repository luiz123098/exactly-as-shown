import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';

import { CarPhoto } from '@/components/garage';
import { TitleRow } from '@/components/title-row';
import { Button, Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import type { Garage } from '@/lib/garage';
import { avatarUrl } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

// Everyone browses the visible garages; active subscribers also manage their own.
export default function Garages() {
  const { kind, session } = useAuth();
  const q = useQuery({
    queryKey: ['garages'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_garages');
      if (error) throw error;
      return data as Garage[];
    },
  });
  const me = session?.user.id;
  const mine = q.data?.find((g) => g.owner_id === me);
  useRefetchOnFocus(q.refetch);

  return (
    <Screen statusBarScrim refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      <TitleRow title="Garagens" />
      {kind === 'subscriber' ? (
        <Card>
          <Text variant="heading">Sua garagem</Text>
          <Text variant="muted">
            {mine ? `${mine.cars_count} ${mine.cars_count === 1 ? 'carro' : 'carros'} · ${mine.likes} ${mine.likes === 1 ? 'curtida' : 'curtidas'}`
              : 'Mostre seus carros para o clube. Cada foto passa por aprovação antes de aparecer.'}
          </Text>
          <Button title="Gerenciar garagem" onPress={() => router.push('/garagem/minha')} />
        </Card>
      ) : kind === 'non_subscriber' ? (
        <Text variant="muted">Membros assinantes podem montar a própria garagem.</Text>
      ) : !!q.data?.some((g) => g.pending_count > 0) && (
        <Text variant="muted">Garagens com fotos para aprovar aparecem primeiro.</Text>
      )}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data?.length ? (
        q.data.map((g) => <GarageRow key={g.owner_id} garage={g} admin={kind === 'admin'} own={g.owner_id === me} />)
      ) : (
        <Empty title="Nenhuma garagem por aqui ainda" text="Quando os membros publicarem seus carros, eles aparecem aqui." />
      )}
    </Screen>
  );
}

function GarageRow({ garage: g, admin, own }: { garage: Garage; admin: boolean; own: boolean }) {
  const avatar = avatarUrl(g.avatar_path);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/garagem/${g.owner_id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <CarPhoto path={g.cover_path} style={{ aspectRatio: 16 / 9 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md }}>
          {avatar && <Image source={{ uri: avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} />}
          <View style={{ flex: 1 }}>
            <Text variant="heading">{g.full_name}</Text>
            <Text variant="muted">
              {g.cars_count} {g.cars_count === 1 ? 'carro' : 'carros'} · {g.likes} {g.likes === 1 ? 'curtida' : 'curtidas'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {own && (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.ink }}>
                <Text style={{ fontSize: 12, color: colors.inkText }}>Sua</Text>
              </View>
            )}
            {admin && g.pending_count > 0 && (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.accent }}>
                <Text style={{ fontSize: 12, color: colors.accentText }}>
                  {g.pending_count} para aprovar
                </Text>
              </View>
            )}
            {admin && !g.is_public && <Text style={{ fontSize: 12, color: colors.danger }}>Oculta</Text>}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
