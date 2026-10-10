import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { AppleMaps } from 'expo-maps';
import { Linking, Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { mapsUrl } from '@/lib/partners';
import { colors, radius, space } from '@/lib/theme';

// Small map at the end of a partner page. Tapping it opens Google Maps.
// Saved coordinates are used when present; otherwise the address is geocoded on the device.
export function PartnerMap({ name, address, city, lat, lng }: {
  name: string; address: string; city: string | null; lat: number | null; lng: number | null;
}) {
  const full = [address, city].filter(Boolean).join(', ');
  const q = useQuery({
    queryKey: ['geocode', full],
    enabled: lat == null || lng == null,
    staleTime: Infinity,
    queryFn: async () => {
      const [hit] = await Location.geocodeAsync(full);
      return hit ? { latitude: hit.latitude, longitude: hit.longitude } : null;
    },
  });
  const coords = lat != null && lng != null ? { latitude: lat, longitude: lng } : q.data;
  const open = () => Linking.openURL(mapsUrl(address, city));

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${name} no Google Maps`} onPress={open}
      style={{ borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
      {coords ? (
        // The map is only a picture here: touches go to the Pressable, which opens Google Maps.
        <View pointerEvents="none" style={{ height: 180 }}>
          <AppleMaps.View style={{ flex: 1 }} cameraPosition={{ coordinates: coords, zoom: 15 }}
            markers={[{ id: 'partner', coordinates: coords, title: name, tintColor: colors.highlight }]} />
        </View>
      ) : (
        <View style={{ height: 120, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary }}>
          <Text variant="muted">{q.isLoading ? 'Carregando mapa…' : 'Mapa indisponível para este endereço'}</Text>
        </View>
      )}
      <View style={{ padding: space.md, gap: 2 }}>
        <Text>{full}</Text>
        <Text variant="label" style={{ color: colors.highlightDeep }}>Abrir no Google Maps</Text>
      </View>
    </Pressable>
  );
}
