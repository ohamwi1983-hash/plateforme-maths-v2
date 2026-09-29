/**
 * Modules PURS de la vérification de la factorisation de gen7 (phase 3b-2), commit 1 : le socle
 * (`expressionAlgebrique`, messages) et `racinesChamp1`. Le commit 2 y ajoute `racinesChamp2`, la génération
 * et les écrans. Voir RAPPORT.md §19.
 */
export { verifierRacinesChamp1 } from "./verifierRacinesChamp1";
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
