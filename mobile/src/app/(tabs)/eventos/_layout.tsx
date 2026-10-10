import { Stack } from 'expo-router';

import { colors } from '@/lib/theme';

export default function EventsLayout() {
  return (
    <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerBackTitle: 'Voltar', headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Evento' }} />
      <Stack.Screen name="info/[id]" options={{ title: 'Informações do evento' }} />
      <Stack.Screen name="editar/[id]" options={{ title: 'Evento' }} />
      <Stack.Screen name="novo-post/[id]" options={{ title: 'Novo post' }} />
      <Stack.Screen name="instagram/[id]" options={{ title: 'Posts do Instagram' }} />
    </Stack>
  );
}
