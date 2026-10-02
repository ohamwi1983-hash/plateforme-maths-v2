import { etatActuelSequentiel, type ConfigurationCases, type Generateur, type ReponseConfirmee, type ResultatVerification } from "../../../lib/contratGenerateur";
import { CODES_FX_ECRAN_EXPRESSION } from "./codes";
import { CHAMP_EXPRESSION, champsFx, ecransFx } from "./ecrans";
import { genererExerciceFx } from "./generation";
import { solutionAttendueFx } from "./solutions";
import type { ExerciceFx } from "./types";
import { verifierExpression } from "./verification";

export const VARIANTE_FX_DEPUIS_GRAPHE = "fx_depuis_graphe";
export const GENERATEUR_ID_FX = "gen8";

/**
 * Descripteur de configuration par ligne (RAPPORT §55) : les transformations ACTIVES. `EV` et `CV` s'excluent. Libellés = texte d'auteur affiché au professeur. Une transformation décochée vaut sa
 * valeur neutre et n'est jamais montrée à l'élève.
 */
export const DESCRIPTEUR_FX = {
  type: "cases" as const,
  libelle: "Transformations appliquées à x²",
  cases: [
    { id: "TH", libelle: "Translation horizontale (TH)" },
    { id: "TV", libelle: "Translation verticale (TV)" },
    { id: "EV", libelle: "Étirement vertical (EV)" },
    { id: "CV", libelle: "Compression verticale (CV)" },
    { id: "SOX", libelle: "Symétrie d'axe Ox (SOX)" },
  ],
  exclusifs: [["EV", "CV"]],
};

/** gen8 « f(x) à partir du graphe » — écran 1 seulement tant que l'écran 2 (chaîne de transformations) n'est pas livré : NON enregistré au registre. */
export const generateurFxDepuisGraphe: Generateur<ExerciceFx> = {
  variante_id: VARIANTE_FX_DEPUIS_GRAPHE,
  generateur_id: GENERATEUR_ID_FX,
  curriculaire: true,
  configuration: DESCRIPTEUR_FX,
  codesCompetenceDeclares: [...CODES_FX_ECRAN_EXPRESSION],
  generer: (graine: number, configuration?: ConfigurationCases) => genererExerciceFx(graine, configuration),
  ecrans: (exercice: ExerciceFx) => ecransFx(exercice),
  etatActuel: (_exercice: ExerciceFx, reponsesConfirmees: ReponseConfirmee[]) => etatActuelSequentiel(champsFx(), reponsesConfirmees),
  verifier: (exercice: ExerciceFx, champ: string, reponseBrute: string): ResultatVerification => {
    if (champ === CHAMP_EXPRESSION) return verifierExpression(exercice, reponseBrute);
    throw new Error(`fx_depuis_graphe : champ inconnu « ${champ} »`);
  },
  solutionAttendue: solutionAttendueFx,
};
