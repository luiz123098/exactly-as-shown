// Server-only RSS curation: fetch sources, score relevance, dedupe, store summaries (never full text).
type Admin = typeof import("@/integrations/supabase/client.server").supabaseAdmin;

const PREMIUM = ["ferrari", "porsche", "lamborghini", "mclaren", "bugatti", "aston martin", "bentley", "rolls-royce", "rolls royce", "maserati", "pagani", "koenigsegg", "bmw m", "mercedes-amg", "amg", "audi rs", "lotus", "rimac", "supercarro", "supercar", "hypercar", "esportivo", "luxo", "luxury", "gt3", "turbo s"];
const TOPICS = ["lançamento", "lança", "estreia", "revela", "apresenta", "novo", "nova", "reveal", "debut", "unveil", "f1", "fórmula 1", "formula 1", "le mans", "motorsport", "elétrico", "híbrido", "electric", "hybrid", "tecnologia", "salão", "recorde", "record"];
const TECH = ["elétrico", "electric", "bateria", "battery", "autônomo", "autonomous", "software", "inteligência artificial", "gemini", " ia "];
const BRANDS = ["Ferrari", "Porsche", "Lamborghini", "McLaren", "Bugatti", "Aston Martin", "Bentley", "Rolls-Royce", "Maserati", "BMW", "Mercedes", "Audi", "Lotus", "Toyota", "Honda", "Ford", "Chevrolet", "Volkswagen", "Fiat", "Jeep", "Renault", "BYD", "GWM", "Tesla", "Hyundai", "Volvo", "Land Rover", "Jaguar", "Nissan", "Peugeot", "F1"];

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");
const strip = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (xml: string, t: string) => xml.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i"))?.[1] ?? "";

function parse(xml: string) {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []).slice(0, 25).map((it) => {
    const desc = tag(it, "description");
    const img = it.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1]
      ?? it.match(/<media:(?:content|thumbnail)[^>]*url="([^"]+)"/i)?.[1]
      ?? decode(desc).match(/<img[^>]*src="([^"]+)"/i)?.[1] ?? null;
    const cats = [...it.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map((m) => strip(m[1] ?? "")).filter(Boolean);
    return {
      title: strip(tag(it, "title")),
      link: strip(tag(it, "link")) || strip(tag(it, "guid")),
      summary: strip(desc),
      date: tag(it, "pubDate") ? new Date(strip(tag(it, "pubDate"))) : new Date(),
      image: img, cats,
    };
  }).filter((i) => i.title && /^https?:\/\//.test(i.link));
}

function score(text: string) {
  const t = ` ${text.toLowerCase()} `;
  return PREMIUM.filter((k) => t.includes(k)).length * 2 + TOPICS.filter((k) => t.includes(k)).length;
}

export async function runNewsSync(admin: Admin, force: boolean) {
  const { data: settings } = await admin.from("news_settings").select("*").eq("id", 1).maybeSingle();
  const s = settings ?? { interval_minutes: 60, auto_publish: true, min_score: 1, last_run_at: null };
  if (!force && s.last_run_at && Date.now() - new Date(s.last_run_at).getTime() < s.interval_minutes * 60_000 - 60_000)
    return { skipped: true, imported: 0 };
  await admin.from("news_settings").update({ last_run_at: new Date().toISOString() }).eq("id", 1);

  const { data: sources } = await admin.from("news_sources").select("*").eq("active", true);
  let imported = 0;
  for (const src of sources ?? []) {
    try {
      const res = await fetch(src.url, { headers: { "user-agent": "Mozilla/5.0 (EXOTIC News)" }, signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parse(await res.text()).filter((i) => Date.now() - i.date.getTime() < 7 * 86400_000);
      const { data: existing } = await admin.from("articles").select("external_url, title").in("external_url", items.map((i) => i.link));
      const seen = new Set((existing ?? []).map((e) => e.external_url));
      const { data: recent } = await admin.from("articles").select("title").eq("origin", "auto").gte("created_at", new Date(Date.now() - 3 * 86400_000).toISOString());
      const titles = new Set((recent ?? []).map((r) => r.title.toLowerCase().slice(0, 60)));
      const rows = items.filter((i) => !seen.has(i.link) && !titles.has(i.title.toLowerCase().slice(0, 60))).map((i) => {
        const text = `${i.title} ${i.summary} ${i.cats.join(" ")}`;
        const sc = score(text);
        const low = ` ${text.toLowerCase()} `;
        const category = TECH.some((k) => low.includes(k)) ? "Tecnologia" : src.category;
        const tags = [...new Set([...BRANDS.filter((b) => low.includes(b.toLowerCase())), ...i.cats.slice(0, 4)])].slice(0, 8);
        const publish = s.auto_publish && sc >= s.min_score;
        return {
          title: i.title.slice(0, 200),
          excerpt: i.summary.slice(0, 280) + (i.summary.length > 280 ? "…" : ""),
          body: "", category, cover_url: i.image, origin: "auto", status: publish ? "published" : "pending",
          published: publish, source_name: src.name, source_url: src.url, external_url: i.link,
          tags, score: sc, created_at: i.date.toISOString(),
        };
      });
      if (rows.length) {
        const { error } = await admin.from("articles").upsert(rows, { onConflict: "external_url", ignoreDuplicates: true });
        if (error) throw error;
      }
      imported += rows.length;
      await admin.from("news_sources").update({ last_synced_at: new Date().toISOString(), last_status: "ok", last_count: rows.length }).eq("id", src.id);
    } catch (e) {
      await admin.from("news_sources").update({ last_synced_at: new Date().toISOString(), last_status: `erro: ${(e as Error).message}`.slice(0, 200) }).eq("id", src.id);
    }
  }
  return { skipped: false, imported };
}
