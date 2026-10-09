import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { byStatus, MEMBER_STATUS, PARTNER_STATUS } from '@/lib/applications';
import type { ApplicationStatus, PartnerStatus } from '@/lib/access';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

type PartnerRow = { id: string; company_name: string; responsible_name: string; niche: string; status: PartnerStatus;
  meeting_request: string | null; created_at: string };
type MemberRow = { id: string; full_name: string; city: string; profession: string; status: ApplicationStatus; created_at: string };

function usePartners() {
  return useQuery({
    queryKey: ['admin', 'partners'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_list_partners');
      if (error) throw error;
      return (data as PartnerRow[]).sort(byStatus);
    },
  });
}

function useMembers() {
  return useQuery({
    queryKey: ['admin', 'members'],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_applications')
        .select('id, full_name, city, profession, status, created_at');
      if (error) throw error;
      return (data as MemberRow[]).sort(byStatus);
    },
  });
}

// Admin home: partnership and membership requests, pending ones first.
export default function Admin() {
  const [tab, setTab] = useState<'partners' | 'members'>('partners');
  const partners = usePartners();
  const members = useMembers();
  const q = tab === 'partners' ? partners : members;
  const pending = (rows?: { status: string }[]) => rows?.filter((r) => r.status === 'pending').length ?? 0;

  return (
    <Screen refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
        <Text variant="title">Admin</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Segment label="Parceiros" count={pending(partners.data)} active={tab === 'partners'} onPress={() => setTab('partners')} />
          <Segment label="Membros" count={pending(members.data)} active={tab === 'members'} onPress={() => setTab('members')} />
        </View>
        {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : tab === 'partners' ? (
          partners.data?.length ? partners.data.map((p) => (
            <Row key={p.id} title={p.company_name} subtitle={`${p.responsible_name} · ${p.niche}`}
              status={PARTNER_STATUS[p.status]} highlight={p.status === 'pending'}
              note={p.status === 'pending' && p.meeting_request ? 'Pediu outro horário' : undefined}
              onPress={() => router.push(`/admin/parceiro/${p.id}`)} />
          )) : <Empty title="Nenhuma solicitação de parceria" />
        ) : (
          members.data?.length ? members.data.map((m) => (
            <Row key={m.id} title={m.full_name} subtitle={`${m.profession} · ${m.city}`}
              status={MEMBER_STATUS[m.status]} highlight={m.status === 'pending'}
              onPress={() => router.push(`/admin/membro/${m.id}`)} />
          )) : <Empty title="Nenhuma solicitação de membro" />
        )}
    </Screen>
  );
}

function Segment({ label, count, active, onPress }: { label: string; count: number; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ flex: 1, paddingVertical: space.sm + 2, borderRadius: radius.pill, alignItems: 'center',
        backgroundColor: active ? colors.ink : colors.secondary }}>
      <Text style={{ color: active ? colors.inkText : colors.text, fontSize: 15 }}>
        {label}{count ? ` (${count})` : ''}
      </Text>
    </Pressable>
  );
}

function Row({ title, subtitle, status, highlight, note, onPress }: {
  title: string; subtitle: string; status: string; highlight: boolean; note?: string | undefined; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{title}</Text>
          <Text variant="muted">{subtitle}</Text>
          {!!note && <Text style={{ color: colors.highlightDeep, fontSize: 13 }}>{note}</Text>}
        </View>
        <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill,
          backgroundColor: highlight ? colors.accent : colors.secondary }}>
          <Text style={{ fontSize: 12, color: highlight ? colors.accentText : colors.textMuted }}>{status}</Text>
        </View>
      </Card>
    </Pressable>
  );
}
