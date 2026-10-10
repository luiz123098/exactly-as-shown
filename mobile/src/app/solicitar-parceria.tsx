import { useState } from 'react';
import { Alert } from 'react-native';

import { NichePicker } from '@/components/niche-picker';
import { Button, Field, Screen, Text } from '@/components/ui';
import { fieldErrors, partnerSchema } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Form = Record<keyof typeof partnerSchema.shape, string>;

// Partnership request ("Torne-se parceiro"). The admins can schedule a meeting,
// approve or reject it; approval turns the account into a partner.
export default function PartnerApplication() {
  const { session, profile, refresh, setIntent } = useAuth();
  const userId = session?.user.id;
  const [f, setF] = useState<Form>({
    responsible_name: profile?.full_name ?? '',
    email: session?.user.email ?? '',
    phone: '',
    company_name: '',
    niche: '',
    instagram_responsible: profile?.instagram ? `@${profile.instagram}` : '',
    instagram_company: '',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [nicheId, setNicheId] = useState<string | null>(null);

  const set = (key: keyof Form) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function submit() {
    if (!userId) return;
    const parsed = partnerSchema.safeParse(f);
    if (!parsed.success || !nicheId) {
      return void setErrors({ ...(parsed.success ? {} : fieldErrors(parsed.error)), ...(nicheId ? {} : { niche: 'Escolha o segmento da empresa' }) });
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.from('partners').insert({ ...parsed.data, niche_id: nicheId, owner_id: userId });
    setBusy(false);
    if (error) return void Alert.alert('Não foi possível enviar', 'Verifique sua conexão e tente novamente.');
    await refresh();
    setIntent(null);
    Alert.alert('Solicitação enviada', 'Vamos analisar e, se for o caso, propor uma reunião. Acompanhe pelo seu perfil.');
  }

  return (
    <Screen>
      <Text variant="eyebrow">Torne-se parceiro</Text>
      <Text variant="title">Solicitação de parceria</Text>
      <Text variant="muted">Conte sobre sua empresa. Depois da análise, podemos marcar uma reunião antes da aprovação.</Text>
      <Field label="Seu nome completo" value={f.responsible_name} onChangeText={set('responsible_name')}
        error={errors['responsible_name']} autoComplete="name" />
      <Field label="E-mail" value={f.email} onChangeText={set('email')} error={errors['email']}
        autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Telefone (WhatsApp)" value={f.phone} onChangeText={set('phone')} error={errors['phone']}
        keyboardType="phone-pad" autoComplete="tel" placeholder="(11) 98765-4321" />
      <Field label="Nome da empresa" value={f.company_name} onChangeText={set('company_name')} error={errors['company_name']} />
      <NichePicker value={nicheId} error={errors['niche']} onChange={(id, name) => { setNicheId(id); set('niche')(name); }} />
      <Field label="Seu Instagram" value={f.instagram_responsible} onChangeText={set('instagram_responsible')}
        error={errors['instagram_responsible']} autoCapitalize="none" autoCorrect={false} placeholder="@seuperfil" />
      <Field label="Instagram da empresa" value={f.instagram_company} onChangeText={set('instagram_company')}
        error={errors['instagram_company']} autoCapitalize="none" autoCorrect={false} placeholder="@empresa" />
      <Field label="O que quer oferecer aos membros?" value={f.reason} onChangeText={set('reason')} error={errors['reason']}
        multiline style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }} />
      <Button title="Enviar solicitação" loading={busy} onPress={submit} />
      <Button title="Agora não" variant="ghost" onPress={() => setIntent(null)} />
    </Screen>
  );
}
