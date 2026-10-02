/** Codes de compétence de gen8 « f(x) à partir du graphe » (RAPPORT §56). Signal pur : n'affectent jamais la note. Déclarés aussi dans `lib/dictionnaireCompetences.ts` et les trois fichiers d'explication. */
export const CODE_SIGNE_P_INVERSE = "SIGNE_P_INVERSE";
export const CODE_Q_INCORRECT = "Q_INCORRECT";
export const CODE_A_INCORRECT = "A_INCORRECT";
export const CODE_P_MAGNITUDE_INCORRECTE = "P_MAGNITUDE_INCORRECTE";
/** Écran 2 : une étape bien formée mais avec une transformation que ni la ligne du professeur ni la fonction de l'élève n'autorisent. */
export const CODE_TRANSFORMATION_HORS_SUJET = "TRANSFORMATION_HORS_SUJET";
/**
 * Écran 2 (RAPPORT §58) : la règle de l'étape est VRAIE pour la transformation choisie, mais la valeur que l'élève a déclarée (TH `h`, TV `k`, EV | CV facteur) n'est pas celle de la règle.
 * Signal PUR : n'affecte ni le verdict ni `fractionCorrecte` (l'étape est fausse, avec ou sans ce code). N'existe que sur `not_equivalent` ; une valeur hors domaine est un `parse_error`, jamais ce code.
 */
export const CODE_VALEUR_DECLAREE_INCORRECTE = "VALEUR_DECLAREE_INCORRECTE";

/** Codes que `verifier` peut renvoyer à l'écran 1. */
export const CODES_FX_ECRAN_EXPRESSION: readonly string[] = [CODE_SIGNE_P_INVERSE, CODE_Q_INCORRECT, CODE_A_INCORRECT, CODE_P_MAGNITUDE_INCORRECTE];

/** Tous les codes du générateur. */
export const CODES_FX: readonly string[] = [...CODES_FX_ECRAN_EXPRESSION, CODE_TRANSFORMATION_HORS_SUJET, CODE_VALEUR_DECLAREE_INCORRECTE];
