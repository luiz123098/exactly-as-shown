import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { formatMeeting, MEMBER_STATUS, PARTNER_STATUS } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

// Profile card: where each application stands, the meeting the admins proposed,
// and the entry points to the membership / partnership forms.
export function ApplicationStatus() {
  const { access, kind, refresh, setIntent } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!access || kind === 'admin') return null;
  const member = access.member_application;
  const partner = access.partner;

  async function respond(confirm: boolean, request?: string) {
    setBusy(true);
    const { error } = await supabase.rpc('partner_respond_meeting', { _confirm: confirm, _request: request ?? null });
    setBusy(false);
    if (error) return void Alert.alert('Não foi possível responder', error.message);
    await refresh();
  }

  function askOtherTime() {
    Alert.prompt('Pedir outro horário', 'Diga quais dias e horários ficam melhores para você.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Enviar', onPress: (text?: string) => respond(false, text) },
    ]);
  }

  return (
    <>
      {member && (
        <Card>
          <Text variant="label">Solicitação de membro</Text>
          <Text variant="heading">{MEMBER_STATUS[member.status]}</Text>
          {member.status === 'rejected' && (
            <>
              {!!member.decision_reason && <Text variant="muted">Motivo: {member.decision_reason}</Text>}
              <Button title="Editar e reenviar" variant="outline" onPress={() => setIntent('member')} />
            </>
          )}
        </Card>
      )}
      {partner && (
        <Card>
          <Text variant="label">Solicitação de parceria · {partner.company_name}</Text>
          <Text variant="heading">{PARTNER_STATUS[partner.status]}</Text>
          {partner.status === 'meeting_proposed' && partner.meeting_at && (
            <View style={{ gap: space.sm }}>
              <Text>Os donos propuseram uma reunião:</Text>
              <Text style={{ color: colors.highlightDeep }}>{formatMeeting(partner.meeting_at, partner.meeting_place)}</Text>
              <Button title="Confirmar reunião" loading={busy} onPress={() => respond(true)} />
              <Button title="Pedir outro horário" variant="outline" disabled={busy} onPress={askOtherTime} />
            </View>
          )}
          {partner.status === 'meeting_confirmed' && partner.meeting_at && (
            <Text>Reunião: {formatMeeting(partner.meeting_at, partner.meeting_place)}</Text>
          )}
          {partner.status === 'pending' && !!partner.meeting_request && (
            <Text variant="muted">Você pediu outro horário. Aguarde uma nova proposta.</Text>
          )}
          {partner.status === 'rejected' && !!partner.decision_reason && (
            <Text variant="muted">Motivo: {partner.decision_reason}</Text>
          )}
        </Card>
      )}
      {kind === 'non_subscriber' && !member && !partner && (
        <Card>
          <Text variant="label">Faça parte</Text>
          <Text variant="muted">Assinantes têm carteirinha e promoções exclusivas. Empresas podem se tornar parceiras.</Text>
          <Button title="Quero ser membro assinante" onPress={() => setIntent('member')} />
          <Button title="Quero ser parceiro" variant="outline" onPress={() => setIntent('partner')} />
        </Card>
      )}
    </>
  );
}
