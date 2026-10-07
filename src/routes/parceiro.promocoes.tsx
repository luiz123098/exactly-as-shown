import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/auth";
import { StatusPill, useMySponsor } from "@/lib/sponsor";
import { Empty, PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/parceiro/promocoes")({ component: SponsorPromos });

const today = () => new Date().toISOString().slice(0, 10);
const blank = { id: "", title: "", description: "", discount_label: "", image_url: "", category: "Outros", min_plan_level: 1, starts_at: "", ends_at: "" };

function SponsorPromos() {
  const { data: sp } = useMySponsor();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<typeof blank | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["my-promos", sp?.id],
    enabled: !!sp,
    queryFn: async () => (await supabase.from("promotions").select("*").eq("sponsor_id", sp!.id).order("created_at", { ascending: false })).data ?? [],
  });
  if (!sp) return <Empty text="Cadastre sua empresa primeiro." />;
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-promos"] });

  async function save() {
    if (!edit) return;
    if (!edit.title.trim() || !edit.discount_label.trim()) return void toast.error("Título e desconto são obrigatórios");
    const { id, ...rest } = edit;
    const row = { ...rest, title: rest.title.slice(0, 120), description: rest.description.slice(0, 1000), image_url: rest.image_url || sp!.cover_url, starts_at: rest.starts_at || today(), ends_at: rest.ends_at || null, sponsor_id: sp!.id };
    const { error } = id ? await supabase.from("promotions").update(row).eq("id", id) : await supabase.from("promotions").insert(row);
    if (error) return void toast.error(error.message);
    toast.success("Promoção enviada para aprovação");
    setEdit(null);
    refresh();
  }

  return (
    <div>
      <PageTitle eyebrow="Parceiro" title="Promoções">
        <Button onClick={() => setEdit({ ...blank, category: sp.category, starts_at: today() })}><Plus /> Nova promoção</Button>
      </PageTitle>
      <p className="mb-6 text-sm text-muted-foreground">Toda promoção passa pela curadoria. Quando aprovada, os membros ativos recebem uma notificação.</p>
      {data.length === 0 ? <Empty text="Nenhuma promoção criada." /> : (
        <div className="surface divide-y">
          {data.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-5">
              {p.image_url && <img src={p.image_url} alt="" className="h-14 w-20 rounded-lg object-cover" />}
              <div className="flex-1">
                <p className="font-semibold">{p.title} <span className="text-primary">· {p.discount_label}</span></p>
                <p className="text-xs text-muted-foreground">{p.starts_at} → {p.ends_at ?? "sem prazo"}</p>
              </div>
              <StatusPill s={p.status} />
              <Button size="icon" variant="ghost" onClick={() => setEdit({ ...blank, ...p, image_url: p.image_url ?? "", ends_at: p.ends_at ?? "" })}><Pencil /></Button>
              <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Excluir promoção?")) { await supabase.from("promotions").delete().eq("id", p.id); refresh(); } }}><Trash2 /></Button>
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar promoção" : "Nova promoção"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <L t="Título"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></L>
                <L t="Desconto"><Input value={edit.discount_label} onChange={(e) => setEdit({ ...edit, discount_label: e.target.value })} placeholder="30% OFF" /></L>
              </div>
              <L t="Descrição"><Textarea rows={3} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></L>
              <L t="URL da imagem (opcional)"><Input value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} /></L>
              <div className="grid grid-cols-2 gap-3">
                <L t="Categoria">
                  <select className="h-10 w-full rounded-md border bg-card px-2 text-sm" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </L>
                <L t="Plano mínimo">
                  <select className="h-10 w-full rounded-md border bg-card px-2 text-sm" value={edit.min_plan_level} onChange={(e) => setEdit({ ...edit, min_plan_level: Number(e.target.value) })}>
                    <option value={1}>Essencial</option><option value={2}>Premium</option>
                  </select>
                </L>
                <L t="Início"><Input type="date" value={edit.starts_at} onChange={(e) => setEdit({ ...edit, starts_at: e.target.value })} /></L>
                <L t="Fim"><Input type="date" value={edit.ends_at} onChange={(e) => setEdit({ ...edit, ends_at: e.target.value })} /></L>
              </div>
              <Button onClick={save}>Enviar para aprovação</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
