import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill } from "@/lib/sponsor";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/promocoes")({
  head: () => ({ meta: [{"title": "Moderação de promoções — Exotic Experience"}, {"name": "description", "content": "Revise as promoções dos parceiros do clube."}, {"property": "og:title", "content": "Moderação de promoções — Exotic Experience"}, {"property": "og:description", "content": "Revise as promoções dos parceiros do clube."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: AdminPromos });

function AdminPromos() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected" | "">("pending");
  const { data = [] } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async () => (await supabase.from("promotions").select("*, sponsor:sponsors(name)").order("created_at", { ascending: false })).data ?? [],
  });
  const up = async (id: string, patch: { status?: "approved" | "rejected"; featured?: boolean }) => {
    await supabase.from("promotions").update(patch).eq("id", id);
    if (patch.status === "approved") toast.success("Promoção aprovada — membros notificados");
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
  };
  const list = data.filter((p) => !tab || p.status === tab);
  return (
    <div>
      <PageTitle eyebrow="Administração" title="Promoções" />
      <div className="mb-6 flex gap-2">
        {(["pending", "approved", "rejected", ""] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${tab === t ? "bg-foreground text-background" : "bg-card"}`}>
            {{ "": "Todas", pending: "Em análise", approved: "Aprovadas", rejected: "Recusadas" }[t]}
          </button>
        ))}
      </div>
      {list.length === 0 ? <p className="text-sm text-muted-foreground">Nada por aqui.</p> : (
        <div className="surface divide-y">
          {list.map((p: any) => (
            <div key={p.id} className="flex flex-wrap items-center gap-4 p-5">
              {p.image_url && <img src={p.image_url} alt="" className="h-14 w-20 rounded-lg object-cover" />}
              <div className="min-w-48 flex-1">
                <p className="font-semibold">{p.title} <span className="text-primary">· {p.discount_label}</span></p>
                <p className="text-xs text-muted-foreground">{p.sponsor?.name} · até {p.ends_at ?? "sem prazo"}</p>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{p.description}</p>
              </div>
              <StatusPill s={p.status} />
              <button aria-label="Destaque" onClick={() => up(p.id, { featured: !p.featured })}>
                <Star className={`h-4 w-4 ${p.featured ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
              {p.status !== "approved" && <Button size="sm" onClick={() => up(p.id, { status: "approved" })}>Aprovar</Button>}
              {p.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => up(p.id, { status: "rejected" })}>Recusar</Button>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
