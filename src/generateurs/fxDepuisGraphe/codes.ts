/** Codes de compétence de gen8 « f(x) à partir du graphe » (RAPPORT §56). Signal pur : n'affectent jamais la note. Déclarés aussi dans `lib/dictionnaireCompetences.ts` et les trois fichiers d'explication. */
export const CODE_SIGNE_P_INVERSE = "SIGNE_P_INVERSE";
export const CODE_Q_INCORRECT = "Q_INCORRECT";
export const CODE_A_INCORRECT = "A_INCORRECT";
export const CODE_P_MAGNITUDE_INCORRECTE = "P_MAGNITUDE_INCORRECTE";
/** Écran 2 : une étape bien formée mais avec une transformation que ni la ligne du professeur ni la fonction de l'élève n'autorisent. */
export const CODE_TRANSFORMATION_HORS_SUJET = "TRANSFORMATION_HORS_SUJET";

/** Codes que `verifier` peut renvoyer à l'écran 1. */
export const CODES_FX_ECRAN_EXPRESSION: readonly string[] = [CODE_SIGNE_P_INVERSE, CODE_Q_INCORRECT, CODE_A_INCORRECT, CODE_P_MAGNITUDE_INCORRECTE];

/** Tous les codes du générateur. */
export const CODES_FX: readonly string[] = [...CODES_FX_ECRAN_EXPRESSION, CODE_TRANSFORMATION_HORS_SUJET];
