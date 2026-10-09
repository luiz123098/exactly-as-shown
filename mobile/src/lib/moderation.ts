import { ActionSheetIOS, Alert } from 'react-native';

import { supabase } from '@/lib/supabase';

// Report and block, required for user-generated content (App Store 1.2).

export function report(reporterId: string, reportedUser: string, carId: string | null, done?: () => void) {
  Alert.prompt('Denunciar', 'Conte o que há de errado. A equipe do Exotic Club vai analisar.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Enviar',
      onPress: async (reason?: string) => {
        if (!reason || reason.trim().length < 3) return void Alert.alert('Descreva o motivo da denúncia.');
        const { error } = await supabase.from('content_reports')
          .insert({ reporter_id: reporterId, reported_user: reportedUser, car_id: carId, reason: reason.trim() });
        if (error) return void Alert.alert('Não foi possível enviar', 'Verifique sua conexão e tente novamente.');
        Alert.alert('Denúncia enviada', 'Obrigado. Vamos analisar em breve.');
        done?.();
      },
    },
  ], 'plain-text');
}

export function block(blockerId: string, blockedId: string, name: string, done?: () => void) {
  Alert.alert(`Bloquear ${name}?`, 'Vocês deixam de ver a garagem um do outro. Dá para desbloquear em Perfil.', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Bloquear',
      style: 'destructive',
      onPress: async () => {
        const { error } = await supabase.from('user_blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
        if (error && error.code !== '23505') return void Alert.alert('Não foi possível bloquear', 'Tente novamente.');
        done?.();
      },
    },
  ]);
}

export function moderationMenu(options: { onReport: () => void; onBlock?: () => void }) {
  const labels = ['Denunciar', ...(options.onBlock ? ['Bloquear usuário'] : []), 'Cancelar'];
  ActionSheetIOS.showActionSheetWithOptions(
    { options: labels, cancelButtonIndex: labels.length - 1, destructiveButtonIndex: options.onBlock ? 1 : undefined },
    (i) => {
      if (i === 0) options.onReport();
      else if (i === 1 && options.onBlock) options.onBlock();
    },
  );
}
