import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ARTICLE_CATEGORIES, type Article } from "@/lib/club";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/admin/conteudo")({
  head: () => ({ meta: [{ title: "Conteúdo — Administração EXOTIC" }, { name: "description", content: "Publique notícias, guias e vídeos para os membros." }, { property: "og:title", content: "Conteúdo — Administração EXOTIC" }, { property: "og:description", content: "Publique notícias, guias e vídeos para os membros." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AdminContent,
});

const blank = { title: "", category: "Lifestyle", excerpt: "", body: "", cover_url: "", video_url: "" };

function AdminContent() {
  const qc = useQueryClient();
  const [f, setF] = useState(blank);
  const [edit, setEdit] = useState<string | null>(null);
  const { data: list = [] } = useQuery({ queryKey: ["admin-articles"], queryFn: async () => ((await supabase.from("articles").select("*").order("created_at", { ascending: false })).data ?? []) as Article[] });
  const reload = () => { qc.invalidateQueries({ queryKey: ["admin-articles"] }); qc.invalidateQueries({ queryKey: ["articles"] }); };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title) return void toast.error("Informe o título");
    const row = { ...f, cover_url: f.cover_url || null, video_url: f.video_url || null };
    const { error } = edit ? await supabase.from("articles").update(row).eq("id", edit) : await supabase.from("articles").insert(row);
    if (error) return void toast.error(error.message);
    toast.success("Conteúdo salvo"); setF(blank); setEdit(null); reload();
  }
  async function patch(id: string, p: Partial<Article>) { await supabase.from("articles").update(p).eq("id", id); reload(); }
  return (
    <div>
      <PageTitle eyebrow="Administração" title="Conteúdo" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {list.map((a) => (
            <div key={a.id} className="surface flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><p className="font-bold">{a.title}</p><p className="text-xs text-muted-foreground">{a.category} · {a.published ? "Publicado" : "Rascunho"}</p></div>
              <Button size="sm" variant={a.featured ? "default" : "outline"} onClick={() => patch(a.id, { featured: !a.featured })}>{a.featured ? "★ Destaque" : "Destacar"}</Button>
              <Button size="sm" variant="outline" onClick={() => patch(a.id, { published: !a.published })}>{a.published ? "Despublicar" : "Publicar"}</Button>
              <Button size="sm" variant="outline" onClick={() => { setEdit(a.id); setF({ title: a.title, category: a.category, excerpt: a.excerpt, body: a.body, cover_url: a.cover_url ?? "", video_url: a.video_url ?? "" }); }}>Editar</Button>
            </div>
          ))}
        </div>
        <form onSubmit={save} className="surface h-fit space-y-3 p-5">
          <p className="font-bold">{edit ? "Editar conteúdo" : "Novo conteúdo"}</p>
          <L t="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
          <L t="Categoria"><select className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{ARTICLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></L>
          <L t="Resumo"><Input value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></L>
          <L t="Imagem de capa (URL)"><Input value={f.cover_url} onChange={(e) => setF({ ...f, cover_url: e.target.value })} /></L>
          <L t="Vídeo (URL, opcional)"><Input value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} /></L>
          <L t="Texto"><Textarea rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></L>
          <div className="flex gap-2"><Button className="flex-1">Salvar</Button>{edit && <Button type="button" variant="outline" onClick={() => { setEdit(null); setF(blank); }}>Cancelar</Button>}</div>
        </form>
      </div>
    </div>
  );
}
