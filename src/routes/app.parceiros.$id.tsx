import { lazy, Suspense } from "react";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Globe, Instagram, MapPin, MessageCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BenefitCard, PromoCard, type Benefit, type Promotion } from "@/components/cards";
import { Button } from "@/components/ui/button";

const SponsorMap = lazy(() => import("@/components/sponsor-map"));

export const Route = createFileRoute("/app/parceiros/$id")({ component: SponsorPage });

function SponsorPage() {
  const { id } = Route.useParams();
  const { data: s } = useQuery({
    queryKey: ["sponsor", id],
    queryFn: async () => (await supabase.from("sponsors").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: benefits = [] } = useQuery({
    queryKey: ["sponsor-benefits", id],
    queryFn: async () => ((await supabase.from("benefits").select("*, sponsor:sponsors(id,name,city,category,cover_url)").eq("sponsor_id", id).eq("active", true)).data ?? []) as unknown as Benefit[],
  });
  const { data: promos = [] } = useQuery({
    queryKey: ["sponsor-promos", id],
    queryFn: async () => ((await supabase.from("promotions").select("*, sponsor:sponsors(id,name,city,category,cover_url)").eq("sponsor_id", id).eq("status", "approved")).data ?? []) as unknown as Promotion[],
  });
  if (!s) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  return (
    <div className="space-y-10">
      <div className="relative overflow-hidden rounded-3xl bg-ink text-ink-foreground">
        {s.cover_url && <img src={s.cover_url} alt={s.name} className="absolute inset-0 h-full w-full object-cover opacity-60" />}
        <div className="hero-overlay absolute inset-0" />
        <div className="relative p-8 pt-40 md:p-12 md:pt-56">
          <p className="eyebrow text-highlight">{s.category}</p>
          <h1 className="mt-2 font-display text-5xl md:text-6xl">{s.name}</h1>
          <p className="mt-3 max-w-2xl text-ink-foreground/75">{s.description}</p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-10">
          <div>
            <h2 className="mb-4 font-display text-3xl">Benefícios</h2>
            <div className="grid gap-5 sm:grid-cols-2">{benefits.map((b) => <BenefitCard key={b.id} b={b} />)}</div>
          </div>
          {promos.length > 0 && (
            <div>
              <h2 className="mb-4 font-display text-3xl">Promoções</h2>
              <div className="grid gap-5 sm:grid-cols-2">{promos.map((p) => <PromoCard key={p.id} p={p} />)}</div>
            </div>
          )}
        </div>
        <aside className="surface h-fit space-y-4 p-6 text-sm">
          <Info icon={MapPin} text={`${s.address}, ${s.city}`} />
          {s.hours && <Info icon={Clock} text={s.hours} />}
          {s.phone && <Info icon={Phone} text={s.phone} />}
          {s.instagram && <Info icon={Instagram} text={s.instagram} />}
          {s.website && <Info icon={Globe} text={s.website} />}
          {s.whatsapp && (
            <Button asChild className="w-full">
              <a href={`https://wa.me/55${encodeURIComponent(s.whatsapp)}`} target="_blank" rel="noreferrer"><MessageCircle /> WhatsApp</a>
            </Button>
          )}
          {s.lat != null && (
            <div className="overflow-hidden rounded-xl border">
              <ClientOnly fallback={<div className="h-[200px] bg-secondary" />}>
                <Suspense fallback={<div className="h-[200px] bg-secondary" />}>
                  <SponsorMap sponsors={[s]} height={200} />
                </Suspense>
              </ClientOnly>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ icon: Icon, text }: { icon: typeof MapPin; text: string }) {
  return <p className="flex items-start gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{text}</p>;
}
