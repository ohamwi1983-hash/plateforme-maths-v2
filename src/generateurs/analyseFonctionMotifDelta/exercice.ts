import { creerPrng } from "../../../lib/prng";
import { chercherFamille, type Famille } from "./familles";
import { coefVersExact, effectifVraiMD, type ExerciceMotifDelta, type FamilleId, type Terme } from "./types";
import { estZero } from "./exact/nombreExact";

/**
 * Génération d'un exercice de gen7 « motif / delta » (RAPPORT §49), régénéré à chaque appel depuis `exercices_assignes.graine`.
 *
 * ── ORDRE DES TIRAGES DU PRNG (contractuel pour ce `variante_id` : toute modification impose un nouveau `variante_id`, CLAUDE.md) ──
 *  1. UN tirage `entierEntre(0, taille du pool − 1)` : l'élément du pool de la famille (ordre d'énumération figé dans `familles.ts`) ;
 *  2. si f a 3 termes non nuls : UN tirage `entierEntre(0, 4)` : l'une des 5 permutations NON canoniques de `a, b, c` (`PERMUTATIONS_NON_CANONIQUES`) ;
 *     si f n'a que 2 termes non nuls : AUCUN tirage — l'unique ordre non canonique est l'inverse (`c + ax²`, `bx + ax²`).
 * « Jamais l'ordre développé canonique » : une présentation `ax² + bx + c` n'est jamais produite.
 */
export const PERMUTATIONS_NON_CANONIQUES: readonly (readonly Terme[])[] = [
  ["a", "c", "b"],
  ["b", "a", "c"],
  ["b", "c", "a"],
  ["c", "a", "b"],
  ["c", "b", "a"],
];

const poolsMemo = new Map<FamilleId, ReturnType<Famille["pool"]>>();
export function poolDe(famille: Famille): ReturnType<Famille["pool"]> {
  let p = poolsMemo.get(famille.id);
  if (p === undefined) {
    p = famille.pool();
    poolsMemo.set(famille.id, p);
  }
  return p;
}

export function genererExerciceMD(familleId: FamilleId, graine: number): ExerciceMotifDelta {
  const famille = chercherFamille(familleId);
  if (famille === undefined) throw new Error(`genererExerciceMD : famille inconnue « ${String(familleId)} »`);
  const prng = creerPrng(graine);
  const pool = poolDe(famille);
  const { a, b, c } = pool[prng.entierEntre(0, pool.length - 1)] as ReturnType<Famille["pool"]>[number];
  const termes: Terme[] = ["a"];
  if (!estZero(coefVersExact(b))) termes.push("b");
  if (!estZero(coefVersExact(c))) termes.push("c");
  const ordreTermes: Terme[] = termes.length === 2 ? [termes[1] as Terme, "a"] : [...(PERMUTATIONS_NON_CANONIQUES[prng.entierEntre(0, 4)] as readonly Terme[])];
  return { famille: familleId, a, b, c, ordreTermes, effectif: effectifVraiMD(a, b, c), affichageTableau: "vraies" };
}
