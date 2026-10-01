import { egaux, exactDepuisEntier, latexExact, oppose, signe, type Exact } from "./exact/nombreExact";
import { coefVersExact, type Coef, type Terme } from "./types";

/**
 * Formatage LaTeX (texte d'AUTEUR, jamais une saisie d'élève) des nombres exacts et de `f(x)` de gen7 « motif / delta ». Convention d'affichage (RAPPORT §49) :
 * JAMAIS `1x` ni `1x²` (toujours `x` / `x²` seuls quand le coefficient vaut ±1) ; un terme dont le coefficient est NUL n'apparaît pas ; exposant en vrai LaTeX.
 */
const ORDRE_CANONIQUE: readonly Terme[] = ["a", "b", "c"];
const rang = (t: Terme): number => ORDRE_CANONIQUE.indexOf(t);

const UN = exactDepuisEntier(1);

/** Un monôme `±coef·x^k` (sans `$`) ; `premier` : pas de « + » initial. `coef` exact non nul. */
export function monome(terme: Terme, coefficient: Exact, premier: boolean): string {
  const negatif = signe(coefficient) < 0;
  const absolu = negatif ? oppose(coefficient) : coefficient;
  const signeTexte = negatif ? (premier ? "-" : " - ") : premier ? "" : " + ";
  const variable = terme === "a" ? "x^2" : terme === "b" ? "x" : "";
  let chiffre: string;
  if (terme !== "c" && egaux(absolu, UN)) chiffre = "";
  else {
    const l = latexExact(absolu);
    chiffre = absolu.size > 1 ? `\\left(${l}\\right)` : l;
  }
  return `${signeTexte}${chiffre}${variable}`;
}

/** Corps de `f(x) = ax² + bx + c` (sans `$`), dans l'ordre `ordre` ; chaque terme de `ordre` doit être NON NUL. */
export function latexPolynomeMD(coefs: { a: Coef; b: Coef; c: Coef }, ordre: readonly Terme[]): string {
  return ordre.map((t, i) => monome(t, coefVersExact(coefs[t]), i === 0)).join("");
}

/** Termes non nuls de `(a, b, c)` : `a` y est toujours. */
export function termesNonNulsMD(coefs: { a: Coef; b: Coef; c: Coef }): Terme[] {
  return ORDRE_CANONIQUE.filter((t) => t === "a" || coefs[t].n !== 0);
}

/**
 * Ordre d'affichage de la fonction EFFECTIVE (celle de l'élève, RAPPORT §38) : celui de l'énoncé restreint aux termes non nuls, les termes qui n'y étaient pas
 * ajoutés à la fin ; jamais l'ordre canonique (inversé s'il se présentait tel quel).
 */
export function ordreAffichage(ordreEnonce: readonly Terme[], coefs: { a: Coef; b: Coef; c: Coef }): Terme[] {
  const presents = new Set(termesNonNulsMD(coefs));
  const ordre = [...ordreEnonce.filter((t) => presents.has(t)), ...ORDRE_CANONIQUE.filter((t) => presents.has(t) && !ordreEnonce.includes(t))];
  const canonique = ordre.every((t, i) => i === 0 || rang(ordre[i - 1] as Terme) < rang(t));
  return canonique && ordre.length > 1 ? [...ordre].reverse() : ordre;
}
