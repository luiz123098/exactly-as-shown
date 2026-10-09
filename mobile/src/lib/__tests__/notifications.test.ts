import { describe, expect, it, jest } from '@jest/globals';

import { notificationHref, timeAgo } from '../notifications';

jest.mock('../supabase', () => ({ supabase: {} }));

describe('notificationHref', () => {
  it('keeps app links and maps retired ones to the profile', () => {
    expect(notificationHref('/admin?aba=fotos')).toBe('/admin?aba=fotos');
    expect(notificationHref('/status')).toBe('/perfil');
    expect(notificationHref(null)).toBe('/notificacoes');
    expect(notificationHref('/admin?aba=fotos', 'x1')).toBe('/admin?aba=fotos&n=x1');
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  it('uses short relative times', () => {
    expect(timeAgo('2026-10-10T11:59:40Z', now)).toBe('agora');
    expect(timeAgo('2026-10-10T11:45:00Z', now)).toBe('15 min');
    expect(timeAgo('2026-10-10T09:00:00Z', now)).toBe('3 h');
    expect(timeAgo('2026-10-08T12:00:00Z', now)).toBe('2 d');
  });
});
