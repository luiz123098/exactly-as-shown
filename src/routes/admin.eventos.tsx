import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_KINDS, fetchEvents, fmtDate, type ClubEvent } from "@/lib/club";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/admin/eventos")({
  head: () => ({ meta: [{ title: "Eventos — Administração EXOTIC" }, { name: "description", content: "Crie e gerencie as experiências do clube." }, { property: "og:title", content: "Eventos — Administração EXOTIC" }, { property: "og:description", content: "Crie e gerencie as experiências do clube." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AdminEvents,
});

const blank = { title: "", kind: "Encontro", description: "", image_url: "", starts_at: "", location: "", capacity: "50", price: "0", min_plan_level: "1" };

function AdminEvents() {
  const qc = useQueryClient();
  const [f, setF] = useState(blank);
  const [edit, setEdit] = useState<string | null>(null);
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const { data: regs = [] } = useQuery({ queryKey: ["all-regs"], queryFn: async () => (await supabase.from("event_registrations").select("event_id,guests").eq("status", "confirmed")).data ?? [] });
  const reload = () => qc.invalidateQueries({ queryKey: ["events"] });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title || !f.starts_at) return void toast.error("Título e data são obrigatórios");
    const row = { title: f.title, kind: f.kind, description: f.description, image_url: f.image_url || null, starts_at: new Date(f.starts_at).toISOString(), location: f.location, capacity: Number(f.capacity) || 0, price: Number(f.price) || 0, min_plan_level: Number(f.min_plan_level) };
    const { error } = edit ? await supabase.from("events").update(row).eq("id", edit) : await supabase.from("events").insert(row);
    if (error) return void toast.error(error.message);
    toast.success(edit ? "Evento atualizado" : "Evento criado — membros notificados");
    setF(blank); setEdit(null); reload();
  }
  function load(ev: ClubEvent) {
    setEdit(ev.id);
    setF({ title: ev.title, kind: ev.kind, description: ev.description, image_url: ev.image_url ?? "", starts_at: ev.starts_at.slice(0, 16), location: ev.location, capacity: String(ev.capacity), price: String(ev.price), min_plan_level: String(ev.min_plan_level) });
  }
  async function patch(id: string, p: Partial<ClubEvent>) { await supabase.from("events").update(p).eq("id", id); reload(); }
  async function del(id: string) { if (confirm("Excluir evento?")) { await supabase.from("events").delete().eq("id", id); reload(); } }

  return (
    <div>
      <PageTitle eyebrow="Administração" title="Eventos" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {events.map((ev) => {
            const n = regs.filter((r) => r.event_id === ev.id).reduce((s, r) => s + 1 + r.guests, 0);
            return (
              <div key={ev.id} className="surface flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1"><p className="font-bold">{ev.title}</p><p className="text-xs text-muted-foreground">{fmtDate(ev.starts_at)} · {ev.kind} · {n}/{ev.capacity} inscritos</p></div>
                <select className="h-9 rounded-md border bg-card px-2 text-xs" value={ev.status} onChange={(e) => patch(ev.id, { status: e.target.value })}>
                  <option value="open">Inscrições abertas</option><option value="closed">Esgotado</option><option value="finished">Encerrado</option>
                </select>
                <Button size="sm" variant={ev.featured ? "default" : "outline"} onClick={() => patch(ev.id, { featured: !ev.featured })}>{ev.featured ? "★ Destaque" : "Destacar"}</Button>
                <Button size="sm" variant="outline" onClick={() => load(ev)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => del(ev.id)}>Excluir</Button>
              </div>
            );
          })}
        </div>
        <form onSubmit={save} className="surface h-fit space-y-3 p-5">
          <p className="font-bold">{edit ? "Editar evento" : "Novo evento"}</p>
          <L t="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
          <L t="Tipo"><select className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{EVENT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></L>
          <L t="Data e hora"><Input type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} /></L>
          <L t="Local"><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></L>
          <div className="grid grid-cols-3 gap-2">
            <L t="Vagas"><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></L>
            <L t="Valor R$"><Input type="number" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></L>
            <L t="Plano"><select className="h-10 w-full rounded-md border bg-card px-2 text-sm" value={f.min_plan_level} onChange={(e) => setF({ ...f, min_plan_level: e.target.value })}><option value="1">Todos</option><option value="2">Premium</option></select></L>
          </div>
          <L t="Imagem (URL)"><Input value={f.image_url} onChange={(e) => setF({ ...f, image_url: e.target.value })} /></L>
          <L t="Descrição"><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></L>
          <div className="flex gap-2"><Button className="flex-1">{edit ? "Salvar" : "Criar evento"}</Button>{edit && <Button type="button" variant="outline" onClick={() => { setEdit(null); setF(blank); }}>Cancelar</Button>}</div>
        </form>
      </div>
    </div>
  );
}
