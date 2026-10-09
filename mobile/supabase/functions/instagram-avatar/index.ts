// Copies the caller's public Instagram profile photo into their avatar folder.
// Instagram has no official API for this and may block the request; any
// failure returns avatar_path: null and the app asks the member for a photo.
import { admin, caller, json } from '../_shared/common.ts';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

async function profilePicUrl(username: string): Promise<string | null> {
  const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
    headers: { 'User-Agent': UA, 'X-IG-App-ID': '936619743392459', Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.warn('instagram profile lookup failed', res.status);
    return null;
  }
  const body = await res.json().catch(() => null);
  const url = body?.data?.user?.profile_pic_url_hd ?? body?.data?.user?.profile_pic_url;
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const user = await caller(req);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const db = admin();

  // Use the username saved on the profile (already validated by the database).
  const { data: profile } = await db.from('profiles').select('instagram').eq('id', user.id).maybeSingle();
  if (!profile?.instagram) return json({ avatar_path: null });

  try {
    const url = await profilePicUrl(profile.instagram);
    if (!url) return json({ avatar_path: null });
    const img = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    const type = img.headers.get('content-type') ?? '';
    if (!img.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) return json({ avatar_path: null });
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (bytes.byteLength > 5 * 1024 * 1024) return json({ avatar_path: null });

    // Instagram's photo links expire, so the image is copied into storage.
    const path = `${user.id}/instagram-${Date.now()}.${type.split('/')[1]}`;
    const { error: upErr } = await db.storage.from('avatars').upload(path, bytes, { contentType: type });
    if (upErr) throw upErr;
    const { error } = await db.from('profiles').update({ avatar_path: path }).eq('id', user.id);
    if (error) throw error;
    return json({ avatar_path: path });
  } catch (e) {
    console.error('instagram avatar import failed', e);
    return json({ avatar_path: null });
  }
});
