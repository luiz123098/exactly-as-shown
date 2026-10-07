import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchEvents } from "@/lib/club";
import { EventCard } from "@/components/club-cards";
import { Empty, PageTitle } from "@/components/cards";

export const Route = createFileRoute("/app/eventos/")({
  head: () => ({ meta: [{ title: "Experiências — Exotic Experience" }, { name: "description", content: "Eventos, encontros, track days e jantares exclusivos para membros EXOTIC." }, { property: "og:title", content: "Experiências — Exotic Experience" }, { property: "og:description", content: "Eventos, encontros, track days e jantares exclusivos para membros EXOTIC." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Events,
});

function Events() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"next" | "mine" | "past">("next");
  const { data: events = [] } = useQuery({ queryKey: ["events"], queryFn: fetchEvents });
  const { data: mine = [] } = useQuery({
    queryKey: ["my-regs", user?.id], enabled: !!user,
    queryFn: async () => (await supabase.from("event_registrations").select("event_id").eq("user_id", user!.id).eq("status", "confirmed")).data ?? [],
  });
  const mineIds = new Set(mine.map((r) => r.event_id));
  const now = new Date();
  const list = tab === "mine" ? events.filter((e) => mineIds.has(e.id))
    : tab === "past" ? events.filter((e) => new Date(e.starts_at) < now || e.status === "finished").reverse()
    : events.filter((e) => new Date(e.starts_at) >= now && e.status !== "finished");
  return (
    <div>
      <PageTitle eyebrow="Experiências EXOTIC" title="Eventos" subtitle="Encontros, jantares, track days e noites exclusivas." />
      <div className="mb-5 inline-flex rounded-full border bg-card p-1 text-sm font-bold">
        {([["next", "Próximos"], ["mine", `Meus eventos${mineIds.size ? ` (${mineIds.size})` : ""}`], ["past", "Galeria"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 transition ${tab === k ? "bg-ink text-ink-foreground" : "text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {list.length ? <div className="grid gap-4 md:grid-cols-2">{list.map((e) => <EventCard key={e.id} e={e} wide />)}</div>
        : <Empty text={tab === "mine" ? "Você ainda não confirmou presença em nenhum evento." : tab === "past" ? "As fotos das experiências aparecerão aqui." : "Nenhum evento agendado no momento."} />}
    </div>
  );
}
