/**
 * Générateur de TEST (jamais dans `src/`, jamais au catalogue, ajouté au registre le temps d'un test) qui
 * COMPOSE les modules de la phase 3b-2 (`src/generateurs/analyseFonction/racines/`) dans un exercice à écrans
 * `debut → [racinesChamp1, racinesChamp2] → fin`, pour les exercer dans le VRAI `api/router.ts` : saut de
 * `af_irreductible`, `parse_error` avec message pédagogique (D6), codes de compétence stockés. Ce n'est PAS
 * gen7 (aucun autre écran, aucun enregistrement de production : c'est la 3b-3).
 *
 * Catégorie tirée de la graine (`graine % 4`) pour que les tests choisissent la leur : 0 mise_en_evidence,
 * 1 binome_conjugue, 2 produit_remarquable, 3 irreductible.
 */
import { creerPrng } from "../../lib/prng";
import { etatActuelSequentiel, type EcranDeclare, type Generateur, type ResultatVerification } from "../../lib/contratGenerateur";
import {
  CHAMP_RACINES_FACTORISATION,
  CHAMP_RACINES_ZEROS,
  CODES_RACINES,
  ecransRacines,
  genererRacines,
  solutionFactorisation,
  solutionZeros,
  verifierRacinesChamp1,
  verifierRacinesChamp2,
  type CategorieAnalyseFonction,
  type DonneesRacines,
} from "../../src/generateurs/analyseFonction/racines";

export const VARIANTE_RACINES = "_racines_fixture_v1";
export const CHAMP_DEBUT = "debut";
export const CHAMP_FIN = "fin";
export const CATEGORIES_TEST: CategorieAnalyseFonction[] = ["mise_en_evidence", "binome_conjugue", "produit_remarquable", "irreductible"];

export interface ExerciceRacinesTest {
  categorie: CategorieAnalyseFonction;
  /** `null` pour `irreductible` : aucune donnée « racines » (les écrans n'existent pas). */
  donnees: DonneesRacines | null;
}

const donneesDe = (ex: ExerciceRacinesTest, champ: string): DonneesRacines => {
  if (ex.donnees === null) throw new Error(`${champ} : jamais appelé pour la catégorie « ${ex.categorie} »`);
  return ex.donnees;
};

export const generateurRacinesTest: Generateur<ExerciceRacinesTest> = {
  variante_id: VARIANTE_RACINES,
  generateur_id: "_racines_fixture",
  curriculaire: false,
  codesCompetenceDeclares: [...CODES_RACINES],

  generer(graine: number): ExerciceRacinesTest {
    const categorie = CATEGORIES_TEST[graine % 4] as CategorieAnalyseFonction;
    if (categorie === "irreductible") return { categorie, donnees: null };
    return { categorie, donnees: genererRacines(categorie, creerPrng(graine)) };
  },

  ecrans(ex: ExerciceRacinesTest): EcranDeclare[] {
    return [
      { type: "champ_expression", champ: CHAMP_DEBUT, consigne: "Combien font $1 + 1$ ?" },
      ...ecransRacines(ex.categorie),
      { type: "champ_expression", champ: CHAMP_FIN, consigne: "Combien font $2 + 2$ ?" },
    ];
  },

  etatActuel(ex, reponsesConfirmees) {
    return etatActuelSequentiel(this.ecrans(ex).map((e) => e.champ), reponsesConfirmees);
  },

  verifier(ex: ExerciceRacinesTest, champ: string, reponseBrute: string): ResultatVerification {
    if (champ === CHAMP_RACINES_FACTORISATION) return verifierRacinesChamp1(donneesDe(ex, champ), reponseBrute);
    if (champ === CHAMP_RACINES_ZEROS) return verifierRacinesChamp2(donneesDe(ex, champ), reponseBrute);
    const attendu = champ === CHAMP_DEBUT ? "2" : champ === CHAMP_FIN ? "4" : null;
    if (attendu === null) throw new Error(`Champ inconnu : ${champ}`);
    return { statut: reponseBrute.trim() === attendu ? "correct" : "not_equivalent", codesCompetence: [] };
  },

  solutionAttendue(ex: ExerciceRacinesTest, champ: string): string {
    if (champ === CHAMP_RACINES_FACTORISATION) return solutionFactorisation(donneesDe(ex, champ));
    if (champ === CHAMP_RACINES_ZEROS) return solutionZeros(donneesDe(ex, champ));
    return champ === CHAMP_DEBUT ? "2" : "4";
  },
};

/** Ajoute le générateur de test au registre COURANT (à appeler APRÈS `installerBase`, qui purge le cache de lib/). */
export function installerGenerateurRacinesTest(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { REGISTRE_GENERATEURS } = require("../../lib/registreGenerateurs") as { REGISTRE_GENERATEURS: Generateur<any>[] };
  REGISTRE_GENERATEURS.push(generateurRacinesTest);
  return () => {
    const i = REGISTRE_GENERATEURS.indexOf(generateurRacinesTest);
    if (i >= 0) REGISTRE_GENERATEURS.splice(i, 1);
  };
}
