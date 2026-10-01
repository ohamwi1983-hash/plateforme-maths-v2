import type { AideTypee, SegmentFormule } from "../../../lib/aideTypee";
import { latexExact, oppose, signe, egaux, exactDepuisEntier } from "./exact/nombreExact";
import { coefVersExact, type Coef } from "./types";

/**
 * Aides de gen7 « motif / delta » (RAPPORT §49).
 *
 * `coefficients` : la formule colorée, TOUJOURS les trois termes (un coefficient nul s'écrit `0`), seul le coefficient est coloré ; convention `x` / `x²` sans « 1 » (un coefficient de
 * valeur absolue 1 s'écrit sans chiffre : on OMET le segment, son signe reste dans un segment sans rôle). Un coefficient irrationnel est un segment LaTeX (`2\sqrt{2}`).
 */
export function aideFormuleColoreeMD(f: { a: Coef; b: Coef; c: Coef }): AideTypee {
  const [a, b, c] = [coefVersExact(f.a), coefVersExact(f.b), coefVersExact(f.c)];
  const un = exactDepuisEntier(1);
  const absolu = (x: typeof a) => (signe(x) < 0 ? oppose(x) : x);
  const segments: SegmentFormule[] = [{ latex: "f(x) = " }];
  if (egaux(absolu(a), un)) {
    if (signe(a) < 0) segments.push({ latex: "-" });
  } else segments.push({ latex: latexExact(a), role: "a" });
  segments.push({ latex: `x^2 ${signe(b) >= 0 ? "+" : "-"} ` });
  if (!egaux(absolu(b), un)) segments.push({ latex: latexExact(absolu(b)), role: "b" });
  segments.push({ latex: `x ${signe(c) >= 0 ? "+" : "-"} ` });
  segments.push({ latex: latexExact(absolu(c)), role: "c" });
  return { type: "formule_coloree", segments };
}

/**
 * `allure` : UNE aide COMBINÉE (décision Q1 du propriétaire : le contrat n'accepte qu'une aide par écran, une seule pénalité) qui porte les deux explications — le signe de `a`, puis
 * le signe de `a` ET de `b` ensemble pour la position du sommet. Texte d'auteur statique : il ne dit rien de la fonction étudiée.
 */
export const AIDE_ALLURE =
  "1) Le signe de $a$ donne le sens de la parabole : $a > 0$, elle s'ouvre vers le haut ; $a < 0$, vers le bas.\n" +
  "2) La position du sommet dépend des signes de $a$ ET de $b$ ensemble : l'abscisse du sommet est $x_S = -\\dfrac{b}{2a}$. " +
  "Si $a$ et $b$ ont le même signe, $x_S < 0$ (sommet à gauche de l'axe $Oy$) ; s'ils ont des signes contraires, $x_S > 0$ (à droite) ; si $b = 0$, $x_S = 0$ (sur l'axe $Oy$).";

/** `axeSommet` : la formule du sommet (texte d'auteur statique). */
export const AIDE_AXE_SOMMET = "L'axe de symétrie a pour équation $x = x_S$, avec $x_S = -\\dfrac{b}{2a}$ et $y_S = f(x_S)$.";
