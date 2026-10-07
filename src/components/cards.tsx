import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Clock, Dumbbell, Heart, HeartPulse, Hotel, Lock, MapPin, PartyPopper, ShoppingBag, Sparkles, Ticket, UtensilsCrossed, Wrench, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, CATEGORIES } from "@/lib/auth";
import { fmtKm, validity } from "@/lib/geo";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";

export type SponsorLite = {
  id: string; name: string; city: string; category: string; cover_url: string | null;
  lat?: number | null; lng?: number | null; address?: string;
};
export type Benefit = {
  id: string; title: string; description: string; discount_label: string; rules: string | null;
  category: string; min_plan_level: number; expires_at: string | null; sponsor: SponsorLite | null;
};
export type Promotion = {
  id: string; title: string; description: string; discount_label: string; image_url: string | null;
  category: string; min_plan_level: number; ends_at: string | null; featured: boolean; sponsor: SponsorLite | null;
};

export const CATEGORY_ICONS: Record<string, typeof Hotel> = {
  Restaurantes: UtensilsCrossed, Hotéis: Hotel, Academias: Dumbbell, Saúde: HeartPulse, Beleza: Sparkles,
  Entretenimento: PartyPopper, Compras: ShoppingBag, Serviços: Wrench,
};

export function LevelTag({ level }: { level: number }) {
  return level >= 2 ? (
    <span className="eyebrow rounded-full bg-ink px-2 py-0.5 text-[0.55rem] text-ink-foreground">Premium</span>
  ) : null;
}

