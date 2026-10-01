/** Codes de compétence de gen7 « motif / delta » (RAPPORT §49). Les quatre `TABLEAU_*` sont de VRAIS détecteurs (voir `tableauSignes.ts`) ; `SIGNE_VARIATION_PARTIEL` n'est plus émis ici. */
export { CODE_ALLURE_PARTIELLE, CODE_AXE_SYMETRIE_NOTATION } from "../analyseFonction/types";
export { CODE_RACINE_PARTIELLE } from "../analyseFonction/racines/types";

export const CODE_RACINE_NON_SIMPLIFIEE = "RACINE_NON_SIMPLIFIEE";
export const CODE_RACINES_NOMBRE_INCORRECT = "RACINES_NOMBRE_INCORRECT";
export const CODE_TABLEAU_SIGNE_PARTIEL = "TABLEAU_SIGNE_PARTIEL";
export const CODE_TABLEAU_VARIATION_PARTIEL = "TABLEAU_VARIATION_PARTIEL";
export const CODE_TABLEAU_SIGNE_INVERSE = "TABLEAU_SIGNE_INVERSE";
export const CODE_TABLEAU_CONCAVITE_INCORRECTE = "TABLEAU_CONCAVITE_INCORRECTE";

import { CODE_ALLURE_PARTIELLE, CODE_AXE_SYMETRIE_NOTATION } from "../analyseFonction/types";
import { CODE_RACINE_PARTIELLE } from "../analyseFonction/racines/types";

/** Tous les codes que `verifier` d'un générateur de cette famille peut renvoyer (`C04`, `C05_SIGNE_REPETE`, `C06_SIGNE_OPPOSE` n'en font plus partie : factorisation hors périmètre). */
export const CODES_MOTIF_DELTA: readonly string[] = [
  CODE_ALLURE_PARTIELLE,
  CODE_AXE_SYMETRIE_NOTATION,
  CODE_RACINE_NON_SIMPLIFIEE,
  CODE_RACINE_PARTIELLE,
  CODE_RACINES_NOMBRE_INCORRECT,
  CODE_TABLEAU_SIGNE_PARTIEL,
  CODE_TABLEAU_VARIATION_PARTIEL,
  CODE_TABLEAU_SIGNE_INVERSE,
  CODE_TABLEAU_CONCAVITE_INCORRECTE,
];
