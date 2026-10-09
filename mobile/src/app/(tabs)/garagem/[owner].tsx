import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { CarCard, LikeButton } from '@/components/garage';
import { Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { instagramUrl } from '@/lib/applications';
import { useAuth } from '@/lib/auth';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import type { Car } from '@/lib/garage';
import { block, moderationMenu, report } from '@/lib/moderation';
import { avatarUrl } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

type Owner = { id: string; full_name: string; avatar_path: string | null; instagram: string | null };

// A member's garage. The cars policy only returns what this user may see
// (approved photos of a visible garage, everything for its owner or an admin).
export default function GarageDetail() {
  const { owner } = useLocalSearchParams<{ owner: string }>();
  const { session, kind } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const key = ['garage', owner, 'view'];
  const q = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [p, c] = await Promise.all([
        supabase.from('profiles').select('id, full_name, avatar_path, instagram').eq('id', owner).single(),
        supabase.from('cars').select('*').eq('owner_id', owner).order('created_at'),
      ]);
      if (p.error) throw p.error;
      if (c.error) throw c.error;
      const cars = c.data as Car[];
      const liked = new Set<string>();
      if (cars.length) {
        const { data } = await supabase.from('car_likes').select('car_id').eq('user_id', me).in('car_id', cars.map((x) => x.id));
        data?.forEach((l) => liked.add(l.car_id));
      }
      return { owner: p.data as Owner, cars, liked };
    },
  });
  const [pending, setPending] = useState<string | null>(null);
  useRefetchOnFocus(q.refetch);

  async function toggleLike(car: Car, liked: boolean) {
    if (!me) return;
    setPending(car.id);
    const { error } = liked
      ? await supabase.from('car_likes').delete().eq('car_id', car.id).eq('user_id', me)
      : await supabase.from('car_likes').insert({ car_id: car.id, user_id: me });
    setPending(null);
    if (error && error.code !== '23505') return void Alert.alert('Não foi possível curtir', 'Tente novamente.');
    await Promise.all([qc.invalidateQueries({ queryKey: key }), qc.invalidateQueries({ queryKey: ['garages'] })]);
  }

  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const { owner: o, cars, liked } = q.data;
  const mine = o.id === me;
  const avatar = avatarUrl(o.avatar_path);
  const afterBlock = () => {
    qc.invalidateQueries({ queryKey: ['garages'] });
    router.back();
  };

  return (
    <Screen>
      <Stack.Screen options={{
        title: o.full_name,
        headerRight: mine || kind === 'admin' || !me ? undefined : () => (
          <Pressable accessibilityRole="button" accessibilityLabel="Mais opções" hitSlop={10}
            onPress={() => moderationMenu({
              onReport: () => report(me, o.id, null),
              onBlock: () => block(me, o.id, o.full_name, afterBlock),
            })}>
            <Text style={{ fontSize: 22, paddingHorizontal: space.sm }}>⋯</Text>
          </Pressable>
        ),
      }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {avatar && <Image source={{ uri: avatar }} style={{ width: 64, height: 64, borderRadius: 32 }} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{o.full_name}</Text>
          {!!o.instagram && (
            <Pressable accessibilityRole="link" onPress={() => Linking.openURL(instagramUrl(o.instagram!))}>
              <Text style={{ color: colors.highlightDeep }}>@{o.instagram}</Text>
            </Pressable>
          )}
        </View>
      </View>
      {cars.length ? cars.map((car) => (
        <CarCard key={car.id} car={car} showStatus={mine || kind === 'admin'} footer={
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
            {mine ? (
              <Text variant="muted">♥ {car.likes_count} {car.likes_count === 1 ? 'curtida' : 'curtidas'}</Text>
            ) : (
              <LikeButton liked={liked.has(car.id)} count={car.likes_count} disabled={pending === car.id || car.photo_status !== 'approved'}
                onPress={() => toggleLike(car, liked.has(car.id))} />
            )}
            {!mine && kind !== 'admin' && me && (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => report(me, o.id, car.id)}>
                <Text variant="label">Denunciar</Text>
              </Pressable>
            )}
          </View>
        } />
      )) : (
        <Empty title="Nenhum carro para mostrar" text="Esta garagem não tem carros publicados no momento." />
      )}
    </Screen>
  );
}
