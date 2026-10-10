// Hourly job (pg_cron) and admin "Atualizar agora": imports the most relevant
// automotive news, Exotic Motors' Instagram posts (when configured) and deletes
// everything older than 45 days, images included.
import { categoryOf, excerptOf, parseFeed, scoreItem, type FeedItem } from '../_shared/rss.ts';
import { admin, caller, json } from '../_shared/common.ts';

const DAILY_CAP = 8; // automatic news per day
const MIN_SCORE = 3; // relevance threshold
const KEEP_DAYS = 45;

type Db = ReturnType<typeof admin>;

// Google Cloud Translation (free tier covers our volume). Without a key, the
// text stays in its original language.
async function toPortuguese(texts: string[]): Promise<string[]> {
  const key = Deno.env.get('GOOGLE_TRANSLATE_KEY');
  if (!key) return texts;
  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target: 'pt', format: 'text' }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Translate HTTP ${res.status}`);
  const { data } = await res.json() as { data: { translations: { translatedText: string }[] } };
  return data.translations.map((t, i) => t.translatedText || texts[i]!);
}

async function authorized(req: Request, db: Db) {
  const secret = Deno.env.get('CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') === secret) return true;
  const user = await caller(req);
  if (!user) return false;
  const { data } = await db.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  return !!data;
}

async function importNews(db: Db) {
  const since = new Date(Date.now() - 86400_000).toISOString();
  const { count } = await db.from('articles').select('id', { count: 'exact', head: true })
    .eq('origin', 'auto').gte('created_at', since);
  const room = DAILY_CAP - (count ?? 0);
  if (room <= 0) return 0;

  // All feeds at once, so one slow site doesn't delay the others.
  const { data: sources } = await db.from('news_sources').select('*').eq('active', true);
  type Source = { id: string; name: string; url: string; category: string; lang: string };
  const results = await Promise.all((sources ?? []).map(async (src: Source) => {
    try {
      const res = await fetch(src.url, { headers: { 'user-agent': 'Mozilla/5.0 (Exotic Club News)' }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text()).filter((i) => Date.now() - i.date.getTime() < 2 * 86400_000);
      await db.from('news_sources').update({ last_synced_at: new Date().toISOString(), last_status: 'ok', last_count: items.length }).eq('id', src.id);
      return items.map((item) => ({ item, score: scoreItem(item), source: src }));
    } catch (e) {
      await db.from('news_sources').update({ last_synced_at: new Date().toISOString(), last_status: `erro: ${(e as Error).message}`.slice(0, 200) }).eq('id', src.id);
      return [];
    }
  }));

  const relevant = results.flat().filter((c) => c.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
  if (!relevant.length) return 0;
  // Skip links already imported or removed by an admin, and near-duplicate
  // titles from the last 3 days (the same story often appears on several sites).
  const links = relevant.map((c) => c.item.link);
  const [byUrl, removed, recent] = await Promise.all([
    db.from('articles').select('external_url').in('external_url', links),
    db.from('removed_external_urls').select('url').in('url', links),
    db.from('articles').select('title').eq('origin', 'auto').gte('created_at', new Date(Date.now() - 3 * 86400_000).toISOString()),
  ]);
  const seenUrls = new Set([...(byUrl.data ?? []).map((e) => e.external_url), ...(removed.data ?? []).map((e) => e.url)]);
  const seenTitles = new Set((recent.data ?? []).map((e) => e.title.toLowerCase().slice(0, 60)));

  const picked: typeof relevant = [];
  for (const c of relevant) {
    if (picked.length >= room) break;
    const key = c.item.title.toLowerCase().slice(0, 60);
    if (seenUrls.has(c.item.link) || seenTitles.has(key)) continue;
    seenTitles.add(key);
    picked.push(c);
  }

  // One translation call for every non-Portuguese title and summary.
  const foreign = picked.filter((c) => c.source.lang !== 'pt');
  let translated: string[] = [];
  if (foreign.length) {
    try {
      translated = await toPortuguese(foreign.flatMap((c) => [c.item.title, excerptOf(c.item.summary)]));
    } catch {
      translated = [];
    }
  }

  let imported = 0;
  for (const c of picked) {
    const f = foreign.indexOf(c);
    const title = f >= 0 && translated.length ? translated[f * 2]! : c.item.title;
    const excerpt = f >= 0 && translated.length ? translated[f * 2 + 1]! : excerptOf(c.item.summary);
    const { error } = await db.from('articles').insert({
      origin: 'auto', title: title.slice(0, 200), excerpt: excerpt.slice(0, 400),
      cover_url: c.item.image, external_url: c.item.link, source_name: c.source.name,
      category: categoryOf(c.item, c.source.category), score: c.score, published_at: c.item.date.toISOString(),
    });
    if (!error) imported++;
  }
  return imported;
}

type IgMedia = { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string;
  permalink: string; timestamp: string };

// Instagram Graph API (Business account linked to a Facebook Page).
async function fetchInstagram(igUser: string, token: string, limit: number): Promise<IgMedia[]> {
  const url = `https://graph.facebook.com/v21.0/${igUser}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=${limit}&access_token=${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Instagram HTTP ${res.status}`);
  return ((await res.json()) as { data: IgMedia[] }).data;
}

// Instagram image links expire, so each image (or video thumbnail) is copied.
// Returns null on any failure; callers skip the post so the next run retries it.
async function copyImage(db: Db, bucket: string, path: string, m: IgMedia) {
  try {
    const img = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
    if (!img) return null;
    const pic = await fetch(img, { signal: AbortSignal.timeout(15000) });
    if (!pic.ok) return null;
    const { error } = await db.storage.from(bucket).upload(path, await pic.arrayBuffer(), { contentType: 'image/jpeg', upsert: true });
    return error ? null : path;
  } catch {
    return null;
  }
}

