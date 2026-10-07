import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, EyeOff, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchHomeConfig, HOME_SECTIONS } from "@/lib/club";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { L } from "./parceiro.beneficios";

export const Route = createFileRoute("/admin/home")({
  head: () => ({ meta: [{ title: "Home do app — Administração EXOTIC" }, { name: "description", content: "Controle o destaque e a ordem das seções da Home dos membros." }, { property: "og:title", content: "Home do app — Administração EXOTIC" }, { property: "og:description", content: "Controle o destaque e a ordem das seções da Home dos membros." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: AdminHome,
});

function AdminHome() {
  const qc = useQueryClient();
  const { data: cfg } = useQuery({ queryKey: ["home-config"], queryFn: fetchHomeConfig });
  const [f, setF] = useState({ hero_badge: "", hero_title: "", hero_subtitle: "", hero_image: "", hero_link: "" });
  const [sections, setSections] = useState<string[]>([]);
  useEffect(() => {
    if (cfg) {
      setF({ hero_badge: cfg.hero_badge, hero_title: cfg.hero_title, hero_subtitle: cfg.hero_subtitle, hero_image: cfg.hero_image ?? "", hero_link: cfg.hero_link ?? "" });
      setSections(cfg.sections);
    }
  }, [cfg]);
  const hidden = Object.keys(HOME_SECTIONS).filter((k) => !sections.includes(k));
  const move = (i: number, d: number) => { const s = [...sections]; const j = i + d; if (j < 0 || j >= s.length) return; [s[i], s[j]] = [s[j]!, s[i]!]; setSections(s); };
  async function save() {
    const { error } = await supabase.from("home_config").update({ ...f, hero_image: f.hero_image || null, hero_link: f.hero_link || null, sections, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) return void toast.error(error.message);
    toast.success("Home atualizada"); qc.invalidateQueries({ queryKey: ["home-config"] });
  }
  return (
    <div className="max-w-3xl">
      <PageTitle eyebrow="Administração" title="Home do app"><Button onClick={save}>Salvar alterações</Button></PageTitle>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="surface space-y-3 p-5">
          <p className="font-bold">Destaque principal</p>
          <L t="Selo"><Input value={f.hero_badge} onChange={(e) => setF({ ...f, hero_badge: e.target.value })} /></L>
          <L t="Título"><Input value={f.hero_title} onChange={(e) => setF({ ...f, hero_title: e.target.value })} /></L>
          <L t="Subtítulo"><Input value={f.hero_subtitle} onChange={(e) => setF({ ...f, hero_subtitle: e.target.value })} /></L>
          <L t="Imagem (URL)"><Input value={f.hero_image} onChange={(e) => setF({ ...f, hero_image: e.target.value })} /></L>
          <L t="Link do botão (ex.: /app/eventos)"><Input value={f.hero_link} onChange={(e) => setF({ ...f, hero_link: e.target.value })} /></L>
          <p className="text-xs text-muted-foreground">Parceiros, promoções, eventos e conteúdos em destaque são escolhidos nas respectivas telas (botão "Destacar").</p>
        </div>
        <div className="surface p-5">
          <p className="mb-3 font-bold">Ordem das seções</p>
          <div className="space-y-2">
            {sections.map((k, i) => (
              <div key={k} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                <span className="flex-1 font-semibold">{i + 1}. {HOME_SECTIONS[k] ?? k}</span>
                <button aria-label="Subir" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></button>
                <button aria-label="Descer" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></button>
                <button aria-label="Ocultar" onClick={() => setSections(sections.filter((x) => x !== k))}><EyeOff className="h-4 w-4" /></button>
              </div>
            ))}
            {hidden.map((k) => (
              <button key={k} onClick={() => setSections([...sections, k])} className="flex w-full items-center gap-2 rounded-lg border border-dashed p-2 text-sm text-muted-foreground">
                <Eye className="h-4 w-4" /> Mostrar “{HOME_SECTIONS[k]}”
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
