import { describe, expect, it, jest } from '@jest/globals';

import { carPhotoSource, carSchema, carTitle } from '../garage';

jest.mock('../supabase', () => ({ supabase: {}, supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k' }));

describe('carSchema', () => {
  it('parses the year and turns empty optional fields into null', () => {
    const r = carSchema.parse({ brand: ' Porsche ', model: '911', version: 'GT3 RS', year: '2023', color: '', nickname: '', description: '' });
    expect(r).toMatchObject({ brand: 'Porsche', year: 2023, color: null, nickname: null });
  });

  it('rejects an impossible year and a missing model', () => {
    const r = carSchema.safeParse({ brand: 'BMW', model: '', version: '', year: '23', color: '', nickname: '', description: '' });
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['model', 'year']);
  });
});

describe('carTitle', () => {
  it('skips an empty version', () => {
    expect(carTitle({ brand: 'BMW', model: 'M3', version: null, year: 2021 })).toBe('BMW M3 2021');
    expect(carTitle({ brand: 'Porsche', model: '911', version: 'GT3 RS', year: 2023 })).toBe('Porsche 911 GT3 RS 2023');
  });
});

describe('carPhotoSource', () => {
  it('builds an authenticated request, or nothing without a photo or session', () => {
    expect(carPhotoSource('u/car.jpg', 't', 'me')).toMatchObject({
      uri: 'https://x.supabase.co/storage/v1/object/authenticated/cars/u/car.jpg',
      headers: { Authorization: 'Bearer t' },
      cacheKey: 'cars/me/u/car.jpg',
    });
    expect(carPhotoSource(null, 't')).toBeNull();
    expect(carPhotoSource('u/car.jpg', undefined)).toBeNull();
  });
});
