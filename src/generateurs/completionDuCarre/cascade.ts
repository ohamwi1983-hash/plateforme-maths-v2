import type { ContexteProjection, ReponseConfirmee } from "../../../lib/contratGenerateur";
import { effectifDepuisReponse, fonctionEffectiveDe } from "../_noyauQuadratique/effectif";
import { parametresRepli, type Parametres, type ParametresJson } from "../_noyauQuadratique/types";
import { CHAMP_FORME } from "./ecrans";
import { parametres, type ExerciceCc } from "./types";

/**
 * Cascade de gen9 (RAPPORT §18, §45, §59) : la règle vit dans le noyau partagé `_noyauQuadratique/effectif.ts`, la MÊME que gen8. La réponse de l'écran 1 est une forme canonique
 * `a(x − p)² + q` ; le noyau la relit par `lirePolynome` (qui la développe) puis en tire `(a, p, q)` : la fonction effective de l'écran 2 est celle que l'élève a CONFIRMÉE, même fausse.
 */
export function effectifDepuisReponses(ex: ExerciceCc, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ParametresJson {
  return effectifDepuisReponse({ vrai: parametres(ex), repli: parametresRepli(ex), champExpression: CHAMP_FORME, reponsesConfirmees, contexte });
}

/** `Generateur.projeter` : l'exercice EFFECTIF vu par l'élève (pose `effectif`). */
export function projeterCc(ex: ExerciceCc, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ExerciceCc {
  return { ...ex, effectif: effectifDepuisReponses(ex, reponsesConfirmees, contexte) };
}

/** Fonction effective d'un exercice PROJETÉ. Lève sur l'exercice brut. */
export function fonctionEffective(ex: ExerciceCc): Parametres {
  return fonctionEffectiveDe(ex.effectif, "completion_du_carre");
}
