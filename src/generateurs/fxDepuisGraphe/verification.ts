import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { decoderChaineTransformations } from "../../../lib/reponsesEcran";
import { DebordementExact, egalR } from "../analyseFonctionMotifDelta/exact/rationnel";
import { fonctionEffective } from "./cascade";
import { POLYNOME_DEPART, etapeLocalementValide, longueurMinimale, transformationsAdmises } from "./chaine";
import { CODE_TRANSFORMATION_HORS_SUJET } from "./codes";
import { diagnostiquerExpression } from "./diagnostic";
import { BORNES_CHAINE } from "./ecrans";
import { coefficient, degre, egalP, lirePolynome, type Polynome } from "./polynome";
import { estTransformation, parametres, polynomeDe, polynomeVrai, type ExerciceFx } from "./types";

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
  let code: string | null = null;
  try {
    code = diagnostiquerExpression(parametres(ex), reponse);
  } catch (e) {
    if (!(e instanceof DebordementExact)) throw e; // saisie démesurée : faux, sans diagnostic (jamais une erreur 500)
  }
  return { statut: "not_equivalent", codesCompetence: code ? [code] : [], partiesFausses: ["champ"] };
}


/**
 * Écran 2 (RAPPORT §57) : vérification à DEUX niveaux, sur la fonction EFFECTIVE `g` (cascade).
 *  - Niveau 0 : structure (`decoderChaineTransformations`) et lecture de chaque expression (`lirePolynome`) ; sinon `parse_error` (aucune tentative consommée).
 *  - Niveau 1 (local) : l'étape `i` se juge contre l'expression que l'ÉLÈVE a écrite à l'étape `i − 1` (`x²` pour la première), jamais contre la vraie chaîne. Étape VALIDE = la règle locale de la
 *    transformation choisie est vraie ET cette transformation est ADMISE pour cet élève (`transformationsAdmises`). Règle vraie mais transformation non admise : `TRANSFORMATION_HORS_SUJET`.
 *    Chaque étape est jugée séparément : deux étapes hors sujet qui s'annulent restent chacune hors sujet.
 *  - Niveau 2 (global) : la dernière expression est exactement `g`.
 * Juste ⇔ toutes les étapes valides ET arrivée. Sinon `not_equivalent` : `partiesFausses` = les étapes invalides (`etape:<i>`) ; `fractionCorrecte` =
 * `(min(valides, k*) + arrivée) / (soumises + 1)` où `k*` = `longueurMinimale(g)` : les étapes valides comptées sont PLAFONNÉES à la chaîne minimale, remplir la chaîne d'étapes valides qui
 * ne mènent nulle part ne rapporte donc pas (5 étapes valides, `k* = 2` : 2/6). Toujours `< 1` quand le verdict est faux. Les paramètres des étapes ne sont jamais exposés.
 */
export function verifierChaine(ex: ExerciceFx, reponseBrute: string): ResultatVerification {
  const g = fonctionEffective(ex);
  const decodee = decoderChaineTransformations(reponseBrute, BORNES_CHAINE);
  if (!decodee.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: decodee.message };
  const polynomes: Polynome[] = [];
  for (let i = 0; i < decodee.valeur.length; i++) {
    const lue = lirePolynome((decodee.valeur[i] as { expression: string }).expression);
    if (!lue.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: `Étape ${i + 1} : ${lue.message}` };
    polynomes.push(lue.polynome);
  }
  const admises = transformationsAdmises(ex.actives, g);
  const fausses: string[] = [];
  let valides = 0;
  let horsSujet = 0;
  let avant = POLYNOME_DEPART;
  decodee.valeur.forEach((etape, i) => {
    const apres = polynomes[i] as typeof avant;
    const t = etape.transformation;
    if (!estTransformation(t)) throw new Error(`fx_depuis_graphe : transformation inconnue « ${t} » (le décodeur aurait dû la refuser)`);
    const regleVraie = etapeLocalementValide(t, avant, apres);
    if (regleVraie && admises.has(t)) valides++;
    else {
      fausses.push(`etape:${i}`);
      if (regleVraie) horsSujet++;
    }
    avant = apres;
  });
  let arrivee = false;
  try {
    arrivee = egalP(avant, polynomeDe(g));
  } catch (e) {
    if (!(e instanceof DebordementExact)) throw e;
  }
  if (fausses.length === 0 && arrivee) return { statut: "correct", codesCompetence: [] };
  const soumises = decodee.valeur.length;
  const fractionCorrecte = (Math.min(valides, longueurMinimale(g)) + (arrivee ? 1 : 0)) / (soumises + 1);
  return {
    statut: "not_equivalent",
    codesCompetence: horsSujet > 0 ? [CODE_TRANSFORMATION_HORS_SUJET] : [],
    partiesFausses: fausses,
    fractionCorrecte,
  };
}
