import { supabase } from "@/integrations/supabase/client";

export type ClubEvent = {
  id: string; title: string; kind: string; description: string; image_url: string | null;
  starts_at: string; location: string; capacity: number; price: number; status: string;
  min_plan_level: number; featured: boolean; sponsor_ids: string[];
};
export type Article = {
  id: string; title: string; category: string; excerpt: string; body: string;
  cover_url: string | null; video_url: string | null; featured: boolean; published: boolean; created_at: string;
  status: string; origin: string; sponsor_id: string | null; source_name: string | null; source_url: string | null;
  external_url: string | null; tags: string[]; publish_at: string | null; cta_kind: string | null; cta_id: string | null;
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
export const ARTICLE_CATEGORIES = ["Automotivo", "Lazer", "Business", "Lifestyle", "Experiências", "Tecnologia", "Viagens", "Eventos"];
export const PARTNER_NICHES = ["Automotivo", "Lazer", "Business", "Lifestyle", "Gastronomia", "Viagens", "Tecnologia", "Serviços", "Eventos", "Outros"];
export const ARTICLE_STATUS: Record<string, string> = { draft: "Rascunho", pending: "Enviado para aprovação", approved: "Aprovado", published: "Publicado", rejected: "Rejeitado" };
export const timeAgo = (d: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (m < 60) return `Há ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `Há ${h} h`;
  const days = Math.round(h / 24); return days < 7 ? `Há ${days} d` : new Date(d).toLocaleDateString("pt-BR");
};
export const EVENT_KINDS = ["Encontro", "Festa", "Jantar", "Experiência", "Viagem", "Track day", "Lançamento", "Networking"];

export async function fetchEvents(): Promise<ClubEvent[]> {
  const { data } = await supabase.from("events").select("*").order("starts_at");
  return (data ?? []) as ClubEvent[];
}
export async function fetchArticles(): Promise<Article[]> {
  const { data } = await supabase.from("articles").select("*").eq("published", true).order("created_at", { ascending: false }).limit(200);
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
