import type { CategorieAnalyseFonction } from "./racines/types";

/**
 * Types et constantes COMMUNS aux écrans de gen7 « Analyse d'une fonction du second degré » (phase 3b-3).
 * Les deux écrans « racines » vivent dans `./racines/` (3b-2) ; ce dossier-ci porte les six autres et l'assemblage.
 */
export type { CategorieAnalyseFonction };

export const CHAMP_COEFFICIENTS = "coefficients";
export const CHAMP_ALLURE = "allure";
export const CHAMP_AXE_SOMMET = "axeSommet";
export const CHAMP_DOMAINE_IMAGE = "domaineImage";
export const CHAMP_RECONNAISSANCE = "racinesReconnaissance";
export const CHAMP_TABLEAU_SIGNES = "tableauSignes";

/** Codes propres à ces écrans (les 4 autres — `C04`, `C05_SIGNE_REPETE`, `C06_SIGNE_OPPOSE`, `RACINE_PARTIELLE` — sont dans `./racines`). */
export const CODE_ALLURE_PARTIELLE = "ALLURE_PARTIELLE";
export const CODE_AXE_SYMETRIE_NOTATION = "AXE_SYMETRIE_NOTATION";
export const CODE_SIGNE_VARIATION_PARTIEL = "SIGNE_VARIATION_PARTIEL";

/** Tolérance des saisies décimales de `axeSommet` et `domaineImage` (comparaison `<=`, comme l'ancien pilote). */
export const TOLERANCE_SAISIE = 0.005;

/**
 * Données numériques d'un exercice communes à tous les écrans. `xS = −b/(2a)` ∈ ½ℤ et `yS = f(xS)` ∈ ¼ℤ pour les
 * quatre catégories : exactement représentables en double, la tolérance n'est sollicitée que par la SAISIE de l'élève.
 * `racines` : racines réelles triées (`[r, r]` pour la double), `null` si Δ < 0 (`af_irreductible`).
 */
export interface FonctionSecondDegre {
  categorie: CategorieAnalyseFonction;
  a: number;
  b: number;
  c: number;
  xS: number;
  yS: number;
  racines: [number, number] | null;
}

/** Racines réelles de `ax² + bx + c` (`null` si Δ < 0). Δ est un entier : la racine carrée d'un carré parfait est exacte. */
export function racinesReelles(a: number, b: number, c: number): [number, number] | null {
  const delta = b * b - 4 * a * c;
  if (delta < 0) return null;
  const s = Math.sqrt(delta);
  const [r1, r2] = [(-b - s) / (2 * a), (-b + s) / (2 * a)];
  return r1 <= r2 ? [r1, r2] : [r2, r1];
}

export function fonctionDe(categorie: CategorieAnalyseFonction, a: number, b: number, c: number): FonctionSecondDegre {
  if (!Number.isInteger(a) || !Number.isInteger(b) || !Number.isInteger(c) || a === 0) throw new Error(`fonctionDe : a, b, c entiers avec a ≠ 0 attendus (reçu ${a}, ${b}, ${c})`);
  const xS = -b / (2 * a);
  const yS = a * xS * xS + b * xS + c;
  const racines = racinesReelles(a, b, c);
  if ((categorie === "irreductible") !== (racines === null)) throw new Error(`fonctionDe : la catégorie « ${categorie} » ne correspond pas à Δ = ${b * b - 4 * a * c}`);
  // `-0` (b = 0) est un vrai zéro pour les comparaisons mais s'écrit « 0 » : jamais « -0 » dans un texte.
  return { categorie, a, b, c, xS: xS === 0 ? 0 : xS, yS: yS === 0 ? 0 : yS, racines };
}

/**
 * Données EFFECTIVES des écrans `allure`, `axeSommet` et `domaineImage` (RAPPORT §38, cascade des coefficients) : ce que la méthode juste
 * donne à partir de ce que l'élève a CONFIRMÉ (« une méthode juste appliquée à une donnée de départ fausse doit réussir »), dans les deux
 * régimes de correction. Dans l'exercice brut : les vraies valeurs.
 *  - `a`, `b`, `c` : coefficients confirmés à `coefficients` s'ils sont exploitables (lisibles, `a ≠ 0`, bornés), sinon les vrais — la
 *    fonction est PUBLIQUE dans l'énoncé, ce repli ne révèle rien ;
 *  - `xS`, `yS` : sommet de la parabole de ces coefficients ;
 *  - `yImage` : borne de `im f`, l'ordonnée du sommet CONFIRMÉE à `axeSommet` si elle est lisible et s'écarte de `yS` de plus que la
 *    tolérance de saisie, sinon `yS`.
 */
export interface DonneesEffectives {
  a: number;
  b: number;
  c: number;
  xS: number;
  yS: number;
  yImage: number;
  /** `a, b, c` viennent de l'élève ET diffèrent des vrais : l'énoncé des écrans suivants affiche SA fonction. */
  coefficientsEleve: boolean;
  /** `yImage` diffère de la vraie ordonnée du sommet : la consigne de `domaineImage` la rappelle. */
  ordonneeEleve: boolean;
}

/** Données effectives d'un exercice non projeté : les vraies. */
export function effectifVrai(f: FonctionSecondDegre): DonneesEffectives {
  return { a: f.a, b: f.b, c: f.c, xS: f.xS, yS: f.yS, yImage: f.yS, coefficientsEleve: false, ordonneeEleve: false };
}
