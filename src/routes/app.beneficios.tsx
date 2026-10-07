import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowUpRight, Building2, MapPin, Search, SlidersHorizontal, Ticket } from "lucide-react";
import { distanceKm, fmtKm, useUserLocation } from "@/lib/geo";
import { fetchBenefits, fetchSponsors, type SponsorFull } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { BenefitCard, CategoryChips, Empty, PageTitle, type Benefit } from "@/components/cards";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/beneficios")({
  head: () => ({ meta: [{"title": "Parceiros & benefícios — Exotic Experience"}, {"name": "description", "content": "Conheça todos os parceiros e seus benefícios exclusivos em Goiás."}, {"property": "og:title", "content": "Parceiros & benefícios — Exotic Experience"}, {"property": "og:description", "content": "Conheça todos os parceiros e seus benefícios exclusivos em Goiás."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
 
  validateSearch: z.object({ cat: z.string().optional(), tab: z.enum(["parceiros", "beneficios"]).optional() }),
  component: PartnersBenefits,
});

type Partner = SponsorFull & { d: number | null; benefit?: Benefit | undefined };

function PartnerCard({ s }: { s: Partner }) {
  return (
    <Link to="/app/parceiros/$id" params={{ id: s.id }} aria-label={`Ver parceiro ${s.name}`} className="surface group flex h-full flex-col overflow-hidden transition hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="relative aspect-video overflow-hidden bg-secondary">
        {s.cover_url ? (
          <img src={s.cover_url} alt={s.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="grid h-full w-full place-items-center"><Building2 className="h-12 w-12 text-muted-foreground" /></div>
        )}
        {s.logo_url && <div className="absolute bottom-3 left-3 h-12 w-12 overflow-hidden rounded-lg border border-border bg-card p-1"><img src={s.logo_url} alt="" className="h-full w-full object-contain" /></div>}
        <span className="absolute right-3 top-3 rounded-md bg-ink px-2.5 py-1 text-xs font-bold text-ink-foreground">EXOTIC</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="eyebrow text-muted-foreground">{s.category}</p>
        <h2 className="mt-1 text-lg font-bold leading-snug">{s.name}</h2>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" /> {s.city}{s.d != null ? ` · ${fmtKm(s.d)}` : ""}
        </p>
        <div className="mt-4 border-t pt-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-primary-deep"><Ticket className="h-3.5 w-3.5" />Benefício EXOTIC</p>
          {s.benefit ? <><p className="mt-1 text-2xl font-extrabold">{s.benefit.discount_label}</p><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.benefit.title}</p></> : <p className="mt-2 text-sm text-muted-foreground">Novos benefícios em breve</p>}
        </div>
        <span className="mt-auto flex items-center justify-between gap-2 pt-4 text-sm font-semibold">Conhecer parceiro<ArrowUpRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

function PartnersBenefits() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = search.tab ?? "parceiros";
  const cat = search.cat ?? "";
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState(0);
  const [sort, setSort] = useState<"near" | "new">("near");
  const { data: sponsors = [] } = useQuery({ queryKey: ["sponsors"], queryFn: fetchSponsors });
  const { data: benefits = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const s = q.toLowerCase();

  const partners: Partner[] = useMemo(
    () =>
      sponsors.map((sp) => ({
        ...sp,
        d: distanceKm(loc, sp.lat, sp.lng),
        benefit: benefits.find((b) => b.sponsor?.id === sp.id && (!b.expires_at || b.expires_at >= new Date().toISOString().slice(0, 10))),
      })),
    [sponsors, benefits, loc],
  );
  const filteredPartners = useMemo(() => {
    const list = partners
      .filter((p) => (!cat || p.category === cat) && (!s || p.name.toLowerCase().includes(s) || p.category.toLowerCase().includes(s) || p.city.toLowerCase().includes(s)))
      .sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9));
    return list;
  }, [partners, cat, s]);

  const filteredBenefits = useMemo(
    () =>
      benefits
        .map((b) => ({ b, d: distanceKm(loc, b.sponsor?.lat, b.sponsor?.lng) }))
        .filter(({ b }) =>
          (!cat || b.category === cat) &&
          (!tier || b.min_plan_level === tier) &&
          (!s || b.title.toLowerCase().includes(s) || b.sponsor?.name.toLowerCase().includes(s) || b.sponsor?.city.toLowerCase().includes(s)),
        )
        .sort((a, b) => (sort === "near" ? (a.d ?? 9e9) - (b.d ?? 9e9) : 0)),
    [benefits, cat, tier, s, sort],
  );

  return (
    <div>
      <PageTitle eyebrow="Ecossistema EXOTIC" title="Parceiros" subtitle="Empresas que fazem parte da sua experiência EXOTIC." />
      <div className="mb-5 space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-full border bg-card p-1">
          {(["parceiros", "beneficios"] as const).map((t) => (
            <Button key={t} variant={tab === t ? "default" : "ghost"} onClick={() => navigate({ search: t === "parceiros" ? { cat: cat || undefined } : { tab: t, cat: cat || undefined }, replace: true })}
              className="rounded-full">
              {t === "parceiros" ? `Parceiros (${partners.length})` : "Benefícios"}
            </Button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-12 rounded-full bg-card pl-11" placeholder={tab === "parceiros" ? "Buscar parceiro, categoria ou cidade" : "Buscar empresa, benefício ou cidade"} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <CategoryChips value={cat} onChange={(c) => navigate({ search: { ...(tab !== "parceiros" && { tab }), ...(c && { cat: c }) }, replace: true })} />
        {tab === "beneficios" && (
          <div className="flex items-center gap-2 text-xs">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className="h-8 rounded-full border bg-card px-3 font-semibold">
              <option value={0}>Todos os planos</option>
              <option value={1}>Essencial</option>
              <option value={2}>Premium</option>
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as "near" | "new")} className="h-8 rounded-full border bg-card px-3 font-semibold">
              <option value="near">Mais próximos</option>
              <option value="new">Mais recentes</option>
            </select>
          </div>
        )}
      </div>

      {tab === "parceiros" ? (
        filteredPartners.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredPartners.map((p) => <PartnerCard key={p.id} s={p} />)}
          </div>
        ) : (
          <Empty text="Nenhum parceiro encontrado." />
        )
      ) : filteredBenefits.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBenefits.map(({ b, d }) => (
            <BenefitCard key={b.id} b={b} distance={d} favorite={fav.favs.has(b.id)} onToggleFav={() => fav.toggleBenefit(b.id)} />
          ))}
        </div>
      ) : (
        <Empty text="Nenhum benefício encontrado." />
      )}
    </div>
  );
}
