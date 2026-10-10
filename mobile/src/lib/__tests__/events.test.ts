import { describe, expect, it, jest } from '@jest/globals';

import { eventSchema, formatEventDate } from '../events';

jest.mock('../supabase', () => ({ supabase: {} }));

describe('formatEventDate', () => {
  it('shows one day with start and end times', () => {
    const s = new Date(2026, 10, 14, 19, 0).toISOString();
    const e = new Date(2026, 10, 14, 23, 30).toISOString();
    expect(formatEventDate(s, e)).toMatch(/14 de novembro de 2026 · 19:00 às 23:30$/);
  });

  it('shows an end on another day', () => {
    const s = new Date(2026, 10, 14, 9, 0).toISOString();
    const e = new Date(2026, 10, 15, 18, 0).toISOString();
    expect(formatEventDate(s, e)).toMatch(/até 15 de novembro 18:00$/);
  });
});

describe('eventSchema', () => {
  it('requires a title', () => {
    expect(eventSchema.safeParse({ title: 'Ab', venue: '', address: '', city: '', program: '', rules: '' }).success).toBe(false);
  });
});
