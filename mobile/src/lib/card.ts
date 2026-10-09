// Member card codes: 8 characters, shown as "ABCD-2345" and encoded in the QR
// as "EXC:ABCD2345" so the scanner can tell them apart from any other QR.
const PREFIX = 'EXC:';

export function qrPayload(code: string) {
  return PREFIX + code;
}

export function formatCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

// True for our QR codes and for codes typed by hand (with or without the dash).
export function looksLikeCardCode(input: string) {
  const v = input.trim().toUpperCase().replace(/^EXC:/, '').replace(/[^A-Z0-9]/g, '');
  return /^[A-Z2-9]{8}$/.test(v);
}

export function secondsLeft(expiresAt: string, now = Date.now()) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}
