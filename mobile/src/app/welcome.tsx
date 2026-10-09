import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { colors, space } from '@/lib/theme';

// Entry screen before login: the three paths of the spec, over the club's
// lounge photo (same hero as the original site).
export default function Welcome() {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Image source={require('../../assets/images/hero.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="left" />
      {/* Darkens the photo so the text and buttons stay readable. */}
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <SafeAreaView style={styles.content}>
        <View style={{ flex: 1, justifyContent: 'flex-end', gap: space.sm }}>
          <Text variant="eyebrow">Exotic Experience · Exotic Motors</Text>
          <Text style={styles.brand}>EXOTIC{'\n'}CLUB</Text>
          <Text style={{ color: colors.inkText, opacity: 0.85 }}>
            O clube fechado de quem vive carros, negócios e experiências de alto padrão.
          </Text>
        </View>
        <View style={{ gap: space.sm, paddingBottom: space.sm }}>
          <Button title="Entrar" onPress={() => router.push('/login')} />
          <Button title="Torne-se membro" variant="outline" onPress={() => router.push({ pathname: '/login', params: { intent: 'member' } })} />
          <Button title="Torne-se parceiro" variant="inkOutline"
            onPress={() => router.push({ pathname: '/login', params: { intent: 'partner' } })} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  shade: { backgroundColor: colors.ink, opacity: 0.6 },
  content: { flex: 1, padding: space.md, gap: space.md },
  brand: { fontFamily: 'Manrope_800ExtraBold', fontSize: 56, lineHeight: 56, color: colors.inkText },
});
