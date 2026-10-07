import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Eye, EyeOff, Play, Plus, Star, Trash2 } from "lucide-react";
import { findCarImage } from "@/lib/car-image";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Empty, PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/app/garagem")({
  head: () => ({ meta: [{ title: "Garagem — Exotic Experience" }, { name: "description", content: "As garagens dos membros EXOTIC: carros, fotos e vídeos." }, { property: "og:title", content: "Garagem — Exotic Experience" }, { property: "og:description", content: "As garagens dos membros EXOTIC: carros, fotos e vídeos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Garage,
});

type CarRow = { id: string; user_id: string; author_name: string; brand: string; model: string; version: string | null; image_source: string; year: number | null; color: string | null; description: string; photo_url: string | null; video_url: string | null };

async function resolve(cars: CarRow[]) {
  const paths = cars.flatMap((c) => [c.photo_url, c.video_url]).filter((p): p is string => !!p && !p.startsWith("http"));
  if (!paths.length) return cars;
  const { data } = await supabase.storage.from("garage").createSignedUrls(paths, 3600);
  const map = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  const r = (p: string | null) => (p && !p.startsWith("http") ? map.get(p) ?? null : p);
  return cars.map((c) => ({ ...c, photo_url: r(c.photo_url), video_url: r(c.video_url) }));
}

function Garage() {
  const { user, profile, subscription, refresh } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"all" | "mine">("all");
  const [add, setAdd] = useState(false);
  const { data: cars = [] } = useQuery({
    queryKey: ["garage"],
    queryFn: async () => resolve(((await supabase.from("garage_cars").select("*").order("created_at", { ascending: false })).data ?? []) as CarRow[]),
  });
  const mine = cars.filter((c) => c.user_id === user?.id);
  const others = cars.filter((c) => c.user_id !== user?.id);
  const owners = Array.from(new Map(others.map((c) => [c.user_id, c.author_name])).entries());
  const isPublic = (profile as { garage_public?: boolean } | null)?.garage_public ?? true;

  async function toggleVisibility() {
    await supabase.from("profiles").update({ garage_public: !isPublic }).eq("id", user!.id);
    toast.success(isPublic ? "Sua garagem agora está oculta" : "Sua garagem está visível");
    refresh();
  }
  async function remove(id: string) {
    await supabase.from("garage_cars").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["garage"] });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle eyebrow="My Exotic Garage" title="Garagem" subtitle="A coleção de carros dos membros do clube." />
      <div className="mb-6 inline-flex rounded-full border bg-card p-1 text-sm font-bold">
        {(["all", "mine"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 ${tab === t ? "bg-ink text-highlight" : ""}`}>{t === "all" ? "Garagens" : "Minha garagem"}</button>
        ))}
      </div>

      {tab === "all" ? (
        !owners.length ? <Empty text="Nenhuma garagem publicada ainda." /> : (
          <div className="space-y-8">
            {owners.map(([uid, name]) => (
              <section key={uid}>
                <p className="mb-3 flex items-center gap-2 font-bold"><Car className="h-4 w-4 text-highlight" />Garagem de {name}</p>
                <div className="grid gap-4 sm:grid-cols-2">{others.filter((c) => c.user_id === uid).map((c) => <CarCard key={c.id} c={c} />)}</div>
              </section>
            ))}
          </div>
        )
      ) : !subscription ? (
        <div className="surface p-6 text-center">
          <p className="font-bold">Garagem exclusiva para membros com anuidade ativa</p>
          <p className="mt-1 text-sm text-muted-foreground">Ative sua assinatura para montar sua garagem.</p>
          <Button asChild className="mt-4"><Link to="/app/assinatura">Ver planos</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdd(true)}><Plus className="mr-1 h-4 w-4" />Adicionar veículo</Button>
            <Button variant="outline" onClick={toggleVisibility}>{isPublic ? <><EyeOff className="mr-1 h-4 w-4" />Esconder minha garagem</> : <><Eye className="mr-1 h-4 w-4" />Mostrar minha garagem</>}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{isPublic ? "Sua garagem está visível para os membros." : "Sua garagem está oculta — só você vê."}</p>
          {!mine.length ? <Empty text="Adicione o primeiro carro da sua garagem." /> : (
            <div className="grid gap-4 sm:grid-cols-2">{mine.map((c) => <CarCard key={c.id} c={c} onDelete={() => remove(c.id)} />)}</div>
          )}
        </div>
      )}
      <AddCar open={add} onOpenChange={setAdd} onDone={() => qc.invalidateQueries({ queryKey: ["garage"] })} />
    </div>
  );
}

function CarCard({ c, onDelete }: { c: CarRow; onDelete?: () => void }) {
  const [open, setOpen] = useState(false);
  const title = [c.model, c.version].filter(Boolean).join(" ");
  return (
    <article className="surface overflow-hidden">
      <button className="relative block w-full text-left" onClick={() => setOpen(true)}>
        {c.photo_url ? <img src={c.photo_url} alt={`${c.brand} ${title}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
          : <div className="grid aspect-[4/3] place-items-center bg-secondary"><Car className="h-10 w-10 text-muted-foreground" /></div>}
        <Star className="absolute right-3 top-3 h-5 w-5 fill-highlight text-highlight" />
        {c.video_url && <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-1 text-xs font-bold text-highlight"><Play className="h-3 w-3" />Vídeo</span>}
      </button>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div><p className="eyebrow text-muted-foreground">{c.brand}</p><p className="text-xl font-extrabold uppercase">{title}</p><p className="text-sm text-muted-foreground">{[c.year, c.color].filter(Boolean).join(" · ")}</p></div>
          {onDelete && <button aria-label="Remover" onClick={onDelete}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
        <Button size="sm" variant="outline" className="mt-3" onClick={() => setOpen(true)}>Ver veículo</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
          {c.photo_url && <img src={c.photo_url} alt={`${c.brand} ${title}`} className="w-full object-cover" />}
          <div className="space-y-3 p-5">
            <div><p className="eyebrow text-muted-foreground">{c.brand}</p><DialogTitle className="text-2xl font-extrabold uppercase">{title}</DialogTitle>
              <p className="text-sm text-muted-foreground">{[c.year, c.color].filter(Boolean).join(" · ")} · Garagem de {c.author_name}</p></div>
            {c.description && <p className="text-sm">{c.description}</p>}
            {c.video_url && <div><p className="mb-2 font-bold">Vídeo do veículo</p><video src={c.video_url} controls playsInline className="aspect-video w-full rounded-md bg-ink" /></div>}
            {c.image_source === "AUTO" && <p className="text-xs text-muted-foreground">Imagem ilustrativa encontrada automaticamente.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

const EMPTY = { brand: "", model: "", version: "", year: "", color: "", description: "" };

function AddCar({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState(EMPTY);
  const [manual, setManual] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function up(file: File | null) {
    if (!file) return null;
    const path = `${user!.id}/${crypto.randomUUID()}.${file.name.split(".").pop() ?? "bin"}`;
    const { error } = await supabase.storage.from("garage").upload(path, file);
    if (error) throw error;
    return { path, name: file.name, type: file.type, uploaded_at: new Date().toISOString() };
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.brand.trim() || !f.model.trim()) return void toast.error("Informe marca e modelo");
    if (manual && !photo) return void toast.error("Adicione pelo menos uma foto do seu veículo para continuar.");
    setBusy(true);
    try {
      let photo_url: string | null = null, video_url: string | null = null, image_meta: Record<string, unknown> = {};
      if (manual) {
        const [p, v] = await Promise.all([up(photo), up(video)]);
        photo_url = p!.path; video_url = v?.path ?? null;
        image_meta = { photo: p, video: v };
      } else {
        const img = await findCarImage({ brand: f.brand, model: f.model, version: f.version, year: f.year, color: f.color });
        if (!img) { setNotFound(true); setBusy(false); return; }
        photo_url = img.url; image_meta = img;
      }
      const { error } = await supabase.from("garage_cars").insert({
        user_id: user!.id, brand: f.brand.trim().slice(0, 60), model: f.model.trim().slice(0, 80), version: f.version.trim().slice(0, 80) || null,
        year: f.year ? Number(f.year) : null, color: f.color.slice(0, 40) || null, description: f.description.slice(0, 500),
        photo_url, video_url, image_source: manual ? "USER_UPLOAD" : "AUTO", image_meta: image_meta as never,
      });
      if (error) throw error;
      toast.success("Veículo adicionado à sua garagem");
      setF(EMPTY); setPhoto(null); setVideo(null); setManual(false); setNotFound(false);
      onOpenChange(false); onDone();
    } catch { toast.error("Não foi possível salvar. Verifique sua assinatura e o tamanho dos arquivos (até 50 MB)."); }
    setBusy(false);
  }
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setF({ ...f, [k]: e.target.value }); setNotFound(false); };
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="text-left"><DrawerTitle>Adicionar veículo</DrawerTitle></DrawerHeader>
        <form onSubmit={save} className="max-h-[70vh] space-y-3 overflow-y-auto px-4 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Marca</Label><Input value={f.brand} onChange={set("brand")} placeholder="Porsche" /></div>
            <div className="space-y-1.5"><Label>Modelo</Label><Input value={f.model} onChange={set("model")} placeholder="911" /></div>
            <div className="space-y-1.5"><Label>Versão</Label><Input value={f.version} onChange={set("version")} placeholder="Carrera S" /></div>
            <div className="space-y-1.5"><Label>Ano</Label><Input type="number" value={f.year} onChange={set("year")} placeholder="2024" /></div>
            <div className="col-span-2 space-y-1.5"><Label>Cor</Label><Input value={f.color} onChange={set("color")} placeholder="Preto" /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={f.description} onChange={set("description")} /></div>
          {!manual && <p className="text-xs text-muted-foreground">Encontramos automaticamente uma foto do seu veículo.</p>}
          {notFound && !manual && (
            <div className="rounded-md border border-highlight/50 p-3 text-sm">
              <p className="font-bold">Não encontramos uma imagem adequada para este veículo.</p>
              <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setManual(true)}>Adicionar minha própria foto</Button>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-muted-foreground">
            <input type="checkbox" className="mt-0.5 accent-[var(--highlight)]" checked={manual} onChange={(e) => setManual(e.target.checked)} />
            <span><span className="font-semibold text-foreground">Quero adicionar minhas próprias fotos/vídeos</span><br />Prefiro usar minhas próprias fotos ou vídeos deste veículo.</span>
          </label>
          {manual && (
            <>
              <div className="space-y-1.5"><Label>Foto do veículo (obrigatória)</Label><Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
              <div className="space-y-1.5"><Label>Vídeo do veículo (opcional)</Label><Input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} /></div>
            </>
          )}
          <Button size="lg" className="w-full" disabled={busy}>{busy ? (manual ? "Enviando…" : "Buscando foto…") : "Adicionar veículo"}</Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
