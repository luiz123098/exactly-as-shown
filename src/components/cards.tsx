import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Lock, MapPin, Ticket } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type SponsorLite = { id: string; name: string; city: string; category: string; cover_url: string | null };
export type Benefit = {
  id: string;
  title: string;
  description: string;
  discount_label: string;
  rules: string | null;
  category: string;
  min_plan_level: number;
  expires_at: string | null;
  sponsor: SponsorLite | null;
};
export type Promotion = {
  id: string;
  title: string;
  description: string;
  discount_label: string;
  image_url: string | null;
  category: string;
  min_plan_level: number;
  ends_at: string | null;
  featured: boolean;
  sponsor: SponsorLite | null;
};

export function LevelTag({ level }: { level: number }) {
  return level >= 2 ? (
    <span className="eyebrow rounded-full bg-ink px-2.5 py-1 text-[0.6rem] text-ink-foreground">Premium</span>
  ) : null;
}

export function BenefitCard({
  b,
  favorite,
  onToggleFav,
}: {
  b: Benefit;
  favorite?: boolean;
  onToggleFav?: () => void;
}) {
  const { user, level } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const locked = level < b.min_plan_level;

  async function use() {
    if (!user) return;
    const c = "EX-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("benefit_usages").insert({ user_id: user.id, benefit_id: b.id, code: c });
    if (error) return toast.error("Seu plano não dá acesso a este benefício.");
    setCode(c);
  }

  return (
    <div className="surface group flex flex-col p-5 transition hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-muted-foreground">{b.category}</p>
          {b.sponsor && (
            <Link to="/app/parceiros/$id" params={{ id: b.sponsor.id }} className="mt-1 block text-sm font-semibold hover:text-primary">
              {b.sponsor.name}
            </Link>
          )}
        </div>
        {onToggleFav && (
          <button onClick={onToggleFav} aria-label="Favoritar" className="rounded-full p-2 hover:bg-secondary">
            <Heart className={`h-4 w-4 ${favorite ? "fill-primary text-primary" : "text-muted-foreground"}`} />
          </button>
        )}
      </div>
      <p className="mt-4 font-display text-4xl text-primary">{b.discount_label}</p>
      <h3 className="mt-1 font-semibold">{b.title}</h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
      <div className="mt-auto flex items-center justify-between pt-5">
        <div className="flex items-center gap-2">
          <LevelTag level={b.min_plan_level} />
          {b.sponsor && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {b.sponsor.city}
            </span>
          )}
        </div>
        {locked ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/app/assinatura"><Lock /> Desbloquear</Link>
          </Button>
        ) : (
          <Button size="sm" onClick={use}><Ticket /> Usar</Button>
        )}
      </div>
      <Dialog open={!!code} onOpenChange={(o) => !o && setCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benefício ativado</DialogTitle>
            <DialogDescription>Apresente este código no estabelecimento {b.sponsor?.name}.</DialogDescription>
          </DialogHeader>
          <div className="member-card rounded-2xl p-8 text-center">
            <p className="eyebrow opacity-70">{b.title}</p>
            <p className="mt-3 font-mono text-4xl font-bold tracking-widest">{code}</p>
            <p className="mt-3 text-sm opacity-70">{b.discount_label}</p>
          </div>
          {b.rules && <p className="text-xs text-muted-foreground">Regras: {b.rules}</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PromoCard({ p }: { p: Promotion }) {
  const days = p.ends_at ? Math.ceil((new Date(p.ends_at).getTime() - Date.now()) / 86400000) : null;
  return (
    <div className="surface group overflow-hidden">
      <div className="relative aspect-[16/10] overflow-hidden bg-ink">
        {p.image_url && (
          <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105" />
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{p.discount_label}</span>
          <LevelTag level={p.min_plan_level} />
        </div>
      </div>
      <div className="p-5">
        <p className="eyebrow text-muted-foreground">{p.sponsor?.name ?? p.category}</p>
        <h3 className="mt-1.5 text-lg font-semibold">{p.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
        {days !== null && (
          <p className={`mt-3 text-xs font-semibold ${days <= 3 ? "text-destructive" : "text-primary"}`}>
            {days <= 0 ? "Termina hoje" : `Termina em ${days} dia${days > 1 ? "s" : ""}`}
          </p>
        )}
      </div>
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && <p className="eyebrow text-primary">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-4xl md:text-5xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="surface p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
