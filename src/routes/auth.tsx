import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import hero from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand";

const search = z.object({
  mode: z.enum(["login", "signup", "forgot"]).catch("login"),
  type: z.enum(["member", "sponsor"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Entrar — Exotic Experience" },
      { name: "description", content: "Acesse sua conta de membro ou parceiro da Exotic Experience." },
      { property: "og:title", content: "Entrar — Exotic Experience" },
      { property: "og:description", content: "Acesse sua conta de membro ou parceiro." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Informe seu nome").max(100),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(8, "Mínimo de 8 caracteres").max(72),
});

function AuthPage() {
  const { mode, type } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isSponsor, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [accountType, setAccountType] = useState<"member" | "sponsor">(type ?? "member");
  const [f, setF] = useState({ full_name: "", email: "", password: "", phone: "", city: "Goiânia" });
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: isSponsor ? "/parceiro" : "/app" });
  }, [user, loading, isSponsor, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const parsed = signupSchema.safeParse(f);
        if (!parsed.success) return toast.error(parsed.error.issues[0].message);
        const { error } = await supabase.auth.signUp({
          email: f.email,
          password: f.password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: { full_name: f.full_name, phone: f.phone, city: f.city, account_type: accountType },
          },
        });
        if (error) return toast.error(error.message);
        setSent(true);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin + "/reset-password" });
        if (error) return toast.error(error.message);
        toast.success("Enviamos um link de recuperação para seu e-mail.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
        if (error) return toast.error("E-mail ou senha incorretos.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error("Não foi possível entrar com Google.");
  }

  const title = mode === "signup" ? "Criar conta" : mode === "forgot" ? "Recuperar senha" : "Bem-vindo de volta";

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute bottom-12 left-12 right-12 text-ink-foreground">
          <p className="font-display text-5xl leading-tight">“Ser membro é ter acesso ao que poucos conhecem.”</p>
        </div>
      </div>
      <div className="flex flex-col px-6 py-8 md:px-16">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {sent ? (
            <div>
              <h1 className="font-display text-4xl">Confirme seu e-mail</h1>
              <p className="mt-3 text-sm text-muted-foreground">Enviamos um link para <strong>{f.email}</strong>. Clique nele para ativar sua conta.</p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-5xl">{title}</h1>
              {mode === "signup" && (
                <div className="mt-6 grid grid-cols-2 rounded-full bg-secondary p-1 text-sm font-semibold">
                  {(["member", "sponsor"] as const).map((t) => (
                    <button key={t} type="button" onClick={() => setAccountType(t)}
                      className={`rounded-full py-2 transition ${accountType === t ? "bg-card shadow-soft" : "text-muted-foreground"}`}>
                      {t === "member" ? "Sou membro" : "Sou parceiro"}
                    </button>
                  ))}
                </div>
              )}
              <form onSubmit={submit} className="mt-6 space-y-4">
                {mode === "signup" && (
                  <>
                    <Field label={accountType === "sponsor" ? "Nome do responsável" : "Nome completo"}>
                      <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Telefone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
                      <Field label="Cidade"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
                    </div>
                  </>
                )}
                <Field label="E-mail"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
                {mode !== "forgot" && (
                  <Field label="Senha"><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></Field>
                )}
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar link" : "Entrar"}
                </Button>
              </form>
              {mode !== "forgot" && (
                <Button variant="outline" className="mt-3 w-full" size="lg" onClick={google}>Continuar com Google</Button>
              )}
              <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
                {mode === "login" && (
                  <>
                    <p><Link to="/auth" search={{ mode: "forgot" }} className="hover:text-foreground">Esqueci minha senha</Link></p>
                    <p>Ainda não é membro? <Link to="/auth" search={{ mode: "signup" }} className="font-semibold text-primary">Criar conta</Link></p>
                  </>
                )}
                {mode !== "login" && (
                  <p>Já tem conta? <Link to="/auth" search={{ mode: "login" }} className="font-semibold text-primary">Entrar</Link></p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
