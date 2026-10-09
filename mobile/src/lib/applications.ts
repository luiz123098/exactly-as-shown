import { z } from 'zod';

import type { ApplicationStatus, PartnerStatus } from '@/lib/access';
import { normalizeInstagram } from '@/lib/profile';

// Which form the person asked for on the welcome screen ("Torne-se membro" /
// "Torne-se parceiro"). Kept on the device so it survives social login and
// email confirmation; cleared once the form is sent or skipped.
export type Intent = 'member' | 'partner';
const INTENT_KEY = 'exotic.intent';

export function readIntent(): Intent | null {
  const v = localStorage.getItem(INTENT_KEY);
  return v === 'member' || v === 'partner' ? v : null;
}

export function writeIntent(intent: Intent | null) {
  if (intent) localStorage.setItem(INTENT_KEY, intent);
  else localStorage.removeItem(INTENT_KEY);
}

// Same limits as the check constraints in the database.
const instagram = z.string().transform((v, ctx) => {
  const handle = normalizeInstagram(v);
  if (!handle) ctx.addIssue({ code: 'custom', message: 'Informe um @ do Instagram válido' });
  return handle ?? '';
});
const name = z.string().trim().min(2, 'Informe o nome completo').max(120);
const email = z.string().trim().email('E-mail inválido').max(255);
const phone = z.string().trim().refine((v) => /^\d{10,13}$/.test(v.replace(/\D/g, '')), 'Telefone com DDD, só números');
const reason = z.string().trim().min(10, 'Conte um pouco mais (mínimo 10 caracteres)').max(2000);

export const memberSchema = z.object({
  full_name: name,
  email,
  phone,
  city: z.string().trim().min(2, 'Informe sua cidade').max(80),
  profession: z.string().trim().min(2, 'Informe sua profissão').max(120),
  instagram,
  cars: z.string().trim().max(500).transform((v) => v || null),
  reason,
});

export const partnerSchema = z.object({
  responsible_name: name,
  email,
  phone,
  company_name: z.string().trim().min(2, 'Informe o nome da empresa').max(120),
  niche: z.string().trim().min(2, 'Informe o segmento').max(60),
  instagram_responsible: instagram,
  instagram_company: instagram,
  reason,
});

// Field errors keyed by field name, as the forms show them.
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    out[key] ??= issue.message;
  }
  return out;
}

export const MEMBER_STATUS: Record<ApplicationStatus, string> = {
  pending: 'Em análise',
  approved: 'Aprovada',
  rejected: 'Não aprovada',
};

export const PARTNER_STATUS: Record<PartnerStatus, string> = {
  pending: 'Em análise',
  meeting_proposed: 'Reunião proposta',
  meeting_confirmed: 'Reunião confirmada',
  approved: 'Aprovada',
  rejected: 'Não aprovada',
};

// Pending items first in the admin lists.
const RANK: Record<string, number> = { pending: 0, meeting_proposed: 1, meeting_confirmed: 2, approved: 3, rejected: 4 };
export function byStatus<T extends { status: string; created_at: string }>(a: T, b: T) {
  return (RANK[a.status] ?? 9) - (RANK[b.status] ?? 9) || b.created_at.localeCompare(a.created_at);
}

export function formatMeeting(at: string | Date, place?: string | null) {
  const d = new Date(at);
  const day = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} às ${time}${place ? ` · ${place}` : ''}`;
}

// Brazilian numbers are stored as typed; WhatsApp needs the country code.
export function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

// Only ever links to Instagram itself (see AGENTS.md).
export function instagramUrl(handle: string) {
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}
