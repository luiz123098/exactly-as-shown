import { describe, expect, it, jest } from '@jest/globals';

import { coverUri, excerptOf, originLabel, postSchema } from '../news';

jest.mock('../supabase', () => ({
  supabase: { storage: { from: () => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn/${p}` } }) }) } },
}));

describe('news helpers', () => {
  it('prefers the uploaded image over the external one', () => {
    expect(coverUri({ cover_path: 'u/p.jpg', cover_url: 'https://x/y.jpg' })).toBe('https://cdn/u/p.jpg');
    expect(coverUri({ cover_path: null, cover_url: 'https://x/y.jpg' })).toBe('https://x/y.jpg');
  });

  it('labels the origin', () => {
    expect(originLabel({ origin: 'exotic', source_name: null, category: null })).toBe('Exotic Motors');
    expect(originLabel({ origin: 'auto', source_name: 'Motor1', category: 'Automotivo' })).toBe('Motor1');
  });

  it('validates posts and builds a short excerpt', () => {
    expect(postSchema.safeParse({ title: 'Oi', body: 'curto' }).success).toBe(false);
    expect(excerptOf('a'.repeat(300))).toHaveLength(281);
  });
});
