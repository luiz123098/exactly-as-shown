import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { QrCode } from '@/components/qr-code';
import { TitleRow } from '@/components/title-row';
import { Button, Card, ErrorState, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { formatCode, qrPayload, secondsLeft } from '@/lib/card';
import { avatarUrl } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

type CardToken = { token: string; expires_at: string };

// Subscribers show this to partners. The QR changes every minute (the server
// issues short-lived codes), so a screenshot can't be passed around.
export default function MemberCard() {
  const { kind } = useAuth();
  return kind === 'subscriber' ? <ActiveCard /> : <NoCard />;
}

function ActiveCard() {
  const { profile, access } = useAuth();
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  const q = useQuery({
    queryKey: ['card-token'],
    enabled: focused,
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('member_card_token');
      if (error) throw error;
      return data as CardToken;
    },
  });

  // One-second tick for the countdown; a new code is fetched a few seconds before expiry.
  useEffect(() => {
    if (!focused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [focused]);
  const left = q.data ? secondsLeft(q.data.expires_at, now) : 0;
  const { refetch, isFetching, isError } = q;
  useEffect(() => {
    if (focused && q.data && left <= 5 && !isFetching && !isError) refetch();
  }, [focused, q.data, left, isFetching, isError, refetch]);

  const uri = avatarUrl(profile?.avatar_path);
  const until = access?.membership_expires_at ? new Date(access.membership_expires_at).toLocaleDateString('pt-BR') : null;

  return (
    <Screen statusBarScrim>
      <TitleRow title="Carteirinha" />
      <View style={styles.card}>
        <Text variant="eyebrow">Exotic Club · Membro</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {uri && <Image source={{ uri }} style={styles.avatar} />}
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading" style={{ color: colors.inkText }}>{profile?.full_name}</Text>
            {!!profile?.instagram && <Text style={{ color: colors.inkText, opacity: 0.7 }}>@{profile.instagram}</Text>}
          </View>
        </View>
        <View style={styles.qrBox}>
          {q.isError ? (
            <ErrorState onRetry={() => q.refetch()} text="Não foi possível gerar o QR. Verifique sua conexão." />
          ) : q.data ? (
            <>
              <QrCode value={qrPayload(q.data.token)} size={232} />
              <Text style={styles.code}>{formatCode(q.data.token)}</Text>
              <Text variant="muted">Atualiza em {left}s</Text>
            </>
          ) : (
            <View style={{ width: 232, height: 232 + 60, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="muted">Gerando QR…</Text>
            </View>
          )}
        </View>
        {until && <Text style={{ color: colors.inkText, opacity: 0.8, textAlign: 'center' }}>Assinatura válida até {until}</Text>}
      </View>
      <Text variant="muted" style={{ textAlign: 'center' }}>
        Mostre este QR ao parceiro. Se a câmera dele não ler, informe o código abaixo do QR.
      </Text>
    </Screen>
  );
}

function NoCard() {
  const { access, setIntent } = useAuth();
  const app = access?.member_application;
  let title = 'Carteirinha de membro';
  let text = 'A carteirinha é exclusiva para assinantes do Exotic Club. Com ela você usa as promoções dos parceiros.';
  if (app?.status === 'pending') text = 'Sua solicitação de assinatura está em análise. Assim que for aprovada e a anuidade ativada, sua carteirinha aparece aqui.';
  if (app?.status === 'approved') {
    title = 'Solicitação aprovada!';
    text = access?.membership_expires_at
      ? 'Sua anuidade venceu. Fale com o Exotic Club para renovar e reativar sua carteirinha.'
      : 'Sua carteirinha aparece aqui assim que a anuidade for ativada pelos donos.';
  }
  if (app?.status === 'rejected') text = 'Sua solicitação não foi aprovada. Veja os detalhes no seu perfil.';
  return (
    <Screen statusBarScrim>
      <TitleRow title="Carteirinha" />
      <Card>
        <Text variant="heading">{title}</Text>
        <Text variant="muted">{text}</Text>
        {!app && <Button title="Quero ser membro assinante" onPress={() => setIntent('member')} />}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.ink, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.inkMuted },
  qrBox: { backgroundColor: colors.card, borderRadius: radius.md, padding: space.md, alignItems: 'center', gap: space.xs },
  code: { fontFamily: 'Manrope_800ExtraBold', fontSize: 24, letterSpacing: 3, color: colors.text },
});
