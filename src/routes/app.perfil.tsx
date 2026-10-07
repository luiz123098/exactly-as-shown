import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/app/perfil")({ component: Profile });

function Profile() {
  const { user, profile, roles, refresh } = useAuth();
  const [f, setF] = useState({ full_name: "", phone: "", city: "" });
  useEffect(() => {
    if (profile) setF({ full_name: profile.full_name, phone: profile.phone ?? "", city: profile.city ?? "" });
  }, [profile]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (f.full_name.trim().length < 2) return toast.error("Informe seu nome");
    const { error } = await supabase.from("profiles").update({ full_name: f.full_name.trim().slice(0, 100), phone: f.phone.slice(0, 30), city: f.city.slice(0, 80) }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
    refresh();
  }
  return (
    <div className="max-w-xl">
      <PageTitle eyebrow="Conta" title="Meu perfil" />
      <form onSubmit={save} className="surface space-y-4 p-6">
        <div className="space-y-1.5"><Label>E-mail</Label><Input value={user?.email ?? ""} disabled /></div>
        <div className="space-y-1.5"><Label>Nome</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Telefone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Cidade</Label><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Perfis: {roles.join(", ")}</p>
        <Button>Salvar</Button>
      </form>
    </div>
  );
}
