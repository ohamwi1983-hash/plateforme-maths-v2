import type { supabaseAdmin } from "./supabaseAdmin";

type Admin = ReturnType<typeof supabaseAdmin>;

/**
 * Identifiants des élèves inscrits dans une classe de TEST (RAPPORT §61) : un élève hérite du statut par son inscription, aucun marquage individuel. Sert à masquer ces élèves du calcul du suffixe
 * d'homonymes d'un VRAI élève (`provisionnerEleve`) : `tousLesEleves` lit toute la plateforme, un élève de test « Léa Dubois » ferait afficher « Léa Dubois (2) » une vraie élève créée ensuite — suffixe
 * calculé une fois, jamais recalculé, donc faux pour toujours même après la suppression de la classe de test. Les élèves de test restent des candidats de la CONNEXION (l'admin s'y connecte).
 */
export async function idsElevesDeTest(admin: Admin): Promise<Set<string>> {
  const { data: classes, error } = await admin.from("classes").select("id, est_test");
  if (error) throw new Error("Échec de lecture des classes de test : " + error.message);
  const classeIds = (classes ?? []).filter((c) => c.est_test === true).map((c) => c.id as string);
  if (classeIds.length === 0) return new Set();
  const { data: inscriptions, error: erreurInscriptions } = await admin.from("inscriptions").select("eleve_id").in("classe_id", classeIds);
  if (erreurInscriptions) throw new Error("Échec de lecture des inscriptions de test : " + erreurInscriptions.message);
  return new Set((inscriptions ?? []).map((l) => l.eleve_id as string));
}

/**
 * Noms (« Prénom Nom ») des élèves de `eleveIds` qui sont AUSSI inscrits dans une autre classe que `classeId` ; `{ erreur }` si la lecture échoue (RAPPORT §61, §64). Garde commune de la suppression d'une
 * classe de test et de la régénération de son mot de passe commun : un élève partagé avec une vraie classe n'est jamais supprimé ni réinitialisé. Aucun chemin de création ne produit ce cas aujourd'hui.
 */
export async function elevesInscritsAilleurs(admin: Admin, classeId: string, eleveIds: readonly string[]): Promise<{ noms: string[] } | { erreur: string }> {
  const partages = new Set<string>();
  for (let i = 0; i < eleveIds.length; i += 100) {
    const { data, error } = await admin.from("inscriptions").select("eleve_id, classe_id").in("eleve_id", eleveIds.slice(i, i + 100));
    if (error) return { erreur: "Échec de lecture des autres inscriptions : " + error.message };
    for (const l of data ?? []) if (l.classe_id !== classeId) partages.add(l.eleve_id as string);
  }
  const noms: string[] = [];
  const ids = [...partages];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await admin.from("eleves").select("id, nom, prenom").in("id", ids.slice(i, i + 100));
    for (const e of data ?? []) noms.push(`${e.prenom as string} ${e.nom as string}`.trim());
  }
  return { noms };
}
