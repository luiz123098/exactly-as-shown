import { describe, expect, it, jest } from '@jest/globals';

import { byStatus, memberSchema, partnerSchema, whatsappUrl } from '../applications';

jest.mock('../supabase', () => ({ supabase: {} }));

const member = {
  full_name: 'Ana Souza',
  email: 'ana@exemplo.com',
  phone: '(11) 98765-4321',
  city: 'São Paulo',
  profession: 'Empresária',
  instagram: '@ana.souza',
  cars: '',
  reason: 'Apaixonada por carros esportivos.',
};

describe('memberSchema', () => {
  it('normalizes Instagram and empty optional fields', () => {
    const r = memberSchema.parse(member);
    expect(r.instagram).toBe('ana.souza');
    expect(r.cars).toBeNull();
  });

  it('rejects a phone without area code and a bad Instagram', () => {
    const r = memberSchema.safeParse({ ...member, phone: '98765', instagram: 'not valid!' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(['phone', 'instagram']);
  });
});

describe('partnerSchema', () => {
  it('accepts an Instagram profile link for the company', () => {
    const r = partnerSchema.parse({
      responsible_name: 'Carlos Lima',
      email: 'carlos@empresa.com',
      phone: '11987654321',
      company_name: 'Lima Detailing',
      niche: 'Estética automotiva',
      instagram_responsible: 'carlos',
      instagram_company: 'https://instagram.com/limadetailing/',
      reason: 'Queremos oferecer descontos aos membros.',
    });
    expect(r.instagram_company).toBe('limadetailing');
  });
});

describe('whatsappUrl', () => {
  it('adds the Brazilian country code only when missing', () => {
    expect(whatsappUrl('(11) 98765-4321')).toBe('https://wa.me/5511987654321');
    expect(whatsappUrl('+55 11 98765-4321')).toBe('https://wa.me/5511987654321');
  });
});

describe('byStatus', () => {
  it('lists pending first, newest first within a status', () => {
    const rows = [
      { status: 'approved', created_at: '2026-10-03' },
      { status: 'pending', created_at: '2026-10-01' },
      { status: 'pending', created_at: '2026-10-02' },
    ];
    expect(rows.sort(byStatus).map((r) => r.created_at)).toEqual(['2026-10-02', '2026-10-01', '2026-10-03']);
  });
});
