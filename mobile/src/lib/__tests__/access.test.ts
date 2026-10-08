import { describe, expect, it } from '@jest/globals';

import { kindOf, type Access } from '../access';

const base: Access = {
  is_admin: false,
  is_subscriber: false,
  membership_expires_at: null,
  member_application: null,
  partner: null,
};

describe('kindOf', () => {
  it('treats a fresh account as non-subscriber', () => {
    expect(kindOf(base)).toBe('non_subscriber');
  });

  it('requires the server-computed subscriber flag, not just an approved application', () => {
    expect(kindOf({ ...base, member_application: { status: 'approved', decision_reason: null } })).toBe('non_subscriber');
    expect(kindOf({ ...base, is_subscriber: true })).toBe('subscriber');
  });

  it('only counts approved and active partners', () => {
    const partner = { id: 'p', company_name: 'X', status: 'approved' as const, active: true };
    expect(kindOf({ ...base, partner })).toBe('partner');
    expect(kindOf({ ...base, partner: { ...partner, active: false } })).toBe('non_subscriber');
    expect(kindOf({ ...base, partner: { ...partner, status: 'meeting_proposed' } })).toBe('non_subscriber');
  });

  it('gives admin precedence', () => {
    expect(kindOf({ ...base, is_admin: true, is_subscriber: true })).toBe('admin');
  });
});
