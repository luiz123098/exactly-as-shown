import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { CarPhoto } from '@/components/garage';
import { Button, Field, Loading, Screen, Text } from '@/components/ui';
import { fieldErrors } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { carSchema, removeCarPhoto, uploadCarPhoto, type Car } from '@/lib/garage';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

type Form = Record<keyof typeof carSchema.shape, string>;
const EMPTY: Form = { brand: '', model: '', version: '', year: '', color: '', nickname: '', description: '' };

// Add ("novo") or edit a car. Saving a new photo sends it to the admins again.
export default function CarForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'novo';
  const { session } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY);
  const [car, setCar] = useState<Car | null>(null);
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isNew) return;
    supabase.from('cars').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        const c = data as Car;
        setCar(c);
        setF({ brand: c.brand, model: c.model, version: c.version ?? '', year: String(c.year), color: c.color ?? '',
          nickname: c.nickname ?? '', description: c.description ?? '' });
      }
      setLoading(false);
    });
  }, [id, isNew]);

  const set = (key: keyof Form) => (value: string) => setF((prev) => ({ ...prev, [key]: value }));

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!res.canceled && res.assets[0]) {
      setPicked(res.assets[0]);
      setErrors((e) => ({ ...e, photo: '' }));
    }
  }

  async function save() {
    if (!me) return;
    const parsed = carSchema.safeParse(f);
    const next = parsed.success ? {} : fieldErrors(parsed.error);
    if (!picked && !car?.photo_path) next['photo'] = 'Escolha uma foto do carro';
    setErrors(next);
    if (!parsed.success || next['photo']) return;

    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (picked) uploaded = await uploadCarPhoto(me, picked.uri, picked.mimeType);
      const photo_path = uploaded ?? car?.photo_path;
      const row = { ...parsed.data, photo_path, photo_source: 'upload' };
      const { data: saved, error } = isNew
        ? await supabase.from('cars').insert({ ...row, owner_id: me }).select('id')
        : await supabase.from('cars').update(row).eq('id', id).select('id');
      if (error) throw error;
      if (!saved?.length) throw new Error('car not found');
      if (picked && car?.photo_path) await removeCarPhoto(car.photo_path);
      await Promise.all([qc.invalidateQueries({ queryKey: ['garage', me] }), qc.invalidateQueries({ queryKey: ['garages'] })]);
      Alert.alert('Carro salvo', 'As alterações vão para aprovação e aparecem para o clube assim que forem aprovadas.');
      router.back();
    } catch {
      await removeCarPhoto(uploaded);
      Alert.alert('Não foi possível salvar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Remover carro', 'O carro e as curtidas dele serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('cars').delete().eq('id', id);
          if (error) return void Alert.alert('Não foi possível remover', 'Tente novamente.');
          await removeCarPhoto(car?.photo_path);
          await Promise.all([qc.invalidateQueries({ queryKey: ['garage', me] }), qc.invalidateQueries({ queryKey: ['garages'] })]);
          router.back();
        },
      },
    ]);
  }

  if (loading) return <Loading />;
  return (
    <Screen>
      <Stack.Screen options={{ title: isNew ? 'Adicionar carro' : 'Editar carro' }} />
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher foto do carro" onPress={pickPhoto}
        style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: errors['photo'] ? colors.danger : colors.border }}>
        {picked ? (
          <Image source={{ uri: picked.uri }} style={{ width: '100%', aspectRatio: 4 / 3 }} contentFit="cover" />
        ) : (
          <CarPhoto path={car?.photo_path} />
        )}
        <View style={{ padding: space.sm, alignItems: 'center', backgroundColor: colors.card }}>
          <Text variant="label">{picked || car?.photo_path ? 'Trocar foto' : 'Escolher foto'}</Text>
        </View>
      </Pressable>
      {!!errors['photo'] && <Text style={{ color: colors.danger, fontSize: 13 }}>{errors['photo']}</Text>}
      <Text variant="muted">O carro (foto e textos) passa por aprovação dos administradores antes de aparecer para o clube.</Text>
      <Field label="Marca" value={f.brand} onChangeText={set('brand')} error={errors['brand']} placeholder="Ex.: Porsche" />
      <Field label="Modelo" value={f.model} onChangeText={set('model')} error={errors['model']} placeholder="Ex.: 911" />
      <Field label="Versão (opcional)" value={f.version} onChangeText={set('version')} error={errors['version']} placeholder="Ex.: GT3 RS" />
      <Field label="Ano" value={f.year} onChangeText={set('year')} error={errors['year']} keyboardType="number-pad" maxLength={4} placeholder="Ex.: 2023" />
      <Field label="Cor (opcional)" value={f.color} onChangeText={set('color')} error={errors['color']} placeholder="Ex.: Branco Carrara" />
      <Field label="Apelido (opcional)" value={f.nickname} onChangeText={set('nickname')} error={errors['nickname']} placeholder="Ex.: meu daily" />
      <Field label="Descrição (opcional)" value={f.description} onChangeText={set('description')} error={errors['description']}
        multiline style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }} />
      <Button title={isNew ? 'Adicionar à garagem' : 'Salvar'} loading={busy} onPress={save} />
      {!isNew && (
        <Button title="Remover carro" variant="ghost" onPress={confirmDelete} style={{ borderWidth: 1, borderColor: colors.danger }} />
      )}
    </Screen>
  );
}
