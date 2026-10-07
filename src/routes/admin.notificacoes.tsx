import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/admin/notificacoes")({ component: Broadcast });

function Broadcast() {
  const [f, setF] = useState({ title: "", body: "", target: "members" });
  const [busy, setBusy] = useState(false);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return toast.error("Informe um título");
    setBusy(true);
    const { data, error } = await supabase.rpc("broadcast_notification", { _title: f.title.slice(0, 120), _body: f.body.slice(0, 500), _target: f.target });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Aviso enviado para ${data} usuário(s)`);
    setF({ ...f, title: "", body: "" });
  }
  return (
    <div className="max-w-xl">
      <PageTitle eyebrow="Administração" title="Enviar aviso" />
      <form onSubmit={send} className="surface space-y-4 p-6">
        <L t="Público">
          <select className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
            <option value="members">Membros</option>
            <option value="sponsors">Parceiros</option>
            <option value="all">Todos</option>
          </select>
        </L>
        <L t="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
        <L t="Mensagem"><Textarea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></L>
        <Button disabled={busy}>Enviar notificação</Button>
      </form>
      <p className="mt-4 text-xs text-muted-foreground">Avisos aparecem na central de notificações do app. Envio por e-mail/push pode ser conectado depois.</p>
    </div>
  );
}
