import { useEffect, useState } from "react";

// Centro de Goiânia — usado quando o usuário não libera a localização.
export const DEFAULT_LOC = { lat: -16.6869, lng: -49.2648 };

export function useUserLocation() {
  const [loc, setLoc] = useState(DEFAULT_LOC);
  const [real, setReal] = useState(false);
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLoc({ lat: p.coords.latitude, lng: p.coords.longitude });
        setReal(true);
      },
      () => {},
      { timeout: 8000, maximumAge: 600000 },
    );
  }, []);
  return { loc, real };
}

export function distanceKm(a: { lat: number; lng: number }, lat?: number | null, lng?: number | null) {
  if (lat == null || lng == null) return null;
  const R = 6371;
  const dLat = ((lat - a.lat) * Math.PI) / 180;
  const dLng = ((lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function fmtKm(d: number | null) {
  if (d == null) return "";
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

export function directionsUrl(lat?: number | null, lng?: number | null, address?: string) {
  const dest = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(address ?? "");
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function validity(ends_at: string | null) {
  if (!ends_at) return "Sem prazo";
  const days = Math.ceil((new Date(ends_at + "T23:59:59").getTime() - Date.now()) / 86400000);
  if (days <= 0) return "Termina hoje";
  if (days === 1) return "Termina amanhã";
  if (days <= 3) return "Últimos dias";
  if (days <= 7) return `Até ${new Date(ends_at + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" })}`;
  return `Até ${new Date(ends_at + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}
