import { describe, expect, it, jest } from '@jest/globals';

import { isProfileComplete, normalizeInstagram } from '../profile';

jest.mock('../supabase', () => ({ supabase: {} }));

describe('normalizeInstagram', () => {
  it('accepts @handle, bare handle and profile links', () => {
    expect(normalizeInstagram('@exotic.club')).toBe('exotic.club');
    expect(normalizeInstagram('  exotic_club ')).toBe('exotic_club');
    expect(normalizeInstagram('https://www.instagram.com/exoticclub/?hl=pt')).toBe('exoticclub');
  });

  it('rejects invalid handles', () => {
    expect(normalizeInstagram('')).toBeNull();
    expect(normalizeInstagram('@')).toBeNull();
    expect(normalizeInstagram('nome com espaço')).toBeNull();
    expect(normalizeInstagram('a'.repeat(31))).toBeNull();
  });
});

describe('isProfileComplete', () => {
  const base = { id: 'u', full_name: 'Ana Souza', instagram: 'ana', avatar_path: 'u/a.jpg' };

  it('requires name, Instagram and photo', () => {
    expect(isProfileComplete(base)).toBe(true);
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete({ ...base, full_name: ' ' })).toBe(false);
    expect(isProfileComplete({ ...base, instagram: null })).toBe(false);
    expect(isProfileComplete({ ...base, avatar_path: null })).toBe(false);
  });
});
