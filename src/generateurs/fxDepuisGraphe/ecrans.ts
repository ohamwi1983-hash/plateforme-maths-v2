import type { EcranChampExpression, EcranChaineTransformations, EcranDeclare } from "../../../lib/contratGenerateur";
import type { AideAnnotationsFigure } from "../../../lib/aideTypee";
import { figureParabole } from "../../../lib/figureParabole";
import { texteFonction } from "./formatage";
import { depuisJson, parametres, pointsDe, type ExerciceFx } from "./types";

/** Identifiants de champ (= `reponses.champ`). */
export const CHAMP_EXPRESSION = "expression";
export const CHAMP_CHAINE = "chaine";

export const NOMS_ECRANS_FX: Record<string, string> = {
  [CHAMP_EXPRESSION]: "Expression canonique",
  [CHAMP_CHAINE]: "Chaîne de transformations",
};

/** Consigne GLOBALE, redondante sur chaque écran (prompt). */
export const CONSIGNE_GLOBALE = "Détermine l'expression analytique de la parabole ci-dessous.";

/**
 * Poids INVERSÉS par rapport au prompt (décision du propriétaire, RAPPORT §57) : 3 pour l'écran 1, 2 pour l'écran 2. L'écran 2 étant jugé sur la fonction que l'élève a CONFIRMÉE (cascade), se
 * tromper exprès à l'écran 1 pour obtenir un écran 2 trivial ne peut plus rapporter : le gain maximal (2) est inférieur à la note minimale d'un élève honnête qui réussit l'écran 1 (3),
 * quelle que soit sa chance de réussir l'écran 2.
 */
export const POIDS_EXPRESSION = 3;
export const POIDS_CHAINE = 2;

/** Le menu est TOUJOURS le même, quelle que soit la configuration : il ne trahit pas les transformations actives. */
export const CHOIX_CHAINE = [
  { id: "TH", libelle: "TH" },
  { id: "TV", libelle: "TV" },
  { id: "EV", libelle: "EV" },
  { id: "CV", libelle: "CV" },
  { id: "SOX", libelle: "SOX" },
];
export const ETAPES_MIN = 1;
export const ETAPES_MAX = 5;
export const BORNES_CHAINE = { choix: CHOIX_CHAINE, etapesMin: ETAPES_MIN, etapesMax: ETAPES_MAX };

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

const LEGENDE_TRANSFORMATIONS = "TH : translation horizontale · TV : translation verticale · EV : étirement vertical · CV : compression verticale · SOX : symétrie d'axe Ox.";

/**
 * Écran 2 : la fonction visée est l'EFFECTIVE (réponse confirmée à l'écran 1, re-sérialisée en forme canonique, jamais la chaîne brute de l'élève : RAPPORT §18). Sur l'exercice BRUT (sans
 * `effectif`, jamais servi : poids, dépendances, champs), la consigne ne nomme AUCUNE fonction : un oubli de projection ne peut pas faire fuiter la vraie.
 */
function ecranChaine(ex: ExerciceFx): EcranChaineTransformations {
  const visee = ex.effectif ? texteFonction(depuisJson(ex.effectif)) : "$f(x)$";
  return {
    type: "chaine_transformations",
    champ: CHAMP_CHAINE,
    consigne: `${CONSIGNE_GLOBALE} Quelles transformations permettent d'obtenir la fonction ${visee} à partir de $x^2$ ?\n${LEGENDE_TRANSFORMATIONS}`,
    depart: "$f_0(x) = x^2$",
    ...BORNES_CHAINE,
    placeholder: "ex. (x-2)^2",
    figure: figureEtPoints(ex).figure,
    poids: POIDS_CHAINE,
    nom: NOMS_ECRANS_FX[CHAMP_CHAINE],
    dependDe: [CHAMP_EXPRESSION],
  };
}

export function ecransFx(ex: ExerciceFx): EcranDeclare[] {
  return [ecranExpression(ex), ecranChaine(ex)];
}

export const champsFx = (): string[] => [CHAMP_EXPRESSION, CHAMP_CHAINE];
