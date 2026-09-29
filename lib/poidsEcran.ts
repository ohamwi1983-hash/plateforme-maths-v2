import type { EcranDeclare, Generateur } from "./contratGenerateur";
import { chercherGenerateur } from "./registreGenerateurs";
import { estGraineValide } from "./prng";

/**
 * SEULE lecture du poids d'un écran (RAPPORT §17) : `EcranDeclare.poids` est une donnée dérivée de
 * l'exercice, donc jamais stockée (`ecrans(exercice)` est pure, l'exercice se régénère depuis
 * `exercices_assignes.graine`). Tout point qui agrège des champs corrects sur un total passe par ici.
 *
 * Repli à 1 — indispensable à la non-régression sur les données réelles : une ligne historique sans
 * graine, une variante absente du registre ou un champ inconnu de l'exercice valent 1 (jamais une
 * exception : un tableau de bord ne doit pas tomber pour une vieille ligne).
 */
export const POIDS_PAR_DEFAUT = 1;

/** Un poids déclaré est un entier ≥ 1 ; sinon bug de câblage du générateur (échec bruyant, comme un code non déclaré). */
export function validerPoids(poids: unknown): number {
  if (typeof poids !== "number" || !Number.isInteger(poids) || poids < 1) {
    throw new Error(`poids d'écran invalide : ${String(poids)} (entier ≥ 1 attendu)`);
  }
  return poids;
}

/** Poids de chaque champ d'une liste d'écrans déjà régénérée (`ExerciceRegenere.ecrans`). */
export function poidsDesEcrans(ecrans: readonly EcranDeclare[]): Map<string, number> {
  return new Map(ecrans.map((e) => [e.champ, e.poids === undefined ? POIDS_PAR_DEFAUT : validerPoids(e.poids)]));
}

/** Poids d'UN champ d'un exercice (`generateur` `null` = repli à 1). */
export function poidsDuChamp(generateur: Generateur<any> | null, exercice: unknown, champ: string): number {
  if (generateur === null) return POIDS_PAR_DEFAUT;
  return poidsDesEcrans(generateur.ecrans(exercice)).get(champ) ?? POIDS_PAR_DEFAUT;
}

/**
 * Poids de tous les champs d'une ligne `exercices_assignes` (`variante_id` + `graine`) : pour les routes
 * qui ne régénèrent pas déjà l'exercice. Ligne non exécutable → map vide (chaque champ vaut 1).
 */
export function poidsDesChampsDeLigne(ligne: { variante_id: string; graine?: number | string | null }): Map<string, number> {
  const generateur = chercherGenerateur(ligne.variante_id);
  const graine = ligne.graine === null || ligne.graine === undefined ? null : Number(ligne.graine);
  if (!generateur || graine === null || !estGraineValide(graine)) return new Map();
  return poidsDesEcrans(generateur.ecrans(generateur.generer(graine)));
}

/** Lecture d'un poids dans une map issue de `poidsDesEcrans`/`poidsDesChampsDeLigne` (absent = 1). */
export function poidsDansMap(poidsParChamp: ReadonlyMap<string, number>, champ: string): number {
  return poidsParChamp.get(champ) ?? POIDS_PAR_DEFAUT;
}

/**
 * Somme pondérée : `correct` = Σ poids des champs corrects, `total` = Σ poids de tous les champs COMPTÉS
 * (l'appelant décide lesquels : répondus, ou attendus — chaque site garde son dénominateur d'origine).
 * Tous poids à 1 : exactement le comptage d'origine. Parité avec `public/moteur/scorePondere.js`
 * (vérifiée par `scripts/test-poids-ecran.ts`) : les navigateurs ne peuvent pas importer `lib/`.
 */
export function sommePonderee(champs: readonly { correct: boolean; poids: number }[]): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const c of champs) {
    total += c.poids;
    if (c.correct) correct += c.poids;
  }
  return { correct, total };
}
