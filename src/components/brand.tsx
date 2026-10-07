import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import darkLogo from "@/assets/exotic-logo-dark.png.asset.json";
import lightLogo from "@/assets/exotic-logo-light.png.asset.json";

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <Link to="/" aria-label="Exotic Experience — início" className="inline-flex shrink-0 items-center">
      <img src={light ? lightLogo.url : darkLogo.url} alt="Exotic Experience" width={1526} height={223}
        className={`${compact ? "w-36" : "w-44 sm:w-52"} h-auto object-contain`} />
    </Link>
  );
}

export function PublicHeader({ light = false }: { light?: boolean }) {
  const { user } = useAuth();
  return (
    <header className={`${light ? "absolute inset-x-0 top-0 z-20" : "border-b bg-card"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6">
        <Logo light={light} />
        <nav className={`hidden gap-8 text-sm md:flex ${light ? "text-ink-foreground/80" : "text-muted-foreground"}`}>
          <Link to="/planos" className="hover:opacity-100">Planos</Link>
          <Link to="/parceiros" className="hover:opacity-100">Parceiros</Link>
          <Link to="/auth" search={{ mode: "signup", type: "sponsor" }} className="hover:opacity-100">Seja parceiro</Link>
        </nav>
        {user ? (
          <Button asChild variant={light ? "glass" : "ink"} size="sm">
            <Link to="/app">Minha área</Link>
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button asChild variant={light ? "glass" : "ghost"} size="sm">
              <Link to="/auth" search={{ mode: "login" }}>Entrar</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-ink text-ink-foreground/60">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center">
        <Logo light />
        <p className="text-xs">© {new Date().getFullYear()} Exotic Experience · Goiás, Brasil</p>
      </div>
    </footer>
  );
}
