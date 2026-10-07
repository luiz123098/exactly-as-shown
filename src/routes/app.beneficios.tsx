import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useAuth, CATEGORIES } from "@/lib/auth";
import { fetchBenefits, fetchFavIds, toggleFav } from "@/lib/queries";
import { BenefitCard, Empty, PageTitle } from "@/components/cards";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/beneficios")({ component: Benefits });

export function CategoryChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {["", ...CATEGORIES].map((c) => (
        <button key={c} onClick={() => onChange(c)}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${value === c ? "border-foreground bg-foreground text-background" : "bg-card hover:border-foreground"}`}>
          {c || "Todas"}
        </button>
      ))}
    </div>
  );
}

function Benefits() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [tier, setTier] = useState(0);
  const { data = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: favs = new Set<string>() } = useQuery({ queryKey: ["favs", user!.id], queryFn: () => fetchFavIds(user!.id) });
  const s = q.toLowerCase();
  const list = data.filter(
    (b) =>
      (!cat || b.category === cat) &&
      (!tier || b.min_plan_level === tier) &&
      (!s || b.title.toLowerCase().includes(s) || b.sponsor?.name.toLowerCase().includes(s) || b.sponsor?.city.toLowerCase().includes(s)),
  );
  return (
    <div>
      <PageTitle eyebrow="Catálogo" title="Benefícios">
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="rounded-full pl-9" placeholder="Buscar parceiro, cidade…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </PageTitle>
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CategoryChips value={cat} onChange={setCat} />
        <select value={tier} onChange={(e) => setTier(Number(e.target.value))} className="h-9 rounded-full border bg-card px-3 text-xs font-semibold">
          <option value={0}>Todos os planos</option>
          <option value={1}>Essencial</option>
          <option value={2}>Premium</option>
        </select>
      </div>
      {list.length === 0 ? <Empty text="Nenhum benefício encontrado." /> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <BenefitCard key={b.id} b={b} favorite={favs.has(b.id)}
              onToggleFav={async () => { await toggleFav(user!.id, b.id, favs.has(b.id)); qc.invalidateQueries({ queryKey: ["favs"] }); }} />
          ))}
        </div>
      )}
    </div>
  );
}
