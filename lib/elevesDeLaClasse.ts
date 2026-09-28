import type { supabaseAdmin } from "./supabaseAdmin";
import type { IdentiteEleve } from "./homonymes";

export interface EleveDeClasse extends IdentiteEleve {
  id: string;
  actif: boolean;
}

/**
 * Élèves inscrits dans une classe (id/nom/prénom/actif) — jointure `inscriptions -> eleves` déjà
 * écrite telle quelle dans `lib/provisionnerEleve.ts` (prompt "Authentification élève"), extraite
 * ici pour que "Gestion de classe étendue" (redétection d'homonyme à la modification et au
 * transfert) la réutilise sans la dupliquer une 2e/3e fois. `null` sur erreur (jamais un tableau
 * vide qui se confondrait avec "classe réellement sans élève").
 *
 * `actif` ajouté pour "Écran résultats (professeur)" : contrairement à `lib/routes/eleves.ts` (qui
 * filtre les élèves désactivés pour les listes actives de gestion de classe), cette fonction ne
 * filtre JAMAIS sur `actif` elle-même — chaque appelant décide (voir `lib/routes/profs/resultats.ts`,
 * qui a explicitement besoin des élèves désactivés). Les appelants existants (`provisionnerEleve.ts`,
 * modification/transfert d'élève) ignorent simplement ce champ, sans changement de comportement.
 *
 * **Correctif (signalement "Échec de lecture des inscriptions existantes")** : renvoie désormais
 * `{ ok: false, erreur }` plutôt que `null` sur erreur — reproduit et confirmé par exécution réelle
 * (pas supposé) que ce message générique, jusqu'ici sans détail, masquait un vrai message PostgREST
 * exploitable (ex. "column eleves.actif does not exist" si la migration
 * `supabase/migrations/cumulatif.sql` n'a pas encore été exécutée côté vraie base, ou si le cache
 * de schéma PostgREST n'a pas été rechargé après coup) — même famille de bug que celui déjà
 * documenté pour `formaterErreur` côté client (voir RAPPORT.md). Chaque appelant propage désormais
 * ce détail dans sa propre réponse d'erreur.
 */
export type ResultatElevesDeLaClasse = { ok: true; eleves: EleveDeClasse[] } | { ok: false; erreur: string };

export async function elevesDeLaClasse(admin: ReturnType<typeof supabaseAdmin>, classeId: string): Promise<ResultatElevesDeLaClasse> {
  const { data, error } = (await admin
    .from("inscriptions")
    .select("eleve_id, eleves(id, nom, prenom, actif)")
    .eq("classe_id", classeId)) as { data: { eleve_id: string; eleves: EleveDeClasse | null }[] | null; error: { message: string } | null };
  if (error) return { ok: false, erreur: error.message };
  const eleves = (data ?? []).map((ligne) => ligne.eleves).filter((e): e is EleveDeClasse => e !== null);
  return { ok: true, eleves };
}
