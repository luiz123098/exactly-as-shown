import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl } from "@/lib/club";
import { Empty, PageTitle } from "@/components/cards";

export const Route = createFileRoute("/app/economia")({
  head: () => ({ meta: [{ title: "Quanto você economizou — Exotic Experience" }, { name: "description", content: "Veja quanto sua assinatura EXOTIC já devolveu em benefícios." }, { property: "og:title", content: "Quanto você economizou — Exotic Experience" }, { property: "og:description", content: "Veja quanto sua assinatura EXOTIC já devolveu em benefícios." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Savings,
});

function Savings() {
  const { user, subscription } = useAuth();
  const { data: uses = [] } = useQuery({
    queryKey: ["usages", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("benefit_usages").select("id,code,status,saved_amount,created_at,validated_at, benefit:benefits(title, discount_label, sponsor:sponsors(name))").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const saved = uses.reduce((s, u) => s + Number(u.saved_amount || 0), 0);
  const price = Number(subscription?.plan.price ?? 0);
  const validated = uses.filter((u) => u.status === "validated");
  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Seu clube se paga" title="Quanto você economizou" />
      <div className="member-card rounded-3xl p-6">
        <p className="eyebrow opacity-70">Total economizado</p>
        <p className="mt-2 text-5xl font-extrabold text-highlight">{brl(saved)}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div><p className="opacity-60">Assinatura</p><p className="font-bold">{price ? `${brl(price)}/mês` : "—"}</p></div>
          <div><p className="opacity-60">Benefícios usados</p><p className="font-bold">{validated.length}</p></div>
        </div>
        {price > 0 && saved > 0 && <p className="mt-5 rounded-xl bg-ink-muted p-3 text-sm">Sua economia equivale a <strong>{(saved / price).toFixed(1)}x</strong> o valor da mensalidade.</p>}
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Histórico de utilização</h2>
      {!uses.length ? <Empty text="Use um benefício em um parceiro para começar a economizar." /> : (
        <div className="surface divide-y px-4">
          {uses.map((u) => {
            const b = u.benefit as unknown as { title: string; discount_label: string; sponsor: { name: string } | null } | null;
            return (
              <div key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate font-semibold">{b?.sponsor?.name} · {b?.discount_label}</p>
                  <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString("pt-BR")} · código {u.code}</p></div>
                <span className={`shrink-0 text-sm font-bold ${u.status === "validated" ? "text-primary" : "text-muted-foreground"}`}>{u.status === "validated" ? `+${brl(Number(u.saved_amount))}` : "Pendente"}</span>
              </div>
            );
          })}
        </div>
      )}
      <Link to="/app/beneficios" className="mt-6 block rounded-full border py-3 text-center text-sm font-bold">Descobrir mais benefícios</Link>
    </div>
  );
}
