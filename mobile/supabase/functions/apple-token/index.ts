// Stores the Apple refresh token of the signed-in user so delete-account can
// revoke it. Called by the app right after Sign in with Apple.
import { appleConfigured, exchangeCode } from '../_shared/apple.ts';
import { admin, caller, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const user = await caller(req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  if (!appleConfigured) return json({ error: 'apple not configured' }, 503);

  const { code } = await req.json().catch(() => ({}));
  if (typeof code !== 'string' || code.length > 2000) return json({ error: 'invalid code' }, 400);

  const refreshToken = await exchangeCode(code);
  if (!refreshToken) return json({ error: 'exchange failed' }, 502);

  const { error } = await admin()
    .from('apple_tokens')
    .upsert({ user_id: user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
