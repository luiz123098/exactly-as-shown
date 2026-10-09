import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notificationHref, timeAgo, type AppNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

// Everything the server sent this user. Opening the screen marks all as read;
// the ones that were unread keep their highlight until the screen is left.
export default function Notifications() {
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['notifications', 'list', me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*')
        .eq('user_id', me!).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data as AppNotification[];
    },
  });
  // Ids that were unread when the list first loaded.
  const [fresh, setFresh] = useState<Set<string> | null>(null);
  if (q.data && !fresh) setFresh(new Set(q.data.filter((n) => !n.read_at).map((n) => n.id)));

  const hasUnread = !!q.data?.some((n) => !n.read_at);
  useEffect(() => {
    if (!me || !hasUnread) return;
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', me).is('read_at', null)
      .then(() => qc.invalidateQueries({ queryKey: ['notifications', 'unread'] }));
  }, [me, hasUnread, qc]);

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      {q.data?.length ? q.data.map((n) => {
        const unread = fresh?.has(n.id);
        return (
          <Pressable key={n.id} accessibilityRole="button" onPress={() => router.push(notificationHref(n.link, n.id) as never)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <Card style={unread ? { borderColor: colors.highlight } : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {unread && <View style={{ width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.highlight }} />}
                <Text variant="heading" style={{ flex: 1 }}>{n.title}</Text>
                <Text variant="label">{timeAgo(n.created_at)}</Text>
              </View>
              {!!n.body && <Text variant="muted">{n.body}</Text>}
            </Card>
          </Pressable>
        );
      }) : <Empty title="Nenhuma notificação" text="Avisos sobre aprovações, reuniões e sua conta aparecem aqui." />}
    </Screen>
  );
}
