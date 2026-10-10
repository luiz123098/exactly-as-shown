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
  let room = DAILY_CAP - (count ?? 0);
  if (room <= 0) return 0;

  const { data: sources } = await db.from('news_sources').select('*').eq('active', true);
  const candidates: { item: FeedItem; score: number; source: { name: string; category: string; lang: string } }[] = [];
  for (const src of sources ?? []) {
    try {
      const res = await fetch(src.url, { headers: { 'user-agent': 'Mozilla/5.0 (Exotic Club News)' }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseFeed(await res.text()).filter((i) => Date.now() - i.date.getTime() < 2 * 86400_000);
      for (const item of items) candidates.push({ item, score: scoreItem(item), source: src });
      await db.from('news_sources').update({ last_synced_at: new Date().toISOString(), last_status: 'ok', last_count: items.length }).eq('id', src.id);
    } catch (e) {
      await db.from('news_sources').update({ last_synced_at: new Date().toISOString(), last_status: `erro: ${(e as Error).message}`.slice(0, 200) }).eq('id', src.id);
    }
  }

  const relevant = candidates.filter((c) => c.score >= MIN_SCORE).sort((a, b) => b.score - a.score);
  if (!relevant.length) return 0;
  // Skip links already imported and near-duplicate titles from the last 3 days
  // (the same story often appears on several sites).
  const [byUrl, recent] = await Promise.all([
    db.from('articles').select('external_url').in('external_url', relevant.map((c) => c.item.link)),
    db.from('articles').select('title').eq('origin', 'auto').gte('created_at', new Date(Date.now() - 3 * 86400_000).toISOString()),
  ]);
  const seenUrls = new Set((byUrl.data ?? []).map((e) => e.external_url));
  const seenTitles = new Set((recent.data ?? []).map((e) => e.title.toLowerCase().slice(0, 60)));

  let imported = 0;
  for (const { item, score, source } of relevant) {
    if (room <= 0) break;
    const key = item.title.toLowerCase().slice(0, 60);
    if (seenUrls.has(item.link) || seenTitles.has(key)) continue;
    let title = item.title;
    let excerpt = excerptOf(item.summary);
    if (source.lang !== 'pt') {
      try {
        [title, excerpt] = await toPortuguese([title, excerpt]) as [string, string];
      } catch {
        // Keep the original text if the translation service is unavailable.
      }
    }
    const { error } = await db.from('articles').insert({
      origin: 'auto', title: title.slice(0, 200), excerpt: excerpt.slice(0, 400),
      cover_url: item.image, external_url: item.link, source_name: source.name,
      category: categoryOf(item, source.category), score, published_at: item.date.toISOString(),
    });
    if (!error) {
      seenTitles.add(key);
      imported++;
      room--;
    }
  }
  return imported;
}

// Exotic Motors' Instagram (Graph API, Business account linked to a Facebook Page).
// Instagram image links expire, so each image is copied into the news bucket.
async function importInstagram(db: Db) {
  const igUser = Deno.env.get('IG_USER_ID');
  const token = Deno.env.get('IG_ACCESS_TOKEN');
  if (!igUser || !token) return 0;
  const url = `https://graph.facebook.com/v21.0/${igUser}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=10&access_token=${token}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`Instagram HTTP ${res.status}`);
  const { data } = await res.json() as { data: { id: string; caption?: string; media_type: string; media_url?: string;
    thumbnail_url?: string; permalink: string; timestamp: string }[] };
  const fresh = data.filter((m) => Date.now() - new Date(m.timestamp).getTime() < KEEP_DAYS * 86400_000);
  const { data: existing } = await db.from('articles').select('external_url').in('external_url', fresh.map((m) => m.permalink));
  const seen = new Set((existing ?? []).map((e) => e.external_url));

  let imported = 0;
  for (const m of fresh.reverse()) {
    if (seen.has(m.permalink)) continue;
    let cover_path: string | null = null;
    const img = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
    if (img) {
      const pic = await fetch(img, { signal: AbortSignal.timeout(12000) });
      if (pic.ok) {
        const path = `exotic/ig-${m.id}.jpg`;
        const { error } = await db.storage.from('news').upload(path, await pic.arrayBuffer(), { contentType: 'image/jpeg', upsert: true });
        if (!error) cover_path = path;
      }
    }
    const caption = (m.caption ?? '').trim();
    const firstLine = caption.split('\n')[0]?.trim() || 'Novo post da Exotic Motors';
    const { error } = await db.from('articles').insert({
      origin: 'exotic', title: firstLine.slice(0, 200).padEnd(3, '.'), excerpt: excerptOf(caption).slice(0, 400),
      body: caption.slice(0, 5000), cover_path, external_url: m.permalink, source_name: 'Exotic Motors',
      category: 'Exotic Motors', published_at: m.timestamp,
    });
    if (!error) imported++;
  }
  return imported;
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
  try { result.removed = await cleanup(db); } catch (e) { result.removed = `erro: ${(e as Error).message}`; }
  return json(result);
});
