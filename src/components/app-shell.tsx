import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell, Crown, Gift, Heart, Home, LayoutDashboard, LogOut, Map, Megaphone, Menu, Building2, Tag, User, Users, ShieldCheck, Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, planLabel } from "@/lib/auth";
import { Logo } from "@/components/brand";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean };

const member: NavItem[] = [
  { to: "/app", label: "Início", icon: Home, exact: true },
  { to: "/app/beneficios", label: "Benefícios", icon: Gift },
  { to: "/app/promocoes", label: "Promoções", icon: Tag },
  { to: "/app/mapa", label: "Mapa", icon: Map },
  { to: "/app/favoritos", label: "Favoritos", icon: Heart },
  { to: "/app/notificacoes", label: "Notificações", icon: Bell },
  { to: "/app/assinatura", label: "Assinatura", icon: Crown },
  { to: "/app/perfil", label: "Perfil", icon: User },
];
const sponsor: NavItem[] = [
  { to: "/parceiro", label: "Painel", icon: LayoutDashboard, exact: true },
  { to: "/parceiro/empresa", label: "Minha empresa", icon: Building2 },
  { to: "/parceiro/beneficios", label: "Benefícios", icon: Gift },
  { to: "/parceiro/promocoes", label: "Promoções", icon: Megaphone },
];
const admin: NavItem[] = [
  { to: "/admin", label: "Visão geral", icon: ShieldCheck, exact: true },
  { to: "/admin/parceiros", label: "Parceiros", icon: Building2 },
  { to: "/admin/promocoes", label: "Promoções", icon: Megaphone },
  { to: "/admin/usuarios", label: "Usuários", icon: Users },
  { to: "/admin/notificacoes", label: "Enviar aviso", icon: Send },
];

export function AppShell({ children, require }: { children: ReactNode; require?: "sponsor" | "admin" }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!auth.user) return;
    const uid = auth.user.id;
    const load = () =>
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .eq("read", false)
        .then(({ count }) => setUnread(count ?? 0));
    load();
    const ch = supabase
      .channel("notif-" + uid)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [auth.user]);

  if (auth.loading) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Carregando…</div>;
  if (!auth.user) return <Navigate to="/auth" search={{ mode: "login" }} />;
  if (require === "admin" && !auth.isAdmin) return <Navigate to="/app" />;
  if (require === "sponsor" && !auth.isSponsor && !auth.isAdmin) return <Navigate to="/app" />;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await auth.signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const groups: [string, NavItem[]][] = [["Membro", member]];
  if (auth.isSponsor || auth.isAdmin) groups.push(["Parceiro", sponsor]);
  if (auth.isAdmin) groups.push(["Administração", admin]);

  const nav = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-6"><Logo light /></div>
      <div className="mx-4 mb-4 rounded-xl member-card p-4">
        <p className="eyebrow opacity-60">{auth.subscription ? `Plano ${planLabel(auth.level)}` : "Sem assinatura"}</p>
        <p className="mt-1 truncate font-semibold">{auth.profile?.full_name || auth.user.email}</p>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {groups.map(([title, items]) => (
          <div key={title}>
            <p className="eyebrow px-3 pb-2 text-sidebar-foreground/40">{title}</p>
            {items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                activeOptions={{ exact: i.exact }}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground transition hover:bg-sidebar-accent"
                activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground" }}
              >
                <i.icon className="h-4 w-4" />
                <span className="flex-1">{i.label}</span>
                {i.to === "/app/notificacoes" && unread > 0 && (
                  <span className="rounded-full bg-sidebar-primary px-2 text-[0.65rem] font-bold text-sidebar-primary-foreground">{unread}</span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <button onClick={signOut} className="m-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent">
        <LogOut className="h-4 w-4" /> Sair
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-sidebar lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar">{nav}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-5 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
          <span className="text-sm font-bold uppercase tracking-[0.18em]">Exotic<span className="text-highlight">.</span></span>
          <Link to="/app/notificacoes" className="relative">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-highlight" />}
          </Link>
        </header>
        <main className="mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-12">{children}</main>
      </div>
    </div>
  );
}
