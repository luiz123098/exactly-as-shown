import { describe, expect, it, jest } from '@jest/globals';

import { parseAuthFragment } from '../auth-link';

jest.mock('../supabase', () => ({ supabase: {} }));

describe('parseAuthFragment', () => {
  it('reads the session tokens from a confirmation redirect', () => {
    expect(parseAuthFragment('exoticclub:///#access_token=a&refresh_token=r&type=signup')).toEqual({
      accessToken: 'a', refreshToken: 'r', error: null,
    });
  });

  it('reports the error of an expired link and ignores plain deep links', () => {
    expect(parseAuthFragment('exoticclub:///#error=access_denied&error_description=Email+link+is+invalid')?.error)
      .toBe('Email link is invalid');
    expect(parseAuthFragment('exoticclub:///perfil')).toBeNull();
  });
});
