import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { distanceKm, useUserLocation } from "@/lib/geo";
import { fetchBenefits, fetchPromotions, fetchSponsors } from "@/lib/queries";
import { useFavorites } from "@/lib/use-member";
import { BenefitCard, Empty, HeartButton, PageTitle, PromoCard, SponsorRow } from "@/components/cards";

export const Route = createFileRoute("/app/favoritos")({ component: Favs });

type Tab = "benefits" | "sponsors" | "promos";

function Favs() {
  const [tab, setTab] = useState<Tab>("benefits");
  const { loc } = useUserLocation();
  const fav = useFavorites();
  const { data: benefits = [] } = useQuery({ queryKey: ["benefits"], queryFn: fetchBenefits });
  const { data: sponsors = [] } = useQuery({ queryKey: ["sponsors"], queryFn: fetchSponsors });
  const { data: promos = [] } = useQuery({ queryKey: ["promos"], queryFn: fetchPromotions });
  const b = benefits.filter((x) => fav.favs.has(x.id));
  const s = sponsors.filter((x) => fav.isSaved("sponsor", x.id));
  const p = promos.filter((x) => fav.isSaved("promotion", x.id));
  const tabs: [Tab, string, number][] = [["benefits", "Benefícios", b.length], ["sponsors", "Empresas", s.length], ["promos", "Promoções", p.length]];
  return (
    <div>
      <PageTitle title="Meus favoritos" subtitle="Tudo o que você salvou em um só lugar." />
      <div className="mb-5 grid grid-cols-3 rounded-full bg-secondary p-1 text-xs font-semibold md:w-fit">
        {tabs.map(([k, l, n]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 ${tab === k ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
            {l} <span className="opacity-50">{n}</span>
          </button>
        ))}
      </div>
      {tab === "benefits" && (b.length === 0 ? <Empty text="Toque no coração de um benefício para salvá-lo aqui." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {b.map((x) => <BenefitCard key={x.id} b={x} favorite onToggleFav={() => fav.toggleBenefit(x.id)} distance={distanceKm(loc, x.sponsor?.lat, x.sponsor?.lng)} />)}
        </div>
      ))}
      {tab === "sponsors" && (s.length === 0 ? <Empty text="Salve empresas pelo mapa ou pela página da empresa." /> : (
        <div className="surface divide-y px-4">
          {s.map((x) => (
            <div key={x.id} className="flex items-center gap-2">
              <div className="min-w-0 flex-1"><SponsorRow id={x.id} name={x.name} category={x.category} distance={distanceKm(loc, x.lat, x.lng)} /></div>
              <HeartButton on onClick={() => fav.toggleSaved("sponsor", x.id)} />
            </div>
          ))}
        </div>
      ))}
      {tab === "promos" && (p.length === 0 ? <Empty text="Salve promoções tocando no coração." /> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {p.map((x) => <PromoCard key={x.id} p={x} saved onToggleSave={() => fav.toggleSaved("promotion", x.id)} distance={distanceKm(loc, x.sponsor?.lat, x.sponsor?.lng)} />)}
        </div>
      ))}
    </div>
  );
}
