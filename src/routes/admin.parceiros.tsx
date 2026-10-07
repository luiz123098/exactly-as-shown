import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill } from "@/lib/sponsor";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/parceiros")({
  head: () => ({ meta: [{"title": "Gestão de parceiros — Exotic Experience"}, {"name": "description", "content": "Gerencie e aprove os parceiros da Exotic Experience."}, {"property": "og:title", "content": "Gestão de parceiros — Exotic Experience"}, {"property": "og:description", "content": "Gerencie e aprove os parceiros da Exotic Experience."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: AdminSponsors });

type St = "pending" | "approved" | "rejected";

function AdminSponsors() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<St | "">("");
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-sponsors"],
    queryFn: async () => (await supabase.from("sponsors").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-sponsors"] });
  const up = async (id: string, patch: { status?: St; featured?: boolean }) => {
    await supabase.from("sponsors").update(patch).eq("id", id);
    refresh();
  };
  const list = data.filter((s) => (!tab || s.status === tab) && (!q || s.name.toLowerCase().includes(q.toLowerCase())));
  return (
    <div>
      <PageTitle eyebrow="Administração" title="Parceiros">
        <Input className="w-64 rounded-full" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      </PageTitle>
      <div className="mb-6 flex gap-2">
        {(["", "pending", "approved", "rejected"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${tab === t ? "bg-foreground text-background" : "bg-card"}`}>
            {{ "": "Todos", pending: "Em análise", approved: "Aprovados", rejected: "Recusados" }[t]}
          </button>
        ))}
      </div>
      <div className="surface divide-y">
        {list.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-48 flex-1">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.category} · {s.city}</p>
            </div>
            <StatusPill s={s.status} />
            <button aria-label="Destaque" onClick={() => up(s.id, { featured: !s.featured })}>
              <Star className={`h-4 w-4 ${s.featured ? "fill-primary text-primary" : "text-muted-foreground"}`} />
            </button>
            {s.status !== "approved" && <Button size="sm" onClick={() => up(s.id, { status: "approved" })}>Aprovar</Button>}
            {s.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => up(s.id, { status: "rejected" })}>Recusar</Button>}
            <Button size="icon" variant="ghost" onClick={async () => { if (confirm(`Excluir ${s.name}?`)) { await supabase.from("sponsors").delete().eq("id", s.id); refresh(); } }}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
