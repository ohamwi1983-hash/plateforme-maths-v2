import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { DebordementExact, egalR } from "../analyseFonctionMotifDelta/exact/rationnel";
import { coefficient, degre, lirePolynome } from "../_noyauQuadratique/polynome";
import { verifierChaineSur } from "../_noyauQuadratique/verificationChaine";
import { fonctionEffective } from "./cascade";
import { diagnostiquerExpression } from "./diagnostic";
import { parametres, polynomeVrai, type ExerciceFx } from "./types";

const MESSAGE_DEGRE = "Cette expression n'est pas celle d'une fonction du second degré : la courbe est une parabole, son expression contient un terme en x².";

/**
 * Écran 1 (RAPPORT §56) : la réponse est lue par `lirePolynome` (ℚ exact, jamais de flottant) puis comparée à la vraie fonction par ses coefficients DÉVELOPPÉS `(A, B, C)` — toute forme
 * équivalente est acceptée (`2x²-4x+5` comme `2(x-1)²+3`, décision D8). Illisible ou de degré ≠ 2 : `parse_error` (compte comme une tentative ratée, comme tout statut ≠ correct : lib/moteurTentatives.ts). Verdict binaire, aucune fraction de mérite
 * (un seul champ). Les codes diagnostiquent la réponse FAUSSE (`diagnostic.ts`) et n'affectent jamais la note.
 */
export function verifierExpression(ex: ExerciceFx, reponseBrute: string): ResultatVerification {
  const lue = lirePolynome(reponseBrute);
  if (!lue.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: lue.message };
  const reponse = lue.polynome;
  if (degre(reponse) !== 2) return { statut: "parse_error", codesCompetence: [], messageErreur: MESSAGE_DEGRE };
  const vrai = polynomeVrai(ex);
  if ([0, 1, 2].every((k) => egalR(coefficient(reponse, k), coefficient(vrai, k)))) return { statut: "correct", codesCompetence: [] };
  let code: string | null = null;
  try {
    code = diagnostiquerExpression(parametres(ex), reponse);
  } catch (e) {
    if (!(e instanceof DebordementExact)) throw e; // saisie démesurée : faux, sans diagnostic (jamais une erreur 500)
  }
  return { statut: "not_equivalent", codesCompetence: code ? [code] : [], partiesFausses: ["champ"] };
}

/** Écran 2 (RAPPORT §57) : la vérification à deux niveaux vit dans le noyau partagé (`verifierChaineSur`, RAPPORT §59) ; gen8 lui fournit la fonction EFFECTIVE et les transformations actives. */
export function verifierChaine(ex: ExerciceFx, reponseBrute: string): ResultatVerification {
  return verifierChaineSur(fonctionEffective(ex), ex.actives, reponseBrute);
}
