import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, View } from 'react-native';

import { askReason } from '@/components/admin';
import { Button, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { report } from '@/lib/moderation';
import { coverUri, originLabel, removeNewsImage, type Article } from '@/lib/news';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

// One news item. Automatic news show the summary and send readers to the source;
// Exotic Motors and partner posts show the full text.
export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, kind } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ['news', 'article', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('articles').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Article | null;
    },
  });

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const a = q.data;
  if (!a) return <ErrorState text="Esta notícia não está mais disponível. As notícias ficam no app por 45 dias." />;
  const uri = coverUri(a);
  const mine = a.author_id === me && a.origin !== 'auto';
  const admin = kind === 'admin';
  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['news'] });
    router.back();
  };

  async function feature() {
    setBusy(true);
    const { error } = await supabase.rpc('admin_feature_article', { _article: a!.id });
    setBusy(false);
    if (error) return void Alert.alert('Não foi possível destacar', error.message);
    Alert.alert('Destaque publicado', 'Todos os usuários foram notificados.');
    qc.invalidateQueries({ queryKey: ['news'] });
  }

  function remove() {
    const run = async (reason: string) => {
      const { data, error } = await supabase.rpc('admin_remove_article', { _article: a!.id, _reason: reason });
      if (error) return void Alert.alert('Não foi possível remover', error.message);
      await removeNewsImage(data as string | null);
      await done();
    };
    if (a!.origin === 'partner') askReason('Remover post', run, { action: 'Remover', required: true });
    else Alert.alert('Remover notícia', 'Ela sai do feed para todos.', [
      { text: 'Cancelar', style: 'cancel' }, { text: 'Remover', style: 'destructive', onPress: () => run('') },
    ]);
  }

  function deleteOwn() {
    Alert.alert('Excluir post', 'O post sai do feed para todos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('articles').delete().eq('id', a!.id);
          if (error) return void Alert.alert('Não foi possível excluir', 'Tente novamente.');
          await removeNewsImage(a!.cover_path);
          await done();
        },
      },
    ]);
  }

  function menu() {
    const options: { label: string; run: () => void; destructive?: boolean }[] = [];
    if (mine) {
      options.push({ label: 'Editar', run: () => router.push({ pathname: '/novo-post', params: { id: a!.id } }) });
      options.push({ label: 'Excluir', run: deleteOwn, destructive: true });
    } else if (admin) {
      if (!a!.featured) options.push({ label: 'Destacar e notificar todos', run: feature });
      options.push({ label: 'Remover', run: remove, destructive: true });
    } else if (a!.origin === 'partner' && a!.author_id && me) {
      options.push({ label: 'Denunciar', run: () => report(me, a!.author_id!, null, undefined, a!.id) });
    }
    if (!options.length) return;
    const labels = [...options.map((o) => o.label), 'Cancelar'];
    ActionSheetIOS.showActionSheetWithOptions(
      { options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: options.findIndex((o) => o.destructive) },
      (i) => options[i]?.run(),
    );
  }

  const hasMenu = mine || admin || (a.origin === 'partner' && !!a.author_id);
  return (
    <Screen>
      <Stack.Screen options={{
        title: originLabel(a),
        headerRight: hasMenu ? () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Mais opções" hitSlop={10} onPress={menu}>
            <Text style={{ fontSize: 22, paddingHorizontal: space.sm }}>⋯</Text>
          </Pressable>
        ) : undefined,
      }} />
      {uri && <Image source={{ uri }} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, backgroundColor: colors.secondary }}
        contentFit="cover" />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        {a.featured && (
          <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.highlight }}>
            <Text style={{ fontSize: 11, color: colors.ink }}>Destaque</Text>
          </View>
        )}
        <Text variant="label">
          {originLabel(a)} · {new Date(a.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
        </Text>
      </View>
      <Text variant="title" style={{ fontSize: 26, lineHeight: 31 }}>{a.title}</Text>
      <Text>{a.origin === 'auto' ? a.excerpt : a.body || a.excerpt}</Text>
      {!!a.external_url && (
        <Button title={a.origin === 'auto' ? `Ler matéria completa em ${a.source_name ?? 'site'}` : 'Ver no Instagram'}
          variant="outline" onPress={() => WebBrowser.openBrowserAsync(a.external_url!)} />
      )}
      {admin && !a.featured && <Button title="Destacar e notificar todos" variant="ink" loading={busy} onPress={feature} />}
    </Screen>
  );
}
