import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { DebordementExact, egalR, estZeroR } from "../analyseFonctionMotifDelta/exact/rationnel";
import { lireFormeCanonique } from "../_noyauQuadratique/formeCanonique";
import { verifierChaineSur } from "../_noyauQuadratique/verificationChaine";
import { fonctionEffective } from "./cascade";
import { diagnostiquerFormeCanonique } from "./diagnostic";
import { parametres, type ExerciceCc } from "./types";

const MESSAGE_A_NUL = "Cette expression n'est pas celle d'une fonction du second degré : le coefficient devant la parenthèse ne peut pas être nul.";

/**
 * Écran 1 (RAPPORT §59) : la réponse doit être ÉCRITE sous forme canonique `a(x − p)² + q` (`lireFormeCanonique`, qui délègue tout nombre à `lirePolynome`) : l'énoncé étant développé,
 * recopier `ax² + bx + c` est un `parse_error` (compte comme une tentative ratée, comme tout statut ≠ correct : lib/moteurTentatives.ts), jamais « correct ». Juste ⇔ `(a, p, q)` identiques, en ℚ exact. Verdict binaire, aucune fraction de mérite.
 * Les codes diagnostiquent la réponse FAUSSE (`diagnostic.ts`) et n'affectent jamais la note.
 */
export function verifierFormeCanonique(ex: ExerciceCc, reponseBrute: string): ResultatVerification {
  const lue = lireFormeCanonique(reponseBrute);
  if (!lue.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: lue.message };
  if (estZeroR(lue.a)) return { statut: "parse_error", codesCompetence: [], messageErreur: MESSAGE_A_NUL };
  const vrai = parametres(ex);
  if (egalR(lue.a, vrai.a) && egalR(lue.p, vrai.p) && egalR(lue.q, vrai.q)) return { statut: "correct", codesCompetence: [] };
  let code: string | null = null;
  try {
    code = diagnostiquerFormeCanonique(vrai, lue);
  } catch (e) {
    if (!(e instanceof DebordementExact)) throw e; // saisie démesurée : faux, sans diagnostic (jamais une erreur 500)
  }
  return { statut: "not_equivalent", codesCompetence: code ? [code] : [], partiesFausses: ["champ"] };
}

/** Écran 2 : la vérification à deux niveaux vit dans le noyau partagé (`verifierChaineSur`, RAPPORT §59) ; gen9 lui fournit la fonction EFFECTIVE et les transformations actives. */
export function verifierChaine(ex: ExerciceCc, reponseBrute: string): ResultatVerification {
  return verifierChaineSur(fonctionEffective(ex), ex.actives, reponseBrute);
}
