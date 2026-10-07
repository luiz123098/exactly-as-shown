// Automatic car photo lookup via Wikimedia Commons (free, CORS-enabled, no key).
export type CarQuery = { brand: string; model: string; version?: string; year?: string; color?: string };
export type FoundImage = { url: string; id: string; source: string; query: string; searched_at: string; page: string };

const COLORS: Record<string, string> = {
  preto: "black", branco: "white", vermelho: "red", azul: "blue", amarelo: "yellow", verde: "green",
  cinza: "grey", prata: "silver", laranja: "orange", roxo: "purple", marrom: "brown", bege: "beige", dourado: "gold",
};

function queries(q: CarQuery) {
  const color = q.color ? COLORS[q.color.trim().toLowerCase()] ?? q.color.trim() : "";
  const parts = (...p: (string | undefined)[]) => p.map((s) => s?.trim()).filter(Boolean).join(" ");
  return Array.from(new Set([
    parts(q.year, q.brand, q.model, q.version, color),
    parts(q.year, q.brand, q.model, q.version),
    parts(q.brand, q.model, q.version),
    parts(q.brand, q.model, color),
    parts(q.brand, q.model),
  ].filter(Boolean)));
}

async function search(query: string): Promise<FoundImage | null> {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  Object.entries({
    action: "query", format: "json", origin: "*", generator: "search", gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6", gsrlimit: "10", prop: "imageinfo", iiprop: "url|size|mime", iiurlwidth: "1600",
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
      return i && /jpe?g|png|webp/.test(i.mime) && i.width >= 800 && i.width >= i.height;
    });
  if (!ok) return null;
  const i = ok.imageinfo![0];
  return { url: i.thumburl ?? i.url, id: String(ok.pageid), source: "Wikimedia Commons", query, searched_at: new Date().toISOString(), page: i.descriptionurl };
}

export async function findCarImage(q: CarQuery): Promise<FoundImage | null> {
  for (const query of queries(q)) {
    try {
      const r = await search(query);
      if (r) return r;
    } catch { /* try next */ }
  }
  return null;
}
