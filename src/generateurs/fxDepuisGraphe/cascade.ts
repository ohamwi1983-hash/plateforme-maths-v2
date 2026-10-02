import type { ContexteProjection, ReponseConfirmee } from "../../../lib/contratGenerateur";
import { DebordementExact, diviserR, multiplierR, oppR, rat, soustraireR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { CHAMP_EXPRESSION } from "./ecrans";
import { coefficient, degre, lirePolynome } from "./polynome";
import { depuisJson, parametres, parametresRepli, versJson, type ExerciceFx, type Parametres, type ParametresJson } from "./types";

/**
 * Cascade de gen8 (RAPPORT §18, §45, §57) : la fonction EFFECTIVE de l'écran 2.
 *  - réponse `correct` à l'écran 1                              → la vraie fonction ;
 *  - réponse fausse mais lisible (degré 2), solution NON montrée → CETTE fonction, re-sérialisée (aucune substitution, quelle que soit sa nature : l'énoncé ne dépend jamais de sa justesse,
 *    donc ne la trahit pas) ;
 *  - solution montrée (`projeterExercice` ne transmet alors que les réponses correctes, RAPPORT §45) et aucune réponse transmise → la vraie fonction ;
 *  - aucune réponse (chrono expiré), solution non montrée       → le REPLI du tirage (jamais la vraie : elle ne doit pas fuiter) ;
 *  - réponse inexploitable (illisible, démesurée)               → comme « aucune réponse ».
 */
const BORNE_EXPLOITABLE = 10_000;

const dansBornes = (r: Rat): boolean => Math.abs(r.n) <= BORNE_EXPLOITABLE && r.d <= BORNE_EXPLOITABLE;

/** `(a, p, q)` d'une réponse `Ax² + Bx + C` de degré 2 : `p = −B/(2A)`, `q = C − A·p²`. `null` si illisible, de mauvais degré ou démesurée. */
export function parametresDepuisReponse(reponseBrute: string): Parametres | null {
  const lue = lirePolynome(reponseBrute);
  if (!lue.ok || degre(lue.polynome) !== 2) return null;
  try {
    const A = coefficient(lue.polynome, 2);
    const B = coefficient(lue.polynome, 1);
    const C = coefficient(lue.polynome, 0);
    const p = oppR(diviserR(B, multiplierR(rat(2), A)));
    const q = soustraireR(C, multiplierR(A, multiplierR(p, p)));
    const g: Parametres = { a: A, p, q };
    return [g.a, g.p, g.q].every(dansBornes) ? g : null;
  } catch (e) {
    if (e instanceof DebordementExact) return null;
    throw e;
  }
}

export function effectifDepuisReponses(ex: ExerciceFx, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ParametresJson {
  const vrai = parametres(ex);
  const repliOuVrai = contexte.solutionMontree ? vrai : parametresRepli(ex);
  const reponse = reponsesConfirmees.find((r) => r.champ === CHAMP_EXPRESSION);
  if (reponse === undefined) return versJson(repliOuVrai);
  if (reponse.statut === "correct") return versJson(vrai);
  const lue = parametresDepuisReponse(reponse.reponseBrute);
  return versJson(lue ?? repliOuVrai);
}

/** `Generateur.projeter` : l'exercice EFFECTIF vu par l'élève (pose `effectif`). */
export function projeterFx(ex: ExerciceFx, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ExerciceFx {
  return { ...ex, effectif: effectifDepuisReponses(ex, reponsesConfirmees, contexte) };
}

/** Fonction effective d'un exercice PROJETÉ. Lève sur l'exercice brut : juger l'écran 2 sur autre chose que la fonction confirmée est un bug de câblage, jamais un défaut silencieux. */
export function fonctionEffective(ex: ExerciceFx): Parametres {
  if (ex.effectif === undefined) throw new Error("fx_depuis_graphe : exercice non projeté (l'écran 2 se juge sur la fonction effective, voir projeterExercice)");
  return depuisJson(ex.effectif);
}

