import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES } from "@/lib/auth";
import { useMySponsor } from "@/lib/sponsor";
import { Empty, LevelTag, PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/parceiro/beneficios")({
  head: () => ({ meta: [{"title": "Benefícios da empresa — Exotic Experience"}, {"name": "description", "content": "Gerencie os benefícios da sua empresa para os membros."}, {"property": "og:title", "content": "Benefícios da empresa — Exotic Experience"}, {"property": "og:description", "content": "Gerencie os benefícios da sua empresa para os membros."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: SponsorBenefits });

const blank = { id: "", title: "", description: "", discount_label: "", rules: "", category: "Outros", min_plan_level: 1, active: true, expires_at: "" };

function SponsorBenefits() {
  const { data: sp } = useMySponsor();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<typeof blank | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["my-benefits", sp?.id],
    enabled: !!sp,
    queryFn: async () => (await supabase.from("benefits").select("*").eq("sponsor_id", sp!.id).order("created_at", { ascending: false })).data ?? [],
  });
  if (!sp) return <Empty text="Cadastre sua empresa primeiro." />;
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-benefits"] });

  async function save() {
    if (!edit) return;
    if (!edit.title.trim() || !edit.discount_label.trim()) return void toast.error("Título e desconto são obrigatórios");
    const { id, ...rest } = edit;
    const row = { ...rest, title: rest.title.slice(0, 120), description: rest.description.slice(0, 1000), expires_at: rest.expires_at || null, rules: rest.rules || null, sponsor_id: sp!.id };
    const { error } = id ? await supabase.from("benefits").update(row).eq("id", id) : await supabase.from("benefits").insert(row);
    if (error) return void toast.error(error.message);
    toast.success("Benefício salvo");
    setEdit(null);
    refresh();
  }

  return (
    <div>
      <PageTitle eyebrow="Parceiro" title="Benefícios">
        <Button onClick={() => setEdit({ ...blank, category: sp.category })}><Plus /> Novo benefício</Button>
      </PageTitle>
      {data.length === 0 ? <Empty text="Nenhum benefício cadastrado." /> : (
        <div className="surface divide-y">
          {data.map((b) => (
            <div key={b.id} className="flex items-center gap-4 p-5">
              <p className="w-28 shrink-0 font-display text-2xl text-primary">{b.discount_label}</p>
              <div className="flex-1">
                <p className="font-semibold">{b.title} <LevelTag level={b.min_plan_level} /></p>
                <p className="text-sm text-muted-foreground line-clamp-1">{b.description}</p>
              </div>
              {!b.active && <span className="text-xs text-muted-foreground">Inativo</span>}
              <Button size="icon" variant="ghost" onClick={() => setEdit({ ...blank, ...b, rules: b.rules ?? "", expires_at: b.expires_at ?? "" })}><Pencil /></Button>
              <Button size="icon" variant="ghost" onClick={async () => { if (confirm("Excluir benefício?")) { await supabase.from("benefits").delete().eq("id", b.id); refresh(); } }}><Trash2 /></Button>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-xs text-muted-foreground">Benefícios ficam visíveis quando sua empresa estiver aprovada. <Link to="/parceiro/empresa" className="text-primary">Ver empresa</Link></p>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar benefício" : "Novo benefício"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <L t="Título"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></L>
                <L t="Desconto (ex.: 20% OFF)"><Input value={edit.discount_label} onChange={(e) => setEdit({ ...edit, discount_label: e.target.value })} /></L>
              </div>
              <L t="Descrição"><Textarea rows={2} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></L>
              <L t="Regras de uso"><Textarea rows={2} value={edit.rules} onChange={(e) => setEdit({ ...edit, rules: e.target.value })} /></L>
              <div className="grid grid-cols-3 gap-3">
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
                <L t="Validade"><Input type="date" value={edit.expires_at} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value })} /></L>
              </div>
              <label className="flex items-center gap-2 text-sm"><Switch checked={edit.active} onCheckedChange={(v) => setEdit({ ...edit, active: v })} /> Ativo</label>
              <Button onClick={save}>Salvar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function L({ t, children }: { t: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{t}</Label>{children}</div>;
}
