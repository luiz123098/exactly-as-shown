import { describe, expect, it, jest } from '@jest/globals';

import { isLive, mapsUrl, partnerPageSchema, websiteUrl } from '../partners';

jest.mock('../supabase', () => ({ supabase: {} }));

describe('partner page', () => {
  it('normalizes website, WhatsApp and Instagram', () => {
    const r = partnerPageSchema.parse({ description: 'Loja', address: '', city: 'Goiânia', public_whatsapp: '(62) 99133-8082',
      website: 'exoticmotors.com.br', instagram_company: '@exoticmotorsbrasil' });
    expect(r).toMatchObject({ address: null, website: 'https://exoticmotors.com.br', instagram_company: 'exoticmotorsbrasil' });
  });

  it('rejects a bad WhatsApp', () => {
    expect(partnerPageSchema.safeParse({ description: '', address: '', city: '', public_whatsapp: '123', website: '',
      instagram_company: 'x' }).success).toBe(false);
  });

  it('builds map and site links', () => {
    expect(mapsUrl('Av. T-63, 100', 'Goiânia')).toBe('https://maps.apple.com/?q=Av.%20T-63%2C%20100%2C%20Goi%C3%A2nia');
    expect(websiteUrl('http://a.com')).toBe('http://a.com');
  });
});

describe('isLive', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  it('requires active and not expired', () => {
    expect(isLive({ active: true, ends_at: null }, now)).toBe(true);
    expect(isLive({ active: true, ends_at: '2026-10-10T00:00:00Z' }, now)).toBe(false);
    expect(isLive({ active: false, ends_at: null }, now)).toBe(false);
  });
});
