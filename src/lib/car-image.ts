// Automatic car photo lookup via Wikimedia Commons (free, CORS-enabled, no key).
export type CarQuery = { brand: string; model: string; version?: string; year?: string; color?: string };
export type FoundImage = { url: string; id: string; source: string; query: string; searched_at: string; page: string };

const COLORS: Record<string, string> = {
  preto: "black", branco: "white", vermelho: "red", azul: "blue", amarelo: "yellow", verde: "green",
  cinza: "grey", prata: "silver", laranja: "orange", roxo: "purple", marrom: "brown", bege: "beige", dourado: "gold",
};

const ALIASES: Record<string, string[]> = {
  white: ["white", "branco", "weiss", "weiß", "blanc", "bianco", "blanca"],
  black: ["black", "preto", "schwarz", "noir", "nero", "negro"],
  red: ["red", "vermelho", "rot", "rouge", "rosso", "rojo"],
  blue: ["blue", "azul", "blau", "bleu", "blu"],
  yellow: ["yellow", "amarelo", "gelb", "jaune", "giallo"],
  green: ["green", "verde", "grün", "vert"],
  grey: ["grey", "gray", "cinza", "grau", "gris", "grigio"],
  silver: ["silver", "prata", "silber", "argent", "argento"],
  orange: ["orange", "laranja", "arancio"],
};

function parts(...p: (string | undefined)[]) { return p.map((s) => s?.trim()).filter(Boolean).join(" "); }

async function search(query: string, colorWords?: string[], brand?: string): Promise<FoundImage | null> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6", gsrlimit: "30", prop: "imageinfo", iiprop: "url|size|mime", iiurlwidth: "1600",
  }).forEach(([k, v]) => u.searchParams.set(k, v));
  const res = await fetch(u);
  if (!res.ok) return null;
  const pages = Object.values((await res.json())?.query?.pages ?? {}) as {
    pageid: number; index: number; title: string;
    imageinfo?: { thumburl?: string; url: string; width: number; height: number; mime: string; descriptionurl: string }[];
  }[];
  const ok = pages
    .sort((a, b) => a.index - b.index)
    .find((p) => {
      const i = p.imageinfo?.[0];
      if (!i || !/jpe?g|png|webp/.test(i.mime) || i.width < 800 || i.width < i.height) return false;
      const t = p.title.toLowerCase().replace(/[_\-().,]/g, " ");
      if (brand && !t.includes(brand.toLowerCase())) return false;
      if (!colorWords) return true;
      return colorWords.some((w) => new RegExp(`(^|\\s)${w}(\\s|$)`).test(t));
    });
  if (!ok) return null;
  const i = ok.imageinfo![0]!;
  return { url: i.thumburl ?? i.url, id: String(ok.pageid), source: "Wikimedia Commons", query, searched_at: new Date().toISOString(), page: i.descriptionurl };
}

export async function findCarImage(q: CarQuery): Promise<FoundImage | null> {
  const raw = q.color?.trim().toLowerCase() ?? "";
  const color = raw ? COLORS[raw] ?? raw : "";
  const words = color ? ALIASES[color] ?? [color, raw] : undefined;
  const attempts: [string, string[] | undefined][] = [];
  if (color) {
    // Color-matching passes: the file title must mention the requested color.
    for (const query of [parts(q.year, q.brand, q.model, q.version, color), parts(q.brand, q.model, q.version, color), parts(q.brand, q.model, color)])
      attempts.push([query, words]);
  }
  for (const query of [parts(q.year, q.brand, q.model, q.version), parts(q.brand, q.model, q.version), parts(q.brand, q.model)])
    attempts.push([query, undefined]);
  const seen = new Set<string>();
  for (const [query, w] of attempts) {
    const key = query + "|" + !!w;
    if (!query || seen.has(key)) continue;
    seen.add(key);
    try {
      const r = await search(query, w, q.brand.trim());
      if (r) return r;
    } catch { /* try next */ }
  }
  return null;
}
