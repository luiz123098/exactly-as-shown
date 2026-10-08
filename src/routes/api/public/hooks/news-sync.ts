import { createFileRoute } from "@tanstack/react-router";

// Called by the scheduler. Idempotent: respects the admin-configured interval and dedupes by URL.
export const Route = createFileRoute("/api/public/hooks/news-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!request.headers.get("authorization")?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runNewsSync } = await import("@/lib/news-sync.server");
        const r = await runNewsSync(supabaseAdmin, false);
        return Response.json({ ok: true, skipped: r.skipped, imported: r.imported });
      },
    },
  },
});
