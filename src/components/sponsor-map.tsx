import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

export type MapSponsor = { id: string; name: string; category: string; address: string; lat: number | null; lng: number | null };

export default function SponsorMap({
  sponsors,
  height = 520,
  onSelect,
}: {
  sponsors: MapSponsor[];
  height?: number;
  onSelect?: (id: string) => void;
}) {
  const pts = sponsors.filter((s) => s.lat != null && s.lng != null);
  return (
    <MapContainer center={[-16.69, -49.26]} zoom={12} style={{ height, width: "100%" }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {pts.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat!, s.lng!]}
          radius={9}
          pathOptions={{ color: "#03452B", fillColor: "#075E3B", fillOpacity: 0.9, weight: 3 }}
          eventHandlers={{ click: () => onSelect?.(s.id) }}
        >
          <Popup>
            <strong>{s.name}</strong>
            <br />
            {s.category}
            <br />
            <small>{s.address}</small>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
