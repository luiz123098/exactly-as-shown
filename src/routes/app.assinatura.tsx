import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { brl, planLabel, useAuth, type Plan } from "@/lib/auth";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { PlanCard } from "./index";

export const Route = createFileRoute("/app/assinatura")({
  head: () => ({ meta: [{"title": "Minha assinatura — Exotic Experience"}, {"name": "description", "content": "Consulte seu plano e histórico de assinatura no clube."}, {"property": "og:title", "content": "Minha assinatura — Exotic Experience"}, {"property": "og:description", "content": "Consulte seu plano e histórico de assinatura no clube."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: Sub });

// PAGAMENTO SIMULADO: a assinatura é ativada diretamente. A integração real de pagamento
// deve substituir `subscribe()` por um checkout e ativar a assinatura via webhook.
function Sub() {
  const { user, subscription, level, refresh } = useAuth();
  const qc = useQueryClient();
  const plansRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("level")).data as Plan[],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", user!.id],
    queryFn: async () =>
      (await supabase.from("subscriptions").select("id, status, started_at, plan:plans(name, price)").eq("user_id", user!.id).order("started_at", { ascending: false })).data ?? [],
  });
  const { data: history = [] } = useQuery({
    queryKey: ["usages", user!.id],
    queryFn: async () => (await supabase.from("benefit_usages").select("id, code, created_at, benefit:benefits(title, discount_label, sponsor:sponsors(name))").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const after = () => { refresh(); qc.invalidateQueries({ queryKey: ["payments"] }); };
  async function subscribe(plan: Plan) {
    setBusy(true);
    if (subscription) await supabase.from("subscriptions").update({ status: "replaced" }).eq("id", subscription.id);
    const { error } = await supabase.from("subscriptions").insert({ user_id: user!.id, plan_id: plan.id });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`Bem-vindo ao plano ${plan.name}!`);
    after();
  }
  async function cancel() {
    if (!subscription || !confirm("Cancelar sua assinatura?")) return;
    await supabase.from("subscriptions").update({ status: "canceled", canceled_at: new Date().toISOString() }).eq("id", subscription.id);
    toast.success("Assinatura cancelada");
    after();
  }

  const statusName: Record<string, string> = { active: "Pago", replaced: "Pago", canceled: "Pago · cancelada" };

  return (
    <div className="space-y-10">
      <PageTitle title="Minha assinatura" subtitle="Seu plano, cobranças e histórico." />

      {subscription ? (
        <div className="space-y-4">
          <div className="member-card rounded-3xl p-6 md:p-8">
            <div className="flex items-center justify-between">
              <p className="eyebrow opacity-60">Plano atual</p>
              <span className="eyebrow rounded-full bg-highlight px-2.5 py-1 text-[0.6rem] text-primary-foreground">Ativa</span>
            </div>
            <p className="mt-3 font-display text-5xl">{planLabel(level)}</p>
            <p className="mt-1 opacity-70">{brl(Number(subscription.plan.price))} / mês</p>
          </div>
          <div className="surface grid grid-cols-2 divide-x text-sm">
            <div className="p-4"><p className="text-xs text-muted-foreground">Próxima cobrança</p><p className="mt-1 font-semibold">{brl(Number(subscription.plan.price))}</p></div>
            <div className="p-4"><p className="text-xs text-muted-foreground">Renovação</p><p className="mt-1 font-semibold">{new Date(subscription.renews_at).toLocaleDateString("pt-BR")}</p></div>
          </div>
          <div className="surface p-5">
            <p className="mb-3 text-sm font-bold">Benefícios do plano</p>
            <ul className="space-y-2 text-sm">
              {subscription.plan.features.map((f) => <li key={f} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-primary" />{f}</li>)}
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button onClick={() => plansRef.current?.scrollIntoView({ behavior: "smooth" })}>Alterar plano</Button>
            <Button variant="outline" onClick={() => toast("Pagamento em modo demonstração", { description: "A gestão de cartão será liberada quando o pagamento real for conectado." })}>Gerenciar pagamento</Button>
            <Button variant="ghost" className="text-destructive" onClick={cancel}>Cancelar assinatura</Button>
          </div>
        </div>
      ) : (
        <div className="surface p-6 text-sm text-muted-foreground">Você ainda não tem uma assinatura ativa. Escolha um plano abaixo para desbloquear os benefícios.</div>
      )}

      <div ref={plansRef} className="scroll-mt-20">
        <h2 className="mb-4 text-lg font-bold">Planos disponíveis</h2>
        <div className="grid gap-5 md:grid-cols-2">
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
        <p className="mt-3 text-center text-xs text-muted-foreground">Pagamento em modo demonstração — nenhuma cobrança real é feita.</p>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Histórico de pagamentos</h2>
        {payments.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum pagamento ainda.</p> : (
          <div className="surface divide-y text-sm">
            {payments.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-semibold">Plano {p.plan?.name}</p>
                  <p className="text-xs text-muted-foreground">{new Date(p.started_at).toLocaleDateString("pt-BR")} · {statusName[p.status] ?? p.status}</p>
                </div>
                <span className="shrink-0 font-semibold">{brl(Number(p.plan?.price ?? 0))}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-bold">Benefícios utilizados</h2>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">Você ainda não utilizou benefícios.</p> : (
          <div className="surface divide-y text-sm">
            {history.map((h: any) => (
              <div key={h.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{h.benefit?.title} · <span className="text-primary">{h.benefit?.discount_label}</span></p>
                  <p className="text-xs text-muted-foreground">{h.benefit?.sponsor?.name} · {new Date(h.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <span className="shrink-0 font-mono text-xs">{h.code}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
