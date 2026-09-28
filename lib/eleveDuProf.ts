import type { supabaseAdmin } from "./supabaseAdmin";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * Classes (appartenant à `profId`) auxquelles `eleveId` est inscrit — `[]` si l'élève n'existe pas,
 * n'est inscrit nulle part, ou n'appartient à aucune classe de ce prof. Même contrôle que
 * `POST /api/profs/reset-mdp-eleve` (prompt "Authentification élève", non refactoré ici pour rester
 * minimal sur un endpoint déjà livré et testé — voir RAPPORT.md), extrait ici parce que "Gestion de
 * classe étendue" en a besoin à l'identique à 3 nouveaux endroits (désactivation, modification,
 * transfert) : jamais redéfini séparément 3 fois.
 */
export async function classesDuProfPourEleve(admin: AdminClient, eleveId: string, profId: string): Promise<string[]> {
  const { data: inscriptions, error: erreurInscriptions } = await admin.from("inscriptions").select("classe_id").eq("eleve_id", eleveId);
  if (erreurInscriptions || !inscriptions || inscriptions.length === 0) return [];

  const classeIds = inscriptions.map((ligne) => ligne.classe_id as string);
  const { data: classesDuProf, error: erreurClasses } = await admin.from("classes").select("id").eq("prof_id", profId).in("id", classeIds);
  if (erreurClasses) return [];

  return (classesDuProf ?? []).map((c) => c.id as string);
}
