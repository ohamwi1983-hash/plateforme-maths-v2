import { etatActuelSequentiel, type ConfigurationCases, type ContexteProjection, type DescripteurConfigurationCases, type Generateur, type ReponseConfirmee, type ResultatVerification } from "../../../lib/contratGenerateur";
import { CASES_TRANSFORMATIONS, EXCLUSIFS_TRANSFORMATIONS, LIBELLE_BLOC_TRANSFORMATIONS } from "../_noyauQuadratique/descripteur";
import { projeterCc } from "./cascade";
import { CODES_CC } from "./codes";
import { CHAMP_CHAINE, CHAMP_FORME, champsCc, ecransCc } from "./ecrans";
import { genererExerciceCc } from "./generation";
import { solutionAttendueCc } from "./solutions";
import type { ExerciceCc } from "./types";
import { verifierChaine, verifierFormeCanonique } from "./verification";

export const VARIANTE_COMPLETION_DU_CARRE = "completion_du_carre";
export const GENERATEUR_ID_CC = "gen9";

/**
 * Descripteur de configuration par ligne (RAPPORT §55, §59) : les mêmes transformations que gen8, avec `TH` OBLIGATOIRE (sans translation horizontale, `b = 0` : rien à compléter). Une
 * transformation décochée vaut sa valeur neutre et n'est jamais montrée à l'élève.
 */
export const DESCRIPTEUR_CC: DescripteurConfigurationCases = {
  type: "cases",
  libelle: LIBELLE_BLOC_TRANSFORMATIONS,
  cases: CASES_TRANSFORMATIONS,
  exclusifs: EXCLUSIFS_TRANSFORMATIONS,
  obligatoires: ["TH"],
};

/** gen9 « Complète le carré » : écran 1 (forme canonique à partir de la forme développée, poids 3) puis écran 2 (chaîne de transformations, poids 2, cascade sur la réponse confirmée). */
export const generateurCompletionDuCarre: Generateur<ExerciceCc> = {
  variante_id: VARIANTE_COMPLETION_DU_CARRE,
  generateur_id: GENERATEUR_ID_CC,
  curriculaire: true,
  configuration: DESCRIPTEUR_CC,
  codesCompetenceDeclares: [...CODES_CC],
  generer: (graine: number, configuration?: ConfigurationCases) => genererExerciceCc(graine, configuration),
  ecrans: (exercice: ExerciceCc) => ecransCc(exercice),
  etatActuel: (_exercice: ExerciceCc, reponsesConfirmees: ReponseConfirmee[]) => etatActuelSequentiel(champsCc(), reponsesConfirmees),
  verifier: (exercice: ExerciceCc, champ: string, reponseBrute: string): ResultatVerification => {
    if (champ === CHAMP_FORME) return verifierFormeCanonique(exercice, reponseBrute);
    if (champ === CHAMP_CHAINE) return verifierChaine(exercice, reponseBrute);
    throw new Error(`completion_du_carre : champ inconnu « ${champ} »`);
  },
  projeter: (exercice: ExerciceCc, reponsesConfirmees: ReponseConfirmee[], contexte: ContexteProjection) => projeterCc(exercice, reponsesConfirmees, contexte),
  solutionAttendue: solutionAttendueCc,
};
