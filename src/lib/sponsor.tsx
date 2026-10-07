import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useMySponsor() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-sponsor", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("sponsors").select("*").eq("owner_id", user!.id).maybeSingle()).data,
  });
}

export const statusLabel: Record<string, string> = { pending: "Em análise", approved: "Aprovado", rejected: "Recusado" };
export function StatusPill({ s }: { s: string }) {
  const cls = s === "approved" ? "bg-accent text-accent-foreground" : s === "rejected" ? "bg-destructive/10 text-destructive" : "bg-secondary text-muted-foreground";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{statusLabel[s] ?? s}</span>;
}
