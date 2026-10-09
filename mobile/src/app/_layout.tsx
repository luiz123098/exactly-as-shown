import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { isProfileComplete } from '@/lib/profile';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar style="dark" />
        {fontsLoaded && <RootStack />}
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootStack() {
  const { ready, session, loaded, profile } = useAuth();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  // Keep the splash up until we know which profile is signed in, so the tab
  // bar mounts once with the right tabs.
  if (!ready) return null;
  const signedIn = !!session;
  if (signedIn && !loaded) return <Loading label="Entrando…" />;
  // Every sign-in method goes through the same profile step (name, Instagram, photo).
  const complete = isProfileComplete(profile);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" options={{ headerShown: true, title: '', headerShadowVisible: false, headerBackTitle: 'Voltar' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !complete}>
        <Stack.Screen name="completar-perfil" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && complete}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="editar-perfil" options={{ headerShown: true, title: 'Editar perfil', headerBackTitle: 'Voltar' }} />
      </Stack.Protected>
    </Stack>
  );
}
