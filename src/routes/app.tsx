import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "Área do membro — Exotic Experience" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
