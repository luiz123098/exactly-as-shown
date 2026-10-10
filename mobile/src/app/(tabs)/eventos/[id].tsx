import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, View } from 'react-native';

import { PhotoViewer } from '@/components/photo-viewer';
import { Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { eventImageUrl, removeEventImages, type EventMedia } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

type EventRow = { id: string; title: string; cover_path: string | null };

// One event: cover and its publications for everyone; "Informações" (date,
// place, programme, RSVP) only for subscribers, approved partners and admins.
export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { kind } = useAuth();
  const admin = kind === 'admin';
  const canSeeInfo = kind === 'subscriber' || kind === 'partner' || admin;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['events', 'event', id],
    queryFn: async () => {
      const [e, m] = await Promise.all([
        supabase.from('events').select('id, title, cover_path').eq('id', id).maybeSingle(),
        supabase.from('event_media').select('*').eq('event_id', id).order('taken_at', { ascending: false }),
      ]);
      if (e.error) throw e.error;
      if (m.error) throw m.error;
      return { event: e.data as EventRow | null, media: (m.data ?? []) as EventMedia[] };
    },
  });
  useRefetchOnFocus(q.refetch);

  const [viewing, setViewing] = useState<string | null>(null);

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const ev = q.data?.event;
  if (!ev) return <ErrorState text="Este evento não está mais disponível." />;
  const cover = eventImageUrl(ev.cover_path);
  const refresh = () => qc.invalidateQueries({ queryKey: ['events'] });

  function adminMenu() {
    const options = ['Editar evento', 'Novo post', 'Posts do Instagram', 'Excluir evento', 'Cancelar'];
    ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: 4, destructiveButtonIndex: 3 }, (i) => {
      if (i === 0) router.push(`/eventos/editar/${ev!.id}`);
      if (i === 1) router.push(`/eventos/novo-post/${ev!.id}`);
      if (i === 2) router.push(`/eventos/instagram/${ev!.id}`);
      if (i === 3) {
        Alert.alert('Excluir evento', 'O evento e os posts feitos no app são apagados. Posts do Instagram voltam para a lista de disponíveis.', [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              const { data, error } = await supabase.rpc('admin_delete_event', { _id: ev!.id });
              if (error) return void Alert.alert('Não foi possível excluir', error.message);
              await removeEventImages(data as string[]);
              await refresh();
              router.back();
            },
          },
        ]);
      }
    });
  }

  async function removeMedia(m: EventMedia) {
    const ig = m.source === 'instagram';
    Alert.alert(ig ? 'Tirar do evento' : 'Excluir post', ig ? 'O post volta para a lista de posts do Instagram disponíveis.' : 'O post é apagado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: ig ? 'Tirar' : 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = ig
            ? await supabase.from('event_media').update({ event_id: null }).eq('id', m.id)
            : await supabase.from('event_media').delete().eq('id', m.id);
          if (error) return void Alert.alert('Não foi possível concluir', error.message);
          if (!ig) await removeEventImages([m.media_path]);
          refresh();
        },
      },
    ]);
  }

  return (
    <Screen>
      <Stack.Screen options={{
        title: ev.title,
        headerRight: () => (
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            {canSeeInfo && (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push(`/eventos/info/${ev.id}`)}>
                <Text style={{ color: colors.highlightDeep, fontSize: 16 }}>Informações</Text>
              </Pressable>
            )}
            {admin && (
              <Pressable accessibilityRole="button" accessibilityLabel="Opções do evento" hitSlop={8} onPress={adminMenu}>
                <Text style={{ fontSize: 22 }}>⋯</Text>
              </Pressable>
            )}
          </View>
        ),
      }} />
      {cover && <ZoomImage uri={cover} aspectRatio={4 / 3} onOpen={setViewing} />}
      <Text variant="title" style={{ fontSize: 28, lineHeight: 33 }}>{ev.title}</Text>
      {!canSeeInfo && (
        <Card style={{ backgroundColor: colors.accent, borderColor: colors.accent }}>
          <Text style={{ color: colors.accentText }}>
            Data, local e programação são exclusivos para membros assinantes e parceiros.
          </Text>
        </Card>
      )}
      {q.data!.media.length ? q.data!.media.map((m) => (
        <MediaCard key={m.id} media={m} onOpen={setViewing} onRemove={admin ? () => removeMedia(m) : undefined} />
      )) : <Empty title="Sem publicações ainda" text="Fotos e posts do evento aparecem aqui." />}
      {viewing && <PhotoViewer source={{ uri: viewing }} visible onClose={() => setViewing(null)} />}
    </Screen>
  );
}

function ZoomImage({ uri, aspectRatio, onOpen }: { uri: string; aspectRatio: number; onOpen: (uri: string) => void }) {
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel="Abrir foto em tela cheia" onPress={() => onOpen(uri)}>
      <Image source={{ uri }} style={{ width: '100%', aspectRatio, borderRadius: radius.lg, backgroundColor: colors.secondary }}
        contentFit="cover" transition={150} />
    </Pressable>
  );
}

function MediaCard({ media: m, onOpen, onRemove }: { media: EventMedia; onOpen: (uri: string) => void; onRemove?: (() => void) | undefined }) {
  const uri = eventImageUrl(m.media_path);
  const video = m.media_type === 'video';
  return (
    <Card>
      {uri && (video ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Assistir no Instagram"
          onPress={() => m.permalink && WebBrowser.openBrowserAsync(m.permalink)}>
          <Image source={{ uri }} style={{ width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md }} contentFit="cover" />
          <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 48, color: '#fff' }}>▶</Text>
          </View>
        </Pressable>
      ) : <ZoomImage uri={uri} aspectRatio={4 / 5} onOpen={onOpen} />)}
      {!!m.caption && <Text>{m.caption}</Text>}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Text variant="label" style={{ flex: 1 }}>
          {new Date(m.taken_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          {m.source === 'instagram' ? ' · Instagram' : ''}
        </Text>
        {m.source === 'instagram' && m.permalink && (
          <Pressable accessibilityRole="link" onPress={() => WebBrowser.openBrowserAsync(m.permalink!)}>
            <Text variant="label" style={{ color: colors.highlightDeep }}>Ver no Instagram</Text>
          </Pressable>
        )}
        {onRemove && (
          <Pressable accessibilityRole="button" onPress={onRemove}>
            <Text variant="label" style={{ color: colors.danger }}>{m.source === 'instagram' ? 'Tirar' : 'Excluir'}</Text>
          </Pressable>
        )}
      </View>
    </Card>
  );
}
