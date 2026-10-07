import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Navigation, X } from "lucide-react";
import { directionsUrl, distanceKm, fmtKm, useUserLocation, validity } from "@/lib/geo";
import { fetchBenefits, fetchPromotions, fetchSponsors } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { CategoryChips, HeartButton, SponsorAvatar, SponsorRow } from "@/components/cards";
import { Button } from "@/components/ui/button";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/app/mapa")({ component: MapPage });

function MapPage() {
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const { data: sponsors = [] } = useQuery({ queryKey: ["sponsors"], queryFn: fetchSponsors });
  const { data: benefits = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: promos = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  const list = useMemo(
    () => sponsors.filter((s) => !cat || s.category === cat).map((s) => ({ ...s, d: distanceKm(loc, s.lat, s.lng) })).sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9)),
    [sponsors, cat, loc],
  );
  const s = list.find((x) => x.id === sel) ?? sponsors.find((x) => x.id === sel);
  const sBenefit = s && benefits.find((b) => b.sponsor?.id === s.id);
  const sPromo = s && promos.find((p) => p.sponsor?.id === s.id);
  const sDist = s ? distanceKm(loc, s.lat, s.lng) : null;

  return (
    <div className="-mx-5 -my-6 md:mx-0 md:my-0">
      <div className="px-5 pb-3 pt-1 md:px-0">
        <h1 className="font-display text-4xl md:text-5xl">Mapa</h1>
        <p className="mb-3 text-sm text-muted-foreground">{list.length} parceiros perto de você</p>
        <CategoryChips value={cat} onChange={(c) => { setCat(c); setSel(null); }} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="relative overflow-hidden md:rounded-3xl md:border">
          <ClientOnly fallback={<div className="h-[calc(100dvh-260px)] bg-secondary md:h-[600px]" />}>
            <Suspense fallback={<div className="h-[calc(100dvh-260px)] bg-secondary md:h-[600px]" />}>
              <div className="h-[calc(100dvh-260px)] md:h-[600px]">
                <SponsorMap sponsors={list} height="100%" onSelect={setSel} selected={sel} center={loc} />
              </div>
            </Suspense>
          </ClientOnly>

          {s && (
            <div className="absolute inset-x-3 bottom-3 z-[500] animate-in slide-in-from-bottom-4 fade-in rounded-3xl bg-card p-4 shadow-lift">
              <div className="flex items-start gap-3">
                <SponsorAvatar name={s.name} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.category}{sDist != null ? ` · ${fmtKm(sDist)}` : ""}</p>
                </div>
                <HeartButton on={fav.isSaved("sponsor", s.id)} onClick={() => fav.toggleSaved("sponsor", s.id)} />
                <button onClick={() => setSel(null)} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full hover:bg-secondary"><X className="h-4 w-4" /></button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-muted-foreground">Benefício</p>
                  <p className="mt-0.5 font-bold text-primary">{sBenefit?.discount_label ?? "—"}</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-muted-foreground">Promoção atual</p>
                  <p className="mt-0.5 truncate font-bold">{sPromo ? `${sPromo.discount_label} · ${validity(sPromo.ends_at)}` : "—"}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild><Link to="/app/parceiros/$id" params={{ id: s.id }}>Ver empresa</Link></Button>
                <Button asChild variant="outline">
                  <a href={directionsUrl(s.lat, s.lng, `${s.address}, ${s.city}`)} target="_blank" rel="noreferrer"><Navigation /> Como chegar</a>
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="hidden max-h-[600px] overflow-y-auto lg:block">
          <div className="surface divide-y px-4">
            {list.map((x) => (
              <div key={x.id} onMouseEnter={() => setSel(x.id)}>
                <SponsorRow id={x.id} name={x.name} category={x.category} distance={x.d} benefit={benefits.find((b) => b.sponsor?.id === x.id)?.discount_label} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
