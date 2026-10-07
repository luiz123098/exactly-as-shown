import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ title: "Administração — Exotic Experience" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell require="admin">
      <Outlet />
    </AppShell>
  ),
});
