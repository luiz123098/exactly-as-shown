import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PhotoViewer } from '@/components/photo-viewer';

import { Card, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { carPhotoSource, carTitle, PHOTO_STATUS, type Car, type PhotoStatus } from '@/lib/garage';
import { colors, radius, space } from '@/lib/theme';

// Photo from the private bucket, or a neutral placeholder. With `zoomable`,
// tapping opens it full screen (pinch to zoom).
export function CarPhoto({ path, style, zoomable }: { path: string | null | undefined; style?: object; zoomable?: boolean }) {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const source = carPhotoSource(path, session?.access_token, session?.user.id);
  if (!source) {
    return (
      <View style={[styles.photo, styles.placeholder, style]}>
        <Text variant="muted">Sem foto</Text>
      </View>
    );
  }
  const image = <Image source={source} style={[styles.photo, style]} contentFit="cover" transition={150} />;
  if (!zoomable) return image;
  return (
    <>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel="Abrir foto em tela cheia" onPress={() => setOpen(true)}>
        {image}
      </Pressable>
      <PhotoViewer source={source} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function StatusBadge({ status }: { status: PhotoStatus }) {
  const tone = status === 'approved' ? colors.success : status === 'rejected' ? colors.danger : colors.accentText;
  const bg = status === 'pending' ? colors.accent : colors.secondary;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ fontSize: 12, color: tone }}>{PHOTO_STATUS[status]}</Text>
    </View>
  );
}

export function LikeButton({ liked, count, onPress, disabled }: {
  liked: boolean; count: number; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={liked ? 'Descurtir' : 'Curtir'}
      accessibilityState={{ selected: liked, disabled: !!disabled }} disabled={disabled} onPress={onPress} hitSlop={8}
      style={({ pressed }) => [styles.like, liked && styles.liked, (pressed || disabled) && { opacity: 0.6 }]}>
      <SymbolView name={liked ? 'heart.fill' : 'heart'} size={20} tintColor={liked ? colors.danger : colors.text} />
      <Text style={{ fontSize: 15, color: colors.text }}>{count}</Text>
    </Pressable>
  );
}

// One car: photo, name and owner's notes; extra controls go in `footer`.
export function CarCard({ car, footer, showStatus }: { car: Car; footer?: ReactNode; showStatus?: boolean }) {
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <CarPhoto path={car.photo_path} zoomable />
      <View style={{ padding: space.md, gap: space.xs }}>
        {showStatus && <StatusBadge status={car.photo_status} />}
        <Text variant="heading">{carTitle(car)}</Text>
        {!!car.nickname && <Text style={{ color: colors.highlightDeep }}>“{car.nickname}”</Text>}
        {!!car.color && <Text variant="muted">Cor: {car.color}</Text>}
        {!!car.description && <Text>{car.description}</Text>}
        {showStatus && car.photo_status === 'rejected' && !!car.photo_reject_reason && (
          <Text style={{ color: colors.danger }}>Motivo: {car.photo_reject_reason}</Text>
        )}
        {footer}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.secondary },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  like: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: space.md,
    paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  liked: { borderColor: colors.danger, backgroundColor: '#fdecec' },

});
