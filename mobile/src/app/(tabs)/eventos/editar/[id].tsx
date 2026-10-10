import { DatePicker, Host } from '@expo/ui/swift-ui';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { Button, Card, ErrorState, Field, Loading, Screen, Text } from '@/components/ui';
import { fieldErrors } from '@/lib/applications';
import { eventImageUrl, eventSchema, removeEventImages, uploadEventImage, type EventDetails } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

type Form = Record<keyof typeof eventSchema.shape, string>;
const EMPTY: Form = { title: '', venue: '', address: '', city: '', program: '', rules: '' };

function nextSaturdayEvening() {
  const d = new Date();
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7));
  d.setHours(19, 0, 0, 0);
  return d;
}

// Admin: create ("novo") or edit an event. Creating an upcoming event notifies everyone.
export default function EventForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'novo';
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY);
  const [startsAt, setStartsAt] = useState(nextSaturdayEvening);
  const [hasEnd, setHasEnd] = useState(false);
  const [endsAt, setEndsAt] = useState(() => new Date(nextSaturdayEvening().getTime() + 4 * 3600_000));
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (isNew) return;
    Promise.all([
      supabase.from('events').select('title, cover_path').eq('id', id).single(),
      supabase.from('event_details').select('*').eq('event_id', id).maybeSingle(),
    ]).then(([e, d]) => {
      // Never show an empty form for an existing event: saving it would erase the details.
      if (e.error || d.error || !e.data) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      const det = d.data as EventDetails | null;
      setF({ title: e.data?.title ?? '', venue: det?.venue ?? '', address: det?.address ?? '', city: det?.city ?? '',
        program: det?.program ?? '', rules: det?.rules ?? '' });
      setCoverPath(e.data?.cover_path ?? null);
      if (det) {
        setStartsAt(new Date(det.starts_at));
        if (det.ends_at) {
          setHasEnd(true);
          setEndsAt(new Date(det.ends_at));
        }
      }
      setLoading(false);
    }, () => {
      setLoadError(true);
      setLoading(false);
    });
  }, [id, isNew]);

  const set = (key: keyof Form) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function pickCover() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.85 });
    if (!res.canceled && res.assets[0]) setPicked(res.assets[0]);
  }

  async function save() {
    const parsed = eventSchema.safeParse(f);
    if (!parsed.success) return void setErrors(fieldErrors(parsed.error));
    if (hasEnd && endsAt <= startsAt) return void setErrors({ ends_at: 'O fim precisa ser depois do início' });
    setErrors({});
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (picked) uploaded = await uploadEventImage(picked.uri, picked.mimeType);
      const v = parsed.data;
      const { data, error } = await supabase.rpc('admin_save_event', {
        _id: isNew ? null : id, _title: v.title, _cover_path: uploaded ?? coverPath, _starts_at: startsAt.toISOString(),
        _ends_at: hasEnd ? endsAt.toISOString() : null, _venue: v.venue, _address: v.address, _city: v.city,
        _program: v.program, _rules: v.rules,
      });
      if (error) throw error;
      if (uploaded && coverPath) await removeEventImages([coverPath]);
      await qc.invalidateQueries({ queryKey: ['events'] });
      if (isNew) router.replace(`/eventos/${data as string}`);
      else router.back();
    } catch (e) {
      await removeEventImages([uploaded]);
      Alert.alert('Não foi possível salvar', (e as Error).message ?? 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (loadError) return <ErrorState text="Não foi possível carregar o evento. Volte e tente de novo." />;
  const preview = picked?.uri ?? eventImageUrl(coverPath);
  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Novo evento' : 'Editar evento' }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher capa do evento" onPress={pickCover}
        style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
        {preview ? <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" /> : (
          <View style={{ aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
            <Text variant="muted">Capa do evento</Text>
          </View>
        )}
        <View style={{ padding: space.sm, alignItems: 'center' }}>
          <Text variant="label">{preview ? 'Trocar capa' : 'Escolher capa'}</Text>
        </View>
      </Pressable>
      <Field label="Nome do evento" value={f.title} onChangeText={set('title')} error={errors['title']} maxLength={120} />
      <Text variant="muted">Os campos abaixo só aparecem para assinantes, parceiros e admins, em “Informações”.</Text>
      <Card>
        <Host matchContents>
          <DatePicker title="Início" selection={startsAt} displayedComponents={['date', 'hourAndMinute']} onDateChange={setStartsAt} />
        </Host>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1 }}>Definir horário de término</Text>
          <Switch value={hasEnd} onValueChange={setHasEnd} trackColor={{ true: colors.highlight }} />
        </View>
        {hasEnd && (
          <Host matchContents>
            <DatePicker title="Término" selection={endsAt} displayedComponents={['date', 'hourAndMinute']} onDateChange={setEndsAt} />
          </Host>
        )}
        {!!errors['ends_at'] && <Text style={{ color: colors.danger, fontSize: 13 }}>{errors['ends_at']}</Text>}
      </Card>
      <Field label="Local" value={f.venue} onChangeText={set('venue')} error={errors['venue']} placeholder="Ex.: Autódromo de Goiânia" />
      <Field label="Endereço" value={f.address} onChangeText={set('address')} error={errors['address']} />
      <Field label="Cidade" value={f.city} onChangeText={set('city')} error={errors['city']} />
      <Field label="Programação" value={f.program} onChangeText={set('program')} error={errors['program']} multiline
        style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }} placeholder={'19h Recepção\n20h Exposição\n22h Jantar'} />
      <Field label="Regras" value={f.rules} onChangeText={set('rules')} error={errors['rules']} multiline
        style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }} placeholder="Dress code, acesso, convidados…" />
      <Button title={isNew ? 'Criar evento' : 'Salvar'} loading={busy} onPress={save} />
    </Screen>
  );
}
