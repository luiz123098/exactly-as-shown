import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { avatarUrl, importInstagramAvatar, normalizeInstagram, uploadAvatar } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

// Name, Instagram (required) and photo. On the first save without a photo we
// try the member's Instagram picture; if that fails they pick one.
export function ProfileForm({ submitLabel, onSaved }: { submitLabel: string; onSaved?: () => void }) {
  const { session, profile, refresh } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState(profile?.full_name ?? '');
  const [instagram, setInstagram] = useState(profile?.instagram ? `@${profile.instagram}` : '');
  const [avatar, setAvatar] = useState(profile?.avatar_path ?? null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function pickPhoto() {
    if (!userId) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    try {
      const asset = res.assets[0];
      setAvatar(await uploadAvatar(userId, asset.uri, asset.mimeType, avatar));
      setErrors((e) => ({ ...e, photo: '' }));
    } catch {
      Alert.alert('Não foi possível enviar a foto', 'Verifique sua conexão e tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!userId) return;
    const next: Record<string, string> = {};
    const handle = normalizeInstagram(instagram);
    if (name.trim().length < 2) next['name'] = 'Informe seu nome completo';
    if (!handle) next['instagram'] = 'Informe um @ do Instagram válido';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: name.trim(), instagram: handle }).eq('id', userId);
      if (error) throw error;
      let photo = avatar;
      if (!photo) {
        photo = await importInstagramAvatar();
        if (photo) {
          setAvatar(photo);
          Alert.alert('Foto do Instagram', 'Usamos sua foto de perfil do Instagram. Você pode trocá-la quando quiser em Editar perfil.');
        } else {
          setErrors({ photo: 'Não conseguimos pegar sua foto do Instagram. Toque no círculo acima para escolher uma foto.' });
          return;
        }
      }
      await refresh();
      onSaved?.();
    } catch {
      Alert.alert('Não foi possível salvar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const uri = avatarUrl(avatar);
  return (
    <View style={{ gap: space.md }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher foto de perfil" onPress={pickPhoto} style={styles.avatarWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.avatar} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.avatar, styles.placeholder]}>
            <Text variant="muted">{uploading ? 'Enviando…' : 'Foto'}</Text>
          </View>
        )}
        <Text variant="label">{uri ? 'Trocar foto' : 'Escolher foto'}</Text>
      </Pressable>
      {!!errors['photo'] && <Text style={styles.error}>{errors['photo']}</Text>}
      <Field label="Nome completo" value={name} onChangeText={setName} error={errors['name']}
        autoComplete="name" textContentType="name" />
      <Field label="Instagram" value={instagram} onChangeText={setInstagram} error={errors['instagram']}
        placeholder="@seuperfil" autoCapitalize="none" autoCorrect={false} />
      <Button title={submitLabel} loading={busy || uploading} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', gap: space.sm },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  placeholder: { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center' },
});
