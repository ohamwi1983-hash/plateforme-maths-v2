import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { decoderChaineTransformations } from "../../../lib/reponsesEcran";
import { DebordementExact, egalR, signeR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { fonctionEffective } from "./cascade";
import { POLYNOME_DEPART, longueurMinimale, parametreEtape, transformationsAdmises } from "./chaine";
import { CODE_TRANSFORMATION_HORS_SUJET } from "./codes";
import { diagnostiquerExpression } from "./diagnostic";
import { BORNES_CHAINE } from "./ecrans";
import { coefficient, degre, egalP, estConstant, lirePolynome, type Polynome } from "./polynome";
import { estTransformation, parametres, polynomeDe, polynomeVrai, type ExerciceFx } from "./types";

const MESSAGE_VALEUR = "doit être un nombre, par exemple 3, -2 ou 1/2.";

/**
 * DOMAINE de la valeur d'une transformation (RAPPORT §58) : une propriété de la transformation CHOISIE, publique et identique pour tous les élèves (jamais de la fonction visée). TH et TV : un
 * nombre non nul (une translation de 0 ne fait rien) ; EV : un facteur > 1 ; CV : un facteur entre 0 et 1 (exclus). Hors domaine : `null` ; sinon, le message d'une valeur hors domaine.
 */
function messageHorsDomaine(t: string, valeur: Rat): string | null {
  switch (t) {
    case "TH":
    case "TV":
      return signeR(valeur) === 0 ? `pour ${t}, la valeur ne peut pas être 0 (une translation de 0 ne change rien).` : null;
    case "EV":
      return valeur.n > valeur.d ? null : "pour EV, la valeur doit être un facteur supérieur à 1.";
    case "CV":
      return signeR(valeur) > 0 && valeur.n < valeur.d ? null : "pour CV, la valeur doit être un facteur compris entre 0 et 1 (exclus).";
    default:
      return null;
  }
}

/** La valeur déclarée d'une étape : un NOMBRE rationnel (lu par `lirePolynome`, donc `3`, `-2`, `1/2`, `0,5`, `2*3`), jamais une expression en `x`. */
function lireValeurDeclaree(texte: string): Rat | null {
  const lue = lirePolynome(texte);
  return lue.ok && estConstant(lue.polynome) ? coefficient(lue.polynome, 0) : null;
}

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
 *  - Niveau 0 : structure (`decoderChaineTransformations`), lecture de chaque expression (`lirePolynome`) et de chaque VALEUR déclarée (TH, TV, EV, CV : un nombre) ; sinon `parse_error` (aucune tentative consommée).
 *  - Niveau 1 (local) : l'étape `i` se juge contre l'expression que l'ÉLÈVE a écrite à l'étape `i − 1` (`x²` pour la première), jamais contre la vraie chaîne. Étape VALIDE = la règle locale de la
 *    transformation choisie est vraie, la VALEUR que l'élève a déclarée est celle de la règle (TH : `h` de `E_{i-1}(x − h)`, positif vers la droite ; TV : la constante ajoutée ; EV | CV : le facteur ; SOX : aucune valeur)
 *    ET cette transformation est ADMISE pour cet élève (`transformationsAdmises`). Règle vraie mais transformation non admise : `TRANSFORMATION_HORS_SUJET`.
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
  const valeursDeclarees: (Rat | null)[] = [];
  for (let i = 0; i < decodee.valeur.length; i++) {
    const etape = decodee.valeur[i] as { expression: string; transformation: string; valeur: string };
    const lue = lirePolynome(etape.expression);
    if (!lue.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: `Étape ${i + 1} : ${lue.message}` };
    polynomes.push(lue.polynome);
    const declaree = etape.valeur === "" ? null : lireValeurDeclaree(etape.valeur);
    if (etape.valeur !== "" && declaree === null) return { statut: "parse_error", codesCompetence: [], messageErreur: `Étape ${i + 1} : la valeur ${MESSAGE_VALEUR}` };
    // Hors domaine pour la transformation choisie : lecture refusée (aucune tentative consommée), AVANT toute comparaison à la règle ou à la fonction visée.
    const horsDomaine = declaree !== null ? messageHorsDomaine(etape.transformation, declaree) : null;
    if (horsDomaine !== null) return { statut: "parse_error", codesCompetence: [], messageErreur: `Étape ${i + 1} : ${horsDomaine}` };
    valeursDeclarees.push(declaree);
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
    const parametre = parametreEtape(t, avant, apres);
    const regleVraie = parametre !== null;
    const declaree = valeursDeclarees[i] as Rat | null;
    // SOX n'a pas de valeur (le décodeur la refuse) ; pour les autres, la valeur déclarée doit être exactement celle de la règle.
    const valeurJuste = t === "SOX" || (declaree !== null && parametre !== null && egalR(declaree, parametre));
    if (regleVraie && valeurJuste && admises.has(t)) valides++;
    else {
      fausses.push(`etape:${i}`);
      if (regleVraie && !admises.has(t)) horsSujet++; // « hors sujet » = règle vraie mais transformation non admise ; une valeur fausse n'est jamais « hors sujet »
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
