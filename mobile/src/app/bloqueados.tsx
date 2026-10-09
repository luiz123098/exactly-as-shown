import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, View } from 'react-native';

import { Button, Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

type Blocked = { blocked_id: string; profile: { full_name: string } | null };

// People this user blocked; unblocking makes their garages visible again.
export default function BlockedUsers() {
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['blocks', me],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from('user_blocks')
        .select('blocked_id, profile:profiles!user_blocks_blocked_id_fkey(full_name)').eq('blocker_id', me!);
      if (error) throw error;
      return data as unknown as Blocked[];
    },
  });

  async function unblock(id: string) {
    const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', me!).eq('blocked_id', id);
    if (error) return void Alert.alert('Não foi possível desbloquear', 'Tente novamente.');
    await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ['garages'] })]);
  }

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  return (
    <Screen>
      {q.data?.length ? q.data.map((b) => (
        <Card key={b.blocked_id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{b.profile?.full_name ?? 'Usuário'}</Text>
          </View>
          <Button title="Desbloquear" variant="outline" onPress={() => unblock(b.blocked_id)} />
        </Card>
      )) : <Empty title="Ninguém bloqueado" text="Você pode bloquear alguém pelo menu ⋯ na garagem da pessoa." />}
    </Screen>
  );
}
