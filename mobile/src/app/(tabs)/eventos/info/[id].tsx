import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, View } from 'react-native';

import { Button, Card, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { eventEndsAt, formatEventDate, type EventDetails } from '@/lib/events';
import { mapsUrl } from '@/lib/partners';
import { avatarUrl } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

type Rsvp = { full_name: string; avatar_path: string | null; created_at: string };

// Event information for subscribers, approved partners and admins (the server
// returns nothing to anyone else): date, place, programme, rules and "Vou".
export default function EventInfo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, kind } = useAuth();
  const me = session?.user.id;
  const admin = kind === 'admin';
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const q = useQuery({
    queryKey: ['events', 'info', id],
    queryFn: async () => {
      const [d, ev, mine, list] = await Promise.all([
        supabase.from('event_details').select('*').eq('event_id', id).maybeSingle(),
        supabase.from('events').select('title').eq('id', id).maybeSingle(),
        supabase.from('event_rsvps').select('event_id').eq('event_id', id).eq('user_id', me!).maybeSingle(),
        admin ? supabase.rpc('admin_event_rsvps', { _event: id }) : Promise.resolve({ data: null, error: null }),
      ]);
      if (d.error) throw d.error;
      if (list.error) throw list.error;
      return { details: d.data as EventDetails | null, title: (ev.data?.title as string | undefined) ?? 'Evento Exotic Experience', going: !!mine.data, rsvps: (list.data ?? []) as Rsvp[] };
    },
  });

  async function toggleRsvp(going: boolean) {
    if (!me) return;
    setBusy(true);
    const { error } = going
      ? await supabase.from('event_rsvps').delete().eq('event_id', id).eq('user_id', me)
      : await supabase.from('event_rsvps').insert({ event_id: id, user_id: me });
    setBusy(false);
    if (error && error.code !== '23505') return void Alert.alert('Não foi possível confirmar', 'Tente novamente.');
    await Promise.all([q.refetch(), qc.invalidateQueries({ queryKey: ['events', 'list'] })]);
  }

  // Opens the system "New Event" screen already filled in; the person confirms there.
  async function addToCalendar(d: EventDetails, title: string) {
    try {
      await createEventInCalendarAsync({
        title,
        startDate: new Date(d.starts_at),
        endDate: eventEndsAt(d),
        location: [d.venue, d.address, d.city].filter(Boolean).join(', ') || undefined,
        notes: [d.program, d.rules].filter(Boolean).join('\n\n') || undefined,
      });
    } catch {
      Alert.alert('Não foi possível abrir o calendário', 'Verifique a permissão de Calendários em Ajustes.');
    }
  }

  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorState onRetry={() => q.refetch()} />;
  const d = q.data?.details;
  if (!d) return <ErrorState text="As informações deste evento são exclusivas para membros assinantes e parceiros." />;
  const past = eventEndsAt(d).getTime() < now;
  const going = q.data!.going;

  return (
    <Screen>
      <Card>
        <Text variant="label">Quando</Text>
        <Text variant="heading">{formatEventDate(d.starts_at, d.ends_at)}</Text>
        {!past && <Button title="Adicionar ao calendário" variant="outline" onPress={() => addToCalendar(d, q.data!.title)} />}
      </Card>
      {(d.venue || d.address) && (
        <Card>
          <Text variant="label">Onde</Text>
          {!!d.venue && <Text variant="heading">{d.venue}</Text>}
          {!!d.address && <Text>{[d.address, d.city].filter(Boolean).join(' · ')}</Text>}
          {!!d.address && <Button title="Como chegar" variant="outline" onPress={() => Linking.openURL(mapsUrl(d.address!, d.city))} />}
        </Card>
      )}
      {!past && (
        <Card style={going ? { borderColor: colors.success } : undefined}>
          <Text variant="heading">{going ? 'Presença confirmada ✓' : 'Você vai?'}</Text>
          <Text variant="muted">{going ? 'Nos vemos lá! Se mudar de ideia, é só cancelar.' : 'Confirme para a equipe se organizar.'}</Text>
          <Button title={going ? 'Cancelar presença' : 'Vou'} variant={going ? 'outline' : 'primary'} loading={busy}
            onPress={() => toggleRsvp(going)} />
        </Card>
      )}
      {!!d.program && (
        <Card>
          <Text variant="label">Programação</Text>
          <Text>{d.program}</Text>
        </Card>
      )}
      {!!d.rules && (
        <Card>
          <Text variant="label">Regras</Text>
          <Text>{d.rules}</Text>
        </Card>
      )}
      {admin && (
        <Card>
          <Text variant="label">Confirmados ({q.data!.rsvps.length})</Text>
          {q.data!.rsvps.length ? q.data!.rsvps.map((r, i) => {
            const uri = avatarUrl(r.avatar_path);
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                {uri && <Image source={{ uri }} style={{ width: 28, height: 28, borderRadius: 14 }} />}
                <Text style={{ flex: 1 }}>{r.full_name}</Text>
              </View>
            );
          }) : <Text variant="muted">Ninguém confirmou ainda.</Text>}
        </Card>
      )}
    </Screen>
  );
}
