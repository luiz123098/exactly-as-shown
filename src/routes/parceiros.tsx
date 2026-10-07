import { lazy, Suspense, useState } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/auth";
import { PublicFooter, PublicHeader } from "@/components/brand";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/parceiros")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Parceiros — Exotic Experience" },
      { name: "description", content: "Empresas parceiras do clube Exotic Experience em Goiânia e em Goiás." },
      { property: "og:title", content: "Parceiros — Exotic Experience" },
      { property: "og:description", content: "Conheça as empresas parceiras do clube em Goiás." },
    ],
  }),
  component: Partners,
});

function Partners() {
  const [cat, setCat] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["public-sponsors"],
    queryFn: async () => (await supabase.from("sponsors").select("id,name,category,city,address,lat,lng,cover_url,description").order("name")).data ?? [],
  });
  const list = data.filter((s) => !cat || s.category === cat);
  return (
    <div>
      <PublicHeader />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="font-display text-6xl">Nossos parceiros</h1>
        <div className="mt-6 flex flex-wrap gap-2">
          {["", ...CATEGORIES].map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-full border px-4 py-1.5 text-sm ${cat === c ? "border-foreground bg-foreground text-background" : "bg-card"}`}>
              {c || "Todos"}
            </button>
          ))}
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <div key={s.id} className="surface overflow-hidden">
              {s.cover_url && <img src={s.cover_url} alt={s.name} loading="lazy" className="aspect-[16/9] w-full object-cover" />}
              <div className="p-5">
                <p className="eyebrow text-muted-foreground">{s.category}</p>
                <h3 className="mt-1 text-lg font-semibold">{s.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{s.city}</p>
                {s.lat != null && s.lng != null && (
                  <button onClick={() => setOpen(open === s.id ? null : s.id)} className="mt-3 rounded-full border px-4 py-1.5 text-sm">
                    {open === s.id ? "Fechar mapa" : "Ver localização"}
                  </button>
                )}
              </div>
              {open === s.id && (
                <ClientOnly fallback={<div className="h-[260px] bg-secondary" />}>
                  <Suspense fallback={<div className="h-[260px] bg-secondary" />}>
                    <SponsorMap sponsors={[s]} height={260} />
                  </Suspense>
                </ClientOnly>
              )}
            </div>
          ))}
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
