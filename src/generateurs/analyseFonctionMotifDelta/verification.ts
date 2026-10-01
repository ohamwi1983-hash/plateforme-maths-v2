import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE } from "../analyseFonction/types";
import { verifierAllureMD } from "./allure";
import { verifierAxeSommetMD } from "./axeSommet";
import { verifierCoefficientsMD } from "./coefficients";
import { verifierDomaineImageMD } from "./domaineImage";
import { coefVersExact, fonctionEffective, type ExerciceMotifDelta } from "./types";

/**
 * Vérification d'un champ de gen7 « motif / delta ». `ex` est l'exercice EFFECTIF (`projeterExercice`, point de substitution UNIQUE) : `coefficients` est jugé sur les VRAIS coefficients,
 * `allure`, `axeSommet`, `domaineImage` (puis `racines` et `tableauSignes`) sur la fonction EFFECTIVE (RAPPORT §38).
 */
export function verifierMotifDelta(ex: ExerciceMotifDelta, champ: string, reponseBrute: string): ResultatVerification {
  const f = fonctionEffective(ex);
  switch (champ) {
    case CHAMP_COEFFICIENTS:
      return verifierCoefficientsMD(ex, reponseBrute);
    case CHAMP_ALLURE:
      return verifierAllureMD(f, reponseBrute);
    case CHAMP_AXE_SOMMET:
      return verifierAxeSommetMD(f, reponseBrute);
    case CHAMP_DOMAINE_IMAGE:
      return verifierDomaineImageMD({ aPositif: f.a.n > 0, yImage: ex.effectif.yImage === null ? f.yS : coefVersExact(ex.effectif.yImage) }, reponseBrute);
    default:
      throw new Error(`gen7 motif/delta : champ inconnu ou non encore câblé « ${champ} »`);
  }
}
