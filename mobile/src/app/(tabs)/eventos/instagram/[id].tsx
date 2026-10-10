import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, View } from 'react-native';

import { Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { eventImageUrl, type EventMedia } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

type PoolItem = EventMedia & { event: { title: string } | null };

// Admin: every Exotic Experience Instagram post. Tap to put it in this event or
// take it out; a post already in another event is locked.
export default function InstagramPicker() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['events', 'instagram-pool'],
    queryFn: async () => {
      const { data, error } = await supabase.from('event_media').select('*, event:events(title)')
        .eq('source', 'instagram').order('taken_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data as PoolItem[];
    },
  });

  async function toggle(m: PoolItem) {
    setBusy(m.id);
    const { error } = await supabase.from('event_media').update({ event_id: m.event_id === id ? null : id }).eq('id', m.id);
    setBusy(null);
    if (error) return void Alert.alert('Não foi possível alterar', error.message);
    await qc.invalidateQueries({ queryKey: ['events'] });
  }

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      <Text variant="muted">Toque para colocar ou tirar do evento. Posts marcados em outro evento ficam bloqueados.</Text>
      {q.data?.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {q.data.map((m) => {
            const here = m.event_id === id;
            const elsewhere = !!m.event_id && !here;
            const uri = eventImageUrl(m.media_path);
            return (
              <Pressable key={m.id} accessibilityRole="checkbox" accessibilityState={{ checked: here, disabled: elsewhere }}
                disabled={elsewhere || busy === m.id} onPress={() => toggle(m)}
                style={{ width: '31.5%', opacity: elsewhere ? 0.4 : busy === m.id ? 0.6 : 1 }}>
                <View style={{ aspectRatio: 1, borderRadius: radius.sm, overflow: 'hidden', borderWidth: here ? 3 : 0, borderColor: colors.highlight,
                  backgroundColor: colors.secondary }}>
                  {uri && <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" />}
                  {m.media_type === 'video' && <Text style={{ position: 'absolute', right: 6, top: 4, color: '#fff' }}>▶</Text>}
                  {here && <Text style={{ position: 'absolute', left: 6, top: 4, color: colors.highlight, fontSize: 18 }}>✓</Text>}
                </View>
                <Text variant="label" numberOfLines={1}>{elsewhere ? `Em: ${m.event?.title}` : here ? 'Neste evento' : 'Disponível'}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <Empty title="Nenhum post do Instagram ainda"
          text="A importação do Instagram da Exotic Experience será ligada na configuração com a Meta. Enquanto isso, use 'Novo post'." />
      )}
    </Screen>
  );
}
