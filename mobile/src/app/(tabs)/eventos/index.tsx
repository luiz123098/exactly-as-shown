import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, View } from 'react-native';

import { TitleRow } from '@/components/title-row';
import { Button, Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { eventImageUrl, type EventCard } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

// Exotic Experience events: one card per event, upcoming first.
export default function Events() {
  const { kind } = useAuth();
  const q = useQuery({
    queryKey: ['events', 'list'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_events');
      if (error) throw error;
      return data as EventCard[];
    },
  });
  useRefetchOnFocus(q.refetch);
  const upcoming = q.data?.filter((e) => !e.is_past) ?? [];
  const past = q.data?.filter((e) => e.is_past) ?? [];

  return (
    <Screen statusBarScrim refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      <TitleRow title="Eventos" />
      <Text variant="eyebrow">Exotic Experience</Text>
      {kind === 'admin' && <Button title="Novo evento" onPress={() => router.push('/eventos/editar/novo')} />}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : !q.data?.length ? (
        <Empty title="Nenhum evento ainda" text="Os eventos da Exotic Experience aparecem aqui." />
      ) : (
        <>
          {!!upcoming.length && <Text variant="heading">Próximos</Text>}
          {upcoming.map((e) => <EventCardView key={e.id} event={e} />)}
          {!!past.length && <Text variant="heading" style={{ marginTop: space.sm }}>Anteriores</Text>}
          {past.map((e) => <EventCardView key={e.id} event={e} />)}
        </>
      )}
    </Screen>
  );
}

function EventCardView({ event: e }: { event: EventCard }) {
  const uri = eventImageUrl(e.cover_path);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/eventos/${e.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <View>
          {uri ? <Image source={{ uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" transition={150} />
            : <View style={{ aspectRatio: 4 / 3, backgroundColor: colors.ink }} />}
          {e.is_past && (
            <View style={{ position: 'absolute', top: space.sm, left: space.sm, paddingHorizontal: space.sm, paddingVertical: 3,
              borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.6)' }}>
              <Text style={{ color: '#fff', fontSize: 12 }}>Realizado</Text>
            </View>
          )}
        </View>
        <View style={{ padding: space.md, gap: 2 }}>
          <Text variant="heading">{e.title}</Text>
          {e.starts_at && (
            <Text style={{ color: colors.highlightDeep }}>
              {new Date(e.starts_at).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })}
              {e.going ? ` · ${e.going} ${e.going === 1 ? 'confirmado' : 'confirmados'}` : ''}
              {e.i_am_going ? ' · você vai ✓' : ''}
            </Text>
          )}
          <Text variant="muted">{e.media_count} {e.media_count === 1 ? 'publicação' : 'publicações'}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
