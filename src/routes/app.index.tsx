import { lazy, Suspense, useMemo } from "react";
import { ClientOnly, createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useAuth, planLabel } from "@/lib/auth";
import { distanceKm, useUserLocation } from "@/lib/geo";
import { fetchBenefits, fetchPromotions, fetchSponsors } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { BenefitCard, CategoryTiles, PromoCard, SectionHeader, SponsorRow } from "@/components/cards";
import { BellLink, UserAvatar, useUnread } from "@/components/app-shell";
import { Button } from "@/components/ui/button";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/app/")({ component: Home });

function Home() {
  const { profile, user, subscription, level } = useAuth();
  const navigate = useNavigate();
  const unread = useUnread();
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const { data: promos = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  const { data: benefits = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: sponsors = [] } = useQuery({ queryKey: ["sponsors"], queryFn: fetchSponsors });
  const first = (profile?.full_name || user?.email || "").split(/[\s@]/)[0];

  const nearby = useMemo(
    () =>
      sponsors
        .map((s) => ({ ...s, d: distanceKm(loc, s.lat, s.lng), benefit: benefits.find((b) => b.sponsor?.id === s.id)?.discount_label }))
        .sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9))
        .slice(0, 4),
    [sponsors, benefits, loc],
  );
  const exclusive = useMemo(
    () => [...benefits].sort((a, b) => b.min_plan_level - a.min_plan_level).slice(0, 4),
    [benefits],
  );

  return (
    <div className="space-y-9">
      {/* Header */}
      <div className="flex items-center gap-3">
        <UserAvatar size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">Olá{first ? `, ${first}` : ""}</p>
          <p className="truncate text-sm text-muted-foreground">Veja o que preparamos para você hoje.</p>
        </div>
        <div className="lg:hidden"><BellLink unread={unread} /></div>
      </div>
      <div className="-mt-5 flex">
        {subscription ? (
          <span className="eyebrow rounded-full bg-accent px-3 py-1.5 text-[0.62rem] text-accent-foreground">● Membro ativo · {planLabel(level)}</span>
        ) : (
          <Link to="/app/assinatura" className="eyebrow rounded-full bg-secondary px-3 py-1.5 text-[0.62rem] text-muted-foreground">Sem assinatura · ativar →</Link>
        )}
      </div>

      {/* Hero card */}
      <div className="member-card relative overflow-hidden rounded-3xl p-6 shadow-lift md:p-10">
        <p className="eyebrow opacity-60">Exotic Experience</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] md:text-6xl">Seu clube.<br />Seus benefícios.</h1>
        <p className="mt-3 max-w-md text-sm opacity-75">Você tem acesso a benefícios exclusivos em {sponsors.length} empresas parceiras.</p>
        <Button asChild className="mt-6"><Link to="/app/beneficios">Explorar benefícios <ArrowRight /></Link></Button>
        <span className="absolute bottom-5 right-6 font-mono text-[0.65rem] opacity-40">#{user!.id.slice(0, 8).toUpperCase()}</span>
      </div>

      {/* Offers */}
      <section>
        <SectionHeader title="🔥 Ofertas para você" to="/app/promocoes" />
        <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">
          {promos.map((p) => (
            <PromoCard key={p.id} p={p} compact distance={distanceKm(loc, p.sponsor?.lat, p.sponsor?.lng)}
              saved={fav.isSaved("promotion", p.id)} onToggleSave={() => fav.toggleSaved("promotion", p.id)} />
          ))}
        </div>
      </section>

      {/* Nearby */}
      <section>
        <SectionHeader title="📍 Perto de você" to="/app/mapa" action="Ver no mapa" />
        <div className="surface divide-y px-4">
          {nearby.map((s) => <SponsorRow key={s.id} id={s.id} name={s.name} category={s.category} distance={s.d} benefit={s.benefit} />)}
        </div>
      </section>

      {/* Categories */}
      <section>
        <SectionHeader title="Categorias" />
        <CategoryTiles onPick={(c) => navigate({ to: "/app/beneficios", search: { cat: c } })} />
      </section>

      {/* Map preview */}
      <section>
        <SectionHeader title="Empresas perto de você" />
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

      {/* Exclusive */}
      <section>
        <SectionHeader title="Exclusivo para membros" to="/app/beneficios" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {exclusive.map((b) => (
            <BenefitCard key={b.id} b={b} favorite={fav.favs.has(b.id)} onToggleFav={() => fav.toggleBenefit(b.id)}
              distance={distanceKm(loc, b.sponsor?.lat, b.sponsor?.lng)} />
          ))}
        </div>
      </section>
    </div>
  );
}
