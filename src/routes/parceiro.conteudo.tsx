import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMySponsor } from "@/lib/sponsor";
import { ARTICLE_STATUS, type Article } from "@/lib/club";
import { Empty, PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/parceiro/conteudo")({
  head: () => ({ meta: [{ title: "Conteúdo do parceiro — Exotic Experience" }, { name: "description", content: "Publique notícias e novidades da sua empresa na revista EXOTIC." }, { property: "og:title", content: "Conteúdo do parceiro — Exotic Experience" }, { property: "og:description", content: "Publique notícias e novidades da sua empresa na revista EXOTIC." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: PartnerContent,
});

const blank = { id: "", title: "", excerpt: "", body: "", cover_url: "", tags: "" };

function PartnerContent() {
  const { data: sp } = useMySponsor();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<typeof blank | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["my-articles", sp?.id], enabled: !!sp,
    queryFn: async () => ((await supabase.from("articles").select("*").eq("sponsor_id", sp!.id).order("created_at", { ascending: false })).data ?? []) as Article[],
  });
  if (!sp) return <Empty text="Cadastre sua empresa primeiro." />;
  const refresh = () => qc.invalidateQueries({ queryKey: ["my-articles"] });

  async function save(status: "draft" | "pending") {
    if (!edit) return;
    if (!edit.title.trim() || !edit.body.trim()) return void toast.error("Título e texto são obrigatórios");
    const { id, tags, ...rest } = edit;
    const row = {
      ...rest, title: rest.title.slice(0, 160), excerpt: (rest.excerpt || rest.body).slice(0, 280), body: rest.body.slice(0, 10000),
      cover_url: rest.cover_url || sp!.cover_url, tags: tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10),
      sponsor_id: sp!.id, status, category: "Lifestyle", origin: "partner",
    };
    const { error } = id ? await supabase.from("articles").update(row).eq("id", id) : await supabase.from("articles").insert(row);
    if (error) return void toast.error(error.message);
    toast.success(status === "pending" ? "Enviado para aprovação" : "Rascunho salvo"); setEdit(null); refresh();
  }
  async function remove(id: string) { await supabase.from("articles").delete().eq("id", id); refresh(); }

  return (
    <div>
      <PageTitle eyebrow="Parceiro" title="Conteúdo" />
      <p className="mb-4 text-sm text-muted-foreground">Publique notícias, lançamentos e comunicados. A categoria segue o nicho da sua empresa ({(sp as { niche?: string }).niche ?? "Lifestyle"}) e tudo passa pela aprovação da EXOTIC.</p>
      <Button onClick={() => setEdit(blank)} className="mb-4"><Plus className="h-4 w-4" />Criar conteúdo</Button>
      {data.length === 0 ? <Empty text="Nenhum conteúdo ainda." /> : (
        <div className="space-y-3">
          {data.map((a) => (
            <div key={a.id} className="surface flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{a.title}</p><p className="text-xs text-muted-foreground">{a.category} · {ARTICLE_STATUS[a.status] ?? a.status} · {new Date(a.created_at).toLocaleDateString("pt-BR")}</p></div>
              {["draft", "pending", "rejected"].includes(a.status) && <Button size="icon" variant="outline" aria-label="Editar" onClick={() => setEdit({ id: a.id, title: a.title, excerpt: a.excerpt, body: a.body, cover_url: a.cover_url ?? "", tags: a.tags.join(", ") })}><Pencil className="h-4 w-4" /></Button>}
              {a.status !== "published" && <Button size="icon" variant="outline" aria-label="Excluir" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
      )}
      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{edit?.id ? "Editar conteúdo" : "Criar conteúdo"}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <L t="Título"><Input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></L>
              <L t="Imagem principal (URL)"><Input value={edit.cover_url} onChange={(e) => setEdit({ ...edit, cover_url: e.target.value })} /></L>
              <L t="Resumo"><Input value={edit.excerpt} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} /></L>
              <L t="Texto"><Textarea rows={8} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></L>
              <L t="Tags (separadas por vírgula)"><Input value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} placeholder="Porsche, inauguração, Goiânia" /></L>
              <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => save("draft")}>Salvar rascunho</Button><Button className="flex-1" onClick={() => save("pending")}>Enviar para aprovação</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
