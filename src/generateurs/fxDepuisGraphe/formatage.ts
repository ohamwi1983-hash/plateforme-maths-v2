import { egalR, signeR, oppR, UN_R, ZERO_R, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import type { Parametres } from "./types";

/**
 * Texte d'AUTEUR (LaTeX sans `$` externe) des fonctions de gen8. Convention (RAPPORT §56) : JAMAIS un terme NEUTRE — `a = 1` n'écrit pas « 1 », `p = 0` donne `x^2` et non `(x - 0)^2`,
 * `q = 0` n'écrit pas « + 0 » — donc l'énoncé ne trahit jamais une transformation inactive. Un coefficient fractionnaire s'écrit `\dfrac{n}{d}`.
 */
const absolu = (r: Rat): Rat => (signeR(r) < 0 ? oppR(r) : r);

/** Valeur absolue d'un rationnel en LaTeX : `3`, `\dfrac{3}{2}`. */
export function latexRatAbsolu(r: Rat): string {
  const v = absolu(r);
  return v.d === 1 ? String(v.n) : `\\dfrac{${v.n}}{${v.d}}`;
}

/** `a(x - p)^2 + q` (sans `$`), termes neutres omis. `a ≠ 0` obligatoire. */
export function latexFonction({ a, p, q }: Parametres): string {
  if (signeR(a) === 0) throw new Error("latexFonction : a = 0 n'est pas une parabole");
  const negatif = signeR(a) < 0;
  const coef = egalR(absolu(a), UN_R) ? "" : latexRatAbsolu(a);
  const carre = egalR(p, ZERO_R) ? "x^2" : `(x ${signeR(p) > 0 ? "-" : "+"} ${latexRatAbsolu(p)})^2`;
  const terme = `${negatif ? "-" : ""}${coef}${carre}`;
  if (egalR(q, ZERO_R)) return terme;
  return `${terme} ${signeR(q) > 0 ? "+" : "-"} ${latexRatAbsolu(q)}`;
}

/** Même fonction, avec son nom : `f(x) = …` (texte d'auteur, délimité par `$…$`). */
export const texteFonction = (parametres: Parametres): string => `$f(x) = ${latexFonction(parametres)}$`;
