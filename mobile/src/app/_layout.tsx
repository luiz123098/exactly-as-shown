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
import { useNotificationsLive } from '@/lib/notifications';
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
  const { ready, session, loaded, profile, access, intent, setIntent } = useAuth();
  useNotificationsLive(session?.user.id);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  // An application already sent (or an admin account) needs no form; a rejected
  // member application can be edited and sent again.
  const memberApp = access?.member_application;
  const formDone = !access || access.is_admin
    || (intent === 'partner' ? !!access.partner
      : intent === 'member' ? !!memberApp && memberApp.status !== 'rejected' : true);
  useEffect(() => {
    if (intent && loaded && formDone) setIntent(null);
  }, [intent, loaded, formDone, setIntent]);
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
      {/* "Torne-se membro/parceiro" leads straight to its form; Perfil reuses the same path. */}
      <Stack.Protected guard={signedIn && complete && intent === 'member' && !formDone}>
        <Stack.Screen name="solicitar-assinatura" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && complete && intent === 'partner' && !formDone}>
        <Stack.Screen name="solicitar-parceria" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && complete && (!intent || formDone)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="editar-perfil" options={{ headerShown: true, title: 'Editar perfil', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="bloqueados" options={{ headerShown: true, title: 'Usuários bloqueados', headerBackTitle: 'Voltar' }} />
        <Stack.Screen name="notificacoes" options={{ headerShown: true, title: 'Notificações', headerBackTitle: 'Voltar' }} />
      </Stack.Protected>
    </Stack>
  );
}
