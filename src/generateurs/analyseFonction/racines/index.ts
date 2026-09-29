/**
 * Modules PURS de la vérification de la factorisation de gen7 (phase 3b-2) : `racinesChamp1` (factorisation)
 * et `racinesChamp2` (racines). Ni `Generateur` gen7 assemblé, ni enregistrement au registre (3b-3). Voir
 * RAPPORT.md §19 : provenance dans l'ancien pilote, divergences délibérées, table de vérité différentielle.
 */
export { ecransRacines } from "./ecransRacines";
export { construireRacines, genererRacines, reponseBruteZerosCorrecte, solutionFactorisation, solutionZeros } from "./genererRacines";
export { verifierRacinesChamp1 } from "./verifierRacinesChamp1";
export { verifierRacinesChamp2 } from "./verifierRacinesChamp2";
export {
  CATEGORIES_AVEC_RACINES,
  CHAMP_RACINES_FACTORISATION,
  CHAMP_RACINES_ZEROS,
  CODE_RACINE_PARTIELLE,
  CODE_SIGNE_OPPOSE,
  CODE_SIGNE_REPETE,
  CODE_X_MASQUE_PAR_NEGATION,
  CODES_RACINES,
  exigerCategorieAvecRacines,
  type CategorieAnalyseFonction,
  type CategorieRacines,
  type DonneesRacines,
} from "./types";
