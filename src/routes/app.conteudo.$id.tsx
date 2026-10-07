import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Article } from "@/lib/club";

export const Route = createFileRoute("/app/conteudo/$id")({
  head: () => ({ meta: [{ title: "Artigo — Exotic Experience" }, { name: "description", content: "Conteúdo exclusivo para membros do clube EXOTIC." }, { property: "og:title", content: "Artigo — Exotic Experience" }, { property: "og:description", content: "Conteúdo exclusivo para membros do clube EXOTIC." }, { property: "og:type", content: "article" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ArticlePage,
});

function ArticlePage() {
  const { id } = Route.useParams();
  const { data: a, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: async () => (await supabase.from("articles").select("*").eq("id", id).maybeSingle()).data as Article | null,
  });
  if (isLoading) return null;
  if (!a) return <p className="text-muted-foreground">Conteúdo não encontrado.</p>;
  return (
    <article className="-mx-5 -mt-6 md:mx-auto md:mt-0 md:max-w-3xl">
      <div className="relative h-72 bg-ink md:rounded-3xl md:overflow-hidden">
        {a.cover_url && <img src={a.cover_url} alt="" className="h-full w-full object-cover" />}
        <Link to="/app/conteudo" className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-card/90"><ArrowLeft className="h-5 w-5" /></Link>
      </div>
      <div className="px-5 pt-6 md:px-0">
        <p className="eyebrow text-highlight">{a.category} · {new Date(a.created_at).toLocaleDateString("pt-BR")}</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight md:text-5xl">{a.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{a.excerpt}</p>
        {a.video_url && <a href={a.video_url} target="_blank" rel="noreferrer" className="mt-4 inline-block rounded-full bg-ink px-5 py-2 text-sm font-bold text-ink-foreground">▶ Assistir vídeo</a>}
        <div className="mt-6 whitespace-pre-line leading-relaxed">{a.body}</div>
      </div>
    </article>
  );
}
