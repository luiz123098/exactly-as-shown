import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusPill, useMySponsor } from "@/lib/sponsor";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/parceiro/")({
  head: () => ({ meta: [{"title": "Visão geral do parceiro — Exotic Experience"}, {"name": "description", "content": "Acompanhe a participação da sua empresa na Exotic Experience."}, {"property": "og:title", "content": "Visão geral do parceiro — Exotic Experience"}, {"property": "og:description", "content": "Acompanhe a participação da sua empresa na Exotic Experience."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: SponsorDash });

export function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="surface p-6">
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-3 text-4xl font-extrabold">{value}</p>
    </div>
  );
}

function SponsorDash() {
  const { data: sp, isLoading } = useMySponsor();
  const { data: stats } = useQuery({
    queryKey: ["sponsor-stats", sp?.id],
    enabled: !!sp,
    queryFn: async () => {
      const [b, p, pa] = await Promise.all([
        supabase.from("benefits").select("id", { count: "exact" }).eq("sponsor_id", sp!.id),
        supabase.from("promotions").select("id", { count: "exact", head: true }).eq("sponsor_id", sp!.id),
        supabase.from("promotions").select("id", { count: "exact", head: true }).eq("sponsor_id", sp!.id).eq("status", "approved"),
      ]);
      const ids = (b.data ?? []).map((x) => x.id);
      const u = ids.length
        ? await supabase.from("benefit_usages").select("id", { count: "exact", head: true }).in("benefit_id", ids)
        : { count: 0 };
      const ev = (await supabase.from("sponsor_events").select("kind,user_id").eq("sponsor_id", sp!.id)).data ?? [];
      const val = (await supabase.from("benefit_usages").select("id", { count: "exact", head: true }).eq("sponsor_id", sp!.id).eq("status", "validated")).count ?? 0;
      return { benefits: b.count ?? 0, promos: p.count ?? 0, approved: pa.count ?? 0, usages: u.count ?? 0,
        views: ev.filter((e) => e.kind === "view").length, clicks: ev.filter((e) => e.kind !== "view").length,
        reach: new Set(ev.map((e) => e.user_id)).size, validated: val };
    },
  });
  if (isLoading) return null;
  if (!sp)
    return (
      <div className="member-card rounded-3xl p-10">
        <h1 className="font-display text-5xl">Bem-vindo, parceiro.</h1>
        <p className="mt-3 max-w-lg opacity-70">Cadastre sua empresa para começar a oferecer benefícios aos membros do clube.</p>
        <Button asChild className="mt-6"><Link to="/parceiro/empresa">Cadastrar empresa</Link></Button>
      </div>
    );
  return (
    <div>
      <PageTitle eyebrow="Painel do parceiro" title={sp.name}><StatusPill s={sp.status} /></PageTitle>
      {sp.status === "pending" && (
        <div className="surface mb-6 p-5 text-sm">Sua empresa está em análise pela curadoria. Você já pode cadastrar benefícios e promoções — elas aparecerão para os membros após a aprovação.</div>
      )}
      <h2 className="mb-3 text-lg font-bold">Meu desempenho</h2>
      <div className="mb-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Visualizações" value={stats?.views ?? "–"} />
        <Stat label="Cliques (rotas)" value={stats?.clicks ?? "–"} />
        <Stat label="Membros alcançados" value={stats?.reach ?? "–"} />
        <Stat label="Conversões" value={stats ? `${stats.validated}${stats.reach ? ` · ${Math.round((stats.validated / stats.reach) * 100)}%` : ""}` : "–"} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Benefícios" value={stats?.benefits ?? "–"} />
        <Stat label="Promoções" value={stats?.promos ?? "–"} />
        <Stat label="Promoções no ar" value={stats?.approved ?? "–"} />
        <Stat label="Usos por membros" value={stats?.usages ?? "–"} />
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild><Link to="/parceiro/validar">Validar benefício</Link></Button>
        <Button asChild variant="outline"><Link to="/parceiro/promocoes">Nova promoção</Link></Button>
        <Button asChild variant="outline"><Link to="/parceiro/beneficios">Gerenciar benefícios</Link></Button>
      </div>
    </div>
  );
}
