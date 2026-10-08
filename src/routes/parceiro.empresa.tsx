import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, useAuth } from "@/lib/auth";
import { PARTNER_NICHES } from "@/lib/club";
import { useMySponsor } from "@/lib/sponsor";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/parceiro/empresa")({
  head: () => ({ meta: [{"title": "Minha empresa — Exotic Experience"}, {"name": "description", "content": "Atualize as informações da sua empresa no clube."}, {"property": "og:title", "content": "Minha empresa — Exotic Experience"}, {"property": "og:description", "content": "Atualize as informações da sua empresa no clube."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: Company });

const empty = { name: "", description: "", category: "Restaurantes", niche: "Lifestyle", address: "", city: "Goiânia", lat: "", lng: "", phone: "", whatsapp: "", website: "", instagram: "", hours: "", cover_url: "" };

function Company() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: sp } = useMySponsor();
  const [f, setF] = useState(empty);
  useEffect(() => {
    if (sp) setF(Object.fromEntries(Object.keys(empty).map((k) => [k, (sp as any)[k] == null ? "" : String((sp as any)[k])])) as typeof empty);
  }, [sp]);
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function locate() {
    const q = encodeURIComponent(`${f.address}, ${f.city}, Goiás, Brasil`);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`).then((r) => r.json()).catch(() => []);
    if (!r[0]) return void toast.error("Endereço não encontrado. Preencha latitude/longitude manualmente.");
    setF({ ...f, lat: r[0].lat, lng: r[0].lon });
    toast.success("Localização encontrada");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) return void toast.error("Informe o nome da empresa");
    const row = {
      ...f,
      name: f.name.trim().slice(0, 120),
      description: f.description.slice(0, 1000),
      lat: f.lat ? Number(f.lat) : null,
      lng: f.lng ? Number(f.lng) : null,
      cover_url: f.cover_url || null,
    };
    const { error } = sp
      ? await supabase.from("sponsors").update(row).eq("id", sp.id)
      : await supabase.from("sponsors").insert({ ...row, owner_id: user!.id });
    if (error) return void toast.error(error.message);
    toast.success(sp ? "Dados atualizados" : "Empresa enviada para análise");
    qc.invalidateQueries({ queryKey: ["my-sponsor"] });
  }

  return (
    <div className="max-w-3xl">
      <PageTitle eyebrow="Parceiro" title="Minha empresa" />
      <form onSubmit={save} className="surface grid gap-4 p-6 md:grid-cols-2">
        <F label="Nome da empresa" full><Input value={f.name} onChange={set("name")} required /></F>
        <F label="Descrição" full><Textarea rows={3} value={f.description} onChange={set("description")} /></F>
        <F label="Categoria">
          <select value={f.category} onChange={set("category")} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </F>
        <F label="Nicho na revista EXOTIC">
          <select value={f.niche} onChange={set("niche")} className="h-10 w-full rounded-md border bg-card px-3 text-sm">
            {PARTNER_NICHES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </F>
        <F label="Horário"><Input value={f.hours} onChange={set("hours")} placeholder="Seg–Sex 9h–18h" /></F>
        <F label="Endereço" full><Input value={f.address} onChange={set("address")} /></F>
        <F label="Cidade"><Input value={f.city} onChange={set("city")} /></F>
        <F label="Localização no mapa">
          <div className="flex gap-2">
            <Input value={f.lat} onChange={set("lat")} placeholder="Lat" />
            <Input value={f.lng} onChange={set("lng")} placeholder="Lng" />
            <Button type="button" variant="outline" onClick={locate}>Buscar</Button>
          </div>
        </F>
        <F label="Telefone"><Input value={f.phone} onChange={set("phone")} /></F>
        <F label="WhatsApp (só números)"><Input value={f.whatsapp} onChange={set("whatsapp")} /></F>
        <F label="Site"><Input value={f.website} onChange={set("website")} /></F>
        <F label="Instagram"><Input value={f.instagram} onChange={set("instagram")} /></F>
        <F label="URL da imagem de capa" full><Input value={f.cover_url} onChange={set("cover_url")} placeholder="https://…" /></F>
        <div className="md:col-span-2"><Button>{sp ? "Salvar alterações" : "Enviar para análise"}</Button></div>
      </form>
    </div>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`space-y-1.5 ${full ? "md:col-span-2" : ""}`}><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
