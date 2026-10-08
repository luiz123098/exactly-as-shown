import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchArticles, type Article } from "@/lib/club";
import { useAuth } from "@/lib/auth";
import { ArticleCard, OriginBadge } from "@/components/club-cards";

export const Route = createFileRoute("/app/conteudo/$id")({
  head: () => ({ meta: [{ title: "Notícia — Revista EXOTIC" }, { name: "description", content: "Leia na revista digital EXOTIC." }, { property: "og:title", content: "Notícia — Revista EXOTIC" }, { property: "og:description", content: "Leia na revista digital EXOTIC." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ArticlePage,
});

function ArticlePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const { data: a, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: async () => (await supabase.from("articles").select("*").eq("id", id).maybeSingle()).data as Article | null,
  });
  const { data: all = [] } = useQuery({ queryKey: ["articles"], queryFn: fetchArticles });
  const { data: sponsor } = useQuery({
    queryKey: ["article-sponsor", a?.sponsor_id], enabled: !!a?.sponsor_id,
    queryFn: async () => (await supabase.from("sponsors").select("id,name").eq("id", a!.sponsor_id!).maybeSingle()).data,
  });
  useEffect(() => {
    if (user && a) void supabase.from("article_reads").upsert({ user_id: user.id, article_id: a.id, category: a.category, read_at: new Date().toISOString() });
  }, [user, a]);
  if (isLoading) return null;
  if (!a) return <p className="text-muted-foreground">Conteúdo não encontrado.</p>;
  const related = all.filter((x) => x.id !== a.id).map((x) => ({ x, s: x.tags.filter((t) => a.tags.includes(t)).length * 2 + (x.category === a.category ? 1 : 0) }))
    .filter((r) => r.s > 0).sort((p, q) => q.s - p.s).slice(0, 4).map((r) => r.x);
  const origin = a.origin === "partner" ? `Parceiro EXOTIC${sponsor ? ` · ${sponsor.name}` : ""}` : a.source_name ?? "Redação EXOTIC";
  return (
    <article className="-mx-5 -mt-6 md:mx-auto md:mt-0 md:max-w-3xl">
      <div className="relative h-72 bg-ink md:overflow-hidden md:rounded-3xl">
        {a.cover_url && <img src={a.cover_url} alt="" className="h-full w-full object-cover" />}
        <Link to="/app/conteudo" aria-label="Voltar" className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-card/90"><ArrowLeft className="h-5 w-5" /></Link>
      </div>
      <div className="px-5 pt-6 md:px-0">
        <div className="flex flex-wrap items-center gap-2"><p className="eyebrow text-highlight">{a.category}</p><OriginBadge a={a} /></div>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-5xl">{a.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString("pt-BR", { dateStyle: "long", timeStyle: "short" })} · {origin}</p>
        <p className="mt-4 text-lg text-muted-foreground">{a.excerpt}</p>
        {a.video_url && <a href={a.video_url} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm font-bold text-ink-foreground">▶ Assistir vídeo</a>}
        {a.body && <div className="mt-6 whitespace-pre-line leading-relaxed">{a.body}</div>}
        {a.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{a.tags.map((t) => <span key={t} className="rounded-full border px-3 py-1 text-xs">#{t}</span>)}</div>}
        {a.source_name && <p className="mt-6 text-sm font-semibold">Fonte: {a.source_name}</p>}
        {a.external_url && (
          <a href={a.external_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-ink-foreground">
            Ler conteúdo completo na fonte original <ExternalLink className="h-4 w-4" />
          </a>
        )}
        {a.sponsor_id && (
          <Link to="/app/parceiros/$id" params={{ id: a.sponsor_id }} className="mt-3 inline-flex rounded-full bg-highlight px-5 py-3 text-sm font-bold text-ink">Conheça este parceiro →</Link>
        )}
        {a.cta_kind === "event" && a.cta_id && (
          <Link to="/app/eventos/$id" params={{ id: a.cta_id }} className="ml-2 mt-3 inline-flex rounded-full bg-highlight px-5 py-3 text-sm font-bold text-ink">Ver evento →</Link>
        )}
        {related.length > 0 && (
          <section className="mt-10">
            <p className="eyebrow mb-1">Leia também</p>
            <div className="surface divide-y px-4">{related.map((r) => <ArticleCard key={r.id} a={r} row />)}</div>
          </section>
        )}
      </div>
    </article>
  );
}
