import { lazy, Suspense, useEffect, useState } from "react";
import { track } from "@/lib/club";
import { useAuth } from "@/lib/auth";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Globe, Heart, Navigation, Ticket, X, Instagram, MapPin, MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BenefitCard, PromoCard, type Benefit, type Promotion } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { directionsUrl } from "@/lib/geo";
import { useFavorites } from "@/lib/use-member";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/app/parceiros/$id")({
  head: () => ({ meta: [{"title": "Detalhes do parceiro — Exotic Experience"}, {"name": "description", "content": "Confira fotos, benefícios e promoções deste parceiro do clube."}, {"property": "og:title", "content": "Detalhes do parceiro — Exotic Experience"}, {"property": "og:description", "content": "Confira fotos, benefícios e promoções deste parceiro do clube."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: SponsorPage });

function SponsorPage() {
  const { id } = Route.useParams();
  const { data: s } = useQuery({
    queryKey: ["sponsor", id],
    queryFn: async () => (await supabase.from("sponsors").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: benefits = [] } = useQuery({
    queryKey: ["sponsor-benefits", id],
    queryFn: async () => ((await supabase.from("benefits").select("*, sponsor:sponsors(id,name,city,category,cover_url)").eq("sponsor_id", id).eq("active", true)).data ?? []) as unknown as Benefit[],
  });
  const { data: promos = [] } = useQuery({
    queryKey: ["sponsor-promos", id],
    queryFn: async () => ((await supabase.from("promotions").select("*, sponsor:sponsors(id,name,city,category,cover_url)").eq("sponsor_id", id).eq("status", "approved")).data ?? []) as unknown as Promotion[],
  });
  const fav = useFavorites();
  const { user } = useAuth();
  useEffect(() => { track(id, user?.id, "view"); }, [id, user?.id]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  if (!s) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-3xl bg-ink text-ink-foreground">
        {s.cover_url && <img src={s.cover_url} alt={s.name} className="absolute inset-0 h-full w-full object-cover opacity-60" />}
        <div className="hero-overlay absolute inset-0" />
        <div className="relative p-8 pt-40 md:p-12 md:pt-56">
          <p className="eyebrow text-highlight">{s.category}</p>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">{s.name}</h1>
          <p className="mt-3 max-w-2xl text-ink-foreground/75">{s.description}</p>
        </div>
      </div>
      {(() => {
        const saved = fav.isSaved("sponsor", s.id);
        return (
          <div className="grid grid-cols-3 gap-2">
            <Button disabled={!benefits.length} onClick={() => document.getElementById("beneficios")?.scrollIntoView({ behavior: "smooth" })}>
              <Ticket /> Usar benefício
            </Button>
            <Button asChild variant="outline">
              <a href={directionsUrl(s.lat, s.lng, `${s.address}, ${s.city}`)} target="_blank" rel="noreferrer" onClick={() => track(s.id, user?.id, "directions")}><Navigation /> Como chegar</a>
            </Button>
            <Button variant="outline" onClick={() => fav.toggleSaved("sponsor", s.id)}>
              <Heart className={saved ? "fill-primary text-primary" : ""} /> {saved ? "Favorito" : "Favoritar"}
            </Button>
          </div>
        );
      })()}
      {(() => {
        const photos = [...new Set([...(s.gallery ?? []), s.cover_url, ...promos.map((p) => p.image_url)].filter(Boolean) as string[])];
        if (!photos.length) return null;
        return (
          <div>
            <h2 className="mb-4 font-display text-3xl">Fotos</h2>
            <div className="no-scrollbar -mx-5 flex snap-x gap-3 overflow-x-auto px-5 md:mx-0 md:px-0">
              {photos.map((u) => (
                <button key={u} onClick={() => setPhoto(u)} className="h-40 w-60 shrink-0 snap-start overflow-hidden rounded-2xl">
                  <img src={u} alt={s.name} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
                </button>
              ))}
            </div>
          </div>
        );
      })()}
      {photo && (
        <div className="fixed inset-0 z-[1000] grid place-items-center bg-ink/90 p-4" onClick={() => setPhoto(null)}>
          <button aria-label="Fechar" className="absolute right-4 top-4 text-ink-foreground"><X /></button>
          <img src={photo} alt={s.name} className="max-h-full max-w-full rounded-2xl" />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          <div id="beneficios" className="scroll-mt-6">
            <h2 className="mb-4 font-display text-3xl">Benefícios</h2>
            <div className="grid gap-5 sm:grid-cols-2">{benefits.map((b) => <BenefitCard key={b.id} b={b} />)}</div>
          </div>
          {promos.length > 0 && (
            <div>
              <h2 className="mb-4 font-display text-3xl">Promoções</h2>
              <div className="grid gap-5 sm:grid-cols-2">{promos.map((p) => <PromoCard key={p.id} p={p} />)}</div>
            </div>
          )}
        </div>
        <aside className="surface h-fit space-y-4 p-6 text-sm">
          <Info icon={MapPin} text={`${s.address}, ${s.city}`} />
          {s.hours && <Info icon={Clock} text={s.hours} />}
          {s.phone && <Info icon={Phone} text={s.phone} />}
          {s.instagram && <Info icon={Instagram} text={s.instagram} />}
          {s.website && <Info icon={Globe} text={s.website} />}
          {s.whatsapp && (
            <Button asChild className="w-full">
              <a href={`https://wa.me/55${encodeURIComponent(s.whatsapp)}`}><MessageCircle /> WhatsApp</a>
            </Button>
          )}
          {s.lat != null && s.lng != null ? (
            showMap ? (
              <div className="overflow-hidden rounded-xl border">
                <ClientOnly fallback={<div className="h-[260px] bg-secondary" />}>
                  <Suspense fallback={<div className="h-[260px] bg-secondary" />}>
                    <SponsorMap sponsors={[s]} height={260} center={{ lat: s.lat, lng: s.lng }} />
                  </Suspense>
                </ClientOnly>
              </div>
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setShowMap(true)}><MapPin /> Ver localização</Button>
            )
          ) : (
            <p className="text-xs text-muted-foreground">Localização ainda não informada pelo parceiro.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return <p className="flex items-start gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{text}</p>;
}
