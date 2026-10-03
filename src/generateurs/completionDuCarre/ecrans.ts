import type { EcranChampExpression, EcranChaineTransformations, EcranDeclare } from "../../../lib/contratGenerateur";
import { ecranChaineTransformations } from "../_noyauQuadratique/ecranChaine";
import { aideFormeCanonique } from "./aide";
import { latexFonctionDeveloppee } from "./enonce";
import type { ExerciceCc } from "./types";

/** Identifiants de champ (= `reponses.champ`). */
export const CHAMP_FORME = "forme";
export const CHAMP_CHAINE = "chaine";

export const NOMS_ECRANS_CC: Record<string, string> = {
  [CHAMP_FORME]: "Forme canonique",
  [CHAMP_CHAINE]: "Chaîne de transformations",
};

/**
 * Consigne GLOBALE, identique sur les deux écrans (RAPPORT §58) : ce qui change d'un écran à l'autre (la fonction développée à l'écran 1, la fonction visée à l'écran 2) est dans la QUESTION.
 * Elle ne nomme aucune fonction : à l'écran 2 la fonction visée est l'EFFECTIVE (réponse confirmée à l'écran 1), qui peut différer de l'énoncé si l'élève s'est trompé.
 */
export const CONSIGNE_GLOBALE = "Complète le carré pour passer de la forme développée à la forme canonique d'une fonction du second degré.";

/**
 * Poids 3 pour l'écran 1, 2 pour l'écran 2 : les mêmes que gen8, pour la même raison (RAPPORT §57) — l'écran 2 se juge sur la fonction que l'élève a CONFIRMÉE, donc se tromper exprès à
 * l'écran 1 pour obtenir un écran 2 trivial ne doit pas pouvoir rapporter plus que de réussir l'écran 1.
 */
export const POIDS_FORME = 3;
export const POIDS_CHAINE = 2;

function ecranForme(ex: ExerciceCc): EcranChampExpression {
  return {
    type: "champ_expression",
    champ: CHAMP_FORME,
    consigne: CONSIGNE_GLOBALE,
    question: `On donne $${latexFonctionDeveloppee(ex)}$. Écris $f(x)$ sous la forme canonique $a(x - p)^2 + q$.`,
    apercu: { libelle: "f(x) =" },
    placeholder: "ex. 2(x-1)^2+3",
    aide: aideFormeCanonique(ex),
    poids: POIDS_FORME,
    nom: NOMS_ECRANS_CC[CHAMP_FORME],
  };
}

/** Écran 2 : le noyau partagé (`ecranChaineTransformations`) ; la fonction visée est l'EFFECTIVE, jamais lue dans l'exercice brut. Pas de figure. */
function ecranChaine(ex: ExerciceCc): EcranChaineTransformations {
  return ecranChaineTransformations({ champ: CHAMP_CHAINE, consigne: CONSIGNE_GLOBALE, effectif: ex.effectif, poids: POIDS_CHAINE, nom: NOMS_ECRANS_CC[CHAMP_CHAINE] as string, dependDe: [CHAMP_FORME] });
}

export function ecransCc(ex: ExerciceCc): EcranDeclare[] {
  return [ecranForme(ex), ecranChaine(ex)];
}

export const champsCc = (): string[] => [CHAMP_FORME, CHAMP_CHAINE];
