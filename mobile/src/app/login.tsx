import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { z } from 'zod';

import { Button, Field, Screen, Text } from '@/components/ui';
import { supabase } from '@/lib/supabase';

const schema = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo de 8 caracteres'),
});

// Phase 0: email sign-in/sign-up so each profile can be tested. Phase 1 adds
// Sign in with Apple and the membership / partner forms after account creation.
export default function Login() {
  const { intent } = useLocalSearchParams<{ intent?: 'member' | 'partner' }>();
  const [signup, setSignup] = useState(!!intent);
  const [f, setF] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

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
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return void Alert.alert('Não foi possível continuar', signup ? error.message : 'E-mail ou senha incorretos.');
    // With email confirmation on, sign-up returns no session until the link is opened.
    if (signup && !data.session) {
      Alert.alert('Confirme seu e-mail', `Enviamos um link para ${email}. Abra-o e depois entre com sua senha.`);
      setSignup(false);
    }
  }

  const title = intent === 'partner' ? 'Torne-se parceiro' : intent === 'member' ? 'Torne-se membro' : 'Entrar';
  return (
    <Screen>
      <Text variant="title">{title}</Text>
      <Text variant="muted">{signup ? 'Crie sua conta para enviar sua solicitação.' : 'Acesse sua conta do Exotic Club.'}</Text>
      <Field label="E-mail" value={f.email} onChangeText={(email) => setF({ ...f, email })} error={errors['email']}
        autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
      <Field label="Senha" value={f.password} onChangeText={(password) => setF({ ...f, password })} error={errors['password']}
        secureTextEntry textContentType={signup ? 'newPassword' : 'password'} />
      <Button title={signup ? 'Criar conta' : 'Entrar'} loading={busy} onPress={submit} />
      <Button title={signup ? 'Já tenho conta' : 'Criar uma conta'} variant="ghost" onPress={() => setSignup(!signup)} />
    </Screen>
  );
}
