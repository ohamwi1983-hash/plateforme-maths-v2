import type { supabaseAdmin } from "./supabaseAdmin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * Tâche du prof authentifié, ou `null` si introuvable/pas la sienne — même convention 404
 * "introuvable" que les autres routes prof (ne jamais confirmer l'existence d'une tâche d'un autre
 * prof). Extrait de `lib/routes/taches/[id].ts` (prompt "Séparer création et assignation de
 * tâche") pour que "Écran résultats" (mode `tache_id`) le réutilise sans le dupliquer.
 */
/**
 * Prompt "Aperçu d'une tâche avant création" : exclut aussi une tâche d'aperçu (`est_apercu`,
 * traitée comme "introuvable" — même convention que la propriété par un autre prof) — tous les
 * appelants de cette fonction (`PATCH`/`DELETE /api/taches/:id`, `GET /api/profs/resultats?tache_id=`)
 * sont des vues/actions prof-facing dont l'aperçu éphémère doit rester absent.
 */
export async function chargerTacheDuProf(admin: AdminClient, tacheId: string, profId: string): Promise<{ id: string } | null> {
  const { data: tache, error } = await admin.from("taches").select("id, prof_id, est_apercu").eq("id", tacheId).maybeSingle();
  if (error || !tache || tache.prof_id !== profId || tache.est_apercu) return null;
  return { id: tache.id as string };
}
