// RSS parsing and relevance scoring for the news feed (no Deno APIs, so the
// app's tests can import it). Only titles, summaries, images and links are
// kept: the full article stays on the source site.

const PREMIUM = ['ferrari', 'porsche', 'lamborghini', 'mclaren', 'bugatti', 'aston martin', 'bentley', 'rolls-royce',
  'rolls royce', 'maserati', 'pagani', 'koenigsegg', 'bmw m', 'mercedes-amg', 'amg', 'audi rs', 'lotus', 'rimac',
  'supercarro', 'supercar', 'hypercar', 'esportivo', 'luxo', 'luxury', 'gt3', 'turbo s'];
const TOPICS = ['lançamento', 'lança', 'estreia', 'revela', 'apresenta', 'reveal', 'debut', 'unveil', 'f1',
  'fórmula 1', 'formula 1', 'le mans', 'motorsport', 'elétrico', 'híbrido', 'electric', 'hybrid', 'recorde', 'record'];
const TECH = ['elétrico', 'electric', 'bateria', 'battery', 'autônomo', 'autonomous', 'software', 'inteligência artificial'];

export type FeedItem = { title: string; link: string; summary: string; date: Date; image: string | null; cats: string[] };

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");
const strip = (s: string) => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml: string, t: string) => xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i'))?.[1] ?? '';

export function parseFeed(xml: string): FeedItem[] {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []).slice(0, 30).map((it) => {
    const desc = tag(it, 'description');
    const image = it.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1]
      ?? it.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i)?.[1]
      ?? decode(desc).match(/<img[^>]*src="([^"]+)"/i)?.[1] ?? null;
    const pub = strip(tag(it, 'pubDate'));
    const date = pub ? new Date(pub) : new Date();
    return {
      title: strip(tag(it, 'title')),
      link: strip(tag(it, 'link')) || strip(tag(it, 'guid')),
      summary: strip(desc),
      date: isNaN(date.getTime()) ? new Date() : date,
      image: image && /^https:\/\//.test(image) ? image : null,
      cats: [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => strip(m[1] ?? '')).filter(Boolean),
    };
  }).filter((i) => i.title && /^https?:\/\//.test(i.link));
}

// Whole words/phrases only ("luxo" must not match "fluxo", "f1" not "f150").
const boundary = (k: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu');
const PREMIUM_RE = PREMIUM.map(boundary);
const TOPICS_RE = TOPICS.map(boundary);
const TECH_RE = TECH.map(boundary);

// Premium brands weigh double; launches, motorsport and tech add one each.
export function scoreItem(i: Pick<FeedItem, 'title' | 'summary' | 'cats'>) {
  const t = `${i.title} ${i.summary} ${i.cats.join(' ')}`;
  return PREMIUM_RE.filter((r) => r.test(t)).length * 2 + TOPICS_RE.filter((r) => r.test(t)).length;
}

export function categoryOf(i: Pick<FeedItem, 'title' | 'summary'>, fallback: string) {
  return TECH_RE.some((r) => r.test(`${i.title} ${i.summary}`)) ? 'Tecnologia' : fallback;
}

export const excerptOf = (summary: string) => (summary.length > 280 ? `${summary.slice(0, 280).trimEnd()}…` : summary);
