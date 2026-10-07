import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, Crown, Gift, Heart, Home, LayoutDashboard, LogOut, Map, Megaphone, Menu, Building2, Tag, User, Users, ShieldCheck, Send, CreditCard, ArrowLeftRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, planLabel } from "@/lib/auth";
import { Logo } from "@/components/brand";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };
type Area = "member" | "sponsor" | "admin";

const NAV: Record<Area, NavItem[]> = {
  member: [
    { to: "/app/beneficios", label: "Parceiros & benefícios", icon: Gift },
    { to: "/app", label: "Home", icon: Home, exact: true },
    { to: "/app/promocoes", label: "Promoções", icon: Tag },
    { to: "/app/mapa", label: "Mapa", icon: Map },
    { to: "/app/favoritos", label: "Favoritos", icon: Heart },
    { to: "/app/notificacoes", label: "Notificações", icon: Bell },
    { to: "/app/assinatura", label: "Minha assinatura", icon: Crown },
    { to: "/app/perfil", label: "Perfil", icon: User },
  ],
  sponsor: [
    { to: "/parceiro", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/parceiro/empresa", label: "Minha empresa", icon: Building2 },
    { to: "/parceiro/beneficios", label: "Benefícios", icon: Gift },
    { to: "/parceiro/promocoes", label: "Promoções", icon: Megaphone },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: ShieldCheck, exact: true },
    { to: "/admin/usuarios", label: "Usuários", icon: Users },
    { to: "/admin/parceiros", label: "Patrocinadores", icon: Building2 },
    { to: "/admin/assinaturas", label: "Assinaturas", icon: CreditCard },
    { to: "/admin/promocoes", label: "Promoções", icon: Megaphone },
    { to: "/admin/notificacoes", label: "Notificações", icon: Send },
  ],
};

const BOTTOM: NavItem[] = [
  { to: "/app/beneficios", label: "Parceiros", icon: Gift },
  { to: "/app/mapa", label: "Mapa", icon: Map },
  { to: "/app/promocoes", label: "Promoções", icon: Tag },
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/perfil", label: "Perfil", icon: User },
];

const AREA_LABEL: Record<Area, string> = { member: "App do membro", sponsor: "Painel do parceiro", admin: "Administração" };
const AREA_HOME: Record<Area, string> = { member: "/app/beneficios", sponsor: "/parceiro", admin: "/admin" };

export function useUnread() {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const uid = user.id;
    const load = () =>
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("read", false)
        .then(({ count }) => setUnread(count ?? 0));
    load();
    const ch = supabase
      .channel("notif-" + uid + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);
  return unread;
}

export function UserAvatar({ size = 40 }: { size?: number }) {
  const { profile, user } = useAuth();
  const name = profile?.full_name || user?.email || "?";
  const initials = name.split(/[\s@]/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span style={{ width: size, height: size }} className="grid shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-2 ring-card">
      {initials}
    </span>
  );
}

export function BellLink({ unread }: { unread: number }) {
  return (
    <Link to="/app/notificacoes" aria-label="Notificações" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-card">
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-highlight px-1 text-[0.6rem] font-bold text-primary-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children, area }: { children: ReactNode; area: Area }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const unread = useUnread();

  if (auth.loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando…</div>;
  if (!auth.user) return <Navigate to="/auth" search={{ mode: "login" }} />;
  if (area === "admin" && !auth.isAdmin) return <Navigate to="/app" />;
  if (area === "sponsor" && !auth.isSponsor && !auth.isAdmin) return <Navigate to="/app" />;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const otherAreas = (["member", "sponsor", "admin"] as Area[]).filter(
    (a) => a !== area && (a === "member" || (a === "sponsor" && (auth.isSponsor || auth.isAdmin)) || (a === "admin" && auth.isAdmin)),
  );
  const isMember = area === "member";
  const onHome = pathname === "/app" || pathname === "/app/";

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-6"><Logo light /></div>
      <p className="eyebrow px-6 pb-3 text-sidebar-foreground/40">{AREA_LABEL[area]}</p>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-6">
        {NAV[area].map((i) => (
          <Link key={i.to} to={i.to} activeOptions={{ exact: !!i.exact }} onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent"
            activeProps={{ className: "bg-primary !text-primary-foreground" }}>
            <i.icon className="h-4 w-4" />
            <span className="flex-1">{i.label}</span>
            {i.to === "/app/notificacoes" && unread > 0 && (
              <span className="rounded-full bg-highlight px-2 text-[0.65rem] font-bold text-primary-foreground">{unread}</span>
            )}
          </Link>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-sidebar-border p-3">
        {otherAreas.map((a) => (
          <Link key={a} to={AREA_HOME[a]} className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent">
            <ArrowLeftRight className="h-3.5 w-3.5" /> {AREA_LABEL[a]}
          </Link>
        ))}
        <button onClick={signOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent">
          <LogOut className="h-3.5 w-3.5" /> Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-sidebar lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar">{sidebar}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Header: desktop always; mobile hidden on member Home (Home has its own header) */}
        <header className={`sticky top-0 z-30 border-b bg-background/85 backdrop-blur ${isMember && onHome ? "hidden lg:block" : ""}`}>
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-5 md:px-10">
            <div className="flex min-w-0 items-center gap-3">
              {!isMember && (
                <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
              )}
              <span className="text-sm font-bold uppercase tracking-[0.18em] lg:hidden">Exotic<span className="text-highlight">.</span></span>
              <span className="hidden truncate text-sm text-muted-foreground lg:block">
                {auth.subscription ? <><span className="font-semibold text-primary">● Membro ativo</span> · Plano {planLabel(auth.level)}</> : AREA_LABEL[area]}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <BellLink unread={unread} />
              <Link to="/app/perfil" aria-label="Perfil"><UserAvatar /></Link>
            </div>
          </div>
        </header>

        <main className={`mx-auto max-w-6xl px-5 py-6 md:px-10 md:py-10 ${isMember ? "pb-28 lg:pb-10" : ""}`}>{children}</main>
      </div>

      {isMember && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-5">
            {BOTTOM.map((i) => (
              <Link key={i.to} to={i.to} activeOptions={{ exact: !!i.exact }}
                className="group flex flex-col items-center gap-1 pt-2.5 text-[0.65rem] font-semibold text-muted-foreground"
                activeProps={{ className: "!text-primary-deep [&_.pill]:bg-accent" }}>
                <span className="pill grid h-8 w-14 place-items-center rounded-full transition">
                  <i.icon className="h-5 w-5" />
                </span>
                {i.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
