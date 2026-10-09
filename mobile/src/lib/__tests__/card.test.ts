import { describe, expect, it } from '@jest/globals';

import { formatCode, looksLikeCardCode, qrPayload, secondsLeft } from '../card';

describe('card codes', () => {
  it('formats and encodes the code', () => {
    expect(formatCode('ABCD2345')).toBe('ABCD-2345');
    expect(qrPayload('ABCD2345')).toBe('EXC:ABCD2345');
  });

  it('recognizes scanned and typed codes, rejecting other QR content', () => {
    expect(looksLikeCardCode('EXC:ABCD2345')).toBe(true);
    expect(looksLikeCardCode(' abcd-2345 ')).toBe(true);
    expect(looksLikeCardCode('https://exemplo.com')).toBe(false);
    expect(looksLikeCardCode('ABC')).toBe(false);
  });

  it('counts down to the expiry without going negative', () => {
    expect(secondsLeft('2026-10-09T12:00:30Z', Date.parse('2026-10-09T12:00:00Z'))).toBe(30);
    expect(secondsLeft('2026-10-09T12:00:00Z', Date.parse('2026-10-09T12:01:00Z'))).toBe(0);
  });
});
