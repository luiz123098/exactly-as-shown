import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { useAuth, planLabel } from "@/lib/auth";
import { fetchBenefits, fetchFavIds, fetchPromotions, toggleFav } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { BenefitCard, PromoCard } from "@/components/cards";
import { Button } from "@/components/ui/button";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/app/")({ component: Dashboard });

function Dashboard() {
  const { user, profile, subscription, level } = useAuth();
  const qc = useQueryClient();
  const { data: promos = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  const { data: benefits = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: favs = new Set<string>() } = useQuery({ queryKey: ["favs", user!.id], queryFn: () => fetchFavIds(user!.id) });
  const { data: sponsors = [] } = useQuery({
    queryKey: ["map-sponsors"],
    queryFn: async () => (await supabase.from("sponsors").select("id,name,category,address,lat,lng")).data ?? [],
  });
  const first = (profile?.full_name || "").split(" ")[0];

  return (
    <div className="space-y-12">
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div>
          <p className="eyebrow text-primary">Área do membro</p>
          <h1 className="mt-1 font-display text-5xl md:text-6xl">Olá{first ? `, ${first}` : ""}.</h1>
          <p className="mt-3 text-muted-foreground">
            {benefits.length} benefícios e {promos.length} promoções ativas esperando por você.
          </p>
        </div>
        <div className="member-card relative overflow-hidden rounded-2xl p-6 shadow-lift">
          <p className="eyebrow opacity-60">Cartão de membro</p>
          <p className="mt-6 font-display text-3xl">{subscription ? planLabel(level) : "Sem plano ativo"}</p>
          <p className="mt-1 text-sm opacity-70">{profile?.full_name || user?.email}</p>
          <div className="mt-6 flex items-end justify-between text-xs opacity-70">
            <span>{subscription ? `Renova em ${new Date(subscription.renews_at).toLocaleDateString("pt-BR")}` : "Assine para desbloquear"}</span>
            <span className="font-mono">#{user!.id.slice(0, 8).toUpperCase()}</span>
          </div>
          {!subscription && (
            <Button asChild size="sm" className="mt-5"><Link to="/app/assinatura">Escolher plano</Link></Button>
          )}
        </div>
      </div>

      <Section title="Promoções em destaque" to="/app/promocoes">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {promos.slice(0, 3).map((p) => <PromoCard key={p.id} p={p} />)}
        </div>
      </Section>

      <Section title="Benefícios para você" to="/app/beneficios">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.slice(0, 6).map((b) => (
            <BenefitCard key={b.id} b={b} favorite={favs.has(b.id)}
              onToggleFav={async () => { await toggleFav(user!.id, b.id, favs.has(b.id)); qc.invalidateQueries({ queryKey: ["favs"] }); }} />
          ))}
        </div>
      </Section>

      <Section title="Parceiros no mapa" to="/app/mapa">
        <div className="overflow-hidden rounded-2xl border">
          <ClientOnly fallback={<div className="h-[360px] bg-secondary" />}>
            <Suspense fallback={<div className="h-[360px] bg-secondary" />}>
              <SponsorMap sponsors={sponsors} height={360} />
            </Suspense>
          </ClientOnly>
        </div>
      </Section>
    </div>
  );
}

function Section({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between">
        <h2 className="font-display text-3xl">{title}</h2>
        <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-primary">Ver tudo <ArrowRight className="h-4 w-4" /></Link>
      </div>
      {children}
    </section>
  );
}
