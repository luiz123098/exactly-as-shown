import { lazy, Suspense, useState } from "react";
import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/cards";
import { CategoryChips } from "./app.beneficios";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/app/mapa")({ component: MapPage });

function MapPage() {
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["map-sponsors-full"],
    queryFn: async () => (await supabase.from("sponsors").select("id,name,category,address,city,lat,lng").order("name")).data ?? [],
  });
  const list = data.filter((s) => !cat || s.category === cat);
  return (
    <div>
      <PageTitle eyebrow="Goiás" title="Mapa de parceiros" />
      <div className="mb-6"><CategoryChips value={cat} onChange={setCat} /></div>
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="overflow-hidden rounded-2xl border">
          <ClientOnly fallback={<div className="h-[560px] bg-secondary" />}>
            <Suspense fallback={<div className="h-[560px] bg-secondary" />}>
              <SponsorMap sponsors={list} height={560} onSelect={setSel} />
            </Suspense>
          </ClientOnly>
        </div>
        <div className="max-h-[560px] space-y-2 overflow-y-auto">
          {list.map((s) => (
            <Link key={s.id} to="/app/parceiros/$id" params={{ id: s.id }}
              className={`surface block p-4 transition hover:border-primary ${sel === s.id ? "border-primary" : ""}`}>
              <p className="eyebrow text-muted-foreground">{s.category}</p>
              <p className="mt-1 font-semibold">{s.name}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{s.address}, {s.city}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
