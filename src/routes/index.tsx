import { useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bell, Check, Map, ShieldCheck } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { brl, homePath, useAuth, type Plan } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PublicFooter, PublicHeader } from "@/components/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Exotic Experience — O clube de benefícios mais exclusivo de Goiás" },
      { name: "description", content: "Torne-se membro e acesse benefícios e promoções exclusivas em restaurantes, academias, viagens e muito mais em Goiás." },
      { property: "og:title", content: "Exotic Experience — Clube de membros" },
      { property: "og:description", content: "Benefícios premium de parceiros selecionados em Goiás, para quem é membro." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user, roles, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && user) navigate({ to: homePath(roles), replace: true });
  }, [user, roles, loading, navigate]);
  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("level")).data as Plan[],
  });
  const { data: sponsors = [] } = useQuery({
    queryKey: ["landing-sponsors"],
    queryFn: async () =>
      (await supabase.from("sponsors").select("id,name,category,city,cover_url").eq("featured", true).limit(4)).data ?? [],
  });

  return (
    <div>
      <section className="relative min-h-[92vh] overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="Lounge exclusivo para membros" width={1600} height={1008} className="absolute inset-0 h-full w-full object-cover" />
        <div className="hero-overlay absolute inset-0" />
        <PublicHeader light />
        <div className="relative z-10 mx-auto flex min-h-[92vh] max-w-7xl flex-col justify-end px-6 pb-20">
          <p className="eyebrow text-highlight">Clube de membros · Goiás</p>
          <h1 className="mt-5 max-w-4xl font-display text-6xl leading-[0.95] md:text-8xl">
            Exotic<br /><span className="text-highlight">Experience</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-foreground/70">
            Benefícios exclusivos nos melhores restaurantes, academias, spas e destinos de Goiás — reunidos em um só cartão de membro.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>Quero ser membro <ArrowRight /></Link>
            </Button>
            <Button asChild size="lg" variant="glass">
              <Link to="/auth" search={{ mode: "signup", type: "sponsor" }}>Quero ser parceiro</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-3">
          {[
            { i: ShieldCheck, t: "Parceiros curados", d: "Cada empresa é aprovada pela curadoria do clube antes de aparecer para os membros." },
            { i: Bell, t: "Avisos na hora certa", d: "Receba notificações quando uma nova promoção for lançada pelos parceiros." },
            { i: Map, t: "Tudo no mapa", d: "Encontre os parceiros mais próximos de você em Goiânia e no interior." },
          ].map((f) => (
            <div key={f.t}>
              <f.i className="h-6 w-6 text-primary" />
              <h3 className="mt-5 text-lg font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {sponsors.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 pb-24">
          <div className="mb-10 flex items-end justify-between">
            <h2 className="font-display text-4xl md:text-5xl">Parceiros em destaque</h2>
            <Link to="/parceiros" className="text-sm font-semibold text-primary">Ver todos →</Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {sponsors.map((s) => (
              <div key={s.id} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-ink">
                {s.cover_url && <img src={s.cover_url} alt={s.name} loading="lazy" className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105" />}
                <div className="hero-overlay absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-ink-foreground">
                  <p className="eyebrow opacity-70">{s.category}</p>
                  <p className="mt-1 text-lg font-semibold">{s.name}</p>
                  <p className="text-xs opacity-60">{s.city}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="bg-secondary py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="eyebrow text-center text-primary">Assinatura</p>
          <h2 className="mt-2 text-center font-display text-5xl">Escolha seu nível</h2>
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            {plans.map((p) => <PlanCard key={p.id} plan={p} />)}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="member-card flex flex-col items-start justify-between gap-8 rounded-3xl p-10 md:flex-row md:items-center md:p-16">
          <div>
            <h2 className="font-display text-4xl md:text-5xl">Sua empresa no clube.</h2>
            <p className="mt-3 max-w-lg text-ink-foreground/70">Alcance uma comunidade de membros qualificados. Cadastre benefícios e promoções e acompanhe resultados no seu painel.</p>
          </div>
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup", type: "sponsor" }}>Cadastrar empresa</Link>
          </Button>
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}

export function PlanCard({ plan, action }: { plan: Plan; action?: React.ReactNode }) {
  const dark = plan.highlighted;
  return (
    <div className={`flex flex-col rounded-3xl p-8 ${dark ? "member-card shadow-lift" : "surface"}`}>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{plan.name}</p>
        {dark && <span className="rounded-full bg-highlight px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-primary-foreground">Mais escolhido</span>}
      </div>
      <p className="mt-6 font-display text-6xl">{brl(Number(plan.price))}<span className="font-sans text-sm opacity-60"> /mês</span></p>
      <p className={`mt-2 text-sm ${dark ? "opacity-70" : "text-muted-foreground"}`}>{plan.description}</p>
      <ul className="mt-8 flex-1 space-y-3 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-3"><Check className={`h-4 w-4 shrink-0 ${dark ? "text-highlight" : "text-primary"}`} />{f}</li>
        ))}
      </ul>
      <div className="mt-8">
        {action ?? (
          <Button asChild className="w-full" variant={dark ? "default" : "ink"}>
            <Link to="/auth" search={{ mode: "signup" }}>Assinar {plan.name}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
