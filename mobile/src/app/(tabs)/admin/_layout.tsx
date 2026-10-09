import { Stack } from 'expo-router';

import { colors } from '@/lib/theme';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerBackTitle: 'Voltar', headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="parceiro/[id]" options={{ title: 'Parceria' }} />
      <Stack.Screen name="membro/[id]" options={{ title: 'Membro' }} />
    </Stack>
  );
}
