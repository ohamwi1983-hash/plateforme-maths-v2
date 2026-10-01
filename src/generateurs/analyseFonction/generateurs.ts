import { etatActuelSequentiel, type Generateur, type ReponseConfirmee, type ContexteProjection } from "../../../lib/contratGenerateur";
import { projeterAnalyseFonction } from "./cascade";
import { champsAnalyseFonction, ecransAnalyseFonction } from "./ecrans";
import { genererExercice, type ExerciceAnalyseFonction } from "./exercice";
import { CODE_RACINE_PARTIELLE, CODE_SIGNE_OPPOSE, CODE_SIGNE_REPETE, CODE_X_MASQUE_PAR_NEGATION } from "./racines/types";
import { solutionAttendueAnalyseFonction } from "./solutions";
import { CODE_ALLURE_PARTIELLE, CODE_AXE_SYMETRIE_NOTATION, CODE_SIGNE_VARIATION_PARTIEL, type CategorieAnalyseFonction } from "./types";
import { verifierAnalyseFonction } from "./verification";

/**
 * Les quatre `Generateur` de gen7 (« Analyse d'une fonction du second degré »), un par catégorie, qui PARTAGENT les mêmes fonctions :
 * seules la catégorie (donc `genererExercice`, la liste des écrans) et les codes déclarés changent. Aucune branche `if` par variante
 * ailleurs que dans cette table : le registre (`lib/registreGenerateurs.ts`) reste l'unique autorité sur variante → générateur.
 *
 * Identifiants = ceux du catalogue AFFICHÉ (`lib/catalogueGenerateurs.ts`), tels quels : première livraison, donc pas de suffixe `_v` (CLAUDE.md,
 * précision de la règle `_v2`). Tout changement ULTÉRIEUR de `genererExercice` pour une graine donnée imposera un `_v2`.
 *
 * Codes de compétence : ceux que `verifier` peut réellement renvoyer. `af_irreductible` n'a pas d'écran « racines » : elle ne déclare pas les
 * quatre codes de la factorisation (`C07_ou_C08` n'est déclaré nulle part, il n'est jamais émis).
 */

export const GENERATEUR_ID_ANALYSE_FONCTION = "gen7";

const CODES_FONCTION = [CODE_ALLURE_PARTIELLE, CODE_AXE_SYMETRIE_NOTATION, CODE_SIGNE_VARIATION_PARTIEL];
const CODES_RACINES_DECLARES = [CODE_X_MASQUE_PAR_NEGATION, CODE_SIGNE_REPETE, CODE_SIGNE_OPPOSE, CODE_RACINE_PARTIELLE];

function creerGenerateur(categorie: CategorieAnalyseFonction): Generateur<ExerciceAnalyseFonction> {
  const champs = champsAnalyseFonction(categorie);
  return {
    variante_id: `af_${categorie}`,
    generateur_id: GENERATEUR_ID_ANALYSE_FONCTION,
    curriculaire: true,
    retire: true, // RAPPORT §49 : exécutable (exercices déjà assignés) mais retiré du catalogue affiché, remplacé par `analyseFonctionMotifDelta`
    codesCompetenceDeclares: categorie === "irreductible" ? [...CODES_FONCTION] : [...CODES_FONCTION, ...CODES_RACINES_DECLARES],
    generer: (graine: number) => genererExercice(categorie, graine),
    ecrans: ecransAnalyseFonction,
    etatActuel: (_exercice: ExerciceAnalyseFonction, reponsesConfirmees: ReponseConfirmee[]) => etatActuelSequentiel(champs, reponsesConfirmees),
    verifier: verifierAnalyseFonction,
    projeter: (exercice: ExerciceAnalyseFonction, reponsesConfirmees: ReponseConfirmee[], contexte: ContexteProjection) => projeterAnalyseFonction(exercice, reponsesConfirmees, contexte),
    solutionAttendue: solutionAttendueAnalyseFonction,
  };
}

export const generateurMiseEnEvidence = creerGenerateur("mise_en_evidence");
export const generateurBinomeConjugue = creerGenerateur("binome_conjugue");
export const generateurProduitRemarquable = creerGenerateur("produit_remarquable");
export const generateurIrreductible = creerGenerateur("irreductible");

/** Dans l'ordre du catalogue affiché. */
export const GENERATEURS_ANALYSE_FONCTION: readonly Generateur<ExerciceAnalyseFonction>[] = [generateurMiseEnEvidence, generateurBinomeConjugue, generateurProduitRemarquable, generateurIrreductible];
