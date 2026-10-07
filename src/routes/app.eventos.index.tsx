import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchEvents } from "@/lib/club";
import { EventCard } from "@/components/club-cards";
import { Empty, PageTitle } from "@/components/cards";

export const Route = createFileRoute("/app/eventos/")({
  head: () => ({ meta: [{ title: "Experiências — Exotic Experience" }, { name: "description", content: "Eventos, encontros, track days e jantares exclusivos para membros EXOTIC." }, { property: "og:title", content: "Experiências — Exotic Experience" }, { property: "og:description", content: "Eventos, encontros, track days e jantares exclusivos para membros EXOTIC." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Events,
});

function Events() {
  const [tab, setTab] = useState<"next" | "past">("next");
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const now = new Date();
  const list = tab === "past" ? events.filter((e) => new Date(e.starts_at) < now || e.status === "finished").reverse()
    : events.filter((e) => new Date(e.starts_at) >= now && e.status !== "finished");
  return (
    <div>
      <PageTitle eyebrow="Experiências EXOTIC" title="Eventos" subtitle="Encontros, jantares, track days e noites exclusivas." />
      <div className="mb-5 inline-flex rounded-full border bg-card p-1 text-sm font-bold">
        {([["next", "Próximos"], ["past", "Galeria"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 transition ${tab === k ? "bg-ink text-ink-foreground" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {list.length ? <div className="grid gap-4 md:grid-cols-2">{list.map((e) => <EventCard key={e.id} e={e} wide />)}</div>
        : <Empty text={tab === "past" ? "As fotos das experiências aparecerão aqui." : "Nenhum evento agendado no momento."} />}
    </div>
  );
}
