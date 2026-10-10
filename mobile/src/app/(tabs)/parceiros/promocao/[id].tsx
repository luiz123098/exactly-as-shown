import { DatePicker, Host } from '@expo/ui/swift-ui';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Button, Card, Field, Loading, Screen, Text } from '@/components/ui';
import { fieldErrors } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import {
  partnerImageUrl, promotionSchema, removePartnerImage, uploadPartnerImage, USAGE_LIMIT, type Promotion, type UsageLimit,
} from '@/lib/partners';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

const LIMITS = Object.keys(USAGE_LIMIT) as UsageLimit[];

// One month from today, a sensible first end date.
function inAMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setHours(23, 59, 0, 0);
  return d;
}

// New ("nova") or edited promotion. Published right away; admins can remove it.
export default function PromotionForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'nova';
  const { session, access } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const [promo, setPromo] = useState<Promotion | null>(null);
  const [f, setF] = useState({ title: '', description: '', discount_label: '' });
  const [limit, setLimit] = useState<UsageLimit>('unlimited');
  const [hasEnd, setHasEnd] = useState(false);
  const [endsAt, setEndsAt] = useState(inAMonth);
  const [active, setActive] = useState(true);
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    supabase.from('promotions').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        const p = data as Promotion;
        setPromo(p);
        setF({ title: p.title, description: p.description, discount_label: p.discount_label ?? '' });
        setLimit(p.usage_limit);
        setHasEnd(!!p.ends_at);
        if (p.ends_at) setEndsAt(new Date(p.ends_at));
        setActive(p.active);
      }
      setLoading(false);
    });
  }, [id, isNew]);

  const set = (key: keyof typeof f) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function pickImage() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setPicked(res.assets[0]);
  }

  async function save() {
    const pid = access?.partner?.id;
    if (!me || !pid) return;
    const parsed = promotionSchema.safeParse(f);
    if (!parsed.success) return void setErrors(fieldErrors(parsed.error));
    if (hasEnd && endsAt.getTime() <= Date.now()) return void setErrors({ ends_at: 'A data de término precisa ser no futuro' });
    setErrors({});
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (picked) uploaded = await uploadPartnerImage(me, 'promo', picked.uri, picked.mimeType);
      const row = { ...parsed.data, usage_limit: limit, ends_at: hasEnd ? endsAt.toISOString() : null,
        image_path: uploaded ?? promo?.image_path ?? null };
      const { data, error } = isNew
        ? await supabase.from('promotions').insert({ ...row, partner_id: pid }).select('id')
        : await supabase.from('promotions').update({ ...row, active }).eq('id', id).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('not saved');
      if (uploaded && promo?.image_path) await removePartnerImage(promo.image_path);
      await qc.invalidateQueries({ queryKey: ['partners'] });
      router.back();
    } catch {
      await removePartnerImage(uploaded);
      Alert.alert('Não foi possível salvar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Excluir promoção', 'Ela sai do app. O histórico de usos também é apagado.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('promotions').delete().eq('id', id);
          if (error) return void Alert.alert('Não foi possível excluir', 'Tente novamente.');
          await removePartnerImage(promo?.image_path);
          await qc.invalidateQueries({ queryKey: ['partners'] });
          router.back();
        },
      },
    ]);
  }

  if (loading) return <Loading />;
  const preview = picked?.uri ?? partnerImageUrl(promo?.image_path);
  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Nova promoção' : 'Editar promoção' }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher imagem da promoção" onPress={pickImage}
        style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
        {preview ? <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" /> : (
          <View style={{ aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
            <Text variant="muted">Imagem (opcional)</Text>
          </View>
        )}
        <View style={{ padding: space.sm, alignItems: 'center' }}>
          <Text variant="label">{preview ? 'Trocar imagem' : 'Escolher imagem'}</Text>
        </View>
      </Pressable>
      <Field label="Nome da promoção" value={f.title} onChangeText={set('title')} error={errors['title']} maxLength={120}
        placeholder="Ex.: Lavagem completa com desconto" />
      <Field label="Destaque do desconto (opcional)" value={f.discount_label} onChangeText={set('discount_label')}
        error={errors['discount_label']} maxLength={40} placeholder="Ex.: 15% OFF" />
      <Field label="Detalhes e regras" value={f.description} onChangeText={set('description')} error={errors['description']}
        multiline maxLength={1000} style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }} />

      <Card>
        <Text variant="label">Quantas vezes cada membro pode usar</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {LIMITS.map((l) => (
            <Pressable key={l} accessibilityRole="radio" accessibilityState={{ selected: limit === l }} onPress={() => setLimit(l)}
              style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1,
                borderColor: limit === l ? colors.ink : colors.border, backgroundColor: limit === l ? colors.ink : colors.card }}>
              <Text style={{ fontSize: 14, color: limit === l ? colors.inkText : colors.text }}>{USAGE_LIMIT[l]}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1 }}>Tem data para acabar</Text>
          <Switch value={hasEnd} onValueChange={setHasEnd} trackColor={{ true: colors.highlight }} />
        </View>
        {hasEnd && (
          <Host matchContents>
            <DatePicker title="Válida até" selection={endsAt} displayedComponents={['date']} range={{ start: new Date() }}
              onDateChange={(d) => { d.setHours(23, 59, 0, 0); setEndsAt(d); }} />
          </Host>
        )}
        {!!errors['ends_at'] && <Text style={{ color: colors.danger, fontSize: 13 }}>{errors['ends_at']}</Text>}
      </Card>

      {!isNew && (
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text>Promoção ativa</Text>
            <Text variant="muted">Desligue para pausar sem excluir.</Text>
          </View>
          <Switch value={active} onValueChange={setActive} trackColor={{ true: colors.highlight }} />
        </Card>
      )}
      <Button title={isNew ? 'Publicar promoção' : 'Salvar'} loading={busy} onPress={save} />
      {!isNew && <Button title="Excluir promoção" variant="ghost" onPress={confirmDelete} style={{ borderWidth: 1, borderColor: colors.danger }} />}
    </Screen>
  );
}
