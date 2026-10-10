import type { ImageSource } from 'expo-image';
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/lib/theme';

// Full-screen photo on black, pinch to zoom, ✕ to close.
export function PhotoViewer({ source, visible, onClose }: { source: ImageSource; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} maximumZoomScale={4} minimumZoomScale={1}
          centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} bouncesZoom>
          <Image source={source} style={{ flex: 1 }} contentFit="contain" />
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} hitSlop={12}
          style={[styles.close, { top: insets.top + space.sm }]}>
          <SymbolView name="xmark" size={18} tintColor="#fff" weight="semibold" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  close: { position: 'absolute', right: space.md, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
});
