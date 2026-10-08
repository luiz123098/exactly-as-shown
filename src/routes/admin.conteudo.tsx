import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ARTICLE_CATEGORIES, ARTICLE_STATUS, type Article } from "@/lib/club";
import { syncNewsNow } from "@/lib/news.functions";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/admin/conteudo")({
  head: () => ({ meta: [{ title: "Gestão de conteúdo — Administração EXOTIC" }, { name: "description", content: "Curadoria da revista EXOTIC: notícias automáticas, conteúdo de parceiros e destaques." }, { property: "og:title", content: "Gestão de conteúdo — Administração EXOTIC" }, { property: "og:description", content: "Curadoria da revista EXOTIC: notícias automáticas, conteúdo de parceiros e destaques." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AdminContent,
});

const blank = { title: "", category: "Automotivo", excerpt: "", body: "", cover_url: "", video_url: "", tags: "", publish_at: "" };
const TABS = [["pending", "Pendentes"], ["published", "Publicados"], ["rejected", "Rejeitados"], ["all", "Todos"], ["sources", "Notícias automáticas"]] as const;
const sel = "h-9 rounded-md border bg-card px-2 text-xs";

function AdminContent() {
  const qc = useQueryClient();
  const sync = useServerFn(syncNewsNow);
  const [tab, setTab] = useState<string>("pending");
  const [origin, setOrigin] = useState("");
  const [f, setF] = useState(blank);
  const [edit, setEdit] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const { data: list = [] } = useQuery({ queryKey: ["admin-articles"], queryFn: async () => ((await supabase.from("articles").select("*").order("created_at", { ascending: false }).limit(300)).data ?? []) as Article[] });
  const { data: sources = [] } = useQuery({ queryKey: ["news-sources"], queryFn: async () => (await supabase.from("news_sources").select("*").order("name")).data ?? [] });
  const { data: settings } = useQuery({ queryKey: ["news-settings"], queryFn: async () => (await supabase.from("news_settings").select("*").eq("id", 1).maybeSingle()).data });
  const reload = () => ["admin-articles", "articles", "news-sources", "news-settings"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title) return void toast.error("Informe o título");
    const row = { ...f, cover_url: f.cover_url || null, video_url: f.video_url || null, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean), publish_at: f.publish_at ? new Date(f.publish_at).toISOString() : null };
    const { error } = edit ? await supabase.from("articles").update(row).eq("id", edit) : await supabase.from("articles").insert({ ...row, status: "published" });
    if (error) return void toast.error(error.message);
    toast.success("Conteúdo salvo"); setF(blank); setEdit(null); reload();
  }
  async function patch(id: string, p: Partial<Article>) { const { error } = await supabase.from("articles").update(p).eq("id", id); if (error) toast.error(error.message); reload(); }
  async function del(id: string) { if (confirm("Excluir este conteúdo?")) { await supabase.from("articles").delete().eq("id", id); reload(); } }
  async function runSync() {
    setSyncing(true);
    try { const r = await sync(); toast.success(`${r.imported} notícias novas importadas`); reload(); }
    catch (e) { toast.error((e as Error).message); } finally { setSyncing(false); }
  }

  const shown = list.filter((a) => (tab === "all" || a.status === tab || (tab === "pending" && a.status === "approved")) && (!origin || a.origin === origin));
  const counts = (s: string) => list.filter((a) => a.status === s).length;

  return (
    <div>
      <PageTitle eyebrow="Administração" title="Gestão de conteúdo" />
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${tab === k ? "border-ink bg-ink text-ink-foreground" : "bg-card"}`}>{l}{k !== "all" && k !== "sources" ? ` (${counts(k)})` : ""}</button>)}
      </div>

      {tab === "sources" ? (
        <SourcesPanel sources={sources} settings={settings} syncing={syncing} onSync={runSync} reload={reload} imported={list.filter((a) => a.origin === "auto").length} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-3">
            <select className={sel} value={origin} onChange={(e) => setOrigin(e.target.value)}>
              <option value="">Todas as origens</option><option value="auto">Notícias automáticas</option><option value="partner">Conteúdo dos parceiros</option><option value="editorial">Redação EXOTIC</option>
            </select>
            {shown.length === 0 && <p className="text-sm text-muted-foreground">Nada por aqui.</p>}
            {shown.map((a) => (
              <div key={a.id} className="surface space-y-2 p-4">
                <div className="flex gap-3">
                  {a.cover_url && <img src={a.cover_url} alt="" className="h-14 w-20 shrink-0 rounded-md object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 font-bold">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{{ auto: "Automática", partner: "Parceiro", editorial: "Redação" }[a.origin]} · {ARTICLE_STATUS[a.status]}{a.source_name ? ` · ${a.source_name}` : ""} · {new Date(a.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select className={sel} value={a.category} onChange={(e) => patch(a.id, { category: e.target.value })}>{ARTICLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                  {a.status !== "published" && <Button size="sm" onClick={() => patch(a.id, { status: "published" })}>Aprovar e publicar</Button>}
                  {a.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => patch(a.id, { status: "rejected" })}>{a.status === "published" ? "Despublicar" : "Rejeitar"}</Button>}
                  <Button size="sm" variant={a.featured ? "default" : "outline"} onClick={() => patch(a.id, { featured: !a.featured })}>{a.featured ? "★ Destaque" : "Destacar"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEdit(a.id); setF({ title: a.title, category: a.category, excerpt: a.excerpt, body: a.body, cover_url: a.cover_url ?? "", video_url: a.video_url ?? "", tags: a.tags.join(", "), publish_at: a.publish_at ? a.publish_at.slice(0, 16) : "" }); }}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => del(a.id)}>Excluir</Button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={save} className="surface h-fit space-y-3 p-5">
            <p className="font-bold">{edit ? "Editar conteúdo" : "Novo conteúdo da redação"}</p>
            <L t="Título"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></L>
            <L t="Categoria"><select className="h-10 w-full rounded-md border bg-card px-3 text-sm" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{ARTICLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></L>
            <L t="Resumo"><Input value={f.excerpt} onChange={(e) => setF({ ...f, excerpt: e.target.value })} /></L>
            <L t="Imagem de capa (URL)"><Input value={f.cover_url} onChange={(e) => setF({ ...f, cover_url: e.target.value })} /></L>
            <L t="Vídeo (URL, opcional)"><Input value={f.video_url} onChange={(e) => setF({ ...f, video_url: e.target.value })} /></L>
            <L t="Tags (vírgula)"><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></L>
            <L t="Programar publicação (opcional)"><Input type="datetime-local" value={f.publish_at} onChange={(e) => setF({ ...f, publish_at: e.target.value })} /></L>
            <L t="Texto"><Textarea rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></L>
            <div className="flex gap-2"><Button className="flex-1">Salvar</Button>{edit && <Button type="button" variant="outline" onClick={() => { setEdit(null); setF(blank); }}>Cancelar</Button>}</div>
          </form>
        </div>
      )}
    </div>
  );
}

type Source = { id: string; name: string; url: string; category: string; active: boolean; last_synced_at: string | null; last_status: string | null; last_count: number };
type Settings = { interval_minutes: number; auto_publish: boolean; min_score: number; last_run_at: string | null } | null | undefined;

function SourcesPanel({ sources, settings, syncing, onSync, reload, imported }: { sources: Source[]; settings: Settings; syncing: boolean; onSync: () => void; reload: () => void; imported: number }) {
  const [n, setN] = useState({ name: "", url: "", category: "Automotivo" });
  async function add() {
    if (!n.name || !/^https?:\/\//.test(n.url)) return void toast.error("Informe nome e URL do feed");
    const { error } = await supabase.from("news_sources").insert(n);
    if (error) return void toast.error(error.message);
    setN({ name: "", url: "", category: "Automotivo" }); reload();
  }
  async function set(p: Partial<NonNullable<Settings>>) { await supabase.from("news_settings").update(p).eq("id", 1); reload(); }
  return (
    <div className="space-y-6">
      <div className="surface grid gap-3 p-5 sm:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Última atualização</p><p className="font-bold">{settings?.last_run_at ? new Date(settings.last_run_at).toLocaleString("pt-BR") : "—"}</p></div>
        <div><p className="text-xs text-muted-foreground">Notícias importadas</p><p className="font-bold">{imported}</p></div>
        <L t="Intervalo (min)"><Input type="number" min={15} max={1440} defaultValue={settings?.interval_minutes ?? 60} onBlur={(e) => set({ interval_minutes: Math.min(1440, Math.max(15, +e.target.value || 60)) })} /></L>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings?.auto_publish ?? true} onChange={(e) => set({ auto_publish: e.target.checked })} />Publicar automaticamente as relevantes</label>
        <Button className="sm:col-span-4" disabled={syncing} onClick={onSync}>{syncing ? "Sincronizando…" : "Sincronizar agora"}</Button>
      </div>
      <div className="space-y-2">
        {sources.map((s) => (
          <div key={s.id} className="surface flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1"><p className="font-bold">{s.name}</p><p className="truncate text-xs text-muted-foreground">{s.url}</p><p className="text-xs text-muted-foreground">{s.category} · {s.last_synced_at ? `${new Date(s.last_synced_at).toLocaleString("pt-BR")} · ${s.last_status} · ${s.last_count} novas` : "Nunca sincronizada"}</p></div>
            <Button size="sm" variant="outline" onClick={async () => { await supabase.from("news_sources").update({ active: !s.active }).eq("id", s.id); reload(); }}>{s.active ? "Ativa" : "Inativa"}</Button>
            <Button size="sm" variant="ghost" onClick={async () => { await supabase.from("news_sources").delete().eq("id", s.id); reload(); }}>Remover</Button>
          </div>
        ))}
      </div>
      <div className="surface grid gap-2 p-5 sm:grid-cols-[1fr_2fr_auto_auto]">
        <Input placeholder="Nome da fonte" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <Input placeholder="URL do feed RSS" value={n.url} onChange={(e) => setN({ ...n, url: e.target.value })} />
        <select className="h-10 rounded-md border bg-card px-2 text-sm" value={n.category} onChange={(e) => setN({ ...n, category: e.target.value })}>{ARTICLE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <Button onClick={add}>Adicionar fonte</Button>
      </div>
    </div>
  );
}
