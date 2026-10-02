import { diviserR, egalR, estZeroR, multiplierR, oppR, rat, ajouterR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { CODE_A_INCORRECT, CODE_P_MAGNITUDE_INCORRECTE, CODE_Q_INCORRECT, CODE_SIGNE_P_INVERSE } from "./codes";
import { coefficient, type Polynome } from "./polynome";
import type { Parametres } from "./types";

/** Coefficients développés `(A, B, C)` de `a(x − p)² + q` : `A = a`, `B = −2ap`, `C = ap² + q`. */
export function coefficientsDe({ a, p, q }: Parametres): { A: Rat; B: Rat; C: Rat } {
  return { A: a, B: oppR(multiplierR(rat(2), multiplierR(a, p))), C: ajouterR(multiplierR(a, multiplierR(p, p)), q) };
}

/**
 * Diagnostic de l'écran « expression canonique » (RAPPORT §56) : CODE unique ou `null`, d'une réponse de degré 2 DIFFÉRENTE de la vraie. Les quatre définitions se PARTITIONNENT (jamais deux
 * codes pour une réponse), `docs/gen8-conception-avant-go.md` §4 ; deux erreurs combinées ou plus : `null` (`not_equivalent` simple). Signal pur, jamais lu par la note.
 *   - `SIGNE_P_INVERSE`     : `A` et `C` justes, `B = −B_vrai`, `B_vrai ≠ 0` ;
 *   - `Q_INCORRECT`         : `A` et `B` justes, `C` différent ;
 *   - `A_INCORRECT`         : `A` différent ET `B = −2A·p`, `C = A·p² + q` (vrais `p`, `q`) ;
 *   - `P_MAGNITUDE_INCORRECTE` : `A` juste, `p' = −B/(2A) ∉ {p, −p}` ET `C = A·p'² + q` (seul `p` est faux).
 * Précondition : `reponse` est de degré 2 (`A ≠ 0`).
 */
export function diagnostiquerExpression(vrai: Parametres, reponse: Polynome): string | null {
  const v = coefficientsDe(vrai);
  const A = coefficient(reponse, 2);
  const B = coefficient(reponse, 1);
  const C = coefficient(reponse, 0);
  if (estZeroR(A)) return null;
  const memeA = egalR(A, v.A);
  if (memeA) {
    if (egalR(B, v.B) && egalR(C, v.C)) return null; // juste : pas de diagnostic
    if (!estZeroR(v.B) && egalR(B, oppR(v.B)) && egalR(C, v.C)) return CODE_SIGNE_P_INVERSE;
    if (egalR(B, v.B)) return CODE_Q_INCORRECT; // C ≠ C_vrai ici
    const pPrime = oppR(diviserR(B, multiplierR(rat(2), A)));
    const memeP = egalR(pPrime, vrai.p) || egalR(pPrime, oppR(vrai.p));
    const cCoherent = egalR(C, ajouterR(multiplierR(A, multiplierR(pPrime, pPrime)), vrai.q));
    return !memeP && cCoherent ? CODE_P_MAGNITUDE_INCORRECTE : null;
  }
  const bCoherent = egalR(B, oppR(multiplierR(rat(2), multiplierR(A, vrai.p))));
  const cCoherent = egalR(C, ajouterR(multiplierR(A, multiplierR(vrai.p, vrai.p)), vrai.q));
  return bCoherent && cCoherent ? CODE_A_INCORRECT : null;
}
