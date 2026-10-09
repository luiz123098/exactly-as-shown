import { useEffect, useState } from 'react';
import { Alert } from 'react-native';

import { Button, Field, Loading, Screen, Text } from '@/components/ui';
import { fieldErrors, memberSchema } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Form = Record<keyof typeof memberSchema.shape, string>;

// Membership request ("Torne-se membro"). The admins approve it and then
// activate the annual fee; a rejected request can be edited and sent again.
export default function MemberApplication() {
  const { session, profile, refresh, setIntent } = useAuth();
  const userId = session?.user.id;
  const [f, setF] = useState<Form>({
    full_name: profile?.full_name ?? '',
    email: session?.user.email ?? '',
    phone: '',
    city: '',
    profession: '',
    instagram: profile?.instagram ? `@${profile.instagram}` : '',
    cars: '',
    reason: '',
  });
  const [existing, setExisting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from('member_applications').select('*').eq('user_id', userId).maybeSingle().then(({ data }) => {
      if (data) {
        setExisting(data.id);
        setF({ ...data, instagram: `@${data.instagram}`, cars: data.cars ?? '' });
      }
      setLoading(false);
    });
  }, [userId]);

  const set = (key: keyof Form) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    if (!userId) return;
    const parsed = memberSchema.safeParse(f);
    if (!parsed.success) return void setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    const { error } = existing
      ? await supabase.from('member_applications').update(parsed.data).eq('id', existing)
      : await supabase.from('member_applications').insert({ ...parsed.data, user_id: userId });
    setBusy(false);
    if (error) return void Alert.alert('Não foi possível enviar', 'Verifique sua conexão e tente novamente.');
    await refresh();
    setIntent(null);
    Alert.alert('Solicitação enviada', 'Vamos analisar e você será avisado por aqui. Acompanhe o status no seu perfil.');
  }

  if (loading) return <Loading />;
  return (
    <Screen>
      <Text variant="eyebrow">Torne-se membro</Text>
      <Text variant="title">Solicitação de assinatura</Text>
      <Text variant="muted">O Exotic Club é fechado: cada solicitação é analisada pelos donos.</Text>
      <Field label="Nome completo" value={f.full_name} onChangeText={set('full_name')} error={errors['full_name']} autoComplete="name" />
      <Field label="E-mail" value={f.email} onChangeText={set('email')} error={errors['email']}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Telefone (WhatsApp)" value={f.phone} onChangeText={set('phone')} error={errors['phone']}
        keyboardType="phone-pad" autoComplete="tel" placeholder="(11) 98765-4321" />
      <Field label="Cidade" value={f.city} onChangeText={set('city')} error={errors['city']} />
      <Field label="Profissão" value={f.profession} onChangeText={set('profession')} error={errors['profession']} />
      <Field label="Instagram" value={f.instagram} onChangeText={set('instagram')} error={errors['instagram']}
        autoCapitalize="none" autoCorrect={false} placeholder="@seuperfil" />
      <Field label="Seus carros (opcional)" value={f.cars} onChangeText={set('cars')} error={errors['cars']} multiline />
      <Field label="Por que quer fazer parte do clube?" value={f.reason} onChangeText={set('reason')} error={errors['reason']}
        multiline style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }} />
      <Button title={existing ? 'Reenviar solicitação' : 'Enviar solicitação'} loading={busy} onPress={submit} />
      <Button title="Agora não" variant="ghost" onPress={() => setIntent(null)} />
    </Screen>
  );
}
