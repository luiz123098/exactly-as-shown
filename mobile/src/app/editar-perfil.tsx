import { router } from 'expo-router';

import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/ui';

export default function EditProfile() {
  return (
    <Screen>
      <ProfileForm submitLabel="Salvar" onSaved={() => router.back()} />
    </Screen>
  );
}