export function HeartButton({ on, onClick, floating }: { on: boolean; onClick: () => void; floating?: boolean }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      aria-label={on ? "Remover dos favoritos" : "Salvar nos favoritos"}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:scale-90 ${floating ? "bg-card/90 shadow-soft backdrop-blur" : "hover:bg-secondary"}`}
    >
      <Heart className={`h-4 w-4 ${on ? "fill-primary text-primary" : "text-muted-foreground"}`} />
    </button>
  );
}

export function SponsorAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-2xl bg-ink text-xs font-bold tracking-wider text-ink-foreground">
      {initials}
    </span>
  );
}

/* ---------- Benefit ---------- */

export function BenefitSheet({ b, open, onOpenChange, distance }: { b: Benefit; open: boolean; onOpenChange: (o: boolean) => void; distance?: number | null | undefined }) {
  const { user, level } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const locked = level < b.min_plan_level;
  async function use() {
    if (!user) return;
    const c = "EX-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error } = await supabase.from("benefit_usages").insert({ user_id: user.id, benefit_id: b.id, code: c });
    if (error) return void toast.error("Seu plano não dá acesso a este benefício.");
    setCode(c);
  }
  return (
    <Drawer open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setCode(null); }}>
      <DrawerContent className="mx-auto max-w-lg">
        {b.sponsor?.cover_url && !code && (
          <img src={b.sponsor.cover_url} alt="" className="mx-4 mt-3 h-36 rounded-2xl object-cover" />
        )}
        <DrawerHeader className="text-left">
          <p className="eyebrow text-muted-foreground">{b.sponsor?.name} · {b.category}{distance != null ? ` · ${fmtKm(distance)}` : ""}</p>
          <DrawerTitle className="text-4xl font-extrabold text-primary">{b.discount_label}</DrawerTitle>
          <DrawerDescription className="text-base text-foreground">{b.title}</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-4 px-4 pb-8">
          {code ? (
            <div className="member-card rounded-2xl p-8 text-center">
              <p className="eyebrow opacity-70">Apresente no estabelecimento</p>
              <div className="mx-auto mt-4 w-fit rounded-2xl bg-ink-foreground p-3"><QRCodeSVG value={`EXOTIC-USE:${code}`} size={150} /></div>
              <p className="mt-3 font-mono text-4xl font-bold tracking-widest">{code}</p>
              <p className="mt-3 text-sm opacity-70">{b.sponsor?.name} · válido por 24 h</p>
              <p className="mt-1 text-xs opacity-50">O parceiro valida este código no painel dele.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{b.description}</p>
              {b.rules && <p className="rounded-xl bg-secondary p-3 text-xs text-muted-foreground"><strong>Regras:</strong> {b.rules}</p>}
              {locked ? (
                <Button asChild size="lg" variant="ink" className="w-full">
                  <Link to="/app/assinatura"><Lock /> Disponível no Premium</Link>
                </Button>
              ) : (
                <Button size="lg" className="w-full" onClick={use}><Ticket /> Usar benefício</Button>
              )}
              {b.sponsor && (
                <Button asChild variant="outline" size="lg" className="w-full">
                  <Link to="/app/parceiros/$id" params={{ id: b.sponsor.id }}>Ver empresa</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function BenefitCard({ b, favorite, onToggleFav, distance }: { b: Benefit; favorite?: boolean; onToggleFav?: () => void; distance?: number | null | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div onClick={() => setOpen(true)} className="surface group flex cursor-pointer flex-col overflow-hidden transition active:scale-[0.99]">
        <div className="relative aspect-[16/9] overflow-hidden bg-ink">
          {b.sponsor?.cover_url && <img src={b.sponsor.cover_url} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
          {onToggleFav && <div className="absolute right-3 top-3"><HeartButton floating on={!!favorite} onClick={onToggleFav} /></div>}
          <div className="absolute left-3 top-3"><LevelTag level={b.min_plan_level} /></div>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="truncate font-semibold">{b.sponsor?.name}</p>
            {distance != null && <span className="shrink-0 text-xs text-muted-foreground">{fmtKm(distance)}</span>}
          </div>
          <p className="text-xs text-muted-foreground">{b.category}</p>
          <p className="mt-3 font-display text-3xl leading-none text-primary">{b.discount_label}</p>
          <p className="mt-1 line-clamp-1 text-sm">{b.title}</p>
          <p className="eyebrow mt-1 text-[0.6rem] text-highlight">Exclusivo membros</p>
          <Button size="sm" variant="secondary" className="mt-4 w-full">Ver benefício</Button>
        </div>
      </div>
      <BenefitSheet b={b} open={open} onOpenChange={setOpen} distance={distance} />
    </>
  );
}

/* ---------- Promotion ---------- */

export function PromoCard({ p, distance, saved, onToggleSave, compact }: { p: Promotion; distance?: number | null; saved?: boolean; onToggleSave?: () => void; compact?: boolean }) {
  const inner = (
    <div className={`surface group block h-full overflow-hidden ${compact ? "w-[78vw] max-w-[300px] shrink-0 snap-start" : ""}`}>
      <div className="relative aspect-[16/10] overflow-hidden bg-ink">
        {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">{p.discount_label}</span>
          <LevelTag level={p.min_plan_level} />
        </div>
        {onToggleSave && <div className="absolute right-3 top-3"><HeartButton floating on={!!saved} onClick={onToggleSave} /></div>}
      </div>
      <div className="p-4">
        <p className="eyebrow truncate text-muted-foreground">{p.sponsor?.name ?? p.category}</p>
        <h3 className="mt-1 line-clamp-1 font-semibold">{p.title}</h3>
        {!compact && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          {distance != null && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{fmtKm(distance)}</span>}
          <span className="flex items-center gap-1 font-semibold text-primary"><Clock className="h-3 w-3" />{validity(p.ends_at)}</span>
        </div>
      </div>
    </div>
  );
  return p.sponsor ? (
    <Link to="/app/parceiros/$id" params={{ id: p.sponsor.id }} className={compact ? "shrink-0" : ""}>{inner}</Link>
  ) : inner;
}

/* ---------- Sponsor row ---------- */

export function SponsorRow({ id, name, category, distance, benefit }: { id: string; name: string; category: string; distance: number | null; benefit?: string | undefined }) {
  return (
    <Link to="/app/parceiros/$id" params={{ id }} className="flex items-center gap-3 py-3">
      <SponsorAvatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{category}{distance != null ? ` · ${fmtKm(distance)}` : ""}</p>
        {benefit && <p className="truncate text-xs font-semibold text-primary">{benefit} para membros</p>}
      </div>
      <span className="shrink-0 rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold">Ver</span>
    </Link>
  );
}

/* ---------- Chips & layout ---------- */

export function CategoryChips({ value, onChange, extra }: { value: string; onChange: (v: string) => void; extra?: { value: string; label: string }[] }) {
  const items = [{ value: "", label: "Todas" }, ...(extra ?? []), ...CATEGORIES.map((c) => ({ value: c, label: c }))];
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
      {items.map((c) => (
        <button key={c.value} onClick={() => onChange(c.value)}
          className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition ${value === c.value ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function CategoryTiles({ onPick }: { onPick: (c: string) => void }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-8 md:px-0">
      {CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICONS[c] ?? LayoutGrid;
        return (
          <button key={c} onClick={() => onPick(c)} className="flex w-20 shrink-0 flex-col items-center gap-2 md:w-auto">
            <span className="grid h-16 w-16 place-items-center rounded-2xl border bg-card shadow-soft transition active:scale-95">
              <Icon className="h-6 w-6 text-primary" />
            </span>
            <span className="text-[0.7rem] font-semibold">{c}</span>
          </button>
        );
      })}
    </div>
  );
}

export function SectionHeader({ title, to, action = "Ver tudo" }: { title: string; to?: string; action?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-lg font-bold md:text-xl">{title}</h2>
      {to && <Link to={to} className="shrink-0 text-sm font-semibold text-primary">{action}</Link>}
    </div>
  );
}

export function PageTitle({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 md:mb-8 md:flex-row md:items-end">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow text-primary">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-4xl md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div className="surface p-10 text-center text-sm text-muted-foreground">{text}</div>;
}
