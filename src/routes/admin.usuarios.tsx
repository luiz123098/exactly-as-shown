import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageTitle } from "@/components/cards";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/admin/usuarios")({
  head: () => ({ meta: [{"title": "Gestão de usuários — Exotic Experience"}, {"name": "description", "content": "Gerencie os usuários e seus acessos ao clube."}, {"property": "og:title", "content": "Gestão de usuários — Exotic Experience"}, {"property": "og:description", "content": "Gerencie os usuários e seus acessos ao clube."}, {"property": "og:type", "content": "website"}, {"name": "twitter:card", "content": "summary_large_image"}] }),
  component: AdminUsers });

const ROLES = ["member", "sponsor", "admin"] as const;
const roleName = { member: "Membro", sponsor: "Parceiro", admin: "Admin" };

function AdminUsers() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r, s] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("subscriptions").select("user_id, plan:plans(name)").eq("status", "active"),
      ]);
      return (p.data ?? []).map((u) => ({
        ...u,
        roles: (r.data ?? []).filter((x) => x.user_id === u.id).map((x) => x.role as string),
        plan: ((s.data ?? []).find((x) => x.user_id === u.id) as any)?.plan?.name as string | undefined,
      }));
    },
  });
  async function toggle(uid: string, role: (typeof ROLES)[number], has: boolean) {
    const { error } = await supabase.rpc("admin_set_role", { _user: uid, _role: role, _grant: !has });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }
  const list = data.filter((u) => !q || u.full_name.toLowerCase().includes(q.toLowerCase()) || (u.city ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageTitle eyebrow="Administração" title="Usuários">
        <Input className="w-64 rounded-full" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
      </PageTitle>
      <div className="surface divide-y">
        {list.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-48 flex-1">
              <p className="font-semibold">{u.full_name || "Sem nome"}</p>
              <p className="text-xs text-muted-foreground">{u.city ?? "—"} · desde {new Date(u.created_at).toLocaleDateString("pt-BR")} · {u.plan ? `Plano ${u.plan}` : "Sem plano"}</p>
            </div>
            <div className="flex gap-1.5">
              {ROLES.map((r) => {
                const has = u.roles.includes(r);
                return (
                  <button key={r} onClick={() => toggle(u.id, r, has)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${has ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>
                    {roleName[r]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
