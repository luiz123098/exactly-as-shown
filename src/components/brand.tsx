import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary font-display text-lg text-primary-foreground">
        E
      </span>
      <span className={`text-sm font-bold tracking-[0.18em] uppercase ${light ? "text-ink-foreground" : "text-foreground"}`}>
        Exotic<span className="text-highlight">.</span>
      </span>
    </Link>
  );
}

export function PublicHeader({ light = false }: { light?: boolean }) {
  const { user } = useAuth();
  return (
    <header className={`${light ? "absolute inset-x-0 top-0 z-20" : "border-b bg-card"}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
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
