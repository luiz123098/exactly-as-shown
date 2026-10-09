import * as AppleAuthentication from 'expo-apple-authentication';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { z } from 'zod';

import { Button, Field, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { authRedirectUrl } from '@/lib/auth-link';
import { googleConfigured, signInWithApple, signInWithGoogle, type SocialResult } from '@/lib/social';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

const schema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
});

// Email, Apple and Google sign-in. New accounts continue on the profile step
// (name, Instagram, photo) before the app opens.
export default function Login() {
  const { intent } = useLocalSearchParams<{ intent?: 'member' | 'partner' }>();
  const [signup, setSignup] = useState(!!intent);
  const [f, setF] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [social, setSocial] = useState<'apple' | 'google' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const { setIntent } = useAuth();

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  // Remember which button brought the person here, so the matching application
  // form opens right after sign-up (plain "Entrar" opens the app directly).
  useEffect(() => {
    setIntent(intent ?? null);
  }, [intent, setIntent]);

  async function socialSignIn(provider: 'apple' | 'google') {
    if (social) return;
    setSocial(provider);
    const res: SocialResult = await (provider === 'apple' ? signInWithApple() : signInWithGoogle());
    setSocial(null);
    if (res.status === 'cancelled') Alert.alert('Login cancelado', 'Você pode tentar de novo quando quiser.');
    else if (res.status === 'error') Alert.alert('Não foi possível entrar', res.message);
    // On success the auth listener moves on to the profile step or the app.
  }

  async function submit() {
    const parsed = schema.safeParse(f);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setBusy(true);
    const { email, password } = parsed.data;
    const { data, error } = signup
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: authRedirectUrl() } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return void Alert.alert('Não foi possível continuar', signup ? error.message : 'E-mail ou senha incorretos.');
    // With email confirmation on, sign-up returns no session until the link is opened.
    if (signup && !data.session) {
      Alert.alert('Confirme seu e-mail', `Enviamos um link para ${email}. Abra-o neste iPhone para entrar direto no app.`);
      setSignup(false);
    }
  }

  const title = intent === 'partner' ? 'Torne-se parceiro' : intent === 'member' ? 'Torne-se membro' : 'Entrar';
  return (
    <Screen style={{ flexGrow: 1 }}>
      <Text variant="title">{title}</Text>
      <Text variant="muted">{signup ? 'Crie sua conta para enviar sua solicitação.' : 'Acesse sua conta do Exotic Club.'}</Text>
      <Field label="E-mail" value={f.email} onChangeText={(email) => setF({ ...f, email })} error={errors['email']}
        autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Senha" value={f.password} onChangeText={(password) => setF({ ...f, password })} error={errors['password']}
        secureTextEntry textContentType={signup ? 'newPassword' : 'password'} />
      <Button title={signup ? 'Criar conta' : 'Entrar'} loading={busy} onPress={submit} />
      <Button title={signup ? 'Já tenho conta' : 'Criar uma conta'} variant="ghost" onPress={() => setSignup(!signup)} />
      {/* Social sign-in sits at the bottom, as is standard on iOS. */}
      <View style={{ flex: 1 }} />
      <View style={{ gap: space.sm }}>
        {(appleAvailable || googleConfigured) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text variant="label">ou</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>
        )}
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            key={signup ? 'up' : 'in'}
            buttonType={signup ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={radius.pill}
            style={{ width: '75%', height: 52, alignSelf: 'center', opacity: social ? 0.5 : 1 }}
            onPress={() => socialSignIn('apple')}
          />
        )}
        {googleConfigured && (
          <Button title="Continuar com Google" variant="outline" loading={social === 'google'} disabled={!!social}
            style={{ width: '75%', alignSelf: 'center' }} onPress={() => socialSignIn('google')} />
        )}
      </View>
    </Screen>
  );
}
