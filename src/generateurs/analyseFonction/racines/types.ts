/**
 * Les deux écrans « racines » de gen7 (`racinesChamp1` : factorisation ; `racinesChamp2` : zéros) n'existent
 * QUE pour les trois catégories qui ont des racines réelles. `af_irreductible` (Δ < 0) SAUTE ces deux écrans
 * entièrement : `CategorieRacines` exclut `irreductible`, donc toute fonction de ce dossier qui reçoit une
 * `CategorieRacines` ne peut pas être appelée sur un exercice irréductible (erreur de compilation), et
 * `ecransRacines("irreductible")` renvoie une liste vide (aucun écran, pas « un écran toujours correct »).
 */
export const CATEGORIES_AVEC_RACINES = ["mise_en_evidence", "binome_conjugue", "produit_remarquable"] as const;
export type CategorieRacines = (typeof CATEGORIES_AVEC_RACINES)[number];
export type CategorieAnalyseFonction = CategorieRacines | "irreductible";

export const CHAMP_RACINES_FACTORISATION = "racinesChamp1";
export const CHAMP_RACINES_ZEROS = "racinesChamp2";

/** Codes de compétence émis par ces deux écrans (`C07_ou_C08` n'est PAS émis : inatteignable pour gen7). */
export const CODE_X_MASQUE_PAR_NEGATION = "C04";
export const CODE_SIGNE_REPETE = "C05_SIGNE_REPETE";
export const CODE_SIGNE_OPPOSE = "C06_SIGNE_OPPOSE";
export const CODE_RACINE_PARTIELLE = "RACINE_PARTIELLE";
export const CODES_RACINES = [CODE_X_MASQUE_PAR_NEGATION, CODE_SIGNE_REPETE, CODE_SIGNE_OPPOSE, CODE_RACINE_PARTIELLE] as const;

/** Données d'un exercice propres à ces deux écrans (a > 0 par construction : a ∈ [1, 4]). */
export interface DonneesRacines {
  categorie: CategorieRacines;
  a: number;
  b: number;
  c: number;
  /** Racines réelles triées (`[r, r]` pour la racine double). Toujours exactes : tolérance 1e-9. */
  racines: [number, number];
  /** Solution de `racinesChamp1`, texte d'auteur (`2x(x - 4)`, `(x - 3)(x + 3)`, `2(x + 3)^2`). */
  formeFactorisee: string;
}

/** Garde d'exécution pour un appelant qui contournerait le typage (jamais atteinte en usage normal). */
export function exigerCategorieAvecRacines(categorie: string): CategorieRacines {
  if ((CATEGORIES_AVEC_RACINES as readonly string[]).includes(categorie)) return categorie as CategorieRacines;
  throw new Error(`racinesChamp1/racinesChamp2 : jamais appelés pour la catégorie « ${categorie} » (ces deux écrans n'existent pas pour af_irreductible)`);
}
