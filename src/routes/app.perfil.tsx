import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, ChevronRight, Crown, Heart, LogOut, IdCard, PiggyBank, Car, Newspaper, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { planLabel, useAuth, CATEGORIES } from "@/lib/auth";
import { UserAvatar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

export const Route = createFileRoute("/app/perfil")({
  head: () => ({ meta: [{"title": "Meu perfil — Exotic Experience"}, {"name": "description", "content": "Gerencie seus dados de membro da Exotic Experience."}, {"property": "og:title", "content": "Meu perfil — Exotic Experience"}, {"property": "og:description", "content": "Gerencie seus dados de membro da Exotic Experience."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: Profile });

function Profile() {
  const { user, profile, subscription, level, refresh, signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ full_name: "", phone: "", city: "" });
  const { data: joined } = useQuery({
    queryKey: ["joined", user!.id],
    queryFn: async () => (await supabase.from("profiles").select("created_at").eq("id", user!.id).maybeSingle()).data?.created_at,
  });
  useEffect(() => {
    if (profile) setF({ full_name: profile.full_name, phone: profile.phone ?? "", city: profile.city ?? "" });
  }, [profile]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.full_name.trim().length < 2) return void toast.error("Informe seu nome");
    const { error } = await supabase.from("profiles").update({ full_name: f.full_name.trim().slice(0, 100), phone: f.phone.slice(0, 30), city: f.city.slice(0, 80) }).eq("id", user!.id);
    if (error) return void toast.error(error.message);
    toast.success("Perfil atualizado");
    setEdit(false);
    refresh();
  }
  async function out() {
    await qc.cancelQueries();
    qc.clear();
    await signOut();
    navigate({ to: "/auth", search: { mode: "login" }, replace: true });
  }

  const rows: [string, string][] = [
    ["E-mail", user?.email ?? "—"],
    ["Telefone", profile?.phone || "—"],
    ["Cidade", profile?.city || "—"],
    ["Membro desde", joined ? new Date(joined).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) : "—"],
    ["Status", subscription ? "Ativa" : "Sem assinatura"],
    ["Plano atual", subscription ? planLabel(level) : "—"],
  ];

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex flex-col items-center pt-2 text-center">
        <UserAvatar size={88} />
        <h1 className="mt-4 text-3xl font-extrabold">{profile?.full_name || "Meu perfil"}</h1>
        {subscription ? (
          <span className="eyebrow mt-2 rounded-full bg-accent px-3 py-1.5 text-[0.62rem] text-accent-foreground">● Membro ativo · {planLabel(level)}</span>
        ) : (
          <span className="eyebrow mt-2 rounded-full bg-secondary px-3 py-1.5 text-[0.62rem] text-muted-foreground">Sem assinatura</span>
        )}
      </div>

      <div className="surface divide-y px-5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 py-3.5 text-sm">
            <span className="text-muted-foreground">{k}</span>
            <span className="truncate font-semibold">{v}</span>
          </div>
        ))}
      </div>
      <Button variant="outline" className="w-full" onClick={() => setEdit(true)}>Editar dados</Button>

      <div className="surface p-5">
        <p className="font-bold">Meus interesses</p>
        <p className="mb-3 text-xs text-muted-foreground">Destacamos parceiros e ofertas dessas categorias para você.</p>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => {
            const on = (profile?.interests ?? []).includes(c);
            return (
              <button key={c} onClick={async () => {
                const cur = profile?.interests ?? [];
                await supabase.from("profiles").update({ interests: on ? cur.filter((x) => x !== c) : [...cur, c] }).eq("id", user!.id);
                refresh();
              }} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-ink bg-ink text-highlight" : "bg-card"}`}>{c}</button>
            );
          })}
        </div>
      </div>

      <div className="surface divide-y px-5">
        {([["/app/carteirinha", "Minha carteirinha", IdCard], ["/app/economia", "Quanto economizei", PiggyBank], ["/app/eventos", "Meus eventos", CalendarDays], ["/app/garagem", "Minha garagem", Car], ["/app/conteudo", "Conteúdo EXOTIC", Newspaper], ["/app/assinatura", "Minha assinatura", Crown], ["/app/favoritos", "Meus favoritos", Heart], ["/app/notificacoes", "Notificações", Bell]] as const).map(([to, l, I]) => (
          <Link key={to} to={to} className="flex items-center gap-3 py-4 text-sm font-semibold">
            <I className="h-4 w-4 text-primary" /><span className="flex-1">{l}</span><ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        ))}
        <button onClick={out} className="flex w-full items-center gap-3 py-4 text-sm font-semibold text-destructive">
          <LogOut className="h-4 w-4" /> Sair da conta
        </button>
      </div>

      <Drawer open={edit} onOpenChange={setEdit}>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader className="text-left"><DrawerTitle>Editar dados</DrawerTitle></DrawerHeader>
          <form onSubmit={save} className="space-y-4 px-4 pb-8">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Telefone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
            <Button size="lg" className="w-full">Salvar</Button>
          </form>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
