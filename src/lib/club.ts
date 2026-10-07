import { supabase } from "@/integrations/supabase/client";

export type ClubEvent = {
  id: string; title: string; kind: string; description: string; image_url: string | null;
  starts_at: string; location: string; capacity: number; price: number; status: string;
  min_plan_level: number; featured: boolean; sponsor_ids: string[];
};
export type Article = {
  id: string; title: string; category: string; excerpt: string; body: string;
  cover_url: string | null; video_url: string | null; featured: boolean; published: boolean; created_at: string;
};
export type HomeConfig = {
  sections: string[]; hero_title: string; hero_subtitle: string; hero_image: string | null;
  hero_link: string | null; hero_badge: string;
};

export const HOME_SECTIONS: Record<string, string> = {
  featured: "Parceiros em destaque",
  benefits: "Benefícios exclusivos",
  promotions: "Ofertas exclusivas",
  categories: "Categorias",
  nearby: "Parceiros perto de você",
  events: "Experiências EXOTIC",
  content: "Conteúdo EXOTIC",
};
export const ARTICLE_CATEGORIES = ["Lifestyle", "Business", "Automotive", "Travel", "Gastronomia", "Experiences"];
export const EVENT_KINDS = ["Encontro", "Festa", "Jantar", "Experiência", "Viagem", "Track day", "Lançamento", "Networking"];

export async function fetchEvents(): Promise<ClubEvent[]> {
  const { data } = await supabase.from("events").select("*").order("starts_at");
  return (data ?? []) as ClubEvent[];
}
export async function fetchArticles(): Promise<Article[]> {
  const { data } = await supabase.from("articles").select("*").order("featured", { ascending: false }).order("created_at", { ascending: false });
  return (data ?? []) as Article[];
}
export async function fetchHomeConfig(): Promise<HomeConfig | null> {
  const { data } = await supabase.from("home_config").select("*").eq("id", 1).maybeSingle();
  return data as HomeConfig | null;
}

export function track(sponsorId: string, userId: string | undefined, kind: "view" | "click" | "directions" | "promo_view") {
  if (!userId) return;
  void supabase.from("sponsor_events").insert({ sponsor_id: sponsorId, user_id: userId, kind });
}

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", weekday: "short" });
export const fmtTime = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const EXOTIC_WHATSAPP = "5562999282306";
export const eventWhatsappUrl = (title: string) =>
  `https://wa.me/${EXOTIC_WHATSAPP}?text=${encodeURIComponent(`Olá, EXOTIC! Gostaria de obter mais informações sobre o evento ${title} e saber como posso participar.`)}`;
