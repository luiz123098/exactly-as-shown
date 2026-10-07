import { Link } from "@tanstack/react-router";
import { Calendar, MapPin } from "lucide-react";
import { brl, fmtDate, fmtTime, type Article, type ClubEvent } from "@/lib/club";

export function EventCard({ e, wide }: { e: ClubEvent; wide?: boolean }) {
  return (
    <Link to="/app/eventos/$id" params={{ id: e.id }}
      className={`group relative block overflow-hidden rounded-3xl bg-ink text-ink-foreground ${wide ? "h-72" : "h-64 w-[80%] shrink-0 snap-start sm:w-[340px]"}`}>
      {e.image_url && <img src={e.image_url} alt={e.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105" />}
      <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="absolute left-4 top-4 flex gap-1.5">
        <span className="rounded-full bg-highlight px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink">{e.kind}</span>
        {e.status !== "open" && <span className="rounded-full bg-card/90 px-3 py-1 text-[0.65rem] font-bold text-foreground">{e.status === "closed" ? "Esgotado" : "Encerrado"}</span>}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-highlight"><Calendar className="h-3.5 w-3.5" /> {fmtDate(e.starts_at)} · {fmtTime(e.starts_at)}</p>
        <h3 className="mt-1 text-xl font-extrabold leading-tight">{e.title}</h3>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs opacity-80">
          <span className="flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0" />{e.location}</span>
          <span className="shrink-0 font-bold">{e.price > 0 ? brl(e.price) : "Incluso"}</span>
        </div>
      </div>
    </Link>
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
