import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Search, SlidersHorizontal } from "lucide-react";
import { distanceKm, useUserLocation } from "@/lib/geo";
import { fetchBenefits } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { BenefitCard, CategoryChips, Empty, PageTitle } from "@/components/cards";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/beneficios")({
  validateSearch: z.object({ cat: z.string().optional() }),
  component: Benefits,
});

function Benefits() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const cat = search.cat ?? "";
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const [q, setQ] = useState("");
  const [tier, setTier] = useState(0);
  const [sort, setSort] = useState<"near" | "new">("near");
  const { data = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const s = q.toLowerCase();
  let list = data
    .map((b) => ({ b, d: distanceKm(loc, b.sponsor?.lat, b.sponsor?.lng) }))
    .filter(({ b }) =>
      (!cat || b.category === cat) &&
      (!tier || b.min_plan_level === tier) &&
      (!s || b.title.toLowerCase().includes(s) || b.sponsor?.name.toLowerCase().includes(s) || b.sponsor?.city.toLowerCase().includes(s)),
    );
  if (sort === "near") list = list.sort((a, b) => (a.d ?? 9e9) - (b.d ?? 9e9));

  return (
    <div>
      <PageTitle title="Benefícios" subtitle="Descubra vantagens exclusivas para membros." />
      <div className="sticky top-0 z-20 -mx-5 mb-5 space-y-3 bg-background/90 px-5 py-2 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-12 rounded-full bg-card pl-11" placeholder="Buscar empresa, benefício ou cidade" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <CategoryChips value={cat} onChange={(c) => navigate({ search: c ? { cat: c } : {}, replace: true })} />
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
      </div>
      {list.length === 0 ? <Empty text="Nenhum benefício encontrado." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ b, d }) => (
            <BenefitCard key={b.id} b={b} distance={d} favorite={fav.favs.has(b.id)} onToggleFav={() => fav.toggleBenefit(b.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
