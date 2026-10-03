import type { EcranChaineTransformations, FigureDeclaree } from "../../../lib/contratGenerateur";
import { texteFonction } from "./formatage";
import { depuisJson, type ParametresJson } from "./types";

/**
 * Écran « chaîne de transformations » COMMUN à gen8 et gen9 (RAPPORT §56, §57, §58, §59) : le menu, les bornes, la légende et la construction de l'écran. Ce qui change d'un générateur à
 * l'autre (champ, consigne globale, poids, figure éventuelle, écran dont il dépend) est un paramètre ; la logique est unique.
 */

/**
 * Le menu est TOUJOURS le même, quelle que soit la configuration : il ne trahit pas les transformations actives. TH, TV, EV et CV prennent une VALEUR (RAPPORT §58) ; son placeholder
 * donne la convention de signe, la même pour tous les élèves. SOX n'en prend pas.
 *  - TH : `h` tel que `f_k(x) = f_{k-1}(x − h)` (positif = vers la droite) ; TV : la constante `k` ajoutée (positive = vers le haut) ;
 *  - EV : le facteur `m > 1` ; CV : le facteur `0 < m < 1` (jamais l'inverse).
 */
export const CHOIX_CHAINE = [
  { id: "TH", libelle: "TH", valeur: { placeholder: "h (+ : vers la droite)" } },
  { id: "TV", libelle: "TV", valeur: { placeholder: "k (+ : vers le haut)" } },
  { id: "EV", libelle: "EV", valeur: { placeholder: "facteur > 1" } },
  { id: "CV", libelle: "CV", valeur: { placeholder: "facteur entre 0 et 1" } },
  { id: "SOX", libelle: "SOX" },
];
export const ETAPES_MIN = 1;
export const ETAPES_MAX = 5;
export const BORNES_CHAINE = { choix: CHOIX_CHAINE, etapesMin: ETAPES_MIN, etapesMax: ETAPES_MAX };

export const LEGENDE_TRANSFORMATIONS = "TH : translation horizontale · TV : translation verticale · EV : étirement vertical · CV : compression verticale · SOX : symétrie d'axe Ox.";

/**
 * Question de l'écran 2 : la fonction visée est l'EFFECTIVE (réponse confirmée à l'écran 1, re-sérialisée en forme canonique, jamais la chaîne brute de l'élève : RAPPORT §18). Sur l'exercice BRUT
 * (sans `effectif`, jamais servi : poids, dépendances, champs), la question ne nomme AUCUNE fonction : un oubli de projection ne peut pas faire fuiter la vraie.
 */
export function questionChaine(effectif: ParametresJson | undefined): string {
  const visee = effectif ? texteFonction(depuisJson(effectif)) : "$f(x)$";
  return `Quelles transformations permettent d'obtenir la fonction ${visee} à partir de $x^2$ ?`;
}

export interface OptionsEcranChaine {
  champ: string;
  consigne: string;
  effectif: ParametresJson | undefined;
  poids: number;
  nom: string;
  /** L'écran (champ) dont la réponse confirmée alimente celui-ci. */
  dependDe: string[];
  figure?: FigureDeclaree;
}

export function ecranChaineTransformations(o: OptionsEcranChaine): EcranChaineTransformations {
  return {
    type: "chaine_transformations",
    champ: o.champ,
    consigne: o.consigne,
    question: questionChaine(o.effectif),
    legende: LEGENDE_TRANSFORMATIONS,
    depart: "$f_0(x) = x^2$",
    ...BORNES_CHAINE,
    placeholder: "ex. (x-2)^2",
    ...(o.figure ? { figure: o.figure } : {}),
    poids: o.poids,
    nom: o.nom,
    dependDe: o.dependDe,
  };
}
