import { z } from 'zod';

import { normalizeInstagram } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { removeImages, uploadImage } from '@/lib/upload';

// Public fields of a partner company (contact data stays private).
export type PartnerPage = {
  id: string;
  owner_id: string;
  company_name: string;
  niche: string;
  niche_id: string | null;
  instagram_company: string;
  logo_path: string | null;
  description: string;
  address: string | null;
  city: string | null;
  public_whatsapp: string | null;
  website: string | null;
};
export const PARTNER_FIELDS =
  'id, owner_id, company_name, niche, niche_id, instagram_company, logo_path, description, address, city, public_whatsapp, website';

export type UsageLimit = 'once' | 'daily' | 'monthly' | 'unlimited';
export type Promotion = {
  id: string;
  partner_id: string;
  title: string;
  description: string;
  discount_label: string | null;
  image_path: string | null;
  usage_limit: UsageLimit;
  ends_at: string | null;
  active: boolean;
  created_at: string;
};

export const USAGE_LIMIT: Record<UsageLimit, string> = {
  once: 'Uso único por membro',
  daily: '1 vez por dia',
  monthly: '1 vez por mês',
  unlimited: 'Uso ilimitado',
};

export function partnerImageUrl(path: string | null | undefined) {
  return path ? supabase.storage.from('partners').getPublicUrl(path).data.publicUrl : null;
}

export function isLive(p: Pick<Promotion, 'active' | 'ends_at'>, now = Date.now()) {
  return p.active && (!p.ends_at || new Date(p.ends_at).getTime() > now);
}

export function mapsUrl(address: string, city?: string | null) {
  return `https://maps.apple.com/?q=${encodeURIComponent([address, city].filter(Boolean).join(', '))}`;
}

export function websiteUrl(site: string) {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

const optional = (max: number) => z.string().trim().max(max).transform((v) => v || null);

export const partnerPageSchema = z.object({
  description: z.string().trim().max(1000),
  address: optional(200),
  city: optional(80),
  public_whatsapp: z.string().trim().refine((v) => !v || /^\d{10,13}$/.test(v.replace(/\D/g, '')), 'WhatsApp com DDD, só números')
    .transform((v) => v || null),
  website: z.string().trim().max(200).refine((v) => !v || /^(https?:\/\/)?[\w-]+(\.[\w-]+)+/i.test(v), 'Site inválido')
    .transform((v) => (v ? websiteUrl(v) : null)),
  instagram_company: z.string().transform((v, ctx) => {
    const h = normalizeInstagram(v);
    if (!h) ctx.addIssue({ code: 'custom', message: 'Informe um @ do Instagram válido' });
    return h ?? '';
  }),
});

export const promotionSchema = z.object({
  title: z.string().trim().min(3, 'Dê um nome à promoção').max(120),
  description: z.string().trim().max(1000),
  discount_label: optional(40),
});

export const uploadPartnerImage = (userId: string, kind: 'logo' | 'promo', uri: string, mimeType?: string | null) =>
  uploadImage('partners', `${userId}/${kind}`, uri, mimeType);

export const removePartnerImage = (path: string | null | undefined) => removeImages('partners', [path]);
