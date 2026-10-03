import { CODES_CHAINE, CODE_SIGNE_P_INVERSE } from "../_noyauQuadratique/codes";

export { CODE_SIGNE_P_INVERSE };

/**
 * Codes de compétence de l'écran 1 de gen9 « Complète le carré » (RAPPORT §59). Signal pur : n'affectent jamais la note. Déclarés aussi dans `lib/dictionnaireCompetences.ts` et les trois
 * fichiers d'explication. `SIGNE_P_INVERSE` est celui de gen8 (même confusion, un seul code au profil de compétences).
 */
export const CODE_P_FACTEUR_A_OUBLIE = "P_FACTEUR_A_OUBLIE";
export const CODE_Q_FACTEUR_A_OUBLIE = "Q_FACTEUR_A_OUBLIE";
export const CODE_Q_SIGNE_INVERSE = "Q_SIGNE_INVERSE";

/** Codes que `verifier` peut renvoyer à l'écran 1. */
export const CODES_CC_ECRAN_FORME: readonly string[] = [CODE_P_FACTEUR_A_OUBLIE, CODE_SIGNE_P_INVERSE, CODE_Q_FACTEUR_A_OUBLIE, CODE_Q_SIGNE_INVERSE];

/** Tous les codes du générateur : ceux de l'écran 1, puis ceux de la chaîne (noyau partagé). */
export const CODES_CC: readonly string[] = [...CODES_CC_ECRAN_FORME, ...CODES_CHAINE];
