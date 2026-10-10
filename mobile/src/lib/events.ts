import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { removeImages, uploadImage } from '@/lib/upload';

export type EventCard = {
  id: string;
  title: string;
  cover_path: string | null;
  is_past: boolean;
  // Only for subscribers, approved partners and admins.
  starts_at: string | null;
  media_count: number;
  going: number | null;
  i_am_going: boolean;
};

export type EventDetails = {
  event_id: string;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  address: string | null;
  city: string | null;
  program: string;
  rules: string;
};

export type EventMedia = {
  id: string;
  event_id: string | null;
  source: 'instagram' | 'app';
  media_type: 'image' | 'video';
  media_path: string | null;
  caption: string;
  permalink: string | null;
  taken_at: string;
};

export function eventImageUrl(path: string | null | undefined) {
  return path ? supabase.storage.from('events').getPublicUrl(path).data.publicUrl : null;
}

// Same rule as the server (event_ends_at): the end time, or 6 hours after the start.
export function eventEndsAt(d: Pick<EventDetails, 'starts_at' | 'ends_at'>) {
  return d.ends_at ? new Date(d.ends_at) : new Date(new Date(d.starts_at).getTime() + 6 * 3600_000);
}

export function formatEventDate(startsAt: string, endsAt?: string | null) {
  const s = new Date(startsAt);
  const day = s.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const from = s.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!endsAt) return `${day} · ${from}`;
  const e = new Date(endsAt);
  const sameDay = e.toDateString() === s.toDateString();
  const to = e.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return sameDay ? `${day} · ${from} às ${to}`
    : `${day} ${from} até ${e.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })} ${to}`;
}

export const eventSchema = z.object({
  title: z.string().trim().min(3, 'Dê um nome ao evento').max(120),
  venue: z.string().trim().max(120),
  address: z.string().trim().max(200),
  city: z.string().trim().max(80),
  program: z.string().trim().max(4000),
  rules: z.string().trim().max(4000),
});

export const uploadEventImage = (uri: string, mimeType?: string | null) =>
  uploadImage('events', `app/${Math.random().toString(36).slice(2, 8)}`, uri, mimeType);

export const removeEventImages = (paths: (string | null | undefined)[]) => removeImages('events', paths);
