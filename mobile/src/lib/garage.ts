import { z } from 'zod';

import { supabaseKey, supabaseUrl } from '@/lib/supabase';
import { removeImages, uploadImage } from '@/lib/upload';

export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export type Car = {
  id: string;
  owner_id: string;
  brand: string;
  model: string;
  version: string | null;
  year: number;
  color: string | null;
  nickname: string | null;
  description: string | null;
  photo_path: string | null;
  photo_status: PhotoStatus;
  photo_reject_reason: string | null;
  likes_count: number;
  created_at: string;
  updated_at: string;
};

export type Garage = {
  owner_id: string;
  full_name: string;
  avatar_path: string | null;
  instagram: string | null;
  cars_count: number;
  likes: number;
  cover_path: string | null;
  is_public: boolean;
  // Photos waiting for approval (only filled in for admins).
  pending_count: number;
};

export const PHOTO_STATUS: Record<PhotoStatus, string> = {
  pending: 'Foto em análise',
  approved: 'Publicada',
  rejected: 'Foto não aprovada',
};

const optional = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const maxYear = new Date().getFullYear() + 1;

// Same limits as the cars table. Brand, model, version and year identify the
// exact car (also what an AI image would be generated from).
export const carSchema = z.object({
  brand: z.string().trim().min(1, 'Informe a marca').max(40),
  model: z.string().trim().min(1, 'Informe o modelo').max(60),
  version: optional(60),
  year: z.string().trim().refine((v) => /^\d{4}$/.test(v) && +v >= 1900 && +v <= maxYear, `Ano entre 1900 e ${maxYear}`)
    .transform(Number),
  color: optional(30),
  nickname: optional(60),
  description: optional(500),
});

export function carTitle(c: Pick<Car, 'brand' | 'model' | 'version' | 'year'>) {
  return [c.brand, c.model, c.version, c.year].filter(Boolean).join(' ');
}

// Car photos live in a private bucket; the image request carries the user's
// token and the storage policy decides whether this photo can be seen.
// The cache key includes the viewer, so another account on the same phone never
// gets a photo from the cache that the server would refuse it.
export function carPhotoSource(path: string | null | undefined, token: string | undefined, viewerId?: string) {
  if (!path || !token) return null;
  return {
    uri: `${supabaseUrl}/storage/v1/object/authenticated/cars/${path}`,
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseKey },
    cacheKey: `cars/${viewerId ?? 'anon'}/${path}`,
  };
}

export const uploadCarPhoto = (userId: string, uri: string, mimeType?: string | null) =>
  uploadImage('cars', `${userId}/car`, uri, mimeType);

export const removeCarPhoto = (path: string | null | undefined) => removeImages('cars', [path]);
