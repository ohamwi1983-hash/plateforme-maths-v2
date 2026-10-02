import type { EcranChampExpression, EcranDeclare } from "../../../lib/contratGenerateur";
import type { AideAnnotationsFigure } from "../../../lib/aideTypee";
import { figureParabole } from "../../../lib/figureParabole";
import { parametres, pointsDe, type ExerciceFx } from "./types";

/** Identifiants de champ (= `reponses.champ`). */
export const CHAMP_EXPRESSION = "expression";

export const NOMS_ECRANS_FX: Record<string, string> = {
  [CHAMP_EXPRESSION]: "Expression canonique",
};

/** Consigne GLOBALE, redondante sur chaque écran (prompt). */
export const CONSIGNE_GLOBALE = "Détermine l'expression analytique de la parabole ci-dessous.";

/** Poids de l'écran 1 (prompt : 2). */
export const POIDS_EXPRESSION = 2;

/**
 * Figure de l'exercice : calculée sur l'exercice BRUT (jamais sur une réponse d'élève), donc IDENTIQUE sur tous les écrans. Aucune coordonnée remarquable n'y figure (RAPPORT §56, D4) :
 * `S` et `A` ne sortent que par l'aide `annotations_figure`.
 */
export function figureEtPoints(ex: ExerciceFx) {
  const { a, p, q } = parametres(ex);
  const { pointA } = pointsDe(ex);
  return figureParabole({ a: a.n / a.d, p: p.n, q: q.n, xA: pointA.x, description: "Graphique d'une parabole dans un repère gradué." });
}

/**
 * Aide de l'écran 1 : DEUX paliers cumulatifs. Palier 1 : le sommet `S`. Palier 2 : le point `A` et les deux écarts (horizontal `S → (x_A ; y_S)`, vertical `(x_A ; y_S) → A`) avec leurs longueurs.
 * La légende décrit ce qui est marqué, jamais comment calculer `a` : le calcul reste à l'élève.
 */
export function aideExpression(ex: ExerciceFx): AideAnnotationsFigure {
  const { sommet, pointA, d } = pointsDe(ex);
  return {
    type: "annotations_figure",
    paliers: [
      { legende: "Le sommet $S$ de la parabole est marqué sur le graphique, avec ses coordonnées.", annotations: [{ genre: "point", x: sommet.x, y: sommet.y, etiquette: `S(${sommet.x} ; ${sommet.y})` }] },
      {
        legende: "Le point $A$ de la parabole est marqué, avec l'écart horizontal et l'écart vertical qui le séparent de $S$.",
        annotations: [
          { genre: "point", x: pointA.x, y: pointA.y, etiquette: `A(${pointA.x} ; ${pointA.y})` },
          { genre: "vecteur", de: [sommet.x, sommet.y], vers: [pointA.x, sommet.y], etiquette: String(d) },
          { genre: "vecteur", de: [pointA.x, sommet.y], vers: [pointA.x, pointA.y], etiquette: String(Math.abs(pointA.y - sommet.y)) },
        ],
      },
    ],
  };
}

function ecranExpression(ex: ExerciceFx): EcranChampExpression {
  return {
    type: "champ_expression",
    champ: CHAMP_EXPRESSION,
    consigne: `${CONSIGNE_GLOBALE} Écris $f(x)$ sous la forme canonique $a(x - p)^2 + q$.`,
    placeholder: "ex. 2(x-1)^2+3",
    figure: figureEtPoints(ex).figure,
    aide: aideExpression(ex),
    poids: POIDS_EXPRESSION,
    nom: NOMS_ECRANS_FX[CHAMP_EXPRESSION],
  };
}

export function ecransFx(ex: ExerciceFx): EcranDeclare[] {
  return [ecranExpression(ex)];
}

export const champsFx = (): string[] => [CHAMP_EXPRESSION];
