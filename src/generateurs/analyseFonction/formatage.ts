import type { FonctionSecondDegre } from "./types";

/**
 * Formatage LaTeX (texte d'AUTEUR, jamais une saisie d'élève) des nombres et de `f(x)` de gen7. Exposant en vrai
 * LaTeX (`x^2`), jamais le caractère `²` (bug de glyphe documenté par l'ancien pilote). Fractions irréductibles.
 */

function pgcd(x: number, y: number): number {
  return y === 0 ? Math.abs(x) || 1 : pgcd(y, x % y);
}

/** Fraction irréductible `[numérateur, dénominateur > 0]` d'un nombre de ¼ℤ (les valeurs de gen7 : ½ℤ et ¼ℤ). */
export function fractionIrreductible(v: number): [number, number] {
  let [n, d] = [Math.round(v * 4), 4];
  const g = pgcd(n, d);
  n /= g;
  d /= g;
  return [n, d];
}

/** `3`, `-\dfrac{9}{4}`, `\dfrac{5}{2}` : le nombre de ¼ℤ en LaTeX (sans `$`). */
export function latexNombre(v: number): string {
  const [n, d] = fractionIrreductible(v);
  if (d === 1) return String(n);
  return `${n < 0 ? "-" : ""}\\dfrac{${Math.abs(n)}}{${d}}`;
}

/** `3`, `-9/4` : le même nombre en TEXTE brut (solution attendue lisible, attribut). */
export function texteNombre(v: number): string {
  const [n, d] = fractionIrreductible(v);
  return d === 1 ? String(n) : `${n}/${d}`;
}

export type Terme = "a" | "b" | "c";

/** Termes non nuls de `[a, b, c]` (`a` y est toujours), dans l'ordre canonique. */
export function termesNonNuls(f: Pick<FonctionSecondDegre, "b" | "c">): Terme[] {
  const termes: Terme[] = ["a"];
  if (f.b !== 0) termes.push("b");
  if (f.c !== 0) termes.push("c");
  return termes;
}

function monome(terme: Terme, coefficient: number, premier: boolean): string {
  const valeur = Math.abs(coefficient);
  const signe = coefficient < 0 ? (premier ? "-" : " - ") : premier ? "" : " + ";
  const chiffre = valeur === 1 && terme !== "c" ? "" : String(valeur);
  const variable = terme === "a" ? "x^2" : terme === "b" ? "x" : "";
  return `${signe}${chiffre}${variable}`;
}

/** Corps de `f(x)` = `ax^2 + bx + c` dans l'ordre `ordre` (les termes nuls sont absents), sans `$`. */
export function latexPolynome(f: Pick<FonctionSecondDegre, "a" | "b" | "c">, ordre: readonly Terme[]): string {
  return ordre.map((t, i) => monome(t, f[t], i === 0)).join("");
}

/** `ax^2 + bx + c` sans terme nul, ordre canonique (énoncé des écrans « racines », sans `$`). */
export function equationCanonique(f: Pick<FonctionSecondDegre, "a" | "b" | "c">): string {
  return latexPolynome(f, (["a", "b", "c"] as const).filter((t) => t === "a" || f[t] !== 0));
}

/** Écriture décimale sûre d'une valeur de racine (peut sortir de ¼ℤ après une projection sur une factorisation fausse). */
export function latexRacine(v: number): string {
  return Math.abs(v * 4 - Math.round(v * 4)) < 1e-9 ? latexNombre(v) : String(Math.round(v * 1e6) / 1e6);
}
