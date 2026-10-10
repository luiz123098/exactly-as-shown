import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActionSheetIOS, Alert, Linking, Pressable, View } from 'react-native';

import { askReason } from '@/components/admin';
import { PartnerLogo, PromotionCard } from '@/components/partners';
import { Button, Card, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { instagramUrl, whatsappUrl } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { report } from '@/lib/moderation';
import { originLabel, type Article } from '@/lib/news';
import { timeAgo } from '@/lib/notifications';
import { isLive, mapsUrl, PARTNER_FIELDS, removePartnerImage, type PartnerPage, type Promotion } from '@/lib/partners';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';

// A partner company: who they are, where, how to reach them, their live
// promotions and recent posts.
export default function PartnerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, kind } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['partners', 'page', id],
    queryFn: async () => {
      const [p, pr, posts] = await Promise.all([
        supabase.from('partners').select(PARTNER_FIELDS).eq('id', id).maybeSingle(),
        supabase.from('promotions').select('*').eq('partner_id', id).order('created_at', { ascending: false }),
        supabase.from('articles').select('*').eq('partner_id', id).order('published_at', { ascending: false }).limit(10),
      ]);
      if (p.error) throw p.error;
      return { partner: p.data as PartnerPage | null, promos: (pr.data ?? []) as Promotion[], posts: (posts.data ?? []) as Article[] };
    },
  });
  useRefetchOnFocus(q.refetch);

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const c = q.data?.partner;
  if (!c) return <ErrorState text="Este parceiro não está disponível no momento." />;
  const mine = c.owner_id === me;
  const promos = mine ? q.data!.promos : q.data!.promos.filter((x) => isLive(x));

  function promoMenu(p: Promotion) {
    if (kind === 'admin') {
      askReason('Remover promoção', async (reason) => {
        const { data, error } = await supabase.rpc('admin_remove_promotion', { _promotion: p.id, _reason: reason });
        if (error) return void Alert.alert('Não foi possível remover', error.message);
        await removePartnerImage(data as string | null);
        qc.invalidateQueries({ queryKey: ['partners'] });
      }, { action: 'Remover', required: true });
    } else if (me) {
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Denunciar promoção', 'Cancelar'], cancelButtonIndex: 1, destructiveButtonIndex: 0 },
        (i) => i === 0 && report(me, c!.owner_id, null, undefined, undefined, p.id));
    }
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: c.company_name }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <PartnerLogo path={c.logo_path} name={c.company_name} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{c.company_name}</Text>
          <Text variant="muted">{c.niche}</Text>
        </View>
      </View>
      {mine && <Button title="Editar página da empresa" variant="outline" onPress={() => router.push('/parceiros/minha-empresa')} />}
      {!!c.description && <Text>{c.description}</Text>}
      {!!c.address && (
        <Card>
          <Text variant="label">Endereço</Text>
          <Text>{[c.address, c.city].filter(Boolean).join(' · ')}</Text>
          <Button title="Como chegar" variant="outline" onPress={() => Linking.openURL(mapsUrl(c.address!, c.city))} />
        </Card>
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {!!c.public_whatsapp && <Button title="WhatsApp" variant="outline" style={{ flexGrow: 1 }} onPress={() => Linking.openURL(whatsappUrl(c.public_whatsapp!))} />}
        <Button title="Instagram" variant="outline" style={{ flexGrow: 1 }} onPress={() => Linking.openURL(instagramUrl(c.instagram_company))} />
        {!!c.website && <Button title="Site" variant="outline" style={{ flexGrow: 1 }} onPress={() => Linking.openURL(c.website!)} />}
      </View>

      <Text variant="heading" style={{ marginTop: space.sm }}>Promoções</Text>
      {kind === 'non_subscriber' && !!promos.length && (
        <Text variant="muted">Exclusivas para membros assinantes: mostre sua carteirinha no balcão.</Text>
      )}
      {kind === 'subscriber' && !!promos.length && (
        <Text variant="muted">Para usar, mostre o QR da sua carteirinha ao parceiro.</Text>
      )}
      {promos.length ? promos.map((p) => (
        <PromotionCard key={p.id} promo={p} footer={
          mine ? (
            <Button title="Editar" variant="outline" onPress={() => router.push(`/parceiros/promocao/${p.id}`)} />
          ) : me && (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => promoMenu(p)} style={{ alignSelf: 'flex-end' }}>
              <Text variant="label">{kind === 'admin' ? 'Remover' : 'Denunciar'}</Text>
            </Pressable>
          )
        } />
      )) : <Text variant="muted">Nenhuma promoção ativa no momento.</Text>}

      {!!q.data!.posts.length && <Text variant="heading" style={{ marginTop: space.sm }}>Posts</Text>}
      {q.data!.posts.map((a) => (
        <Pressable key={a.id} accessibilityRole="button" onPress={() => router.push(`/noticia/${a.id}`)}>
          <Card>
            <Text variant="label">{originLabel(a)} · {timeAgo(a.published_at)}</Text>
            <Text variant="heading">{a.title}</Text>
            {!!a.excerpt && <Text variant="muted" numberOfLines={2}>{a.excerpt}</Text>}
          </Card>
        </Pressable>
      ))}
      {!mine && kind !== 'admin' && me && (
        <Pressable accessibilityRole="button" onPress={() => report(me, c.owner_id, null)} style={{ alignSelf: 'center', padding: space.sm }}>
          <Text variant="label" style={{ color: colors.textMuted }}>Denunciar esta empresa</Text>
        </Pressable>
      )}
    </Screen>
  );
}
