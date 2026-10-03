import { CODES_CHAINE } from "../_noyauQuadratique/codes";

/** Codes de compétence de gen8 « f(x) à partir du graphe » (RAPPORT §56). Signal pur : n'affectent jamais la note. Déclarés aussi dans `lib/dictionnaireCompetences.ts` et les trois fichiers d'explication. */
export const CODE_SIGNE_P_INVERSE = "SIGNE_P_INVERSE";
export const CODE_Q_INCORRECT = "Q_INCORRECT";
export const CODE_A_INCORRECT = "A_INCORRECT";
export const CODE_P_MAGNITUDE_INCORRECTE = "P_MAGNITUDE_INCORRECTE";

/** Codes que `verifier` peut renvoyer à l'écran 1. */
export const CODES_FX_ECRAN_EXPRESSION: readonly string[] = [CODE_SIGNE_P_INVERSE, CODE_Q_INCORRECT, CODE_A_INCORRECT, CODE_P_MAGNITUDE_INCORRECTE];

/** Tous les codes du générateur : ceux de l'écran 1, puis ceux de la chaîne (noyau partagé). */
export const CODES_FX: readonly string[] = [...CODES_FX_ECRAN_EXPRESSION, ...CODES_CHAINE];
