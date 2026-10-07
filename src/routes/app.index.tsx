import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, MapPin, Star } from "lucide-react";
import { useAuth, planLabel } from "@/lib/auth";
import { distanceKm, fmtKm, useUserLocation } from "@/lib/geo";
import { fetchBenefits, fetchPromotions, fetchSponsors, type SponsorFull } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { BenefitCard, CategoryChips, PromoCard, SectionHeader, SponsorAvatar, SponsorRow } from "@/components/cards";
import { BellLink, UserAvatar, useUnread } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/app/")({ component: Home });

type Partner = SponsorFull & { d: number | null; benefit?: string | undefined; promo?: string | undefined };

function Cover({ s, className = "" }: { s: SponsorFull; className?: string }) {
  return s.cover_url ? (
    <img src={s.cover_url} alt={s.name} loading="lazy" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className={`member-card h-full w-full ${className}`} />
  );
}

function Logo({ s, size = 44 }: { s: SponsorFull; size?: number }) {
  return s.logo_url ? (
    <img src={s.logo_url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-2xl border-2 border-card bg-card object-cover" />
  ) : (
    <span className="rounded-2xl border-2 border-card"><SponsorAvatar name={s.name} size={size} /></span>
  );
}

function FeaturedCard({ s }: { s: Partner }) {
  return (
    <Link to="/app/parceiros/$id" params={{ id: s.id }}
      className="relative block h-64 w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl shadow-lift sm:w-[420px]">
      <Cover s={s} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 text-ink-foreground">
        {s.benefit && <p className="font-display text-4xl leading-none text-highlight">{s.benefit}</p>}
        <p className="mt-2 text-lg font-bold">{s.name}</p>
        <p className="text-xs opacity-75">Exclusivo para membros · {s.category}</p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
          Ver benefício <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="absolute left-4 top-4"><Logo s={s} size={40} /></div>
    </Link>
  );
}

function PartnerCard({ s }: { s: Partner }) {
  return (
    <Link to="/app/parceiros/$id" params={{ id: s.id }} className="surface group block overflow-hidden transition hover:shadow-lift">
      <div className="relative h-32 overflow-hidden"><Cover s={s} className="transition duration-500 group-hover:scale-105" /></div>
      <div className="relative px-4 pb-4">
        <div className="-mt-6"><Logo s={s} size={48} /></div>
        <p className="mt-2 truncate font-bold">{s.name}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {s.category} · {s.d != null ? fmtKm(s.d) : s.city}
        </p>
        {s.benefit && (
          <p className="mt-3 flex items-center gap-1 text-sm font-semibold text-primary">
            <Star className="h-3.5 w-3.5 fill-primary" /> {s.benefit} para membros
          </p>
        )}
        {s.promo && <p className="mt-1 truncate text-xs text-muted-foreground">🔥 {s.promo}</p>}
        <span className="mt-3 block rounded-full border py-2 text-center text-xs font-semibold">Ver parceiro</span>
      </div>
    </Link>
  );
}

function Home() {
  const { profile, user, subscription, level } = useAuth();
  const unread = useUnread();
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const [cat, setCat] = useState("");
  const { data: promos = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  const { data: benefits = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: sponsors = [] } = useQuery({ queryKey: ["sponsors"], queryFn: fetchSponsors });
  const first = (profile?.full_name || user?.email || "").split(/[\s@]/)[0];

  const partners: Partner[] = useMemo(
    () =>
      sponsors.map((s) => ({
        ...s,
        d: distanceKm(loc, s.lat, s.lng),
        benefit: benefits.find((b) => b.sponsor?.id === s.id)?.discount_label,
        promo: promos.find((p) => p.sponsor?.id === s.id)?.title,
      })),
    [sponsors, benefits, promos, loc],
  );
  const featured = useMemo(() => {
    const f = partners.filter((p) => p.featured);
    return (f.length ? f : partners).slice(0, 6);
  }, [partners]);
  const filtered = cat ? partners.filter((p) => p.category === cat) : partners;
  const nearby = useMemo(() => [...partners].sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9)).slice(0, 4), [partners]);
  const exclusive = useMemo(() => [...benefits].sort((a, b) => b.min_plan_level - a.min_plan_level).slice(0, 4), [benefits]);

  return (
    <div className="space-y-9">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserAvatar size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">Olá{first ? `, ${first}` : ""}</p>
          <p className="text-sm text-muted-foreground">Confira os benefícios exclusivos dos nossos parceiros.</p>
        </div>
        <div className="lg:hidden"><BellLink unread={unread} /></div>
      </div>

      {/* Featured partners */}
      <section>
        <SectionHeader title="Parceiros em destaque" />
        <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          {featured.map((s) => <FeaturedCard key={s.id} s={s} />)}
        </div>
      </section>

      {/* All partners + categories */}
      <section>
        <SectionHeader title={`Nossos parceiros (${filtered.length})`} to="/app/beneficios" />
        <div className="-mx-5 mb-4 px-5 md:mx-0 md:px-0"><CategoryChips value={cat} onChange={setCat} /></div>
        {filtered.length ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((s) => <PartnerCard key={s.id} s={s} />)}
          </div>
        ) : (
          <p className="surface p-6 text-center text-sm text-muted-foreground">Nenhum parceiro nesta categoria ainda.</p>
        )}
      </section>

      {/* Promotions */}
      <section>
        <SectionHeader title="🔥 Promoções exclusivas" to="/app/promocoes" />
        <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          {promos.map((p) => (
            <PromoCard key={p.id} p={p} compact distance={distanceKm(loc, p.sponsor?.lat, p.sponsor?.lng)}
              saved={fav.isSaved("promotion", p.id)} onToggleSave={() => fav.toggleSaved("promotion", p.id)} />
          ))}
        </div>
      </section>

      {/* Nearby */}
      <section>
        <SectionHeader title="📍 Parceiros perto de você" to="/app/mapa" action="Ver todos no mapa" />
        <div className="surface divide-y px-4">
          {nearby.map((s) => <SponsorRow key={s.id} id={s.id} name={s.name} category={s.category} distance={s.d} benefit={s.benefit} />)}
        </div>
      </section>

      {/* Exclusive benefits */}
      <section>
        <SectionHeader title="Benefícios exclusivos" to="/app/beneficios" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {exclusive.map((b) => (
            <BenefitCard key={b.id} b={b} favorite={fav.favs.has(b.id)} onToggleFav={() => fav.toggleBenefit(b.id)}
              distance={distanceKm(loc, b.sponsor?.lat, b.sponsor?.lng)} />
          ))}
        </div>
      </section>

      {/* Map */}
      <section>
        <SectionHeader title="Mapa dos parceiros" />
        <div className="relative overflow-hidden rounded-3xl border">
          <ClientOnly fallback={<div className="h-[220px] bg-secondary" />}>
            <Suspense fallback={<div className="h-[220px] bg-secondary" />}>
              <SponsorMap sponsors={sponsors} height={220} center={loc} interactive={false} />
            </Suspense>
          </ClientOnly>
          <div className="absolute inset-x-3 bottom-3 z-[500]">
            <Button asChild variant="ink" className="w-full"><Link to="/app/mapa">Ver mapa completo</Link></Button>
          </div>
        </div>
      </section>

      {/* Subscription (secondary) */}
      <section className="surface flex items-center justify-between gap-3 p-4">
        <div>
          <p className="eyebrow text-[0.6rem] text-muted-foreground">Sua assinatura</p>
          <p className="font-semibold">{subscription ? `Membro ativo · ${planLabel(level)}` : "Sem assinatura ativa"}</p>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/app/assinatura">{subscription ? "Detalhes" : "Ativar"}</Link></Button>
      </section>
    </div>
  );
}
