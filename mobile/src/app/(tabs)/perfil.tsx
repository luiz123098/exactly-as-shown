import { View } from 'react-native';

import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth, type Kind } from '@/lib/auth';
import { space } from '@/lib/theme';

const KIND_LABEL: Record<Kind, string> = {
  admin: 'Administrador',
  partner: 'Parceiro',
  subscriber: 'Assinante',
  non_subscriber: 'Não assinante',
};

const APPLICATION_LABEL = { pending: 'Em análise', approved: 'Aprovada', rejected: 'Recusada' } as const;

export default function Profile() {
  const { session, access, kind, signOut, refresh } = useAuth();
  return (
    <Screen>
      <Text variant="title">Perfil</Text>
      <Card>
        <Text variant="label">Conta</Text>
        <Text>{session?.user.email}</Text>
        <Text variant="label">Perfil de acesso</Text>
        <Text variant="heading">{kind ? KIND_LABEL[kind] : '—'}</Text>
        {access?.member_application && (
          <View style={{ gap: space.xs }}>
            <Text variant="label">Solicitação de membro</Text>
            <Text>{APPLICATION_LABEL[access.member_application.status]}</Text>
          </View>
        )}
        {access?.membership_expires_at && (
          <View style={{ gap: space.xs }}>
            <Text variant="label">Anuidade válida até</Text>
            <Text>{new Date(access.membership_expires_at).toLocaleDateString('pt-BR')}</Text>
          </View>
        )}
      </Card>
      <Button title="Atualizar status" variant="outline" onPress={refresh} />
      <Button title="Sair" variant="ink" onPress={signOut} />
    </Screen>
  );
}
