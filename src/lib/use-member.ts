import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchFavIds, fetchSaved, toggleFav, toggleSaved } from "@/lib/queries";

export function useFavorites() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: favs = new Set<string>() } = useQuery({
    queryKey: ["favs", user?.id],
    enabled: !!user,
    queryFn: () => fetchFavIds(user!.id),
  });
  const { data: saved = new Set<string>() } = useQuery({
    queryKey: ["saved", user?.id],
    enabled: !!user,
    queryFn: () => fetchSaved(user!.id),
  });
  return {
    favs,
    saved,
    toggleBenefit: async (id: string) => {
      await toggleFav(user!.id, id, favs.has(id));
      qc.invalidateQueries({ queryKey: ["favs"] });
    },
    isSaved: (kind: "sponsor" | "promotion", id: string) => saved.has(`${kind}:${id}`),
    toggleSaved: async (kind: "sponsor" | "promotion", id: string) => {
      await toggleSaved(user!.id, kind, id, saved.has(`${kind}:${id}`));
      qc.invalidateQueries({ queryKey: ["saved"] });
    },
  };
}
