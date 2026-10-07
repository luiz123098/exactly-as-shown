import { useMemo, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, IdCard, MapPin, Star, LayoutGrid } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { distanceKm, fmtKm, useUserLocation } from "@/lib/geo";
import { fetchBenefits, fetchPromotions, fetchSponsors, type SponsorFull } from "@/lib/queries";
import { fetchArticles, fetchEvents, fetchHomeConfig } from "@/lib/club";
import { useFavorites } from "@/lib/use-member";
import { BenefitCard, CATEGORY_ICONS, PromoCard, SectionHeader, SponsorAvatar, SponsorRow } from "@/components/cards";
import { ArticleCard, EventCard } from "@/components/club-cards";
import { BellLink, UserAvatar, useUnread } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/auth";


export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Home do membro — Exotic Experience" }, { name: "description", content: "Parceiros, benefícios, ofertas e experiências exclusivas do clube EXOTIC." }, { property: "og:title", content: "Home do membro — Exotic Experience" }, { property: "og:description", content: "Parceiros, benefícios, ofertas e experiências exclusivas do clube EXOTIC." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Home,
});

type Partner = SponsorFull & { d: number | null; benefit?: string | undefined; promo?: string | undefined };

function Cover({ s, className = "" }: { s: SponsorFull; className?: string }) {
  return s.cover_url ? <img src={s.cover_url} alt={s.name} loading="lazy" className={`h-full w-full object-cover ${className}`} /> : <div className={`member-card h-full w-full ${className}`} />;
}
function SLogo({ s, size = 44 }: { s: SponsorFull; size?: number }) {
  return s.logo_url ? (
    <img src={s.logo_url} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-2xl border-2 border-card bg-card object-cover" />
  ) : <span className="rounded-2xl border-2 border-card"><SponsorAvatar name={s.name} size={size} /></span>;
}

function FeaturedCard({ s }: { s: Partner }) {
  return (
    <Link to="/app/parceiros/$id" params={{ id: s.id }} className="relative block h-64 w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl shadow-lift sm:w-[420px]">
      <Cover s={s} />
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
      <span className="absolute right-4 top-4 rounded-full bg-highlight px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest text-ink">Exclusivo</span>
      <div className="absolute inset-x-0 bottom-0 p-5 text-ink-foreground">
        {s.benefit && <p className="text-4xl font-extrabold leading-none text-highlight">{s.benefit}</p>}
        <p className="mt-2 text-lg font-bold">{s.name}</p>
        <p className="text-xs opacity-75">Condições especiais para membros · {s.category}</p>
        <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-ink-foreground px-4 py-2 text-xs font-bold text-ink">Ver parceiro <ArrowRight className="h-3.5 w-3.5" /></span>
      </div>
      <div className="absolute left-4 top-4"><SLogo s={s} size={40} /></div>
    </Link>
  );
}

function PartnerCard({ s }: { s: Partner }) {
  return (
    <Link to="/app/parceiros/$id" params={{ id: s.id }} className="surface group block overflow-hidden transition hover:shadow-lift">
      <div className="relative h-28 overflow-hidden">
        <Cover s={s} className="transition duration-500 group-hover:scale-105" />
        <span className="absolute right-2 top-2 rounded-full bg-ink px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-highlight">Exclusivo</span>
      </div>
      <div className="relative px-3 pb-3">
        <div className="-mt-6"><SLogo s={s} size={44} /></div>
        <p className="mt-2 truncate font-bold">{s.name}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3" /> {s.category}{s.d != null ? ` · ${fmtKm(s.d)}` : ""}</p>
        {s.benefit && <p className="mt-2 flex items-center gap-1 text-sm font-extrabold text-primary"><Star className="h-3.5 w-3.5 fill-highlight text-highlight" /> {s.benefit}</p>}
      </div>
    </Link>
  );
}

