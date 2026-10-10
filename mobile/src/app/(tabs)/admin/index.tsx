import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import { NicheQueue, PhotoQueue, ReportList, useOpenReports, usePendingNiches, usePendingPhotos } from '@/components/admin-moderation';
import { TitleRow } from '@/components/title-row';
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

type Tab = 'partners' | 'members' | 'reports';

// Admin home: partnership requests, members (requests and their car photos to
// approve) and open reports. Partners have no garage, so photos live under Membros.
export default function Admin() {
  const [tab, setTab] = useState<Tab>('partners');
  const [memberView, setMemberView] = useState<'requests' | 'photos'>('requests');
  // Notifications open a section directly: /admin?aba=fotos|membros|parceiros|denuncias
  const { aba, n } = useLocalSearchParams<{ aba?: string; n?: string }>();
  const link = `${aba}:${n}`;
  const [appliedLink, setAppliedLink] = useState<string | undefined>();
  if (link !== appliedLink) {
    setAppliedLink(link);
    if (aba === 'fotos' || aba === 'membros') {
      setTab('members');
      setMemberView(aba === 'fotos' ? 'photos' : 'requests');
    } else if (aba === 'parceiros') setTab('partners');
    else if (aba === 'denuncias') setTab('reports');
  }
  const partners = usePartners();
  const members = useMembers();
  const photos = usePendingPhotos();
  const reports = useOpenReports();
  const niches = usePendingNiches();
  const q = tab === 'members' && memberView === 'photos' ? photos : { partners, members, reports }[tab];
  useRefetchOnFocus(q.refetch);
  const pending = (rows?: { status: string }[]) => rows?.filter((r) => r.status === 'pending').length ?? 0;

  return (
    <Screen statusBarScrim refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      <TitleRow title="Admin" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Segment label="Parceiros" count={pending(partners.data) + (niches.data?.length ?? 0)} active={tab === 'partners'} onPress={() => setTab('partners')} />
        <Segment label="Membros" count={pending(members.data) + (photos.data?.length ?? 0)} active={tab === 'members'}
          onPress={() => setTab('members')} />
        <Segment label="Denúncias" count={reports.data?.length ?? 0} active={tab === 'reports'} onPress={() => setTab('reports')} />
      </View>
      {tab === 'members' && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Segment small label="Solicitações" count={pending(members.data)} active={memberView === 'requests'}
            onPress={() => setMemberView('requests')} />
          <Segment small label="Fotos dos carros" count={photos.data?.length ?? 0} active={memberView === 'photos'}
            onPress={() => setMemberView('photos')} />
        </View>
      )}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : tab === 'partners' ? (
        <>
        <NicheQueue niches={niches.data ?? []} />
        {partners.data?.length ? partners.data.map((p) => (
          <Row key={p.id} title={p.company_name} subtitle={`${p.responsible_name} · ${p.niche}`}
            status={PARTNER_STATUS[p.status]} highlight={p.status === 'pending'}
            note={p.status === 'pending' && p.meeting_request ? 'Pediu outro horário' : undefined}
            onPress={() => router.push(`/admin/parceiro/${p.id}`)} />
        )) : <Empty title="Nenhuma solicitação de parceria" />}
        </>
      ) : tab === 'members' && memberView === 'photos' ? (
        <PhotoQueue cars={photos.data ?? []} />
      ) : tab === 'members' ? (
        members.data?.length ? members.data.map((m) => (
          <Row key={m.id} title={m.full_name} subtitle={`${m.profession} · ${m.city}`}
            status={MEMBER_STATUS[m.status]} highlight={m.status === 'pending'}
            onPress={() => router.push(`/admin/membro/${m.id}`)} />
        )) : <Empty title="Nenhuma solicitação de membro" />
      ) : (
        <ReportList reports={reports.data ?? []} />
      )}
    </Screen>
  );
}

function Segment({ label, count, active, onPress, small }: {
  label: string; count: number; active: boolean; onPress: () => void; small?: boolean;
}) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ flex: 1, paddingVertical: small ? space.sm : space.sm + 2, borderRadius: radius.pill, alignItems: 'center',
        backgroundColor: active ? (small ? colors.accent : colors.ink) : colors.secondary }}>
      <Text style={{ color: active ? (small ? colors.accentText : colors.inkText) : colors.text, fontSize: small ? 14 : 15 }}>
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
