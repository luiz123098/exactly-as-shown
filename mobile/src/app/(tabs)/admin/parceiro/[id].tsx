import { DatePicker, Host } from '@expo/ui/swift-ui';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, View } from 'react-native';

import { askReason, Contact, Info, useAdminAction } from '@/components/admin';
import { useApprovedNiches } from '@/components/niche-picker';
import { Button, Card, ErrorState, Field, Loading, Screen, Text } from '@/components/ui';
import type { PartnerStatus } from '@/lib/access';
import { formatMeeting, PARTNER_STATUS } from '@/lib/applications';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

type Partner = {
  id: string; responsible_name: string; email: string; phone: string; company_name: string; niche: string;
  instagram_responsible: string; instagram_company: string; reason: string; status: PartnerStatus; active: boolean;
  decision_reason: string | null; meeting_at: string | null; meeting_place: string | null; meeting_request: string | null;
  created_at: string;
};

// Tomorrow at 10:00, a sensible first suggestion for a meeting.
function defaultMeeting() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

// One partnership request: contact data, meeting scheduling and the decision.
export default function PartnerReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const key = ['admin', 'partner', id];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_partner', { _partner: id });
      if (error) throw error;
      return data as Partner;
    },
  });
  const { busy, run } = useAdminAction(key, ['news']);
  const niches = useApprovedNiches();
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(defaultMeeting);
  const [place, setPlace] = useState('');

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const p = q.data;
  const open = p.status === 'pending' || p.status === 'meeting_proposed' || p.status === 'meeting_confirmed';

  // The company's posts move with it to the new segment.
  function changeNiche() {
    const list = niches.data ?? [];
    const labels = [...list.map((n) => n.name), 'Cancelar'];
    ActionSheetIOS.showActionSheetWithOptions({ title: 'Segmento da empresa', options: labels, cancelButtonIndex: list.length }, (i) => {
      const n = list[i];
      if (n) run('niche', 'admin_set_partner_niche', { _partner: p.id, _niche: n.id }, `Segmento alterado para ${n.name}`);
    });
  }

  function approve() {
    Alert.alert('Aprovar parceria', `${p.company_name} passa a ser parceiro do clube.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Aprovar', onPress: () => run('approve', 'admin_set_partner_status', { _partner: p.id, _status: 'approved' }, 'Parceria aprovada') },
    ]);
  }

  async function propose() {
    const ok = await run('meeting', 'admin_propose_meeting', { _partner: p.id, _at: when.toISOString(), _place: place },
      'Reunião proposta. O parceiro foi avisado para confirmar.');
    if (ok) setScheduling(false);
  }

  return (
    <Screen>
      <Text variant="title">{p.company_name}</Text>
      <Text variant="heading" style={{ color: colors.highlightDeep }}>{PARTNER_STATUS[p.status]}{p.status === 'approved' && !p.active ? ' · desativado' : ''}</Text>

      {p.meeting_at && (p.status === 'meeting_proposed' || p.status === 'meeting_confirmed') && (
        <Card>
          <Text variant="label">{p.status === 'meeting_confirmed' ? 'Reunião confirmada' : 'Aguardando confirmação do parceiro'}</Text>
          <Text>{formatMeeting(p.meeting_at, p.meeting_place)}</Text>
        </Card>
      )}
      {p.status === 'pending' && !!p.meeting_request && (
        <Card>
          <Text variant="label">O parceiro pediu outro horário</Text>
          <Text>{p.meeting_request}</Text>
        </Card>
      )}

      <Card>
        <Info label="Responsável" value={p.responsible_name} />
        <Info label="Segmento" value={p.niche} />
        <Info label="E-mail" value={p.email} />
        <Info label="Telefone" value={p.phone} />
        <Info label="Instagram do responsável" value={`@${p.instagram_responsible}`} />
        <Info label="Instagram da empresa" value={`@${p.instagram_company}`} />
        <Info label="O que quer oferecer" value={p.reason} />
        <Info label="Enviado em" value={new Date(p.created_at).toLocaleDateString('pt-BR')} />
        {p.status === 'rejected' && <Info label="Motivo da reprovação" value={p.decision_reason} />}
      </Card>
      <Contact phone={p.phone} instagram={p.instagram_company} />
      <Button title="Trocar segmento" variant="outline" disabled={!niches.data?.length} loading={busy === 'niche'} onPress={changeNiche} />

      {open && (scheduling ? (
        <Card>
          <Text variant="heading">Propor reunião</Text>
          <Host matchContents>
            <DatePicker title="Data e hora" selection={when} displayedComponents={['date', 'hourAndMinute']}
              range={{ start: new Date() }} onDateChange={setWhen} />
          </Host>
          <Field label="Local ou link" value={place} onChangeText={setPlace} placeholder="Ex.: Exotic Motors ou link do Meet" />
          <Button title="Enviar proposta" loading={busy === 'meeting'} onPress={propose} />
          <Button title="Cancelar" variant="ghost" onPress={() => setScheduling(false)} />
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button title={p.meeting_at && p.status !== 'pending' ? 'Remarcar reunião' : 'Agendar reunião'} variant="ink"
            onPress={() => setScheduling(true)} />
          <Button title="Aprovar" loading={busy === 'approve'} onPress={approve} />
        </View>
      ))}
      {p.status === 'rejected' && (
        <Button title="Aprovar mesmo assim" variant="outline" loading={busy === 'approve'} onPress={approve} />
      )}
      {p.status !== 'rejected' && p.status !== 'approved' && (
        <Button title="Reprovar" variant="ghost" loading={busy === 'reject'} style={{ borderWidth: 1, borderColor: colors.danger }}
          onPress={() => askReason('Reprovar parceria', (reason) =>
            run('reject', 'admin_set_partner_status', { _partner: p.id, _status: 'rejected', _reason: reason }, 'Parceria reprovada'))} />
      )}
      {p.status === 'approved' && (
        <Button title={p.active ? 'Desativar parceiro' : 'Reativar parceiro'} variant="outline" loading={busy === 'active'}
          onPress={() => run('active', 'admin_set_partner_active', { _partner: p.id, _active: !p.active })} />
      )}
    </Screen>
  );
}
