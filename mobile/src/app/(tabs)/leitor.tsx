import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Keyboard, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Button, Card, Field, Screen, Text } from '@/components/ui';
import { looksLikeCardCode } from '@/lib/card';
import { avatarUrl } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

type ScanResult = {
  valid: boolean;
  full_name?: string;
  avatar_path?: string | null;
  instagram?: string | null;
  expires_at?: string | null;
  reason?: string | null;
};

// Partner side: read the member's QR (or type the code) and see on the spot
// whether the membership is active. Every check is recorded on the server.
export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [focused, setFocused] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [code, setCode] = useState('');
  // The camera reports the same code many times per second; handle one at a time.
  const busy = useRef(false);
  const scroll = useRef<ScrollView>(null);

  // The result is shorter than the form; start it from the top.
  function show(r: ScanResult) {
    Keyboard.dismiss();
    setResult(r);
    scroll.current?.scrollTo({ y: 0, animated: false });
  }

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));

  async function check(raw: string) {
    if (busy.current) return;
    if (!looksLikeCardCode(raw)) {
      show({ valid: false, reason: 'Este QR não é uma carteirinha do Exotic Club.' });
      return;
    }
    busy.current = true;
    setChecking(true);
    const { data, error } = await supabase.rpc('partner_scan_card', { _code: raw });
    setChecking(false);
    show(error ? { valid: false, reason: error.message } : (data as ScanResult));
  }

  function reset() {
    setResult(null);
    setCode('');
    busy.current = false;
  }

  return (
    <Screen statusBarScrim ref={scroll}>
      <Text variant="title">Ler carteirinha</Text>
      {result ? (
        <ResultCard result={result} onNext={reset} />
      ) : (
        <>
          <View style={styles.camera}>
            {!permission ? null : permission.granted ? (
              focused && (
                <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={checking ? undefined : ({ data }) => check(data)} />
              )
            ) : (
              <View style={styles.permission}>
                <Text style={{ color: colors.inkText, textAlign: 'center' }}>
                  Permita o acesso à câmera para ler o QR da carteirinha.
                </Text>
                <Button title={permission.canAskAgain ? 'Permitir câmera' : 'Abrir Ajustes'}
                  onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())} />
              </View>
            )}
          </View>
          <Text variant="muted" style={{ textAlign: 'center' }}>
            {checking ? 'Validando…' : 'Aponte a câmera para o QR na carteirinha do membro.'}
          </Text>
          <Card>
            <Text variant="label">Ou digite o código abaixo do QR</Text>
            <Field label="Código" value={code} onChangeText={setCode} placeholder="ABCD-2345"
              autoCapitalize="characters" autoCorrect={false} maxLength={9} />
            <Button title="Validar" variant="ink" loading={checking} disabled={!code.trim()} onPress={() => check(code)} />
          </Card>
        </>
      )}
    </Screen>
  );
}

function ResultCard({ result, onNext }: { result: ScanResult; onNext: () => void }) {
  const uri = avatarUrl(result.avatar_path);
  const ok = result.valid;
  return (
    <>
      <View style={[styles.banner, { backgroundColor: ok ? colors.success : colors.danger }]}>
        <Text style={styles.bannerText}>{ok ? 'Assinante ativo' : 'Não validado'}</Text>
      </View>
      {result.full_name ? (
        <Card style={{ alignItems: 'center' }}>
          {uri && <Image source={{ uri }} style={styles.avatar} />}
          <Text variant="heading">{result.full_name}</Text>
          {!!result.instagram && <Text variant="muted">@{result.instagram}</Text>}
          {ok && result.expires_at && (
            <Text>Válida até {new Date(result.expires_at).toLocaleDateString('pt-BR')}</Text>
          )}
          {ok && <Text variant="muted" style={{ textAlign: 'center' }}>Confira se a foto é da pessoa à sua frente.</Text>}
        </Card>
      ) : null}
      {!!result.reason && <Text style={{ textAlign: 'center' }}>{result.reason}</Text>}
      <Button title="Ler outra carteirinha" onPress={onNext} />
    </>
  );
}

const styles = StyleSheet.create({
  camera: { height: 320, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.ink },
  permission: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.lg },
  banner: { borderRadius: radius.lg, paddingVertical: space.lg, alignItems: 'center' },
  bannerText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 24, color: '#fff' },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.secondary },
});
