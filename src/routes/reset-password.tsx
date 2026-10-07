import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Nova senha — Exotic Experience" },
      { name: "description", content: "Defina uma nova senha para sua conta." },
      { property: "og:title", content: "Nova senha — Exotic Experience" },
      { property: "og:description", content: "Defina uma nova senha para sua conta." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return void toast.error("Mínimo de 8 caracteres");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return void toast.error(error.message);
    toast.success("Senha atualizada");
    navigate({ to: "/app" });
  }
  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Logo />
      <h1 className="mt-10 font-display text-4xl">Defina sua nova senha</h1>
      <form onSubmit={save} className="mt-6 space-y-4">
        <Input type="password" placeholder="Nova senha" value={pw} onChange={(e) => setPw(e.target.value)} />
        <Button className="w-full" size="lg">Salvar</Button>
      </form>
    </div>
  );
}
