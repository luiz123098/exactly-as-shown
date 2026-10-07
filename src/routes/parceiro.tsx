import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/parceiro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel do parceiro — Exotic Experience" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <AppShell area="sponsor">
      <Outlet />
    </AppShell>
  ),
});
