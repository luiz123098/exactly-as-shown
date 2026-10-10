import { Stack } from 'expo-router';

import { colors } from '@/lib/theme';

export default function PartnersLayout() {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerBackTitle: 'Voltar', headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Parceiro' }} />
      <Stack.Screen name="minha-empresa" options={{ title: 'Página da empresa' }} />
      <Stack.Screen name="promocoes" options={{ title: 'Minhas promoções' }} />
      <Stack.Screen name="promocao/[id]" options={{ title: 'Promoção' }} />
      <Stack.Screen name="historico" options={{ title: 'Histórico' }} />
    </Stack>
  );
}
