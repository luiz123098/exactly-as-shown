import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Switch, View } from 'react-native';

import { CarCard } from '@/components/garage';
import { Button, Card, Empty, ErrorState, Loading, Screen, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useRefetchOnFocus } from '@/lib/use-refetch-on-focus';
import type { Car } from '@/lib/garage';
import { supabase } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

// The subscriber's own garage: visibility switch, cars with their review status.
export default function MyGarage() {
  const { session, profile, kind, refresh } = useAuth();
  const me = session?.user.id;
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['garage', me, 'manage'],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from('cars').select('*').eq('owner_id', me!).order('created_at');
      if (error) throw error;
      return data as Car[];
    },
  });
  const [saving, setSaving] = useState(false);
  useRefetchOnFocus(q.refetch);
  const visible = profile?.garage_visible ?? true;
  const active = kind === 'subscriber';

  async function setVisible(value: boolean) {
    if (!me) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ garage_visible: value }).eq('id', me);
    setSaving(false);
    if (error) return void Alert.alert('Não foi possível salvar', 'Tente novamente.');
    await refresh();
    qc.invalidateQueries({ queryKey: ['garages'] });
  }

  return (
    <Screen>
      {!active && (
        <Card style={{ borderColor: colors.danger }}>
          <Text variant="heading">Garagem oculta</Text>
          <Text variant="muted">Sua anuidade não está ativa. Os carros continuam salvos e voltam a aparecer quando você renovar.</Text>
        </Card>
      )}
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">Garagem visível</Text>
          <Text variant="muted">{visible ? 'Outros usuários podem ver seus carros aprovados.' : 'Só você e os administradores veem seus carros.'}</Text>
        </View>
        <Switch value={visible} onValueChange={setVisible} disabled={saving || !active} trackColor={{ true: colors.highlight }} />
      </Card>
      {!!q.data?.length && (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Stat label="Carros" value={q.data.length} />
          <Stat label="Curtidas" value={q.data.reduce((n, c) => n + c.likes_count, 0)} />
          <Stat label="Em análise" value={q.data.filter((c) => c.photo_status === 'pending').length} />
        </View>
      )}
      {active && <Button title="Adicionar carro" onPress={() => router.push('/garagem/carro/novo')} />}
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState onRetry={() => q.refetch()} /> : q.data?.length ? (
        q.data.map((car) => (
          <Pressable key={car.id} accessibilityRole="button" disabled={!active}
            onPress={() => router.push(`/garagem/carro/${car.id}`)}>
            <CarCard car={car} showStatus footer={
              <Text variant="muted">
                ♥ {car.likes_count} {car.likes_count === 1 ? 'curtida' : 'curtidas'}{active ? ' · Toque para editar' : ''}
              </Text>
            } />
          </Pressable>
        ))
      ) : (
        <Empty title="Sua garagem está vazia" text="Adicione seu primeiro carro. A foto aparece para o clube depois de aprovada." />
      )}
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="title" style={{ fontSize: 26, lineHeight: 30 }}>{value}</Text>
      <Text variant="label">{label}</Text>
    </Card>
  );
}
