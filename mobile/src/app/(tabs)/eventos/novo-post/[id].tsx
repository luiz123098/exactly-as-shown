import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Field, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { removeEventImages, uploadEventImage } from '@/lib/events';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

// Admin: a post made in the app (outside Instagram) for this event.
export default function EventPostForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 5], quality: 0.85 });
    if (!res.canceled && res.assets[0]) setPicked(res.assets[0]);
  }

  async function save() {
    if (!picked && !caption.trim()) return void Alert.alert('Escolha uma foto ou escreva um texto.');
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (picked) uploaded = await uploadEventImage(picked.uri, picked.mimeType);
      const { error } = await supabase.from('event_media').insert({
        event_id: id, source: 'app', media_path: uploaded, caption: caption.trim().slice(0, 2200), author_id: session?.user.id,
      });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['events'] });
      router.back();
    } catch {
      await removeEventImages([uploaded]);
      Alert.alert('Não foi possível publicar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher foto" onPress={pick}
        style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
        {picked ? <Image source={{ uri: picked.uri }} style={{ width: '100%', aspectRatio: 4 / 5 }} contentFit="cover" /> : (
          <View style={{ aspectRatio: 4 / 5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
            <Text variant="muted">Foto do evento</Text>
          </View>
        )}
        <View style={{ padding: space.sm, alignItems: 'center' }}>
          <Text variant="label">{picked ? 'Trocar foto' : 'Escolher foto'}</Text>
        </View>
      </Pressable>
      <Field label="Legenda" value={caption} onChangeText={setCaption} multiline maxLength={2200}
        style={{ minHeight: 100, paddingTop: 12, textAlignVertical: 'top' }} />
      <Button title="Publicar no evento" loading={busy} onPress={save} />
    </Screen>
  );
}
