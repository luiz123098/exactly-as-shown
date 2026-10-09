import { Stack } from 'expo-router';

import { colors } from '@/lib/theme';

export default function GarageLayout() {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerBackTitle: 'Voltar', headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[owner]" options={{ title: 'Garagem' }} />
      <Stack.Screen name="minha" options={{ title: 'Minha garagem' }} />
      <Stack.Screen name="carro/[id]" options={{ title: 'Carro' }} />
    </Stack>
  );
}
