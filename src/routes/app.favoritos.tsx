import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchBenefits, fetchFavIds, toggleFav } from "@/lib/queries";
import { BenefitCard, Empty, PageTitle } from "@/components/cards";

export const Route = createFileRoute("/app/favoritos")({ component: Favs });

function Favs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: favs = new Set<string>() } = useQuery({ queryKey: ["favs", user!.id], queryFn: () => fetchFavIds(user!.id) });
  const list = data.filter((b) => favs.has(b.id));
  return (
    <div>
      <PageTitle eyebrow="Salvos" title="Favoritos" />
      {list.length === 0 ? <Empty text="Toque no coração de um benefício para salvá-lo aqui." /> : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <BenefitCard key={b.id} b={b} favorite
              onToggleFav={async () => { await toggleFav(user!.id, b.id, true); qc.invalidateQueries({ queryKey: ["favs"] }); }} />
          ))}
        </div>
      )}
    </div>
  );
}
