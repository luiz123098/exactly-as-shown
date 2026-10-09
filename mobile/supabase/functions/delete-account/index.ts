// Deletes the caller's account: revokes Sign in with Apple (App Store rule),
// removes their photos and deletes the auth user (rows cascade).
import { revoke } from '../_shared/apple.ts';
import { admin, caller, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const user = await caller(req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const db = admin();

  const { data: apple } = await db.from('apple_tokens').select('refresh_token').eq('user_id', user.id).maybeSingle();
  // Keep the account if Apple refuses, so the member can retry and the
  // revocation is never skipped.
  if (apple && !(await revoke(apple.refresh_token))) return json({ error: 'apple revoke failed' }, 502);

  const { data: files } = await db.storage.from('avatars').list(user.id);
  if (files?.length) await db.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`));

  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
