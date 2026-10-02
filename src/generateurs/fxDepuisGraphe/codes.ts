/** Codes de compétence de gen8 « f(x) à partir du graphe » (RAPPORT §56). Signal pur : n'affectent jamais la note. Déclarés aussi dans `lib/dictionnaireCompetences.ts` et les trois fichiers d'explication. */
export const CODE_SIGNE_P_INVERSE = "SIGNE_P_INVERSE";
export const CODE_Q_INCORRECT = "Q_INCORRECT";
export const CODE_A_INCORRECT = "A_INCORRECT";
export const CODE_P_MAGNITUDE_INCORRECTE = "P_MAGNITUDE_INCORRECTE";

/** Codes que `verifier` peut renvoyer (écran 1 ; l'écran 2 ajoutera `TRANSFORMATION_HORS_SUJET`). */
export const CODES_FX_ECRAN_EXPRESSION: readonly string[] = [CODE_SIGNE_P_INVERSE, CODE_Q_INCORRECT, CODE_A_INCORRECT, CODE_P_MAGNITUDE_INCORRECTE];
