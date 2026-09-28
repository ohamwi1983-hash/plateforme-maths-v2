import { supabaseAdmin } from "./supabaseAdmin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * Une tâche est "assignée" si elle a au moins une ligne dans `taches_assignations` (par classe)
 * OU dans `taches_assignations_eleves` (par élève, prompt "Assigner à des élèves spécifiques") —
 * quelle que soit la classe (prompt "Séparer création et assignation de tâche", Étape 2 :
 * "verrouillage... quelle que soit la classe", étendu au même titre aux élèves). Seule source de
 * vérité pour cette règle — réutilisée telle quelle par `GET /api/taches` (champ `assignee`),
 * `PATCH /api/taches/:id` et `DELETE /api/taches/:id` (rejet si assignée), jamais recalculée
 * indépendamment à ces 3 endroits.
 */
export async function tacheEstAssignee(admin: AdminClient, tacheId: string): Promise<boolean> {
  const { data: parClasse, error: erreurParClasse } = await admin.from("taches_assignations").select("id").eq("tache_id", tacheId).limit(1);
  if (erreurParClasse) throw new Error(erreurParClasse.message);
  if ((parClasse ?? []).length > 0) return true;

  const { data: parEleve, error: erreurParEleve } = await admin
    .from("taches_assignations_eleves")
    .select("id")
    .eq("tache_id", tacheId)
    .limit(1);
  if (erreurParEleve) throw new Error(erreurParEleve.message);
  return (parEleve ?? []).length > 0;
}
