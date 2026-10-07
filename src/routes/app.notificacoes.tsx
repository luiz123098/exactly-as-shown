import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Megaphone, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Empty, PageTitle } from "@/components/cards";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/notificacoes")({ component: Notifs });

function Notifs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["notifs", user!.id];
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => (await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const refresh = () => qc.invalidateQueries({ queryKey: key });
  async function readAll() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    refresh();
  }
  return (
    <div>
      <PageTitle eyebrow="Avisos" title="Notificações">
        <Button variant="outline" size="sm" onClick={readAll}>Marcar todas como lidas</Button>
      </PageTitle>
      {data.length === 0 ? <Empty text="Nenhuma notificação por enquanto." /> : (
        <div className="surface divide-y">
          {data.map((n) => (
            <div key={n.id} className={`flex items-start gap-4 p-5 ${n.read ? "opacity-60" : ""}`}
              onClick={async () => { if (!n.read) { await supabase.from("notifications").update({ read: true }).eq("id", n.id); refresh(); } }}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                {n.kind === "promotion" ? <Megaphone className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{n.title}{!n.read && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-highlight" />}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                {n.link && <Link to={n.link} className="mt-1 inline-block text-xs font-semibold text-primary">Ver →</Link>}
              </div>
              <button aria-label="Excluir" onClick={async (e) => { e.stopPropagation(); await supabase.from("notifications").delete().eq("id", n.id); refresh(); }}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
