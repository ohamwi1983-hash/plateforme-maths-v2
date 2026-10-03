import type { ContexteProjection, ReponseConfirmee } from "../../../lib/contratGenerateur";
import { effectifDepuisReponse, fonctionEffectiveDe } from "../_noyauQuadratique/effectif";
import { parametresRepli, type Parametres, type ParametresJson } from "../_noyauQuadratique/types";
import { CHAMP_EXPRESSION } from "./ecrans";
import { parametres, type ExerciceFx } from "./types";

/**
 * Cascade de gen8 (RAPPORT §18, §45, §57) : la règle et son code vivent dans le noyau partagé `_noyauQuadratique/effectif.ts` (RAPPORT §59) ; ne reste ici que le câblage de gen8
 * (le champ de l'écran 1 et les paramètres de SON exercice).
 */
export function effectifDepuisReponses(ex: ExerciceFx, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ParametresJson {
  return effectifDepuisReponse({ vrai: parametres(ex), repli: parametresRepli(ex), champExpression: CHAMP_EXPRESSION, reponsesConfirmees, contexte });
}

/** `Generateur.projeter` : l'exercice EFFECTIF vu par l'élève (pose `effectif`). */
export function projeterFx(ex: ExerciceFx, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ExerciceFx {
  return { ...ex, effectif: effectifDepuisReponses(ex, reponsesConfirmees, contexte) };
}

/** Fonction effective d'un exercice PROJETÉ. Lève sur l'exercice brut. */
export function fonctionEffective(ex: ExerciceFx): Parametres {
  return fonctionEffectiveDe(ex.effectif, "fx_depuis_graphe");
}
