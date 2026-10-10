import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable } from 'react-native';

import { PartnerLogo } from '@/components/partners';
import { Button, Field, Loading, Screen, Text } from '@/components/ui';
import { fieldErrors } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { partnerPageSchema, removePartnerImage, uploadPartnerImage, type PartnerPage } from '@/lib/partners';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

type Form = Record<keyof typeof partnerPageSchema.shape, string>;

// The partner edits what members see on the company page.
export default function MyCompany() {
  const { session, refresh } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const [partner, setPartner] = useState<PartnerPage | null>(null);
  const [f, setF] = useState<Form>({ description: '', address: '', city: '', public_whatsapp: '', website: '', instagram_company: '' });
  const [logo, setLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('my_partner').then(({ data }) => {
      const p = data as PartnerPage | null;
      if (p?.id) {
        setPartner(p);
        setF({ description: p.description ?? '', address: p.address ?? '', city: p.city ?? '',
          public_whatsapp: p.public_whatsapp ?? '', website: p.website ?? '', instagram_company: `@${p.instagram_company}` });
      }
      setLoading(false);
    });
  }, []);

  const set = (key: keyof Form) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function pickLogo() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setLogo(res.assets[0]);
  }

  async function save() {
    if (!me || !partner) return;
    const parsed = partnerPageSchema.safeParse(f);
    if (!parsed.success) return void setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (logo) uploaded = await uploadPartnerImage(me, 'logo', logo.uri, logo.mimeType);
      const { error } = await supabase.from('partners')
        .update({ ...parsed.data, logo_path: uploaded ?? partner.logo_path }).eq('id', partner.id);
      if (error) throw error;
      if (uploaded) await removePartnerImage(partner.logo_path);
      await Promise.all([qc.invalidateQueries({ queryKey: ['partners'] }), refresh()]);
      router.back();
    } catch {
      await removePartnerImage(uploaded);
      Alert.alert('Não foi possível salvar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!partner) return <Screen><Text>Esta conta não tem uma empresa parceira aprovada.</Text></Screen>;
  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Trocar logo" onPress={pickLogo} style={{ alignItems: 'center', gap: space.sm }}>
        {logo ? (
          <Image source={{ uri: logo.uri }} style={{ width: 96, height: 96, borderRadius: 24 }} contentFit="cover" />
        ) : <PartnerLogo path={partner.logo_path} name={partner.company_name} size={96} />}
        <Text variant="label">{partner.logo_path || logo ? 'Trocar logo' : 'Escolher logo'}</Text>
      </Pressable>
      <Text variant="heading" style={{ textAlign: 'center' }}>{partner.company_name}</Text>
      <Text variant="muted" style={{ textAlign: 'center' }}>Segmento: {partner.niche}. Para mudar, fale com a equipe.</Text>
      <Field label="Sobre a empresa" value={f.description} onChangeText={set('description')} error={errors['description']}
        multiline maxLength={1000} style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }} />
      <Field label="Endereço (opcional)" value={f.address} onChangeText={set('address')} error={errors['address']}
        placeholder="Rua, número, bairro" />
      <Field label="Cidade (opcional)" value={f.city} onChangeText={set('city')} error={errors['city']} />
      <Field label="WhatsApp para clientes (opcional)" value={f.public_whatsapp} onChangeText={set('public_whatsapp')}
        error={errors['public_whatsapp']} keyboardType="phone-pad" placeholder="(62) 99999-9999" />
      <Field label="Site (opcional)" value={f.website} onChangeText={set('website')} error={errors['website']}
        autoCapitalize="none" keyboardType="url" placeholder="www.suaempresa.com.br" />
      <Field label="Instagram da empresa" value={f.instagram_company} onChangeText={set('instagram_company')}
        error={errors['instagram_company']} autoCapitalize="none" autoCorrect={false} />
      <Button title="Salvar" loading={busy} onPress={save} />
    </Screen>
  );
}
