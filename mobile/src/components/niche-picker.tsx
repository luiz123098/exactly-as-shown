import { useQuery } from '@tanstack/react-query';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import type { Niche } from '@/lib/news';
import { supabase } from '@/lib/supabase';
import { colors, radius, space } from '@/lib/theme';

export function useApprovedNiches() {
  return useQuery({
    queryKey: ['niches', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase.from('niches').select('id, name, status').eq('status', 'approved').order('name');
      if (error) throw error;
      return data as Niche[];
    },
  });
}

// The company picks its segment from the list kept by the admins.
export function NichePicker({ value, onChange, error }: {
  value: string | null; onChange: (id: string, name: string) => void; error?: string | undefined;
}) {
  const q = useApprovedNiches();
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="label">Segmento da empresa</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {q.data?.map((n) => {
          const active = value === n.id;
          return (
            <Pressable key={n.id} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => onChange(n.id, n.name)}
              style={{ paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, borderWidth: 1,
                borderColor: active ? colors.ink : colors.border, backgroundColor: active ? colors.ink : colors.card }}>
              <Text style={{ fontSize: 14, color: active ? colors.inkText : colors.text }}>{n.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text variant="muted">Não achou o seu? Escolha o mais próximo; a equipe pode ajustar depois.</Text>
      {!!error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}
    </View>
  );
}
