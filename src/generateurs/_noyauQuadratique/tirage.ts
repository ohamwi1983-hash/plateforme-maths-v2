import type { Prng } from "../../../lib/prng";
import { egalR } from "../analyseFonctionMotifDelta/exact/rationnel";
import { parametresDeTirage, type RepliFx, type TirageTransformations, type Transformation } from "./types";

/**
 * Pools et repli du tirage, COMMUNS à gen8 et gen9 (RAPPORT §56, §59). Le CONTENU et l'ORDRE des pools sont contractuels (règle `_v2`) : modifier un pool change ce que `generer` produit pour une
 * graine donnée, donc impose un NOUVEAU `variante_id` à CHACUNE des variantes qui l'utilisent (`fx_depuis_graphe` ET `completion_du_carre`). Épinglés par `scripts/test-fx-ecran1.ts` (gen8) et
 * `scripts/test-gen9-generation.ts` (gen9).
 *
 * Pools (décision D3, `docs/gen8-conception-avant-go.md` §2.4 : le prompt ne bornait pas le numérateur de l'EV fractionnaire et laissait un point `A` à 120 unités de `S`) :
 *   - EV : entiers 2 à 5, puis fractions irréductibles `n/2` (n impair) et `n/4` (n impair) de valeur ∈ ]1 ; 4] ;
 *   - CV : `1/d` pour d ∈ [2 ; 5], puis `n/d` irréductible, n ∈ [2 ; 5], n < d, d ≤ 4 (`d = 5` et `d = 6` écartés : A à 30 unités de S).
 */
export const POOL_TRANSLATION: readonly number[] = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

export type Facteur = readonly [number, number];

export const POOL_EV: readonly Facteur[] = [
  [2, 1], [3, 1], [4, 1], [5, 1],
  [3, 2], [5, 2], [7, 2],
  [5, 4], [7, 4], [9, 4], [11, 4], [13, 4], [15, 4],
];

export const POOL_CV: readonly Facteur[] = [
  [1, 2], [1, 3], [1, 4], [1, 5],
  [2, 3], [3, 4],
];

/** Le pool de facteurs de la configuration (`EV` → `POOL_EV`, `CV` → `POOL_CV`, ni l'un ni l'autre → `null`). */
export const poolFacteur = (actives: readonly Transformation[]): readonly Facteur[] | null => (actives.includes("EV") ? POOL_EV : actives.includes("CV") ? POOL_CV : null);

const memeFonction = (a: TirageTransformations, b: TirageTransformations): boolean => {
  const x = parametresDeTirage(a);
  const y = parametresDeTirage(b);
  return egalR(x.a, y.a) && egalR(x.p, y.p) && egalR(x.q, y.q);
};

/**
 * Repli de l'écran 2 : atteignable avec `actives`, différent de la vraie fonction. Consomme le PRNG APRÈS les tirages de l'exercice (ordre contractuel). Mêmes pools, mais `SOX` y est un pile-ou-face
 * (sinon le repli de la configuration `SOX` seule serait toujours la vraie fonction), répété jusqu'à obtenir une fonction DIFFÉRENTE de la vraie (au plus 64 essais, puis une alternative déterministe).
 */
export function tirerRepli(prng: Prng, actives: readonly Transformation[], vrai: TirageTransformations): RepliFx {
  const tirage = (): RepliFx => {
    const pool = poolFacteur(actives);
    const th = actives.includes("TH") ? prng.choisir(POOL_TRANSLATION) : 0;
    const tv = actives.includes("TV") ? prng.choisir(POOL_TRANSLATION) : 0;
    const [facteurN, facteurD] = pool ? prng.choisir(pool) : [1, 1];
    const sox = actives.includes("SOX") ? prng.choisir([false, true] as const) : false;
    return { th, tv, facteurN, facteurD, sox };
  };
  for (let essai = 0; essai < 64; essai++) {
    const r = tirage();
    if (!memeFonction(vrai, r)) return r;
  }
  // Probabilité 2^-64 au pire : alternative déterministe (on bascule la première dimension active).
  const r: RepliFx = { th: vrai.th, tv: vrai.tv, facteurN: vrai.facteurN, facteurD: vrai.facteurD, sox: vrai.sox };
  if (actives.includes("SOX")) return { ...r, sox: !r.sox };
  if (actives.includes("TH")) return { ...r, th: r.th === 1 ? 2 : 1 };
  if (actives.includes("TV")) return { ...r, tv: r.tv === 1 ? 2 : 1 };
  const pool = actives.includes("EV") ? POOL_EV : POOL_CV;
  const suivant = pool[(pool.findIndex(([n, d]) => n === r.facteurN && d === r.facteurD) + 1) % pool.length] as Facteur;
  return { ...r, facteurN: suivant[0], facteurD: suivant[1] };
}