// Exotic Motors' Instagram → news feed (and notifies everyone, like admin posts).
async function importInstagram(db: Db) {
  const igUser = Deno.env.get('IG_USER_ID');
  const token = Deno.env.get('IG_ACCESS_TOKEN');
  if (!igUser || !token) return 0;
  // A few days short of the 45-day cleanup, so deleted posts aren't imported again.
  const fresh = (await fetchInstagram(igUser, token, 10)).filter((m) => Date.now() - new Date(m.timestamp).getTime() < (KEEP_DAYS - 5) * 86400_000);
  const links = fresh.map((m) => m.permalink);
  const [existing, removed] = await Promise.all([
    db.from('articles').select('external_url').in('external_url', links),
    db.from('removed_external_urls').select('url').in('url', links),
  ]);
  const seen = new Set([...(existing.data ?? []).map((e) => e.external_url), ...(removed.data ?? []).map((e) => e.url)]);

  let imported = 0;
  for (const m of fresh.reverse()) {
    if (seen.has(m.permalink)) continue;
    const cover_path = await copyImage(db, 'news', `exotic/ig-${m.id}.jpg`, m);
    if (!cover_path) continue;
    const caption = (m.caption ?? '').trim();
    const firstLine = caption.split('\n')[0]?.trim() ?? '';
    // Characters as Postgres counts them (an emoji is one), between 3 and 200.
    const chars = Array.from(firstLine);
    const title = chars.length >= 3 ? chars.slice(0, 200).join('') : 'Novo post da Exotic Motors';
    const { error } = await db.from('articles').insert({
      origin: 'exotic', title, excerpt: excerptOf(caption).slice(0, 400),
      body: caption.slice(0, 5000), cover_path, external_url: m.permalink, source_name: 'Exotic Motors',
      category: 'Exotic Motors', published_at: m.timestamp,
    });
    if (!error) imported++;
  }
  return imported;
}

// Exotic Experience's Instagram → pool of event media; an admin assigns each
// post to one event. These are kept (events are not cleaned up).
async function importExperience(db: Db) {
  const igUser = Deno.env.get('IG_EXPERIENCE_USER_ID');
  const token = Deno.env.get('IG_EXPERIENCE_TOKEN') ?? Deno.env.get('IG_ACCESS_TOKEN');
  if (!igUser || !token) return 0;
  const media = await fetchInstagram(igUser, token, 25);
  const { data: existing } = await db.from('event_media').select('ig_id').in('ig_id', media.map((m) => m.id));
  const seen = new Set((existing ?? []).map((e) => e.ig_id));
  let imported = 0;
  for (const m of media) {
    if (seen.has(m.id)) continue;
    const media_path = await copyImage(db, 'events', `instagram/${m.id}.jpg`, m);
    if (!media_path) continue;
    const { error } = await db.from('event_media').insert({
      source: 'instagram', ig_id: m.id, media_type: m.media_type === 'VIDEO' ? 'video' : 'image', media_path,
      caption: (m.caption ?? '').slice(0, 2200), permalink: m.permalink, taken_at: m.timestamp,
    });
    if (!error) imported++;
  }
  return imported;
}

// Images uploaded by the app whose event or post was deleted while offline.
async function cleanupEventImages(db: Db) {
  const { data: files } = await db.storage.from('events').list('app', { limit: 1000 });
  if (!files?.length) return 0;
  const dayAgo = Date.now() - 86400_000;
  const old = files.filter((f) => f.created_at && new Date(f.created_at).getTime() < dayAgo).map((f) => `app/${f.name}`);
  if (!old.length) return 0;
  const [covers, media] = await Promise.all([
    db.from('events').select('cover_path').in('cover_path', old),
    db.from('event_media').select('media_path').in('media_path', old),
  ]);
  const used = new Set([...(covers.data ?? []).map((r) => r.cover_path), ...(media.data ?? []).map((r) => r.media_path)]);
  const orphans = old.filter((p) => !used.has(p));
  if (orphans.length) await db.storage.from('events').remove(orphans);
  return orphans.length;
}

async function cleanup(db: Db) {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 86400_000).toISOString();
  const { data: old } = await db.from('articles').select('id, cover_path').lt('published_at', cutoff).limit(500);
  if (!old?.length) return 0;
  const files = old.map((a) => a.cover_path).filter((p): p is string => !!p);
  if (files.length) await db.storage.from('news').remove(files);
  await db.from('articles').delete().in('id', old.map((a) => a.id));
  return old.length;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const db = admin();
  if (!(await authorized(req, db))) return json({ error: 'unauthorized' }, 401);
  const result: Record<string, unknown> = {};
  try { result.news = await importNews(db); } catch (e) { result.news = `erro: ${(e as Error).message}`; }
  try { result.instagram = await importInstagram(db); } catch (e) { result.instagram = `erro: ${(e as Error).message}`; }
  try { result.experience = await importExperience(db); } catch (e) { result.experience = `erro: ${(e as Error).message}`; }
  try { result.removed = await cleanup(db); } catch (e) { result.removed = `erro: ${(e as Error).message}`; }
  try { result.orphanImages = await cleanupEventImages(db); } catch (e) { result.orphanImages = `erro: ${(e as Error).message}`; }
  return json(result);
});
