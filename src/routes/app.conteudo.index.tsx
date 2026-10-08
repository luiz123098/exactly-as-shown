import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ARTICLE_CATEGORIES, fetchArticles, timeAgo } from "@/lib/club";
import { ArticleCard, OriginBadge } from "@/components/club-cards";
import { Empty } from "@/components/cards";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/app/conteudo/")({
  head: () => ({ meta: [{ title: "Notícias EXOTIC — Revista digital" }, { name: "description", content: "Revista digital EXOTIC: automotivo, lifestyle, business, experiências e novidades dos parceiros." }, { property: "og:title", content: "Notícias EXOTIC — Revista digital" }, { property: "og:description", content: "Revista digital EXOTIC: automotivo, lifestyle, business, experiências e novidades dos parceiros." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Magazine,
});

function Magazine() {
  const { user } = useAuth();
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const { data: all = [] } = useQuery({ queryKey: ["articles"], queryFn: fetchArticles });
  // Personalization groundwork: count categories the member reads most
  const { data: prefs = {} } = useQuery({
    queryKey: ["article-prefs", user?.id], enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("article_reads").select("category").eq("user_id", user!.id).limit(200);
      return (data ?? []).reduce<Record<string, number>>((m, r) => ({ ...m, [r.category]: (m[r.category] ?? 0) + 1 }), {});
    },
  });
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((a) => (!cat || a.category === cat) && (!term || `${a.title} ${a.excerpt} ${a.tags.join(" ")} ${a.source_name ?? ""}`.toLowerCase().includes(term)));
  }, [all, cat, q]);
  const highlights = [...list].sort((a, b) => Number(b.featured) - Number(a.featured) || (prefs[b.category] ?? 0) - (prefs[a.category] ?? 0)).slice(0, 4);
  const [top, ...more] = highlights;
  const latest = list.filter((a) => !highlights.includes(a));

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-5xl font-extrabold tracking-tighter">EXOTIC</h1>
        <p className="eyebrow mt-1 text-muted-foreground">Automotive • Lifestyle • Business • Experiences</p>
      </header>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar carros, marcas, parceiros, assuntos…" className="pl-9" />
      </div>
      <div className="no-scrollbar -mx-5 mb-6 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
        {["", ...ARTICLE_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${cat === c ? "border-ink bg-ink text-ink-foreground" : "bg-card"}`}>{c || "Todos"}</button>
        ))}
      </div>
      {!top ? <Empty text="Nenhum conteúdo encontrado." /> : (
        <>
          <p className="eyebrow mb-3">Destaques</p>
          <Link to="/app/conteudo/$id" params={{ id: top.id }} className="relative mb-4 block h-96 overflow-hidden rounded-3xl bg-ink text-ink-foreground">
            {top.cover_url && <img src={top.cover_url} alt="" className="h-full w-full object-cover opacity-75" />}
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="flex items-center gap-2"><p className="eyebrow text-highlight">{top.category}</p><OriginBadge a={top} /></div>
              <h2 className="mt-1 text-3xl font-extrabold leading-tight">{top.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm opacity-80">{top.excerpt}</p>
              <p className="mt-2 text-xs opacity-60">{timeAgo(top.created_at)}{top.source_name ? ` · ${top.source_name}` : ""}</p>
            </div>
          </Link>
          {more.length > 0 && <div className="no-scrollbar -mx-5 mb-8 flex snap-x gap-3 overflow-x-auto px-5 md:mx-0 md:px-0">{more.map((a) => <ArticleCard key={a.id} a={a} />)}</div>}
          {latest.length > 0 && (
            <>
              <p className="eyebrow mb-1">Últimas notícias</p>
              <div className="surface divide-y px-4">{latest.map((a) => <ArticleCard key={a.id} a={a} row />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}
