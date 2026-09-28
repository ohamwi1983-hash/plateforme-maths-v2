import type { supabaseAdmin } from "./supabaseAdmin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * Prompt "Temps de réponse par type d'exercice — profil élève", volet B : classe de l'élève
 * SEULEMENT si non ambiguë. `inscriptions` (`supabase/schema.sql:63-67`) a une clé primaire
 * composite `(eleve_id, classe_id)`, sans contrainte d'unicité sur `eleve_id` seul — un élève peut
 * donc être inscrit dans 0 ou plusieurs classes simultanément (déjà confirmé structurellement, et
 * déjà traité comme un cas réel ailleurs dans ce dépôt, voir `lib/routes/profs/tableau-de-
 * bord.ts:61-69`). `null` dans les deux cas (0 ou 2+ classes) : aucune comparaison de classe n'est
 * alors possible — jamais une classe devinée parmi plusieurs.
 */
export async function classeUniqueDeEleve(admin: AdminClient, eleveId: string): Promise<string | null> {
  const { data } = await admin.from("inscriptions").select("classe_id").eq("eleve_id", eleveId);
  return data?.length === 1 ? (data[0].classe_id as string) : null;
}
