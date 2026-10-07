import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMySponsor } from "@/lib/sponsor";
import { brl } from "@/lib/club";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/parceiro/validar")({
  head: () => ({ meta: [{ title: "Validar benefício — Exotic Experience" }, { name: "description", content: "Valide o código apresentado pelo membro EXOTIC." }, { property: "og:title", content: "Validar benefício — Exotic Experience" }, { property: "og:description", content: "Valide o código apresentado pelo membro EXOTIC." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Validate,
});

function Validate() {
  const { data: sp } = useMySponsor();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [ok, setOk] = useState<{ member: string; benefit: string } | null>(null);
  const { data: history = [] } = useQuery({
    queryKey: ["sp-usages", sp?.id], enabled: !!sp,
    queryFn: async () => (await supabase.from("benefit_usages").select("id,code,status,saved_amount,created_at, benefit:benefits(title)").eq("sponsor_id", sp!.id).order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("validate_usage", { _code: code.replace(/^EXOTIC-USE:/, ""), _amount: Number(amount.replace(",", ".")) || 0 });
    if (error) return void toast.error(error.message);
    setOk(data as { member: string; benefit: string });
    setCode(""); setAmount("");
    qc.invalidateQueries({ queryKey: ["sp-usages"] });
  }
  return (
    <div className="max-w-xl">
      <PageTitle eyebrow="Painel do parceiro" title="Validar benefício" subtitle="Digite o código que o membro mostra no app." />
      {ok && (
        <div className="surface mb-5 flex items-center gap-3 p-4">
          <CheckCircle2 className="h-8 w-8 text-highlight" />
          <div><p className="font-bold">Benefício validado</p><p className="text-sm text-muted-foreground">{ok.member} · {ok.benefit}</p></div>
        </div>
      )}
      <form onSubmit={submit} className="surface space-y-4 p-6">
        <L t="Código do membro"><Input placeholder="EX-XXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono text-lg tracking-widest" /></L>
        <L t="Valor do desconto concedido (R$, opcional)"><Input inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} /></L>
        <Button disabled={!code.trim()} className="w-full">Validar</Button>
      </form>
      <h2 className="mb-3 mt-8 text-lg font-bold">Últimas utilizações</h2>
      <div className="surface divide-y px-4">
        {history.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma utilização ainda.</p>}
        {history.map((h) => (
          <div key={h.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div className="min-w-0"><p className="truncate font-semibold">{(h.benefit as unknown as { title: string } | null)?.title}</p>
              <p className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")} · {h.code}</p></div>
            <span className={`shrink-0 font-bold ${h.status === "validated" ? "text-primary" : "text-muted-foreground"}`}>{h.status === "validated" ? brl(Number(h.saved_amount)) : "Pendente"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
