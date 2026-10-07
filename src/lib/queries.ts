import { supabase } from "@/integrations/supabase/client";
import type { Benefit, Promotion } from "@/components/cards";

const SP = "sponsor:sponsors(id,name,city,category,cover_url)";

export async function fetchBenefits(): Promise<Benefit[]> {
  const { data } = await supabase.from("benefits").select(`*, ${SP}`).eq("active", true).order("created_at", { ascending: false });
  return (data ?? []) as unknown as Benefit[];
}

export async function fetchPromotions(): Promise<Promotion[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("promotions")
    .select(`*, ${SP}`)
    .eq("status", "approved")
    .or(`ends_at.is.null,ends_at.gte.${today}`)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Promotion[];
}

export async function fetchFavIds(uid: string): Promise<Set<string>> {
  const { data } = await supabase.from("favorites").select("benefit_id").eq("user_id", uid);
  return new Set((data ?? []).map((f) => f.benefit_id));
}

export async function toggleFav(uid: string, benefitId: string, isFav: boolean) {
  if (isFav) await supabase.from("favorites").delete().eq("user_id", uid).eq("benefit_id", benefitId);
  else await supabase.from("favorites").insert({ user_id: uid, benefit_id: benefitId });
}
