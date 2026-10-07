import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Plan = {
  id: string;
  slug: string;
  name: string;
  price: number;
  level: number;
  description: string | null;
  features: string[];
  highlighted: boolean;
};
export type Subscription = {
  id: string;
  status: string;
  started_at: string;
  renews_at: string;
  plan: Plan;
};
type Profile = { id: string; full_name: string; phone: string | null; city: string | null; avatar_url: string | null; interests: string[]; member_code: string | null; created_at: string; garage_public: boolean };

type AuthCtx = {
  user: User | null;
  loading: boolean;
  roles: string[];
  profile: Profile | null;
  subscription: Subscription | null;
  level: number;
  isAdmin: boolean;
  isSponsor: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  const load = useCallback(async (u: User | null) => {
    if (!u) {
      setRoles([]);
      setProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    const [r, p, s] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.id),
      supabase.from("profiles").select("id, full_name, phone, city, avatar_url, interests, member_code, created_at, garage_public").eq("id", u.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("id, status, started_at, renews_at, plan:plans(*)")
        .eq("user_id", u.id)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setRoles((r.data ?? []).map((x) => x.role));
    setProfile(p.data ?? null);
    setSubscription((s.data as unknown as Subscription) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setTimeout(() => load(u), 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      load(data.session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const value: AuthCtx = {
    user,
    loading,
    roles,
    profile,
    subscription,
    level: subscription?.plan?.level ?? 0,
    isAdmin: roles.includes("admin"),
    isSponsor: roles.includes("sponsor"),
    refresh: () => load(user),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}

export const planLabel = (level: number) => (level >= 2 ? "Premium" : "Essencial");
export const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const CATEGORIES = [
  "Restaurantes",
  "Hotéis",
  "Academias",
  "Saúde",
  "Beleza",
  "Entretenimento",
  "Compras",
  "Serviços",
];

export function homePath(roles: string[]) {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("sponsor")) return "/parceiro";
  return "/app";
}
