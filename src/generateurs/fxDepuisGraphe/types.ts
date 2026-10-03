import { multiplierR, rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { parametresDeTirage, polynomeDe, type Parametres, type ParametresJson, type RepliFx, type Transformation } from "../_noyauQuadratique/types";
import type { Polynome } from "../_noyauQuadratique/polynome";

/**
 * Modèle de gen8 « f(x) à partir du graphe » (`variante_id` `fx_depuis_graphe`, RAPPORT §56). Les types et conversions communs (transformations, `Parametres`, `polynomeDe`…) vivent dans le
 * noyau partagé `../_noyauQuadratique/types.ts` (RAPPORT §59) ; ne reste ici que ce qui est propre à gen8 : l'exercice, son graphique et le point `A`.
 */

/** Exercice brut, JSON-sérialisable, régénéré depuis `(graine, configuration)` : jamais stocké. */
export interface ExerciceFx {
  /** Transformations actives, dans l'ordre canonique de `TRANSFORMATIONS` (copie de la configuration figée). */
  actives: Transformation[];
  /** Translation horizontale `p` (entier, 0 si `TH` inactive). */
  th: number;
  /** Translation verticale `q` (entier, 0 si `TV` inactive). */
  tv: number;
  /** Facteur d'échelle `m = facteurN / facteurD` (> 0, fraction irréductible ; 1/1 si ni `EV` ni `CV`). Le signe de `a` est porté par `sox`. */
  facteurN: number;
  facteurD: number;
  /** `SOX` active : `a = −m`. */
  sox: boolean;
  /** Côté du second point `A` : `x_A = p + signeEcart · d`. Indifférent pour l'élève. */
  signeEcart: 1 | -1;
  /**
   * Fonction de REPLI de l'écran 2 (RAPPORT §57) : tirée APRÈS les quatre tirages ci-dessus, atteignable avec la même configuration, JAMAIS égale à la vraie. Ne sert que lorsqu'aucune
   * réponse n'a été confirmée à l'écran 1 (chrono expiré) et que la solution n'a pas été montrée : la vraie fonction ne doit alors pas fuiter par l'énoncé de l'écran 2.
   */
  repli: RepliFx;
  /**
   * Fonction EFFECTIVE de l'écran 2 (cascade, RAPPORT §18), posée par `projeter` seulement : la fonction CONFIRMÉE par l'élève à l'écran 1 (même fausse), re-sérialisée ; la vraie fonction si
   * la solution a été montrée ; le repli si aucune réponse n'existe. Absente de l'exercice BRUT : l'écran 2 ne s'écrit ni ne se juge jamais sur la vraie fonction par oubli de projection.
   */
  effectif?: ParametresJson;
}

export const estActive = (ex: Pick<ExerciceFx, "actives">, t: Transformation): boolean => ex.actives.includes(t);

export const parametres = (ex: ExerciceFx): Parametres => parametresDeTirage(ex);

export const polynomeVrai = (ex: ExerciceFx): Polynome => polynomeDe(parametres(ex));

/**
 * Plus petit entier `d ≥ 1` tel que `d²` soit un multiple de `den` (`den ≥ 1`) : l'écart horizontal `d` entre `S` et `A` qui rend `y_A = q + a·d²` ENTIER pour `a = n/den` irréductible. */
export function ecartHorizontal(den: number): number {
  for (let d = 1; ; d++) if ((d * d) % den === 0) return d;
}

export interface PointsFx {
  sommet: { x: number; y: number };
  pointA: { x: number; y: number };
  /** Écart horizontal `d ≥ 1` (valeur absolue). */
  d: number;
}

/** `S = (p ; q)` et `A = (p ± d ; q + a·d²)`, à coordonnées entières. */
export function pointsDe(ex: ExerciceFx): PointsFx {
  const { a } = parametres(ex);
  const d = ecartHorizontal(a.d);
  const dy = multiplierR(a, rat(d * d)); // entier par construction de d
  if (dy.d !== 1) throw new Error(`gen8 : écart vertical non entier (${dy.n}/${dy.d}) pour d = ${d}`);
  return { sommet: { x: ex.th, y: ex.tv }, pointA: { x: ex.th + ex.signeEcart * d, y: ex.tv + dy.n }, d };
}
