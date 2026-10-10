import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Field, Loading, Screen, Text } from '@/components/ui';
import { fieldErrors } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { coverUri, excerptOf, postSchema, removeNewsImage, uploadNewsImage, type Article } from '@/lib/news';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

// New or edited post: partners post as their company (into their niche),
// admins post as Exotic Motors (which notifies everyone).
export default function PostForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, access, kind } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [article, setArticle] = useState<Article | null>(null);
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(!!id);
  const [busy, setBusy] = useState(false);
  const asExotic = kind === 'admin';

  useEffect(() => {
    if (!id) return;
    supabase.from('articles').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        const a = data as Article;
        setArticle(a);
        setTitle(a.title);
        setBody(a.body);
      }
      setLoading(false);
    });
  }, [id]);

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setPicked(res.assets[0]);
  }

  async function save() {
    if (!me) return;
    const parsed = postSchema.safeParse({ title, body });
    if (!parsed.success) return void setErrors(fieldErrors(parsed.error));
    setErrors({});
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (picked) uploaded = await uploadNewsImage(me, picked.uri, picked.mimeType);
      const fields = { ...parsed.data, excerpt: excerptOf(parsed.data.body), cover_path: uploaded ?? article?.cover_path ?? null };
      const { data, error } = article
        ? await supabase.from('articles').update(fields).eq('id', article.id).select('id')
        : await supabase.from('articles').insert({
            ...fields, author_id: me,
            origin: asExotic ? 'exotic' : 'partner',
            partner_id: asExotic ? null : access?.partner?.id,
          }).select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('not saved');
      if (uploaded && article?.cover_path) await removeNewsImage(article.cover_path);
      await qc.invalidateQueries({ queryKey: ['news'] });
      if (!article && asExotic) Alert.alert('Post publicado', 'Todos os usuários foram notificados.');
      router.back();
    } catch {
      await removeNewsImage(uploaded);
      Alert.alert('Não foi possível publicar', 'Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  const preview = picked?.uri ?? (article ? coverUri(article) : null);
  return (
    <Screen>
      <Stack.Screen options={{ title: article ? 'Editar post' : asExotic ? 'Post Exotic Motors' : 'Novo post' }} />
      <Text variant="muted">
        {asExotic
          ? 'O post aparece em Principais e notifica todos os usuários.'
          : `O post aparece no filtro do seu nicho${access?.partner?.company_name ? `, como ${access.partner.company_name}` : ''}. Promoções são cadastradas separadamente.`}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Escolher imagem do post" onPress={pickPhoto}
        style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
        {preview ? (
          <Image source={{ uri: preview }} style={{ width: '100%', aspectRatio: 16 / 9 }} contentFit="cover" />
        ) : (
          <View style={{ aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
            <Text variant="muted">Imagem (opcional)</Text>
          </View>
        )}
        <View style={{ padding: space.sm, alignItems: 'center' }}>
          <Text variant="label">{preview ? 'Trocar imagem' : 'Escolher imagem'}</Text>
        </View>
      </Pressable>
      <Field label="Título" value={title} onChangeText={setTitle} error={errors['title']} maxLength={200} />
      <Field label="Texto" value={body} onChangeText={setBody} error={errors['body']} multiline maxLength={5000}
        style={{ minHeight: 160, paddingTop: 12, textAlignVertical: 'top' }} />
      <Button title={article ? 'Salvar' : 'Publicar'} loading={busy} onPress={save} />
    </Screen>
  );
}
