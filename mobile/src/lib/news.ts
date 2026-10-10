import { z } from 'zod';

import { supabase } from '@/lib/supabase';
import { removeImages, uploadImage } from '@/lib/upload';

export type Article = {
  id: string;
  origin: 'auto' | 'exotic' | 'partner';
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  cover_path: string | null;
  external_url: string | null;
  source_name: string | null;
  category: string | null;
  partner_id: string | null;
  niche_id: string | null;
  author_id: string | null;
  featured: boolean;
  published_at: string;
};

export type Niche = { id: string; name: string; status: 'pending' | 'approved' | 'rejected' };

// Feed filters: the main news (automotive + Exotic Motors), Exotic only, or a niche.
export type Filter = { kind: 'main' } | { kind: 'exotic' } | { kind: 'niche'; id: string };

export function coverUri(a: Pick<Article, 'cover_path' | 'cover_url'>) {
  if (a.cover_path) return supabase.storage.from('news').getPublicUrl(a.cover_path).data.publicUrl;
  return a.cover_url;
}

export function originLabel(a: Pick<Article, 'origin' | 'source_name' | 'category'>) {
  if (a.origin === 'exotic') return 'Exotic Motors';
  return a.source_name ?? a.category ?? 'Notícia';
}

export const postSchema = z.object({
  title: z.string().trim().min(3, 'Escreva um título').max(200),
  body: z.string().trim().min(10, 'Escreva o texto do post (mínimo 10 caracteres)').max(5000),
});

// Same summary rule as the automatic news.
export { excerptOf } from '../../supabase/functions/_shared/rss';

export const uploadNewsImage = (userId: string, uri: string, mimeType?: string | null) =>
  uploadImage('news', `${userId}/post`, uri, mimeType);

export const removeNewsImage = (path: string | null | undefined) => removeImages('news', [path]);
