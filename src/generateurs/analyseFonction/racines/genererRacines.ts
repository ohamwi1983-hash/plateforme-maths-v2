import type { Prng } from "../../../../lib/prng";
import { exigerCategorieAvecRacines, type CategorieRacines, type DonneesRacines } from "./types";

/**
 * Génération des données propres aux écrans « racines », seedée (`creerPrng`), réécrite d'après les trois
 * constructeurs purs de l'ancien pilote (`pilote:src/generateurs/secondDegre/categories/miseEnEvidence.ts`,
 * `binomeConjugue.ts`, `produitRemarquable.ts` @ 6acc102, appelés SANS option par gen7).
 *
 * ORDRE DES TIRAGES — contractuel pour le `variante_id` `_v1` de gen7 (toute modification impose `_v2`,
 * `CLAUDE.md`) : d'abord `a = entierEntre(1, 4)` ; puis `r` :
 *  - mise_en_evidence, produit_remarquable : `r ∈ [−5, 5] \ {0}` par REJET (`entierEntre(−5, 5)` répété tant
 *    que r = 0 : nombre de tirages variable) ;
 *  - binome_conjugue : `r = entierEntre(1, 5)`.
 * L'assemblage de gen7 (3b-3) ajoutera ses propres tirages APRÈS ceux-ci (ordre d'affichage des termes).
 * `af_irreductible` n'a pas d'écran « racines » : rien à tirer ici (`CategorieRacines` l'exclut).
 *
 * Construction (a ≥ 1 : la branche a < 0 de l'ancien `formeFactorisee` n'est jamais atteinte, donc non portée) :
 *  - mise_en_evidence   : a·x·(x − r)   → b = −a·r, c = 0, racines {0, r} triées ;
 *  - binome_conjugue    : a(x − r)(x + r) → b = 0, c = −a·r², racines [−r, r] ;
 *  - produit_remarquable: a(x − r)²      → b = −2a·r, c = a·r², racines [r, r].
 */

function racineNonNulle(prng: Prng): number {
  let r = 0;
  while (r === 0) r = prng.entierEntre(-5, 5);
  return r;
}

const facteur = (r: number): string => (r >= 0 ? `x - ${r}` : `x + ${Math.abs(r)}`);
const coefficientDevant = (a: number): string => (a === 1 ? "" : String(a));

/** Données déterministes de (catégorie, a, r) — même texte de solution que l'ancien pilote, caractère pour caractère. */
export function construireRacines(categorie: CategorieRacines, a: number, r: number): DonneesRacines {
  exigerCategorieAvecRacines(categorie);
  if (!Number.isInteger(a) || a < 1) throw new Error(`construireRacines : a doit être un entier ≥ 1 (reçu ${a})`);
  if (!Number.isInteger(r) || r === 0) throw new Error(`construireRacines : r doit être un entier non nul (reçu ${r})`);
  switch (categorie) {
    case "mise_en_evidence":
      return { categorie, a, b: -a * r, c: 0, racines: r < 0 ? [r, 0] : [0, r], formeFactorisee: `${coefficientDevant(a)}x(${facteur(r)})` };
    case "binome_conjugue": {
      if (r < 0) throw new Error(`construireRacines : r doit être > 0 pour binome_conjugue (reçu ${r})`);
      return { categorie, a, b: 0, c: -a * r * r, racines: [-r, r], formeFactorisee: `${coefficientDevant(a)}(x - ${r})(x + ${r})` };
    }
    case "produit_remarquable":
      return { categorie, a, b: -2 * a * r, c: a * r * r, racines: [r, r], formeFactorisee: `${coefficientDevant(a)}(${facteur(r)})^2` };
  }
}

/** Tire (a, r) dans l'ordre documenté ci-dessus puis construit les données. */
export function genererRacines(categorie: CategorieRacines, prng: Prng): DonneesRacines {
  exigerCategorieAvecRacines(categorie);
  const a = prng.entierEntre(1, 4);
  const r = categorie === "binome_conjugue" ? prng.entierEntre(1, 5) : racineNonNulle(prng);
  return construireRacines(categorie, a, r);
}

/** Solution lisible de `racinesChamp1` (texte d'auteur). */
export function solutionFactorisation(donnees: DonneesRacines): string {
  return donnees.formeFactorisee;
}

/** Réponse brute qui VALIDE `racinesChamp2` (liste JSON des racines distinctes ; `[r]` pour la racine double). */
export function reponseBruteZerosCorrecte(donnees: DonneesRacines): string {
  const [r1, r2] = donnees.racines;
  return JSON.stringify(r1 === r2 ? [String(r1)] : [String(r1), String(r2)]);
}

/** Solution lisible de `racinesChamp2` (texte d'auteur) : `0 ; 4`, ou `3` pour la racine double. */
export function solutionZeros(donnees: DonneesRacines): string {
  const [r1, r2] = donnees.racines;
  return r1 === r2 ? String(r1) : `${r1} ; ${r2}`;
}
