import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { PartnerLogo, PromotionCard } from '@/components/partners';
import { TitleRow } from '@/components/title-row';
import { Button, Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Niche } from '@/lib/news';
import { PARTNER_FIELDS, type PartnerPage, type Promotion } from '@/lib/partners';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

type PromoWithPartner = Promotion & { partner: { id: string; company_name: string; logo_path: string | null; niche_id: string | null } | null };

// Partner companies and their promotions. Everyone browses; only active
// subscribers can use a promotion (the partner scans their card).
export default function Partners() {
  const { kind, access, setIntent } = useAuth();
  const [view, setView] = useState<'companies' | 'promos'>('companies');
  const [niche, setNiche] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ['partners', 'directory'],
    queryFn: async () => {
      const [p, pr, n] = await Promise.all([
        supabase.from('partners').select(PARTNER_FIELDS).eq('status', 'approved').eq('active', true).order('company_name'),
        supabase.from('promotions').select('*, partner:partners(id, company_name, logo_path, niche_id)')
          .eq('active', true).order('created_at', { ascending: false }),
        supabase.from('niches').select('id, name, status').eq('status', 'approved').order('name'),
      ]);
      if (p.error) throw p.error;
      if (pr.error) throw pr.error;
      const partners = p.data as PartnerPage[];
      const now = Date.now();
      const promos = (pr.data as PromoWithPartner[])
        .filter((x) => (!x.ends_at || new Date(x.ends_at).getTime() > now) && partners.some((c) => c.id === x.partner_id));
      // Only segments that have companies become filters.
      const used = new Set(partners.map((c) => c.niche_id));
      return { partners, promos, niches: ((n.data ?? []) as Niche[]).filter((x) => used.has(x.id)) };
    },
  });
  useRefetchOnFocus(q.refetch);

  const partners = q.data?.partners.filter((c) => !niche || c.niche_id === niche) ?? [];
  const promos = q.data?.promos.filter((x) => !niche || x.partner?.niche_id === niche) ?? [];
  const promoCount = (id: string) => q.data?.promos.filter((x) => x.partner_id === id).length ?? 0;

  return (
    <Screen statusBarScrim refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      <TitleRow title="Parceiros" />
      {kind === 'partner' && access?.partner && (
        <Card>
          <Text variant="heading">{access.partner.company_name}</Text>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Editar página" variant="outline" style={{ flex: 1 }} onPress={() => router.push('/parceiros/minha-empresa')} />
            <Button title="Promoções" style={{ flex: 1 }} onPress={() => router.push('/parceiros/promocoes')} />
          </View>
          <Button title="Histórico de leituras" variant="ghost" onPress={() => router.push('/parceiros/historico')} />
        </Card>
      )}
      {kind === 'non_subscriber' && (
        <Card>
          <Text variant="heading">Promoções exclusivas para assinantes</Text>
          <Text variant="muted">Você pode ver tudo, mas só membros assinantes usam as promoções, mostrando a carteirinha.</Text>
          {!access?.member_application && <Button title="Quero ser membro assinante" onPress={() => setIntent('member')} />}
        </Card>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Segment label="Empresas" active={view === 'companies'} onPress={() => setView('companies')} />
        <Segment label={`Promoções${q.data ? ` (${q.data.promos.length})` : ''}`} active={view === 'promos'} onPress={() => setView('promos')} />
      </View>
      {!!q.data?.niches.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.md }}
          contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.md }}>
          <Chip label="Todos" active={!niche} onPress={() => setNiche(null)} />
          {q.data.niches.map((n) => <Chip key={n.id} label={n.name} active={niche === n.id} onPress={() => setNiche(n.id)} />)}
        </ScrollView>
      )}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : view === 'companies' ? (
        partners.length ? partners.map((c) => (
          <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/parceiros/${c.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <PartnerLogo path={c.logo_path} name={c.company_name} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{c.company_name}</Text>
                <Text variant="muted">{[c.niche, c.city].filter(Boolean).join(' · ')}</Text>
                {promoCount(c.id) > 0 && (
                  <Text style={{ fontSize: 13, color: colors.highlightDeep }}>
                    {promoCount(c.id)} {promoCount(c.id) === 1 ? 'promoção' : 'promoções'}
                  </Text>
                )}
              </View>
            </Card>
          </Pressable>
        )) : <Empty title="Nenhum parceiro por aqui ainda" />
      ) : (
        promos.length ? promos.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/parceiros/${p.partner_id}`)}>
            <PromotionCard promo={p} header={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <PartnerLogo path={p.partner?.logo_path} name={p.partner?.company_name ?? '?'} size={28} />
                <Text variant="label">{p.partner?.company_name}</Text>
              </View>
            } />
          </Pressable>
        )) : <Empty title="Nenhuma promoção ativa" text="Quando os parceiros publicarem promoções, elas aparecem aqui." />
      )}
    </Screen>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ flex: 1, paddingVertical: space.sm + 2, borderRadius: radius.pill, alignItems: 'center',
        backgroundColor: active ? colors.ink : colors.secondary }}>
      <Text style={{ color: active ? colors.inkText : colors.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={onPress}
      style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1,
        borderColor: active ? colors.ink : colors.border, backgroundColor: active ? colors.ink : colors.card }}>
      <Text style={{ fontSize: 14, color: active ? colors.inkText : colors.text }}>{label}</Text>
    </Pressable>
  );
}
