import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { colors, space } from '@/lib/theme';

// Entry screen before login: the three paths of the spec.
export default function Welcome() {
  return (
    <Screen scroll={false} style={styles.root}>
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: space.sm }}>
        <Text variant="eyebrow">Exotic Experience · Exotic Motors</Text>
        <Text style={styles.brand}>EXOTIC{'\n'}CLUB</Text>
        <Text style={{ color: colors.inkText, opacity: 0.7 }}>
          O clube fechado de quem vive carros, negócios e experiências de alto padrão.
        </Text>
      </View>
      <View style={{ gap: space.sm, paddingBottom: space.lg }}>
        <Button title="Entrar" onPress={() => router.push('/login')} />
        <Button title="Torne-se membro" variant="outline" onPress={() => router.push({ pathname: '/login', params: { intent: 'member' } })} />
        <Button title="Torne-se parceiro" variant="ghost" style={{ borderWidth: 1, borderColor: colors.inkMuted }}
          onPress={() => router.push({ pathname: '/login', params: { intent: 'partner' } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.ink, flex: 1 },
  brand: { fontFamily: 'Manrope_800ExtraBold', fontSize: 56, lineHeight: 56, color: colors.inkText },
});