function Rail({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:px-0">{children}</div>;
}

function Home() {
  const { profile, user, subscription } = useAuth();
  const unread = useUnread();
  const navigate = useNavigate();
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const { data: cfg } = useQuery({ queryKey: ["home-config"], queryFn: fetchHomeConfig });
  const { data: promos = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  const { data: benefits = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: sponsors = [] } = useQuery({ queryKey: ["sponsors"], queryFn: fetchSponsors });
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const { data: articles = [] } = useQuery({ queryKey: ["articles"], queryFn: fetchArticles });
  const first = (profile?.full_name || user?.email || "").split(/[\s@]/)[0];
  const interests = profile?.interests ?? [];
  const boost = (c: string) => (interests.includes(c) ? 0 : 1);

  const partners: Partner[] = useMemo(
    () => sponsors.map((s) => ({
      ...s, d: distanceKm(loc, s.lat, s.lng),
      benefit: benefits.find((b) => b.sponsor?.id === s.id)?.discount_label,
      promo: promos.find((p) => p.sponsor?.id === s.id)?.title,
    })).sort((a, b) => boost(a.category) - boost(b.category)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sponsors, benefits, promos, loc, interests.join()],
  );
  const featured = useMemo(() => { const f = partners.filter((p) => p.featured); return (f.length ? f : partners).slice(0, 6); }, [partners]);
  const nearby = useMemo(() => [...partners].sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9)).slice(0, 4), [partners]);
  const topBenefits = useMemo(() => [...benefits].sort((a, b) => boost(a.category) - boost(b.category)).slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [benefits, interests.join()]);
  const upcoming = events.filter((e) => e.status !== "finished" && new Date(e.starts_at) > new Date());
  const sections = cfg?.sections ?? ["featured", "benefits", "promotions", "categories", "nearby", "events", "content"];

  const blocks: Record<string, ReactNode> = {
    featured: featured.length > 0 && (
      <section><SectionHeader title="Parceiros em destaque" to="/app/beneficios" /><Rail>{featured.map((s) => <FeaturedCard key={s.id} s={s} />)}</Rail>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">{partners.slice(0, 4).map((s) => <PartnerCard key={s.id} s={s} />)}</div>
        <Link to="/app/beneficios" className="mt-3 block rounded-full border py-3 text-center text-sm font-bold">Ver todos os {partners.length} parceiros</Link>
      </section>
    ),
    benefits: (
      <section><SectionHeader title="Benefícios EXOTIC" to="/app/beneficios" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {topBenefits.map((b) => <BenefitCard key={b.id} b={b} favorite={fav.favs.has(b.id)} onToggleFav={() => fav.toggleBenefit(b.id)} distance={distanceKm(loc, b.sponsor?.lat, b.sponsor?.lng)} />)}
        </div>
      </section>
    ),
    promotions: promos.length > 0 && (
      <section><SectionHeader title="🔥 Ofertas exclusivas" to="/app/promocoes" />
        <Rail>{promos.map((p) => <PromoCard key={p.id} p={p} compact distance={distanceKm(loc, p.sponsor?.lat, p.sponsor?.lng)} saved={fav.isSaved("promotion", p.id)} onToggleSave={() => fav.toggleSaved("promotion", p.id)} />)}</Rail>
      </section>
    ),
    categories: (
      <section><SectionHeader title="Categorias" />
        <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-8 md:px-0">
          {CATEGORIES.map((c) => { const Icon = CATEGORY_ICONS[c] ?? LayoutGrid; return (
            <button key={c} onClick={() => navigate({ to: "/app/beneficios" })} className="flex w-20 shrink-0 flex-col items-center gap-2 md:w-auto">
              <span className={`grid h-16 w-16 place-items-center rounded-2xl border transition active:scale-95 ${interests.includes(c) ? "border-highlight bg-ink text-highlight" : "bg-card text-primary"}`}><Icon className="h-6 w-6" /></span>
              <span className="text-[0.7rem] font-semibold">{c}</span>
            </button>); })}
        </div>
      </section>
    ),
    nearby: (
      <section><SectionHeader title="📍 Parceiros perto de você" />
        <div className="surface divide-y px-4">{nearby.map((s) => <SponsorRow key={s.id} id={s.id} name={s.name} category={s.category} distance={s.d} benefit={s.benefit} />)}</div>
      </section>
    ),
    events: upcoming.length > 0 && (
      <section><SectionHeader title="Próximos eventos" to="/app/eventos" /><Rail>{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</Rail></section>
    ),
    content: articles.length > 0 && (
      <section><SectionHeader title="Conteúdo EXOTIC" to="/app/conteudo" /><Rail>{articles.slice(0, 6).map((a) => <ArticleCard key={a.id} a={a} />)}</Rail></section>
    ),
  };

  return (
    <div className="space-y-9">
      <header className="flex items-center gap-3">
        <Link to="/app/perfil"><UserAvatar size={48} /></Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-extrabold">Olá{first ? `, ${first}` : ""}</p>
          <p className={`text-[0.65rem] font-extrabold uppercase tracking-[0.2em] ${subscription ? "text-highlight" : "text-muted-foreground"}`}>{subscription ? "● Membro EXOTIC" : "Assinatura inativa"}</p>
        </div>
        <Link to="/app/carteirinha" aria-label="Minha carteirinha" className="grid h-10 w-10 place-items-center rounded-full border bg-card"><IdCard className="h-[18px] w-[18px]" /></Link>
        <div className="lg:hidden"><BellLink unread={unread} /></div>
      </header>

      <Link to={(cfg?.hero_link || "/app/eventos") as "/app/eventos"} className="relative block h-[22rem] overflow-hidden rounded-[2rem] bg-ink text-ink-foreground shadow-lift md:h-[26rem]">
        {cfg?.hero_image && <img src={cfg.hero_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-6 md:p-10">
          <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.3em] text-highlight">{cfg?.hero_badge ?? "EXOTIC EXPERIENCE"}</p>
          <h1 className="mt-2 max-w-lg text-4xl font-extrabold leading-[0.95] md:text-6xl">{cfg?.hero_title ?? "Seu acesso. Seus benefícios."}</h1>
          <p className="mt-3 max-w-md text-sm opacity-80">{cfg?.hero_subtitle}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-highlight px-5 py-2.5 text-sm font-extrabold text-ink">Conhecer <ArrowRight className="h-4 w-4" /></span>
        </div>
      </Link>

      {sections.filter((k) => k !== "map").map((k) => <div key={k}>{blocks[k]}</div>)}

      {!subscription && (
        <section className="member-card flex items-center justify-between gap-3 rounded-3xl p-5">
          <p className="font-bold">Ative sua assinatura e desbloqueie tudo.</p>
          <Button asChild size="sm"><Link to="/app/assinatura">Ativar</Link></Button>
        </section>
      )}
    </div>
  );
}
