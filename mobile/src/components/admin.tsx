import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { instagramUrl, whatsappUrl } from '@/lib/applications';
import { supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

// Pieces shared by the admin detail screens.

export function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={{ gap: 2 }}>
      <Text variant="label">{label}</Text>
      <Text>{value}</Text>
    </View>
  );
}

export function Contact({ phone, instagram }: { phone: string; instagram?: string | null }) {
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      <Button title="WhatsApp" variant="outline" style={{ flex: 1 }} onPress={() => Linking.openURL(whatsappUrl(phone))} />
      {!!instagram && (
        <Button title="Instagram" variant="outline" style={{ flex: 1 }} onPress={() => Linking.openURL(instagramUrl(instagram))} />
      )}
    </View>
  );
}

// Runs an admin RPC, shows the server's message on failure and refreshes the
// admin lists plus any other screens it affects.
export function useAdminAction(...keys: unknown[][]) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  async function run(name: string, fn: string, args: Record<string, unknown>, done?: string) {
    setBusy(name);
    const { error } = await supabase.rpc(fn, args);
    setBusy(null);
    if (error) {
      Alert.alert('Não foi possível concluir', error.message);
      return false;
    }
    await Promise.all([['admin'], ...keys].map((queryKey) => qc.invalidateQueries({ queryKey })));
    if (done) Alert.alert(done);
    return true;
  }
  return { busy, run };
}

// iOS text prompt for the reason sent with a rejection or removal.
export function askReason(title: string, onSubmit: (reason: string) => void,
  { action = 'Reprovar', required = false }: { action?: string; required?: boolean } = {}) {
  Alert.prompt(title, required ? 'Motivo. A pessoa verá esta mensagem.' : 'Motivo (opcional). A pessoa verá esta mensagem.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: action,
      style: 'destructive',
      onPress: (text?: string) => {
        if (required && !text?.trim()) return void Alert.alert('Informe o motivo.');
        onSubmit(text?.trim() ?? '');
      },
    },
  ]);
}
