import { Link } from "@tanstack/react-router";
import { Calendar, MessageCircle } from "lucide-react";
import { eventWhatsappUrl, fmtDate, fmtTime, type Article, type ClubEvent } from "@/lib/club";

export function EventInfoButton({ title, className = "" }: { title: string; className?: string }) {
  return (
    <a href={eventWhatsappUrl(title)}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-highlight px-4 py-2.5 text-xs font-extrabold uppercase tracking-wider text-ink ${className}`}>
      <MessageCircle className="h-4 w-4" />Obter mais informações
    </a>
  );
}

export function EventCard({ e, wide }: { e: ClubEvent; wide?: boolean }) {
  return (
    <article className={`surface overflow-hidden ${wide ? "" : "w-[80%] shrink-0 snap-start sm:w-[340px]"}`}>
      <Link to="/app/eventos/$id" params={{ id: e.id }} className="group relative block aspect-[16/10] overflow-hidden bg-ink">
        {e.image_url && <img src={e.image_url} alt={e.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
        <span className="absolute left-3 top-3 rounded-full bg-highlight px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink">{e.kind}</span>
      </Link>
      <div className="p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Calendar className="h-3.5 w-3.5 text-highlight" />{fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}</p>
        <Link to="/app/eventos/$id" params={{ id: e.id }}><h3 className="mt-1 text-lg font-extrabold leading-tight">{e.title}</h3></Link>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.description}</p>
        <EventInfoButton title={e.title} className="mt-3 w-full" />
      </div>
    </article>
  );
}

export function ArticleCard({ a, row }: { a: Article; row?: boolean }) {
  if (row)
    return (
      <Link to="/app/conteudo/$id" params={{ id: a.id }} className="flex gap-3 py-3">
        <div className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-ink">
          {a.cover_url && <img src={a.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </div>
        <div className="min-w-0">
          <p className="eyebrow text-[0.6rem] text-highlight">{a.category}</p>
          <p className="line-clamp-2 font-bold leading-snug">{a.title}</p>
          <p className="line-clamp-1 text-xs text-muted-foreground">{a.excerpt}</p>
        </div>
      </Link>
    );
  return (
    <Link to="/app/conteudo/$id" params={{ id: a.id }} className="surface group block w-[75%] shrink-0 snap-start overflow-hidden sm:w-[300px]">
      <div className="aspect-[16/10] overflow-hidden bg-ink">
        {a.cover_url && <img src={a.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
      </div>
      <div className="p-4">
        <p className="eyebrow text-[0.6rem] text-highlight">{a.category}</p>
        <p className="mt-1 line-clamp-2 font-bold leading-snug">{a.title}</p>
      </div>
    </Link>
  );
}
