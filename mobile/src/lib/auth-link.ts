import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

import { supabase } from '@/lib/supabase';

// Where Supabase sends people after they open the confirmation email: the app
// itself (exoticclub://), which must be listed under Auth → URL Configuration.
export function authRedirectUrl() {
  return Linking.createURL('/');
}

// Tokens or an error come back in the URL fragment (#access_token=…).
export function parseAuthFragment(url: string) {
  const hash = url.split('#')[1];
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    error: params.get('error_description') ?? params.get('error'),
  };
}

export async function handleAuthRedirect(url: string) {
  const f = parseAuthFragment(url);
  if (!f) return;
  if (f.error) {
    Alert.alert('Link inválido ou expirado', 'Entre com seu e-mail e senha. Se ainda não confirmou, crie a conta de novo para receber outro link.');
    return;
  }
  if (f.accessToken && f.refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: f.accessToken, refresh_token: f.refreshToken });
    if (error) Alert.alert('Não foi possível entrar', 'Entre com seu e-mail e senha.');
  }
}
