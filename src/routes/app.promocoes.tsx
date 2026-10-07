import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { distanceKm, useUserLocation } from "@/lib/geo";
import { fetchPromotions } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { CategoryChips, Empty, PageTitle, PromoCard } from "@/components/cards";

export const Route = createFileRoute("/app/promocoes")({
  head: () => ({ meta: [{"title": "Promoções exclusivas — Exotic Experience"}, {"name": "description", "content": "Confira as promoções disponíveis nos parceiros do clube."}, {"property": "og:title", "content": "Promoções exclusivas — Exotic Experience"}, {"property": "og:description", "content": "Confira as promoções disponíveis nos parceiros do clube."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: Promos });

const NEAR_KM = 5;

function Promos() {
  const [cat, setCat] = useState("");
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const { data = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  let list = data.map((p) => ({ p, d: distanceKm(loc, p.sponsor?.lat, p.sponsor?.lng) }));
  if (cat === "__near") list = list.filter((x) => x.d != null && x.d <= NEAR_KM).sort((a, b) => a.d! - b.d!);
  else if (cat) list = list.filter((x) => x.p.category === cat);
  return (
    <div>
      <PageTitle title="Promoções" subtitle="Ofertas exclusivas disponíveis agora." />
      <div className="mb-5">
        <CategoryChips value={cat} onChange={setCat} extra={[{ value: "__near", label: "📍 Perto de mim" }]} />
      </div>
      {list.length === 0 ? <Empty text="Nenhuma promoção ativa aqui no momento." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(({ p, d }) => (
            <PromoCard key={p.id} p={p} distance={d} saved={fav.isSaved("promotion", p.id)} onToggleSave={() => fav.toggleSaved("promotion", p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
