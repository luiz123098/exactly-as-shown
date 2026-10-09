import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

export type SocialResult = { status: 'ok' } | { status: 'cancelled' } | { status: 'error'; message: string };

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

// The Google button only shows once both public client IDs are configured.
export const googleConfigured = !!googleWebClientId && !!googleIosClientId;

// Supabase links a social login to an existing account with the same verified
// email, so returning users land in their original account.
export async function signInWithApple(): Promise<SocialResult> {
  // Apple signs a hash of the nonce; Supabase checks it against the raw value.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    return { status: 'error', message: 'A Apple não concluiu o login. Tente novamente.' };
  }
  if (!credential.identityToken) return { status: 'error', message: 'A Apple não enviou os dados de login. Tente novamente.' };

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
  });
  if (error || !data.user) return { status: 'error', message: 'Não foi possível entrar com a Apple. Tente novamente.' };

  // Apple sends the name only on the first sign-in: keep it, without
  // overwriting a name the member already set.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
  if (name) {
    await supabase.auth.updateUser({ data: { full_name: name } });
    await supabase.from('profiles').update({ full_name: name.slice(0, 120) }).eq('id', data.user.id).eq('full_name', '');
  }
  // The server exchanges the one-time code for a refresh token so the account
  // deletion can revoke it later, as Apple requires.
  if (credential.authorizationCode) {
    const { error: fnError } = await supabase.functions.invoke('apple-token', { body: { code: credential.authorizationCode } });
    if (fnError) console.warn('apple-token', fnError.message);
  }
  return { status: 'ok' };
}

async function google() {
  // Loaded on demand so screens that never use Google don't touch the native module.
  const { GoogleSignin, isErrorWithCode, statusCodes } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
  return { GoogleSignin, isErrorWithCode, statusCodes };
}

export async function signInWithGoogle(): Promise<SocialResult> {
  if (!googleConfigured) return { status: 'error', message: 'O login com Google ainda não foi configurado.' };
  const { GoogleSignin, isErrorWithCode, statusCodes } = await google();
  let idToken: string | null;
  try {
    const res = await GoogleSignin.signIn();
    if (res.type === 'cancelled') return { status: 'cancelled' };
    idToken = res.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return { status: 'cancelled' };
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) return { status: 'error', message: 'Já existe um login com Google em andamento.' };
    return { status: 'error', message: 'O Google não concluiu o login. Tente novamente.' };
  }
  if (!idToken) return { status: 'error', message: 'O Google não enviou os dados de login. Tente novamente.' };
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
  if (error) return { status: 'error', message: 'Não foi possível entrar com o Google. Tente novamente.' };
  return { status: 'ok' };
}

// Forget the Google account on sign-out so the next login can pick another one.
export async function signOutSocial() {
  if (!googleConfigured) return;
  try {
    const { GoogleSignin } = await google();
    await GoogleSignin.signOut();
  } catch {
    // Not signed in with Google; nothing to clear.
  }
}
