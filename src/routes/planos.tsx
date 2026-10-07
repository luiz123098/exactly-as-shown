import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Plan } from "@/lib/auth";
import { PublicFooter, PublicHeader } from "@/components/brand";
import { PlanCard } from "./index";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos — Exotic Experience" },
      { name: "description", content: "Conheça os planos Essencial e Premium do clube Exotic Experience." },
      { property: "og:title", content: "Planos — Exotic Experience" },
      { property: "og:description", content: "Planos de assinatura Essencial e Premium." },
    ],
  }),
  component: Plans,
});

function Plans() {
  const { data: plans = [] } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => (await supabase.from("plans").select("*").order("level")).data as Plan[],
  });
  return (
    <div>
      <PublicHeader />
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="eyebrow text-center text-primary">Assinatura mensal · cancele quando quiser</p>
        <h1 className="mt-3 text-center font-display text-6xl">Escolha seu nível</h1>
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {plans.map((p) => <PlanCard key={p.id} plan={p} />)}
        </div>
      </section>
      <PublicFooter />
    </div>
  );
}
