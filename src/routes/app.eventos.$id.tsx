import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, Clock, Crown, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtTime, type ClubEvent } from "@/lib/club";
import { planLabel } from "@/lib/auth";
import { EventInfoButton } from "@/components/club-cards";

export const Route = createFileRoute("/app/eventos/$id")({
  head: () => ({ meta: [{ title: "Evento — Exotic Experience" }, { name: "description", content: "Detalhes de uma experiência exclusiva EXOTIC e contato direto pelo WhatsApp." }, { property: "og:title", content: "Evento — Exotic Experience" }, { property: "og:description", content: "Detalhes de uma experiência exclusiva EXOTIC e contato direto pelo WhatsApp." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => (await supabase.from("events").select("*").eq("id", id).maybeSingle()).data as ClubEvent | null,
  });
  if (isLoading) return null;
  const ev = data;
  if (!ev) return <p className="text-muted-foreground">Evento não encontrado.</p>;
  const past = new Date(ev.starts_at) < new Date() || ev.status === "finished";

  return (
    <div className="-mx-5 -mt-6 md:mx-0 md:mt-0">
      <div className="relative h-80 overflow-hidden bg-ink md:rounded-3xl">
        {ev.image_url && <img src={ev.image_url} alt={ev.title} className="h-full w-full object-cover opacity-80" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
        <Link to="/app/eventos" aria-label="Voltar" className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-card/90"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="absolute inset-x-0 bottom-0 p-5 text-ink-foreground">
          <span className="rounded-full bg-highlight px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink">{ev.kind}</span>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">{ev.title}</h1>
        </div>
      </div>
      <div className="space-y-6 px-5 pt-6 pb-8 md:px-0">
        <div className="grid grid-cols-2 gap-2 text-center">
          <Info icon={<Calendar className="h-4 w-4" />} top={fmtDate(ev.starts_at)} sub="Data" />
          <Info icon={<Clock className="h-4 w-4" />} top={fmtTime(ev.starts_at)} sub="Horário" />
        </div>
        <p className="flex items-center gap-2 text-sm font-semibold"><Crown className="h-4 w-4 text-highlight" />
          {ev.min_plan_level > 0 ? `Exclusivo para membros ${planLabel(ev.min_plan_level)}` : "Exclusivo para membros EXOTIC"}</p>
        <div><p className="eyebrow mb-2 text-muted-foreground">Sobre o evento</p><p className="whitespace-pre-line leading-relaxed">{ev.description}</p></div>
        <div className="surface flex gap-3 p-4 text-sm"><Sparkles className="h-5 w-5 shrink-0 text-highlight" />
          <p className="text-muted-foreground">Fale com a equipe EXOTIC para saber disponibilidade, como participar e todas as experiências preparadas para este evento.</p></div>
        {past && <p className="text-center text-sm text-muted-foreground">Este evento já aconteceu.</p>}
        <EventInfoButton title={ev.title} className="w-full py-4 text-sm" />
      </div>
    </div>
  );
}

function Info({ icon, top, sub }: { icon: React.ReactNode; top: string; sub: string }) {
  return (
    <div className="surface p-3">
      <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-ink text-highlight">{icon}</div>
      <p className="mt-2 text-sm font-bold capitalize">{top}</p>
      <p className="text-[0.65rem] text-muted-foreground">{sub}</p>
    </div>
  );
}
