import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { ArrowLeft, Calendar, MapPin, Minus, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brl, fmtDate, fmtTime, type ClubEvent } from "@/lib/club";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/eventos/$id")({
  head: () => ({ meta: [{ title: "Experiência — Exotic Experience" }, { name: "description", content: "Detalhes e inscrição em uma experiência exclusiva EXOTIC." }, { property: "og:title", content: "Experiência — Exotic Experience" }, { property: "og:description", content: "Detalhes e inscrição em uma experiência exclusiva EXOTIC." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const { user, level } = useAuth();
  const qc = useQueryClient();
  const [guests, setGuests] = useState(0);
  const [busy, setBusy] = useState(false);
  const { data } = useQuery({
    queryKey: ["event", id, user?.id],
    queryFn: async () => {
      const [e, taken, reg] = await Promise.all([
        supabase.from("events").select("*").eq("id", id).maybeSingle(),
        supabase.rpc("event_taken", { _event: id }),
        supabase.from("event_registrations").select("*").eq("event_id", id).eq("user_id", user!.id).maybeSingle(),
      ]);
      const ev = e.data as ClubEvent | null;
      const partners = ev?.sponsor_ids?.length ? (await supabase.from("sponsors").select("id,name,category").in("id", ev.sponsor_ids)).data ?? [] : [];
      return { ev, taken: (taken.data as number) ?? 0, reg: reg.data, partners };
    },
  });
  if (!data) return null;
  const { ev, taken, reg, partners } = data;
  if (!ev) return <p className="text-muted-foreground">Evento não encontrado.</p>;
  const left = Math.max(ev.capacity - taken, 0);
  const confirmed = reg?.status === "confirmed";
  const past = new Date(ev.starts_at) < new Date() || ev.status === "finished";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["event", id] }); qc.invalidateQueries({ queryKey: ["my-regs"] }); };

  async function join() {
    if (guests + 1 > left) return void toast.error("Não há vagas suficientes.");
    setBusy(true);
    const { error } = reg
      ? await supabase.from("event_registrations").update({ status: "confirmed", guests }).eq("id", reg.id)
      : await supabase.from("event_registrations").insert({ event_id: id, user_id: user!.id, guests });
    setBusy(false);
    if (error) return void toast.error(level < ev!.min_plan_level ? "Seu plano não dá acesso a este evento." : "Ative sua assinatura para participar.");
    toast.success(ev!.price > 0 ? "Presença reservada! Pagamento será feito no check-in." : "Presença confirmada!");
    refresh();
  }
  async function cancel() {
    await supabase.from("event_registrations").update({ status: "cancelled" }).eq("id", reg!.id);
    toast("Participação cancelada"); refresh();
  }

  return (
    <div className="-mx-5 -mt-6 md:mx-0 md:mt-0">
      <div className="relative h-80 overflow-hidden bg-ink md:rounded-3xl">
        {ev.image_url && <img src={ev.image_url} alt={ev.title} className="h-full w-full object-cover opacity-80" />}
        <div className="absolute inset-0 bg-gradient-to-t from-ink to-transparent" />
        <Link to="/app/eventos" className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-card/90"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="absolute inset-x-0 bottom-0 p-5 text-ink-foreground">
          <span className="rounded-full bg-highlight px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-ink">{ev.kind}</span>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight md:text-5xl">{ev.title}</h1>
        </div>
      </div>
      <div className="space-y-6 px-5 pt-6 md:px-0">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Info icon={<Calendar className="h-4 w-4" />} top={fmtDate(ev.starts_at)} sub={fmtTime(ev.starts_at)} />
          <Info icon={<Users className="h-4 w-4" />} top={`${left} vagas`} sub={`de ${ev.capacity}`} />
          <Info icon={<span className="text-xs font-black">R$</span>} top={ev.price > 0 ? brl(ev.price) : "Incluso"} sub="por pessoa" />
        </div>
        <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-highlight" /> {ev.location}</p>
        <p className="leading-relaxed text-muted-foreground">{ev.description}</p>
        {partners.length > 0 && (
          <div><p className="eyebrow mb-2 text-muted-foreground">Parceiros envolvidos</p>
            <div className="flex flex-wrap gap-2">{partners.map((p) => <Link key={p.id} to="/app/parceiros/$id" params={{ id: p.id }} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{p.name}</Link>)}</div>
          </div>
        )}
        {confirmed ? (
          <div className="member-card rounded-3xl p-6 text-center">
            <p className="eyebrow opacity-70">Seu ingresso · check-in</p>
            <div className="mx-auto mt-4 w-fit rounded-2xl bg-ink-foreground p-3"><QRCodeSVG value={`EXOTIC-EVT:${ev.id}:${reg!.code}`} size={160} /></div>
            <p className="mt-3 font-mono text-2xl font-bold tracking-widest">{reg!.code}</p>
            <p className="mt-1 text-sm opacity-70">{reg!.guests ? `Você + ${reg!.guests} acompanhante(s)` : "Somente você"}</p>
            {!past && <Button variant="outline" className="mt-5 text-foreground" onClick={cancel}>Cancelar participação</Button>}
          </div>
        ) : past ? (
          <p className="surface p-5 text-center text-sm text-muted-foreground">Este evento já aconteceu.</p>
        ) : ev.status !== "open" || left === 0 ? (
          <p className="surface p-5 text-center text-sm font-semibold">Inscrições encerradas</p>
        ) : (
          <div className="surface space-y-4 p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Acompanhantes</span>
              <div className="flex items-center gap-3">
                <button aria-label="Menos" onClick={() => setGuests(Math.max(0, guests - 1))} className="grid h-9 w-9 place-items-center rounded-full border"><Minus className="h-4 w-4" /></button>
                <span className="w-4 text-center font-bold">{guests}</span>
                <button aria-label="Mais" onClick={() => setGuests(Math.min(3, guests + 1))} className="grid h-9 w-9 place-items-center rounded-full border"><Plus className="h-4 w-4" /></button>
              </div>
            </div>
            {ev.price > 0 && <p className="text-sm text-muted-foreground">Total: <strong className="text-foreground">{brl(ev.price * (guests + 1))}</strong></p>}
            <Button size="lg" className="w-full" disabled={busy} onClick={join}>{ev.price > 0 ? "Garantir ingresso" : "Participar"}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ icon, top, sub }: { icon: React.ReactNode; top: string; sub: string }) {
  return (
    <div className="surface p-3">
      <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-ink text-highlight">{icon}</div>
      <p className="mt-2 text-sm font-bold">{top}</p>
      <p className="text-[0.65rem] text-muted-foreground">{sub}</p>
    </div>
  );
}
