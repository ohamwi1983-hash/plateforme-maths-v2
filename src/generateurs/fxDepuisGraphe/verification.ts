import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { egalR } from "../analyseFonctionMotifDelta/exact/rationnel";
import { diagnostiquerExpression } from "./diagnostic";
import { coefficient, degre, lirePolynome } from "./polynome";
import { parametres, polynomeVrai, type ExerciceFx } from "./types";

const MESSAGE_DEGRE = "Cette expression n'est pas celle d'une fonction du second degré : la courbe est une parabole, son expression contient un terme en x².";

/**
 * Écran 1 (RAPPORT §56) : la réponse est lue par `lirePolynome` (ℚ exact, jamais de flottant) puis comparée à la vraie fonction par ses coefficients DÉVELOPPÉS `(A, B, C)` — toute forme
 * équivalente est acceptée (`2x²-4x+5` comme `2(x-1)²+3`, décision D8). Illisible ou de degré ≠ 2 : `parse_error` (aucune tentative consommée). Verdict binaire, aucune fraction de mérite
 * (un seul champ). Les codes diagnostiquent la réponse FAUSSE (`diagnostic.ts`) et n'affectent jamais la note.
 */
export function verifierExpression(ex: ExerciceFx, reponseBrute: string): ResultatVerification {
  const lue = lirePolynome(reponseBrute);
  if (!lue.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: lue.message };
  const reponse = lue.polynome;
  if (degre(reponse) !== 2) return { statut: "parse_error", codesCompetence: [], messageErreur: MESSAGE_DEGRE };
  const vrai = polynomeVrai(ex);
  if ([0, 1, 2].every((k) => egalR(coefficient(reponse, k), coefficient(vrai, k)))) return { statut: "correct", codesCompetence: [] };
  const code = diagnostiquerExpression(parametres(ex), reponse);
  return { statut: "not_equivalent", codesCompetence: code ? [code] : [], partiesFausses: ["champ"] };
}

