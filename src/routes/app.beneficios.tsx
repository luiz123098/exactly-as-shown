import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { MapPin, Search, SlidersHorizontal, Star } from "lucide-react";
import { distanceKm, fmtKm, useUserLocation } from "@/lib/geo";
import { fetchBenefits, fetchSponsors, type SponsorFull } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { BenefitCard, CategoryChips, Empty, PageTitle, SponsorAvatar } from "@/components/cards";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/beneficios")({
  head: () => ({ meta: [{"title": "Parceiros & benefícios — Exotic Experience"}, {"name": "description", "content": "Conheça todos os parceiros e seus benefícios exclusivos em Goiás."}, {"property": "og:title", "content": "Parceiros & benefícios — Exotic Experience"}, {"property": "og:description", "content": "Conheça todos os parceiros e seus benefícios exclusivos em Goiás."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
 
  validateSearch: z.object({ cat: z.string().optional(), tab: z.enum(["parceiros", "beneficios"]).optional() }),
  component: PartnersBenefits,
});

type Partner = SponsorFull & { d: number | null; benefit?: string | undefined };

function PartnerCard({ s }: { s: Partner }) {
  return (
    <Link to="/app/parceiros/$id" params={{ id: s.id }} className="surface group block overflow-hidden transition hover:shadow-lift">
      <div className="relative h-32 overflow-hidden">
        {s.cover_url ? (
          <img src={s.cover_url} alt={s.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="member-card h-full w-full" />
        )}
        <div className="absolute left-3 top-3 flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border-2 border-card bg-card">
          {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : <SponsorAvatar name={s.name} size={40} />}
        </div>
      </div>
      <div className="px-4 pb-4">
        <p className="mt-2 truncate font-bold">{s.name}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" /> {s.category} · {s.d != null ? fmtKm(s.d) : s.city}
        </p>
        {s.benefit && (
          <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-primary">
            <Star className="h-3.5 w-3.5 fill-primary" /> {s.benefit} para membros
          </p>
        )}
        <span className="mt-3 block rounded-full border py-2 text-center text-xs font-semibold">Ver parceiro</span>
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
        benefit: benefits.find((b) => b.sponsor?.id === sp.id)?.discount_label,
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
      <PageTitle title="Parceiros & benefícios" subtitle="Todos os parceiros do clube e suas vantagens." />
      <div className="sticky top-0 z-20 -mx-5 mb-5 space-y-3 bg-background/90 px-5 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
        <div className="grid grid-cols-2 gap-1 rounded-full border bg-card p-1">
          {(["parceiros", "beneficios"] as const).map((t) => (
            <button key={t} onClick={() => navigate({ search: t === "parceiros" ? { cat: cat || undefined } : { tab: t, cat: cat || undefined }, replace: true })}
              className={`rounded-full py-2.5 text-sm font-semibold transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {t === "parceiros" ? `Parceiros (${partners.length})` : "Benefícios"}
            </button>
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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
