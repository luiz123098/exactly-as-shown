import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', 'unread', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase.from('notifications')
        .select('id', { count: 'exact', head: true }).eq('user_id', userId!).is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// One realtime subscription per signed-in user keeps the bell and the list current.
export function useNotificationsLive(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ['notifications'] }))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}

// Server links come from the database; older ones point at screens that were
// folded into Perfil.
// `id` makes each notification's link unique, so opening a second one for the
// same admin section still switches to it.
export function notificationHref(link: string | null, id?: string): string {
  if (!link) return '/notificacoes';
  if (link === '/parceiro' || link === '/status') return '/perfil';
  return id && link.includes('?') ? `${link}&n=${id}` : link;
}

export function timeAgo(iso: string, now = Date.now()) {
  const min = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d} d` : new Date(iso).toLocaleDateString('pt-BR');
}
