import { createFileRoute, Link } from "@tanstack/react-router";
import { QRCodeSVG } from "qrcode.react";
import { useAuth, planLabel } from "@/lib/auth";
import { UserAvatar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import lightLogo from "@/assets/exotic-logo-light.png.asset.json";

export const Route = createFileRoute("/app/carteirinha")({
  head: () => ({ meta: [{ title: "Minha carteirinha — Exotic Experience" }, { name: "description", content: "Carteirinha digital do membro EXOTIC com QR Code de identificação." }, { property: "og:title", content: "Minha carteirinha — Exotic Experience" }, { property: "og:description", content: "Carteirinha digital do membro EXOTIC com QR Code de identificação." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Card,
});

function Card() {
  const { profile, subscription, level, user } = useAuth();
  const code = profile?.member_code ?? "--------";
  const active = !!subscription;
  return (
    <div className="mx-auto max-w-md">
      <p className="eyebrow mb-4 text-center text-muted-foreground">Carteirinha digital</p>
      <div className="relative overflow-hidden rounded-[2rem] bg-ink p-6 text-ink-foreground shadow-lift" style={{ backgroundImage: "radial-gradient(circle at 100% 0%, color-mix(in oklch, var(--color-highlight) 35%, transparent), transparent 55%)" }}>
        <div className="flex items-center justify-between">
          <img src={lightLogo.url} alt="Exotic Experience" className="h-auto w-36" />
          <span className={`rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest ${active ? "bg-highlight text-ink" : "bg-ink-muted"}`}>{active ? "Membro ativo" : "Inativo"}</span>
        </div>
        <div className="mt-8 flex items-center gap-4">
          <UserAvatar size={64} />
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold">{profile?.full_name || user?.email}</p>
            <p className="text-xs opacity-70">Plano {planLabel(level)}</p>
          </div>
        </div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="space-y-3 text-xs">
            <div><p className="opacity-50">Nº DE MEMBRO</p><p className="font-mono text-lg font-bold tracking-widest">{code}</p></div>
            <div><p className="opacity-50">VALIDADE</p><p className="font-bold">{subscription ? new Date(subscription.renews_at).toLocaleDateString("pt-BR") : "—"}</p></div>
          </div>
          <div className="rounded-2xl bg-ink-foreground p-2.5"><QRCodeSVG value={`EXOTIC-MEMBER:${code}`} size={104} /></div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-highlight" />
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Apresente para identificação, check-in em eventos e acesso a experiências.</p>
      {!active && <Button asChild className="mt-4 w-full"><Link to="/app/assinatura">Ativar assinatura</Link></Button>}
    </div>
  );
}
