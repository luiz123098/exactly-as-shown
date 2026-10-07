import { MapContainer, TileLayer, CircleMarker, Marker, Popup } from "react-leaflet";
import L from "leaflet";

export type MapSponsor = { id: string; name: string; category: string; address: string; lat: number | null; lng: number | null };

// Pin colors follow the brand palette (leaflet needs literal colors).
const BRAND = "#075E3B";
const BRAND_DEEP = "#03452B";

function pin(active: boolean) {
  const size = active ? 40 : 30;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="${active ? "#0A0A0A" : BRAND}" stroke="#fff" stroke-width="1.6"/><circle cx="12" cy="10" r="2.6" fill="#fff"/></svg>`,
  });
}

export default function SponsorMap({
  sponsors,
  height = 520,
  onSelect,
  selected,
  center,
  interactive = true,
}: {
  sponsors: MapSponsor[];
  height?: number | string;
  onSelect?: (id: string) => void;
  selected?: string | null;
  center?: { lat: number; lng: number };
  interactive?: boolean;
}) {
  const pts = sponsors.filter((s) => s.lat != null && s.lng != null);
  return (
    <MapContainer
      center={center ? [center.lat, center.lng] : [-16.69, -49.26]}
      zoom={12}
      style={{ height, width: "100%" }}
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={interactive}
      attributionControl={interactive}
    >
      <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {center && (
        <CircleMarker center={[center.lat, center.lng]} radius={7} pathOptions={{ color: "#fff", fillColor: BRAND_DEEP, fillOpacity: 1, weight: 3 }} />
      )}
      {pts.map((s) =>
        onSelect ? (
          <Marker key={s.id} position={[s.lat!, s.lng!]} icon={pin(selected === s.id)} eventHandlers={{ click: () => onSelect(s.id) }} />
        ) : (
          <Marker key={s.id} position={[s.lat!, s.lng!]} icon={pin(false)}>
            {interactive && (
              <Popup>
                <strong>{s.name}</strong>
                <br />
                {s.category}
              </Popup>
            )}
          </Marker>
        ),
      )}
    </MapContainer>
  );
}
