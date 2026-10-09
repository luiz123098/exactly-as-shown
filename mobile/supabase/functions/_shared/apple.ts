import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

// Secrets set with `supabase secrets set` — never shipped in the app.
const TEAM_ID = Deno.env.get('APPLE_TEAM_ID');
const KEY_ID = Deno.env.get('APPLE_KEY_ID');
const PRIVATE_KEY = Deno.env.get('APPLE_PRIVATE_KEY');
// Native sign-in tokens are issued to the app's bundle ID.
const CLIENT_ID = Deno.env.get('APPLE_CLIENT_ID') ?? 'com.exoticclub.app';

export const appleConfigured = !!(TEAM_ID && KEY_ID && PRIVATE_KEY);

// Apple's client secret is a short-lived JWT signed with the .p8 key.
async function clientSecret() {
  const key = await importPKCS8(PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: KEY_ID! })
    .setIssuer(TEAM_ID!)
    .setSubject(CLIENT_ID)
    .setAudience('https://appleid.apple.com')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

async function post(path: string, params: Record<string, string>) {
  return await fetch(`https://appleid.apple.com/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: await clientSecret(), ...params }),
  });
}

// Exchanges the one-time authorization code from the app for a refresh token.
export async function exchangeCode(code: string): Promise<string | null> {
  const res = await post('token', { code, grant_type: 'authorization_code' });
  if (!res.ok) {
    console.error('apple token exchange failed', res.status, await res.text());
    return null;
  }
  const body = await res.json();
  return typeof body.refresh_token === 'string' ? body.refresh_token : null;
}

export async function revoke(refreshToken: string): Promise<boolean> {
  const res = await post('revoke', { token: refreshToken, token_type_hint: 'refresh_token' });
  if (!res.ok) console.error('apple revoke failed', res.status, await res.text());
  return res.ok;
}
