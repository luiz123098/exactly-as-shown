import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Empty, PageTitle } from "@/components/cards";
import { UserAvatar } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/comunidade")({
  head: () => ({ meta: [{ title: "Comunidade — Exotic Experience" }, { name: "description", content: "O feed exclusivo dos membros EXOTIC: experiências, fotos e networking." }, { property: "og:title", content: "Comunidade — Exotic Experience" }, { property: "og:description", content: "O feed exclusivo dos membros EXOTIC: experiências, fotos e networking." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Community,
});

type Post = { id: string; user_id: string; author_name: string; body: string; image_url: string | null; created_at: string };
type Comment = { id: string; post_id: string; author_name: string; body: string; user_id: string };

const ago = (d: string) => {
  const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  return m < 60 ? `${Math.max(m, 1)} min` : m < 1440 ? `${Math.round(m / 60)} h` : new Date(d).toLocaleDateString("pt-BR");
};
const initials = (n: string) => n.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function Community() {
  const { user, subscription, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [img, setImg] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const { data } = useQuery({
    queryKey: ["feed"],
    queryFn: async () => {
      const [p, l, c] = await Promise.all([
        supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("post_likes").select("post_id,user_id"),
        supabase.from("post_comments").select("*").order("created_at"),
      ]);
      return { posts: (p.data ?? []) as Post[], likes: l.data ?? [], comments: (c.data ?? []) as Comment[] };
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["feed"] });

  if (!subscription && !isAdmin)
    return <div><PageTitle eyebrow="Comunidade EXOTIC" title="Só para membros" /><Empty text="Ative sua assinatura para participar da comunidade." /></div>;

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const url = img.trim();
    if (url && !/^https:\/\//.test(url)) return void toast.error("Use um link de imagem https://");
    const { error } = await supabase.from("posts").insert({ user_id: user!.id, body: body.trim().slice(0, 1000), image_url: url || null });
    if (error) return void toast.error("Não foi possível publicar.");
    setBody(""); setImg(""); reload();
  }
  async function like(id: string, on: boolean) {
    if (on) await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", user!.id);
    else await supabase.from("post_likes").insert({ post_id: id, user_id: user!.id });
    reload();
  }
  async function sendComment(id: string) {
    if (!comment.trim()) return;
    await supabase.from("post_comments").insert({ post_id: id, user_id: user!.id, body: comment.trim().slice(0, 500) });
    setComment(""); reload();
  }
  async function remove(id: string) { await supabase.from("posts").delete().eq("id", id); reload(); }

  return (
    <div className="mx-auto max-w-xl">
      <PageTitle eyebrow="Comunidade EXOTIC" title="Feed" subtitle="Compartilhe experiências com outros membros." />
      <form onSubmit={publish} className="surface mb-6 space-y-3 p-4">
        <div className="flex gap-3"><UserAvatar size={40} /><Textarea rows={2} placeholder="O que você viveu no clube hoje?" value={body} onChange={(e) => setBody(e.target.value)} /></div>
        <div className="flex gap-2"><Input placeholder="Link de uma foto (opcional)" value={img} onChange={(e) => setImg(e.target.value)} /><Button disabled={!body.trim()}>Publicar</Button></div>
      </form>
      {!data?.posts.length ? <Empty text="Seja o primeiro a publicar na comunidade." /> : (
        <div className="space-y-4">
          {data.posts.map((p) => {
            const likes = data.likes.filter((l) => l.post_id === p.id);
            const liked = likes.some((l) => l.user_id === user!.id);
            const cs = data.comments.filter((c) => c.post_id === p.id);
            return (
              <article key={p.id} className="surface overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-xs font-bold text-highlight">{initials(p.author_name)}</span>
                  <div className="flex-1"><p className="font-bold">{p.author_name}</p><p className="text-xs text-muted-foreground">Membro EXOTIC · {ago(p.created_at)}</p></div>
                  {(p.user_id === user!.id || isAdmin) && <button aria-label="Excluir" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></button>}
                </div>
                <p className="whitespace-pre-line px-4 pb-3">{p.body}</p>
                {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="max-h-[420px] w-full object-cover" />}
                <div className="flex gap-5 px-4 py-3 text-sm font-semibold">
                  <button onClick={() => like(p.id, liked)} className="flex items-center gap-1.5"><Heart className={`h-5 w-5 ${liked ? "fill-highlight text-highlight" : ""}`} />{likes.length}</button>
                  <button onClick={() => setOpen(open === p.id ? null : p.id)} className="flex items-center gap-1.5"><MessageCircle className="h-5 w-5" />{cs.length}</button>
                </div>
                {open === p.id && (
                  <div className="space-y-2 border-t bg-secondary/40 p-4">
                    {cs.map((c) => <p key={c.id} className="text-sm"><strong>{c.author_name}</strong> {c.body}</p>)}
                    <div className="flex gap-2 pt-1"><Input placeholder="Comentar…" value={comment} onChange={(e) => setComment(e.target.value)} /><Button size="sm" onClick={() => sendComment(p.id)}>Enviar</Button></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
