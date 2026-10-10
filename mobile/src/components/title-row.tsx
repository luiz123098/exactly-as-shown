import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/lib/notifications';
import { avatarUrl } from '@/lib/profile';
import { colors, radius, space } from '@/lib/theme';

// Screen title with the notifications bell (unread count badge) and the
// profile photo, which opens Perfil.
export function TitleRow({ title }: { title: string }) {
  const { session, profile } = useAuth();
  const unread = useUnreadCount(session?.user.id).data ?? 0;
  const avatar = avatarUrl(profile?.avatar_path);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Text variant="title" style={{ flex: 1 }} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={unread ? `Notificações, ${unread} não lidas` : 'Notificações'}
        hitSlop={10} onPress={() => router.push('/notificacoes')}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 })}>
        <SymbolView name={unread ? 'bell.badge.fill' : 'bell'} size={22} tintColor={colors.text} />
        {unread > 0 && (
          <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 20, height: 20, borderRadius: radius.pill,
            paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 11, lineHeight: 14 }}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        )}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Perfil" hitSlop={10} onPress={() => router.push('/perfil')}
        style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', opacity: pressed ? 0.7 : 1,
          backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' })}>
        {avatar ? <Image source={{ uri: avatar }} style={{ width: 44, height: 44 }} />
          : <SymbolView name="person.crop.circle.fill" size={26} tintColor={colors.textMuted} />}
      </Pressable>
    </View>
  );
}
