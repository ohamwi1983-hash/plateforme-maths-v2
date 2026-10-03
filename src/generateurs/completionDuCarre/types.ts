import { multiplierR, oppR, rat, ajouterR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { parametresDeTirage, type Parametres, type ParametresJson, type RepliFx, type Transformation } from "../_noyauQuadratique/types";

/**
 * Modèle de gen9 « Complète le carré » (`variante_id` `completion_du_carre`, RAPPORT §59). La fonction `f(x) = a(x − p)² + q` est obtenue de `x²` par les transformations ACTIVES de la ligne
 * (noyau partagé) et AFFICHÉE développée `ax² + bx + c` avec `b = −2ap` et `c = ap² + q`, termes mélangés. `TH` est toujours active (`p ≠ 0`, donc `b ≠ 0`) ; `b` et `c` sont des ENTIERS
 * par construction du tirage (`generation.ts`).
 */
export interface ExerciceCc {
  /** Transformations actives, dans l'ordre canonique de `TRANSFORMATIONS` (copie de la configuration figée) ; contient toujours `TH`. */
  actives: Transformation[];
  /** Translation horizontale `p` (entier non nul). */
  th: number;
  /** Translation verticale `q` (entier, 0 si `TV` inactive). */
  tv: number;
  /** Facteur d'échelle `m = facteurN / facteurD` (> 0, fraction irréductible ; 1/1 si ni `EV` ni `CV`). Le signe de `a` est porté par `sox`. */
  facteurN: number;
  facteurD: number;
  /** `SOX` active : `a = −m`. */
  sox: boolean;
  /**
   * Ordre d'AFFICHAGE des termes de `f(x)` : indices du développement canonique (0 : `ax²`, 1 : `bx`, 2 : `c`), réordonnés. Jamais l'ordre canonique. Le terme `c` est absent quand `c = 0`.
   * Fait partie de l'exercice brut : y toucher change ce que `generer` produit (règle `_v2`).
   */
  ordre: number[];
  /** Fonction de REPLI de l'écran 2 (même rôle et mêmes règles que gen8, RAPPORT §57) : tirée APRÈS tout le reste, jamais égale à la vraie fonction. */
  repli: RepliFx;
  /** Fonction EFFECTIVE de l'écran 2 (cascade), posée par `projeter` seulement. Absente de l'exercice BRUT. */
  effectif?: ParametresJson;
}

export const parametres = (ex: ExerciceCc): Parametres => parametresDeTirage(ex);

/** Coefficients du développement `ax² + bx + c` : `b = −2ap`, `c = ap² + q`. Exacts (`b` et `c` sont entiers pour tout exercice généré). */
export function coefficientsDeveloppes({ a, p, q }: Parametres): { a: Rat; b: Rat; c: Rat } {
  return { a, b: oppR(multiplierR(rat(2), multiplierR(a, p))), c: ajouterR(multiplierR(a, multiplierR(p, p)), q) };
}
