import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { TitleRow } from '@/components/title-row';
import { Button, Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { coverUri, originLabel, type Article, type Filter, type Niche } from '@/lib/news';
import { timeAgo } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

const PAGE = 30;

// News feed: "Principais" (curated automotive news + Exotic Motors), Exotic only,
// and one filter per approved niche with the partners' posts.
export default function News() {
  const { kind } = useAuth();
  const [filter, setFilter] = useState<Filter>({ kind: 'main' });
  const [limit, setLimit] = useState(PAGE);
  const [syncing, setSyncing] = useState(false);

  // Only niches that currently have posts become filters.
  const niches = useQuery({
    queryKey: ['news', 'niches'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('news_niches');
      if (error) throw error;
      return data as Pick<Niche, 'id' | 'name'>[];
    },
  });

  const feed = useQuery({
    queryKey: ['news', 'feed', filter, limit],
    queryFn: async () => {
      let q = supabase.from('articles').select('*');
      if (filter.kind === 'main') q = q.in('origin', ['auto', 'exotic']);
      else if (filter.kind === 'exotic') q = q.eq('origin', 'exotic');
      else q = q.eq('niche_id', filter.id);
      const { data, error } = await q.order('featured', { ascending: false }).order('published_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data as Article[];
    },
    placeholderData: (prev) => prev,
  });
  useRefetchOnFocus(feed.refetch);

  function choose(f: Filter) {
    setFilter(f);
    setLimit(PAGE);
  }

  async function syncNow() {
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke<{ news: number | string }>('news-sync', { body: {} });
    setSyncing(false);
    if (error) return void Alert.alert('Não foi possível atualizar', 'Tente novamente em instantes.');
    Alert.alert('Notícias atualizadas', typeof data?.news === 'number' ? `${data.news} novas notícias relevantes.` : 'Feito.');
    feed.refetch();
  }

  const same = (f: Filter) => f.kind === filter.kind && (f.kind !== 'niche' || (filter.kind === 'niche' && f.id === filter.id));

  return (
    <Screen statusBarScrim refreshControl={<RefreshControl refreshing={feed.isRefetching} onRefresh={() => { feed.refetch(); niches.refetch(); }} />}>
      <TitleRow title="Notícias" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.md }}
        contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}>
        <Chip label="Principais" active={same({ kind: 'main' })} onPress={() => choose({ kind: 'main' })} />
        <Chip label="Exotic Motors" active={same({ kind: 'exotic' })} onPress={() => choose({ kind: 'exotic' })} />
        {niches.data?.map((n) => (
          <Chip key={n.id} label={n.name} active={same({ kind: 'niche', id: n.id })} onPress={() => choose({ kind: 'niche', id: n.id })} />
        ))}
      </ScrollView>
      {kind === 'partner' && <Button title="Novo post da sua empresa" onPress={() => router.push('/novo-post')} />}
      {kind === 'admin' && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button title="Post Exotic Motors" style={{ flex: 1 }} onPress={() => router.push('/novo-post')} />
          <Button title="Atualizar" variant="outline" style={{ flex: 1 }} loading={syncing} onPress={syncNow} />
        </View>
      )}
      {feed.isLoading ? <Loading /> : feed.isError ? <ErrorState onRetry={() => feed.refetch()} /> : feed.data?.length ? (
        <>
          {feed.data.map((a) => <ArticleCard key={a.id} article={a} />)}
          {feed.data.length >= limit && (
            <Button title="Carregar mais" variant="outline" loading={feed.isFetching} onPress={() => setLimit((l) => l + PAGE)} />
          )}
        </>
      ) : (
        <Empty title="Nada por aqui ainda" text="As notícias mais relevantes do mundo automotivo chegam ao longo do dia." />
      )}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill,
        backgroundColor: active ? colors.ink : colors.secondary }}>
      <Text style={{ fontSize: 14, color: active ? colors.inkText : colors.text }}>{label}</Text>
    </Pressable>
  );
}

function ArticleCard({ article: a }: { article: Article }) {
  const uri = coverUri(a);
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/noticia/${a.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {uri && <Image source={{ uri }} style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.secondary }}
          contentFit="cover" transition={150} />}
        <View style={{ padding: space.md, gap: space.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {a.featured && (
              <View style={{ paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.highlight }}>
                <Text style={{ fontSize: 11, color: colors.ink }}>Destaque</Text>
              </View>
            )}
            <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>{originLabel(a)} · {timeAgo(a.published_at)}</Text>
          </View>
          <Text variant="heading">{a.title}</Text>
          {!!a.excerpt && <Text variant="muted" numberOfLines={3}>{a.excerpt}</Text>}
        </View>
      </Card>
    </Pressable>
  );
}
