import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/auth";
import { PageTitle } from "@/components/cards";

export const Route = createFileRoute("/admin/assinaturas")({ component: AdminSubs });

const label: Record<string, string> = { active: "Ativa", canceled: "Cancelada", replaced: "Substituída" };

function AdminSubs() {
  const [tab, setTab] = useState("active");
  const { data = [] } = useQuery({
    queryKey: ["admin-subs"],
    queryFn: async () => {
      const [s, p] = await Promise.all([
        supabase.from("subscriptions").select("id,user_id,status,started_at,renews_at,plan:plans(name,price)").order("started_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name"),
      ]);
      const names = new Map((p.data ?? []).map((x) => [x.id, x.full_name]));
      return (s.data ?? []).map((x: any) => ({ ...x, name: names.get(x.user_id) || "—" }));
    },
  });
  const list = data.filter((x) => !tab || x.status === tab);
  return (
    <div>
      <PageTitle eyebrow="Administração" title="Assinaturas" subtitle="Assinaturas e pagamentos (modo demonstração)." />
      <div className="mb-5 flex gap-2">
        {[["active", "Ativas"], ["canceled", "Canceladas"], ["", "Todas"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${tab === k ? "bg-foreground text-background" : "bg-card"}`}>{l}</button>
        ))}
      </div>
      <div className="surface divide-y text-sm">
        {list.map((x) => (
          <div key={x.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-semibold">{x.name}</p>
              <p className="text-xs text-muted-foreground">Plano {x.plan?.name} · desde {new Date(x.started_at).toLocaleDateString("pt-BR")} · renova {new Date(x.renews_at).toLocaleDateString("pt-BR")}</p>
            </div>
            <span className="text-xs font-semibold">{label[x.status] ?? x.status}</span>
            <span className="font-semibold">{brl(Number(x.plan?.price ?? 0))}</span>
          </div>
        ))}
        {list.length === 0 && <p className="p-6 text-muted-foreground">Nenhuma assinatura.</p>}
      </div>
    </div>
  );
}
