import { ProfileForm } from '@/components/profile-form';
import { Button, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';

// First step after any sign-in (email, Apple or Google): the app opens only
// once name, Instagram and photo are filled in.
export default function CompleteProfile() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Text variant="title">Complete seu perfil</Text>
      <Text variant="muted">Seu @ do Instagram é obrigatório. Vamos tentar usar sua foto de perfil de lá.</Text>
      <ProfileForm submitLabel="Continuar" />
      <Button title="Sair" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
