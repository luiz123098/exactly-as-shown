import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Alert } from 'react-native';

import { askReason, Contact, Info, useAdminAction } from '@/components/admin';
import { Button, Card, ErrorState, Loading, Screen, Text } from '@/components/ui';
import type { ApplicationStatus } from '@/lib/access';
import { MEMBER_STATUS } from '@/lib/applications';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Application = {
  id: string; user_id: string; full_name: string; email: string; phone: string; city: string; profession: string;
  instagram: string; cars: string | null; reason: string; status: ApplicationStatus; decision_reason: string | null;
  created_at: string;
};

const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR');

// One membership request: approve or reject it, then activate the annual fee
// once it has been paid (one year from today).
export default function MemberReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = ['admin', 'member', id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: app, error } = await supabase.from('member_applications').select('*').eq('id', id).single();
      if (error) throw error;
      const { data: m } = await supabase.from('memberships').select('expires_at')
        .eq('user_id', app.user_id).is('suspended_at', null).gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false }).limit(1).maybeSingle();
      return { app: app as Application, activeUntil: (m?.expires_at as string | undefined) ?? null };
    },
  });
  const { busy, run } = useAdminAction(key);

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const { app: a, activeUntil } = q.data;

  function approve() {
    run('approve', 'admin_review_member', { _application: a.id, _approve: true },
      'Solicitação aprovada. Ative a anuidade quando o pagamento for confirmado.');
  }

  function activate() {
    const until = new Date();
    until.setFullYear(until.getFullYear() + 1);
    Alert.alert('Ativar anuidade', `${a.full_name} será assinante até ${until.toLocaleDateString('pt-BR')}.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Ativar', onPress: () => run('activate', 'admin_set_membership', { _user: a.user_id, _expires_at: until.toISOString() }, 'Anuidade ativada') },
    ]);
  }

  return (
    <Screen>
      <Text variant="title">{a.full_name}</Text>
      <Text variant="heading" style={{ color: colors.highlightDeep }}>
        {activeUntil ? `Assinante até ${fmt(activeUntil)}` : MEMBER_STATUS[a.status]}
      </Text>
      <Card>
        <Info label="E-mail" value={a.email} />
        <Info label="Telefone" value={a.phone} />
        <Info label="Instagram" value={`@${a.instagram}`} />
        <Info label="Cidade" value={a.city} />
        <Info label="Profissão" value={a.profession} />
        <Info label="Carros" value={a.cars} />
        <Info label="Por que quer fazer parte" value={a.reason} />
        <Info label="Enviado em" value={fmt(a.created_at)} />
        {a.status === 'rejected' && <Info label="Motivo da reprovação" value={a.decision_reason} />}
      </Card>
      <Contact phone={a.phone} instagram={a.instagram} />
      {a.status !== 'approved' && <Button title="Aprovar" loading={busy === 'approve'} onPress={approve} />}
      {a.status === 'approved' && (
        <Button title={activeUntil ? 'Renovar anuidade (+1 ano a partir de hoje)' : 'Ativar anuidade (1 ano)'}
          loading={busy === 'activate'} onPress={activate} />
      )}
      {a.status === 'pending' && (
        <Button title="Reprovar" variant="ghost" loading={busy === 'reject'} style={{ borderWidth: 1, borderColor: colors.danger }}
          onPress={() => askReason('Reprovar solicitação', (reason) =>
            run('reject', 'admin_review_member', { _application: a.id, _approve: false, _reason: reason }, 'Solicitação reprovada'))} />
      )}
    </Screen>
  );
}
