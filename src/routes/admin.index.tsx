import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/auth";
import { PageTitle } from "@/components/cards";
import { Stat } from "./parceiro.index";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{"title": "Visão geral administrativa — Exotic Experience"}, {"name": "description", "content": "Acompanhe membros, parceiros e operações do clube."}, {"property": "og:title", "content": "Visão geral administrativa — Exotic Experience"}, {"property": "og:description", "content": "Acompanhe membros, parceiros e operações do clube."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: AdminHome });

function AdminHome() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const c = (q: any) => q.then((r: any) => r.count ?? 0);
      const [users, sponsors, pendingS, pendingP, benefits, usages, subs] = await Promise.all([
        c(supabase.from("profiles").select("id", { count: "exact", head: true })),
        c(supabase.from("sponsors").select("id", { count: "exact", head: true }).eq("status", "approved")),
        c(supabase.from("sponsors").select("id", { count: "exact", head: true }).eq("status", "pending")),
        c(supabase.from("promotions").select("id", { count: "exact", head: true }).eq("status", "pending")),
        c(supabase.from("benefits").select("id", { count: "exact", head: true })),
        c(supabase.from("benefit_usages").select("id", { count: "exact", head: true })),
        supabase.from("subscriptions").select("plan:plans(price)").eq("status", "active").then((r) => r.data ?? []),
      ]);
      const mrr = subs.reduce((a: number, s: any) => a + Number(s.plan?.price ?? 0), 0);
      return { users, sponsors, pendingS, pendingP, benefits, usages, active: subs.length, mrr };
    },
  });
  return (
    <div>
      <PageTitle eyebrow="Administração" title="Visão geral" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Usuários" value={data?.users ?? "–"} />
        <Stat label="Assinaturas ativas" value={data?.active ?? "–"} />
        <Stat label="Receita mensal" value={data ? brl(data.mrr) : "–"} />
        <Stat label="Parceiros ativos" value={data?.sponsors ?? "–"} />
        <Stat label="Benefícios" value={data?.benefits ?? "–"} />
        <Stat label="Usos de benefícios" value={data?.usages ?? "–"} />
        <Link to="/admin/parceiros"><Stat label="Parceiros p/ aprovar" value={data?.pendingS ?? "–"} /></Link>
        <Link to="/admin/promocoes"><Stat label="Promoções p/ aprovar" value={data?.pendingP ?? "–"} /></Link>
      </div>
    </div>
  );
}
