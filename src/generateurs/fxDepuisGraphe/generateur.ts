import { etatActuelSequentiel, type ConfigurationCases, type ContexteProjection, type Generateur, type ReponseConfirmee, type ResultatVerification } from "../../../lib/contratGenerateur";
import { CASES_TRANSFORMATIONS, EXCLUSIFS_TRANSFORMATIONS, LIBELLE_BLOC_TRANSFORMATIONS } from "../_noyauQuadratique/descripteur";
import { projeterFx } from "./cascade";
import { CODES_FX } from "./codes";
import { CHAMP_CHAINE, CHAMP_EXPRESSION, champsFx, ecransFx } from "./ecrans";
import { genererExerciceFx } from "./generation";
import { solutionAttendueFx } from "./solutions";
import type { ExerciceFx } from "./types";
import { verifierChaine, verifierExpression } from "./verification";

export const VARIANTE_FX_DEPUIS_GRAPHE = "fx_depuis_graphe";
export const GENERATEUR_ID_FX = "gen8";

/**
 * Descripteur de configuration par ligne (RAPPORT §55) : les transformations ACTIVES. `EV` et `CV` s'excluent. Libellés = texte d'auteur affiché au professeur. Une transformation décochée vaut sa
 * valeur neutre et n'est jamais montrée à l'élève.
 */
export const DESCRIPTEUR_FX = {
  type: "cases" as const,
  libelle: LIBELLE_BLOC_TRANSFORMATIONS,
  cases: CASES_TRANSFORMATIONS,
  exclusifs: EXCLUSIFS_TRANSFORMATIONS,
};

/** gen8 « f(x) à partir du graphe » : écran 1 (expression canonique, poids 3) puis écran 2 (chaîne de transformations, poids 2, cascade sur la réponse confirmée). */
export const generateurFxDepuisGraphe: Generateur<ExerciceFx> = {
  variante_id: VARIANTE_FX_DEPUIS_GRAPHE,
  generateur_id: GENERATEUR_ID_FX,
  curriculaire: true,
  configuration: DESCRIPTEUR_FX,
  codesCompetenceDeclares: [...CODES_FX],
  generer: (graine: number, configuration?: ConfigurationCases) => genererExerciceFx(graine, configuration),
  ecrans: (exercice: ExerciceFx) => ecransFx(exercice),
  etatActuel: (_exercice: ExerciceFx, reponsesConfirmees: ReponseConfirmee[]) => etatActuelSequentiel(champsFx(), reponsesConfirmees),
  verifier: (exercice: ExerciceFx, champ: string, reponseBrute: string): ResultatVerification => {
    if (champ === CHAMP_EXPRESSION) return verifierExpression(exercice, reponseBrute);
    if (champ === CHAMP_CHAINE) return verifierChaine(exercice, reponseBrute);
    throw new Error(`fx_depuis_graphe : champ inconnu « ${champ} »`);
  },
  projeter: (exercice: ExerciceFx, reponsesConfirmees: ReponseConfirmee[], contexte: ContexteProjection) => projeterFx(exercice, reponsesConfirmees, contexte),
  solutionAttendue: solutionAttendueFx,
};
