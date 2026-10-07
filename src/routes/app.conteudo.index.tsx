import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ARTICLE_CATEGORIES, fetchArticles } from "@/lib/club";
import { ArticleCard } from "@/components/club-cards";
import { Empty, PageTitle } from "@/components/cards";

export const Route = createFileRoute("/app/conteudo/")({
  head: () => ({ meta: [{ title: "Conteúdo EXOTIC — Exotic Experience" }, { name: "description", content: "Notícias, guias, entrevistas e lifestyle para membros EXOTIC." }, { property: "og:title", content: "Conteúdo EXOTIC — Exotic Experience" }, { property: "og:description", content: "Notícias, guias, entrevistas e lifestyle para membros EXOTIC." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Content,
});

function Content() {
  const [cat, setCat] = useState("");
  const { data: all = [] } = useQuery({ queryKey: ["articles"], queryFn: fetchArticles });
  const list = cat ? all.filter((a) => a.category === cat) : all;
  const [top, ...rest] = list;
  return (
    <div>
      <PageTitle eyebrow="Conteúdo EXOTIC" title="Revista" />
      <div className="no-scrollbar -mx-5 mb-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
        {["", ...ARTICLE_CATEGORIES].map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold ${cat === c ? "border-ink bg-ink text-ink-foreground" : "bg-card"}`}>{c || "Tudo"}</button>
        ))}
      </div>
      {!top ? <Empty text="Nenhum conteúdo nesta categoria ainda." /> : (
        <>
          <Link to="/app/conteudo/$id" params={{ id: top.id }} className="relative mb-6 block h-80 overflow-hidden rounded-3xl bg-ink text-ink-foreground">
            {top.cover_url && <img src={top.cover_url} alt="" className="h-full w-full object-cover opacity-75" />}
            <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="eyebrow text-highlight">{top.category}</p>
              <h2 className="mt-1 text-3xl font-extrabold leading-tight">{top.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm opacity-80">{top.excerpt}</p>
            </div>
          </Link>
          <div className="surface divide-y px-4">{rest.map((a) => <ArticleCard key={a.id} a={a} row />)}</div>
        </>
      )}
    </div>
  );
}
