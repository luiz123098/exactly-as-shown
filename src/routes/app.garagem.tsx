import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Car, Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Empty, PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export const Route = createFileRoute("/app/garagem")({
  head: () => ({ meta: [{ title: "Garagem — Exotic Experience" }, { name: "description", content: "As garagens dos membros EXOTIC: carros, fotos e vídeos." }, { property: "og:title", content: "Garagem — Exotic Experience" }, { property: "og:description", content: "As garagens dos membros EXOTIC: carros, fotos e vídeos." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Garage,
});

type CarRow = { id: string; user_id: string; author_name: string; brand: string; model: string; year: number | null; color: string | null; description: string; photo_url: string | null; video_url: string | null };

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
      <PageTitle eyebrow="Garagem EXOTIC" title="Garagem" subtitle="Os carros dos membros do clube." />
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
            <Button onClick={() => setAdd(true)}><Plus className="mr-1 h-4 w-4" />Adicionar carro</Button>
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
  const [video, setVideo] = useState(false);
  return (
    <article className="surface overflow-hidden">
      {video && c.video_url ? (
        <video src={c.video_url} controls autoPlay playsInline className="aspect-video w-full bg-ink object-cover" />
      ) : c.photo_url ? (
        <img src={c.photo_url} alt={`${c.brand} ${c.model}`} loading="lazy" className="aspect-video w-full object-cover" />
      ) : <div className="grid aspect-video place-items-center bg-secondary"><Car className="h-10 w-10 text-muted-foreground" /></div>}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div><p className="eyebrow text-muted-foreground">{c.brand}</p><p className="text-lg font-bold">{c.model}</p></div>
          {onDelete && <button aria-label="Remover" onClick={onDelete}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
        <p className="text-xs text-muted-foreground">{[c.year, c.color].filter(Boolean).join(" · ")}</p>
        {c.description && <p className="mt-2 text-sm">{c.description}</p>}
        {c.video_url && <Button size="sm" variant="outline" className="mt-3" onClick={() => setVideo(!video)}>{video ? "Ver foto" : "Ver vídeo"}</Button>}
      </div>
    </article>
  );
}

function AddCar({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { user } = useAuth();
  const [f, setF] = useState({ brand: "", model: "", year: "", color: "", description: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function up(file: File | null) {
    if (!file) return null;
    const path = `${user!.id}/${crypto.randomUUID()}.${file.name.split(".").pop() ?? "bin"}`;
    const { error } = await supabase.storage.from("garage").upload(path, file);
    if (error) throw error;
    return path;
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.brand.trim() || !f.model.trim()) return void toast.error("Informe marca e modelo");
    setBusy(true);
    try {
      const [photo_url, video_url] = await Promise.all([up(photo), up(video)]);
      const { error } = await supabase.from("garage_cars").insert({
        user_id: user!.id, brand: f.brand.trim().slice(0, 60), model: f.model.trim().slice(0, 80),
        year: f.year ? Number(f.year) : null, color: f.color.slice(0, 40) || null, description: f.description.slice(0, 500), photo_url, video_url,
      });
      if (error) throw error;
      toast.success("Carro adicionado à garagem");
      setF({ brand: "", model: "", year: "", color: "", description: "" }); setPhoto(null); setVideo(null);
      onOpenChange(false); onDone();
    } catch { toast.error("Não foi possível salvar. Verifique sua assinatura e o tamanho dos arquivos (até 50 MB)."); }
    setBusy(false);
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-lg">
        <DrawerHeader className="text-left"><DrawerTitle>Adicionar carro</DrawerTitle></DrawerHeader>
        <form onSubmit={save} className="max-h-[70vh] space-y-3 overflow-y-auto px-4 pb-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Marca</Label><Input value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Modelo</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Ano</Label><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cor</Label><Input value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Descrição</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Foto</Label><Input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5"><Label>Vídeo</Label><Input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} /></div>
          <Button size="lg" className="w-full" disabled={busy}>{busy ? "Enviando…" : "Salvar"}</Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
