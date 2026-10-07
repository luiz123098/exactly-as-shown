import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { brl, planLabel, useAuth, type Plan } from "@/lib/auth";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { PlanCard } from "./index";

export const Route = createFileRoute("/app/assinatura")({ component: Sub });

// PAGAMENTO SIMULADO: a assinatura é ativada diretamente. Integração real de pagamento
// deve substituir `subscribe()` por um checkout e ativar a assinatura via webhook.
function Sub() {
  const { user, subscription, level, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("level")).data as Plan[],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["usages", user!.id],
    queryFn: async () => (await supabase.from("benefit_usages").select("id, code, created_at, benefit:benefits(title, discount_label, sponsor:sponsors(name))").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  async function subscribe(plan: Plan) {
    setBusy(true);
    if (subscription) await supabase.from("subscriptions").update({ status: "replaced" }).eq("id", subscription.id);
    const { error } = await supabase.from("subscriptions").insert({ user_id: user!.id, plan_id: plan.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Bem-vindo ao plano ${plan.name}!`);
    refresh();
  }
  async function cancel() {
    if (!subscription || !confirm("Cancelar sua assinatura?")) return;
    await supabase.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", subscription.id);
    toast.success("Assinatura cancelada");
    refresh();
  }

  return (
    <div className="space-y-12">
      <PageTitle eyebrow="Conta" title="Minha assinatura" />
      {subscription && (
        <div className="member-card flex flex-col justify-between gap-6 rounded-2xl p-8 md:flex-row md:items-center">
          <div>
            <p className="eyebrow opacity-60">Plano atual</p>
            <p className="mt-2 font-display text-4xl">{planLabel(level)} · {brl(Number(subscription.plan.price))}/mês</p>
            <p className="mt-2 text-sm opacity-70">
              Ativa desde {new Date(subscription.started_at).toLocaleDateString("pt-BR")} · próxima cobrança {new Date(subscription.renews_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <Button variant="glass" onClick={cancel}>Cancelar assinatura</Button>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} action={
            subscription?.plan.id === p.id ? (
              <Button disabled className="w-full" variant="secondary">Plano atual</Button>
            ) : (
              <Button className="w-full" variant={p.highlighted ? "default" : "ink"} disabled={busy} onClick={() => subscribe(p)}>
                {subscription ? (p.level > level ? "Fazer upgrade" : "Mudar para este plano") : `Assinar ${p.name}`}
              </Button>
            )
          } />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Pagamento em modo demonstração — nenhuma cobrança real é feita.</p>
      <div>
        <h2 className="mb-4 font-display text-3xl">Histórico de uso</h2>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">Você ainda não utilizou benefícios.</p> : (
          <div className="surface divide-y text-sm">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold">{h.benefit?.title} · <span className="text-primary">{h.benefit?.discount_label}</span></p>
                  <p className="text-xs text-muted-foreground">{h.benefit?.sponsor?.name} · {new Date(h.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <span className="font-mono text-xs">{h.code}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
