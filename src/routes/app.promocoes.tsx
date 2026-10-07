import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchPromotions } from "@/lib/queries";
import { Empty, PageTitle, PromoCard } from "@/components/cards";
import { CategoryChips } from "./app.beneficios";

export const Route = createFileRoute("/app/promocoes")({ component: Promos });

function Promos() {
  const [cat, setCat] = useState("");
  const [sort, setSort] = useState<"new" | "ending">("new");
  const { data = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  let list = data.filter((p) => !cat || p.category === cat);
  if (sort === "ending") list = [...list].sort((a, b) => (a.ends_at ?? "9999").localeCompare(b.ends_at ?? "9999"));
  return (
    <div>
      <PageTitle eyebrow="Por tempo limitado" title="Promoções">
        <div className="flex rounded-full bg-secondary p-1 text-xs font-semibold">
          {(["new", "ending"] as const).map((s) => (
            <button key={s} onClick={() => setSort(s)} className={`rounded-full px-4 py-1.5 ${sort === s ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
              {s === "new" ? "Novidades" : "Terminando"}
            </button>
          ))}
        </div>
      </PageTitle>
      <div className="mb-8"><CategoryChips value={cat} onChange={setCat} /></div>
      {list.length === 0 ? <Empty text="Nenhuma promoção ativa nesta categoria." /> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((p) => <PromoCard key={p.id} p={p} />)}</div>
      )}
    </div>
  );
}
