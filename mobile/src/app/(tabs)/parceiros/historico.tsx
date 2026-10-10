import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { RefreshControl, View } from 'react-native';

import { Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { avatarUrl } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

type Scan = { id: number; member_id: string; valid: boolean; created_at: string };
type Member = { id: string; full_name: string; avatar_path: string | null };
type Use = { scan_id: number | null; promotion: { title: string } | null };

// The partner's own history: every member card read and the promotions
// registered with it, newest first (last 200 reads).
export default function History() {
  const { access } = useAuth();
  const pid = access?.partner?.id;
  const q = useQuery({
    queryKey: ['partners', 'mine', 'history', pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data: scans, error } = await supabase.from('card_scans').select('id, member_id, valid, created_at')
        .eq('partner_id', pid!).order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      const list = scans as Scan[];
      if (!list.length) return [];
      const [members, uses] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_path').in('id', [...new Set(list.map((s) => s.member_id))]),
        supabase.from('promotion_uses').select('scan_id, promotion:promotions(title)').in('scan_id', list.map((s) => s.id)),
      ]);
      if (members.error) throw members.error;
      if (uses.error) throw uses.error;
      const byId = new Map((members.data as Member[]).map((m) => [m.id, m]));
      const promos = new Map<number, string[]>();
      for (const u of uses.data as unknown as Use[]) {
        if (u.scan_id && u.promotion) promos.set(u.scan_id, [...(promos.get(u.scan_id) ?? []), u.promotion.title]);
      }
      return list.map((s) => ({ ...s, member: byId.get(s.member_id), promos: promos.get(s.id) ?? [] }));
    },
  });
  useRefetchOnFocus(q.refetch);

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  const usesCount = rows.reduce((n, r) => n + r.promos.length, 0);

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      {!!rows.length && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Leituras" value={rows.length} />
          <Stat label="Promoções usadas" value={usesCount} />
        </View>
      )}
      {rows.length ? rows.map((r, i) => {
        const day = new Date(r.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
        const prevDay = i > 0 ? new Date(rows[i - 1]!.created_at).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : null;
        const uri = avatarUrl(r.member?.avatar_path);
        return (
          <View key={r.id} style={{ gap: space.sm }}>
            {day !== prevDay && <Text variant="label" style={{ marginTop: space.xs, textTransform: 'capitalize' }}>{day}</Text>}
            <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              {uri ? <Image source={{ uri }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.secondary }} />}
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{r.member?.full_name ?? 'Membro'}</Text>
                <Text variant="muted">
                  {new Date(r.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  <Text style={{ color: r.valid ? colors.success : colors.danger, fontSize: 15 }}>
                    {r.valid ? 'Assinante ativo' : 'Não validado'}
                  </Text>
                </Text>
                {r.promos.map((p, j) => <Text key={j} style={{ color: colors.highlightDeep }}>✓ {p}</Text>)}
              </View>
            </Card>
          </View>
        );
      }) : <Empty title="Nenhuma leitura ainda" text="As carteirinhas lidas na aba Ler QR aparecem aqui, com as promoções registradas." />}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="title" style={{ fontSize: 26, lineHeight: 30 }}>{value}</Text>
      <Text variant="label">{label}</Text>
    </Card>
  );
}
