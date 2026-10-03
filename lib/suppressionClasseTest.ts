import type { supabaseAdmin } from "./supabaseAdmin";
import { recupererToutesLesLignes } from "./supabasePagination";

type Admin = ReturnType<typeof supabaseAdmin>;

/** Taille des lots de `.in(...)` (même valeur que la suppression de l'aperçu, `lib/routes/taches-apercu.ts`) : une URL PostgREST trop longue échoue. */
export const TAILLE_LOT_SUPPRESSION_CLASSE = 100;

/** Ce que l'étape vise : les exercices des élèves (`exercice_assigne_id`), les élèves de la classe (`eleve_id` / `id`), ou la classe elle-même. */
export type PorteeEtape = "exercices" | "eleves" | "classe";

export type EtapeSuppression = { genre: "table"; table: string; colonne: string; portee: PorteeEtape } | { genre: "auth" };

/**
 * LA liste ordonnée de la suppression en cascade d'une classe de test (RAPPORT §61) : le schéma n'a AUCUN `on delete cascade` (sauf `composition_id … on delete set null`), l'ordre est donc imposé par les
 * clés étrangères — tout ce qui référence `exercices_assignes`, puis `exercices_assignes`, puis ce qui référence `eleves` et `classes`, puis les élèves, leurs comptes Supabase Auth, enfin la classe.
 * Établie par lecture de `supabase/schema.sql`, pas de mémoire de la suppression de l'aperçu : `scripts/test-classe-test-cascade.ts` relit les clés étrangères du schéma et échoue si une table qui
 * référence `classes`, `eleves` ou une table supprimée ici n'y figure pas (c'est exactement l'oubli de `aides_utilisees` dans l'aperçu). NON supprimées, volontairement : `taches` et `taches_composition`
 * (tâches de l'admin, réutilisables ; une tâche qui n'était assignée qu'à cette classe redevient modifiable dès que `taches_assignations` est vidée).
 */
export const ETAPES_SUPPRESSION_CLASSE_TEST: readonly EtapeSuppression[] = [
  { genre: "table", table: "reponses", colonne: "exercice_assigne_id", portee: "exercices" },
  { genre: "table", table: "debuts_ecran", colonne: "exercice_assigne_id", portee: "exercices" },
  { genre: "table", table: "aides_utilisees", colonne: "exercice_assigne_id", portee: "exercices" },
  { genre: "table", table: "exercices_assignes", colonne: "eleve_id", portee: "eleves" },
  { genre: "table", table: "taches_assignations_eleves", colonne: "eleve_id", portee: "eleves" },
  { genre: "table", table: "taches_assignations", colonne: "classe_id", portee: "classe" },
  { genre: "table", table: "inscriptions", colonne: "classe_id", portee: "classe" },
  { genre: "table", table: "eleves", colonne: "id", portee: "eleves" },
  { genre: "auth" },
  { genre: "table", table: "classes", colonne: "id", portee: "classe" },
];

export type ResultatSuppressionClasseTest =
  | { ok: true; eleves: number; exercices: number; comptesAuthNonSupprimes: string[] }
  | { ok: false; statut: 404 | 409 | 500; erreur: string; elevesPartages?: string[] };

function lots<T>(valeurs: readonly T[]): T[][] {
  const resultat: T[][] = [];
  for (let i = 0; i < valeurs.length; i += TAILLE_LOT_SUPPRESSION_CLASSE) resultat.push(valeurs.slice(i, i + TAILLE_LOT_SUPPRESSION_CLASSE));
  return resultat;
}

/**
 * Supprime une classe de test et TOUT ce qui en dépend (RAPPORT §61). Refuse (404) toute classe qui n'est pas marquée `est_test` — jamais une vraie classe — et refuse (409) si l'un de ses élèves est aussi
 * inscrit ailleurs : un élève partagé avec une vraie classe ne doit jamais être supprimé, et on ne devine pas ce qu'il faudrait faire de ses exercices (aucun chemin de création ne produit ce cas
 * aujourd'hui ; la garde est là pour une donnée saisie à la main). `etapes` est paramétrable pour le test de mutation (retirer une étape doit être détecté) ; la production passe toujours la liste complète.
 */
export async function supprimerClasseDeTest(admin: Admin, classeId: string, etapes: readonly EtapeSuppression[] = ETAPES_SUPPRESSION_CLASSE_TEST): Promise<ResultatSuppressionClasseTest> {
  const { data: classe, error: erreurClasse } = await admin.from("classes").select("id, est_test").eq("id", classeId).maybeSingle();
  if (erreurClasse) return { ok: false, statut: 500, erreur: "Échec de lecture de la classe : " + erreurClasse.message };
  if (!classe || classe.est_test !== true) return { ok: false, statut: 404, erreur: "Classe de test introuvable" };

  const { data: inscrits, error: erreurInscrits } = await admin.from("inscriptions").select("eleve_id").eq("classe_id", classeId);
  if (erreurInscrits) return { ok: false, statut: 500, erreur: "Échec de lecture des inscriptions : " + erreurInscrits.message };
  const eleveIds = (inscrits ?? []).map((l) => l.eleve_id as string);

  // Élève partagé : inscrit aussi dans une AUTRE classe -> refus explicite, rien n'est supprimé.
  const partages = new Set<string>();
  for (const lot of lots(eleveIds)) {
    const { data: ailleurs, error } = await admin.from("inscriptions").select("eleve_id, classe_id").in("eleve_id", lot);
    if (error) return { ok: false, statut: 500, erreur: "Échec de lecture des autres inscriptions : " + error.message };
    for (const l of ailleurs ?? []) if (l.classe_id !== classeId) partages.add(l.eleve_id as string);
  }
  if (partages.size > 0) {
    const noms: string[] = [];
    for (const lot of lots([...partages])) {
      const { data } = await admin.from("eleves").select("id, nom, prenom").in("id", lot);
      for (const e of data ?? []) noms.push(`${e.prenom as string} ${e.nom as string}`.trim());
    }
    return { ok: false, statut: 409, erreur: "Suppression refusée : des élèves de cette classe sont aussi inscrits dans une autre classe (" + noms.join(", ") + ").", elevesPartages: noms };
  }

  const exerciceIds: string[] = [];
  for (const lot of lots(eleveIds)) {
    const lignes = await recupererToutesLesLignes<{ id: string }>(() => admin.from("exercices_assignes").select("id").in("eleve_id", lot));
    exerciceIds.push(...lignes.map((l) => l.id));
  }

  const comptesAuthNonSupprimes: string[] = [];
  for (const etape of etapes) {
    if (etape.genre === "auth") {
      for (const id of eleveIds) {
        const { error } = await admin.auth.admin.deleteUser(id);
        if (error) comptesAuthNonSupprimes.push(id);
      }
      continue;
    }
    const valeurs = etape.portee === "exercices" ? exerciceIds : etape.portee === "eleves" ? eleveIds : [classeId];
    for (const lot of lots(valeurs)) {
      const { error } = await admin.from(etape.table).delete().in(etape.colonne, lot);
      if (error) return { ok: false, statut: 500, erreur: `Échec de suppression de ${etape.table} : ` + error.message };
    }
  }
  return { ok: true, eleves: eleveIds.length, exercices: exerciceIds.length, comptesAuthNonSupprimes };
}
