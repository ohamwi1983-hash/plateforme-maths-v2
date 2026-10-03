import { ajouterR, egalR, multiplierR, oppR, rat, soustraireR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import type { Parametres } from "../_noyauQuadratique/types";
import { CODE_P_FACTEUR_A_OUBLIE, CODE_Q_FACTEUR_A_OUBLIE, CODE_Q_SIGNE_INVERSE, CODE_SIGNE_P_INVERSE } from "./codes";

/**
 * Diagnostic de l'écran « forme canonique » de gen9 (RAPPORT §59) : CODE unique ou `null`, d'une réponse `a'(x − p')² + q'` DIFFÉRENTE de la vraie `a(x − p)² + q`. Une erreur MÉCANIQUE
 * ISOLÉE de la complétion du carré de `ax² + bx + c` (`b = −2ap`, `c = ap² + q`) : `a' = a` exigé et EXACTEMENT UNE des deux quantités `p`, `q` fausse ; deux erreurs ou plus : `null`.
 *   - `P_FACTEUR_A_OUBLIE`  : `q' = q` et `p' = −b/2 = a·p`        (b divisé par 2 au lieu de 2a) ;
 *   - `SIGNE_P_INVERSE`     : `q' = q` et `p' = b/(2a) = −p`        (signe du décalage inversé) ;
 *   - `Q_FACTEUR_A_OUBLIE`  : `p' = p` et `q' = c − p² = q + (a − 1)p²` (on retranche p² au lieu de a·p²) ;
 *   - `Q_SIGNE_INVERSE`     : `p' = p` et `q' = c + ap² = q + 2a·p²`    (on ajoute au lieu de retrancher).
 * Les deux codes de `p` sont distincts pour `a ≠ −1` (`a·p = −p` ⇔ `a = −1`, `p ≠ 0`), les deux codes de `q` aussi (`a − 1 = 2a` ⇔ `a = −1`) : à `a = −1`, la même réponse porterait deux
 * explications, donc AUCUN code n'est émis (aucun n'est plus juste que l'autre). À `a = 1`, les valeurs « facteur oublié » sont les valeurs justes : ces deux codes sont inertes.
 * Signal pur, jamais lu par la note.
 */
export function diagnostiquerFormeCanonique(vrai: Parametres, reponse: { a: Rat; p: Rat; q: Rat }): string | null {
  const { a, p, q } = vrai;
  if (!egalR(reponse.a, a)) return null;
  const pJuste = egalR(reponse.p, p);
  const qJuste = egalR(reponse.q, q);
  if (pJuste === qJuste) return null; // juste (rien à diagnostiquer) ou deux quantités fausses
  const p2 = multiplierR(p, p);
  if (qJuste) {
    const facteurOublie = egalR(reponse.p, multiplierR(a, p));
    const signeInverse = egalR(reponse.p, oppR(p));
    if (facteurOublie === signeInverse) return null; // aucune des deux (ou a = −1 : les deux)
    return facteurOublie ? CODE_P_FACTEUR_A_OUBLIE : CODE_SIGNE_P_INVERSE;
  }
  const facteurOublie = egalR(reponse.q, ajouterR(q, multiplierR(soustraireR(a, rat(1)), p2)));
  const signeInverse = egalR(reponse.q, ajouterR(q, multiplierR(multiplierR(rat(2), a), p2)));
  if (facteurOublie === signeInverse) return null;
  return facteurOublie ? CODE_Q_FACTEUR_A_OUBLIE : CODE_Q_SIGNE_INVERSE;
}
