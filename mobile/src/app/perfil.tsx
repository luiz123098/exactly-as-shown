import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { ApplicationStatus } from '@/components/application-status';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useAuth, type Kind } from '@/lib/auth';
import { avatarUrl, deleteAccount } from '@/lib/profile';
import { colors, space } from '@/lib/theme';

const KIND_LABEL: Record<Kind, string> = {
  admin: 'Administrador',
  partner: 'Parceiro',
  subscriber: 'Assinante',
  non_subscriber: 'Não assinante',
};

export default function Profile() {
  const { session, access, profile, kind, signOut, refresh } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const uri = avatarUrl(profile?.avatar_path);

  function confirmDelete() {
    Alert.alert(
      'Excluir conta',
      'Sua conta e todos os seus dados serão apagados. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteAccount();
              await signOut();
            } catch {
              Alert.alert('Não foi possível excluir a conta', 'Verifique sua conexão e tente novamente.');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {uri && <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.secondary }} />}
        <View style={{ flex: 1, gap: space.xs }}>
          <Text variant="heading">{profile?.full_name}</Text>
          {!!profile?.instagram && <Text variant="muted">@{profile.instagram}</Text>}
        </View>
      </View>
      <Button title="Editar perfil" variant="outline" onPress={() => router.push('/editar-perfil')} />
      <Card>
        <Text variant="label">Conta</Text>
        <Text>{session?.user.email}</Text>
        <Text variant="label">Perfil de acesso</Text>
        <Text variant="heading">{kind ? KIND_LABEL[kind] : '—'}</Text>
        {access?.membership_expires_at && (
          <View style={{ gap: space.xs }}>
            <Text variant="label">Anuidade válida até</Text>
            <Text>{new Date(access.membership_expires_at).toLocaleDateString('pt-BR')}</Text>
          </View>
        )}
      </Card>
      <ApplicationStatus />
      <Button title="Usuários bloqueados" variant="outline" onPress={() => router.push('/bloqueados')} />
      <Button title="Atualizar status" variant="outline" onPress={refresh} />
      <Button title="Sair" variant="ink" onPress={signOut} />
      <Button title="Excluir conta" variant="ghost" loading={deleting} onPress={confirmDelete}
        style={{ borderWidth: 1, borderColor: colors.danger }} />
    </Screen>
  );
}
