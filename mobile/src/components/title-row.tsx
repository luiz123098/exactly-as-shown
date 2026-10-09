import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useUnreadCount } from '@/lib/notifications';
import { colors, radius } from '@/lib/theme';

// Screen title with the notifications bell (unread count badge).
export function TitleRow({ title }: { title: string }) {
  const { session } = useAuth();
  const unread = useUnreadCount(session?.user.id).data ?? 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="title" style={{ flexShrink: 1 }}>{title}</Text>
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
    </View>
  );
}
