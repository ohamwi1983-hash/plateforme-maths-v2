import type { ContexteProjection, ReponseConfirmee } from "../../../lib/contratGenerateur";
import { decoderChampsMultiples } from "../../../lib/reponsesEcran";
import { COEFFICIENT_MAX } from "../../../lib/aideTypee";
import { SOUS_CHAMPS_COEFFICIENTS_MD } from "./coefficients";
import { SOUS_CHAMPS_AXE_SOMMET_MD } from "./axeSommet";
import { TOLERANCE_SAISIE, lireValeur } from "./comparaison";
import { approx, egaux, moins } from "./exact/nombreExact";
import {
  CHAMP_AXE_SOMMET,
  CHAMP_COEFFICIENTS,
  coefDepuisExact,
  coefVersExact,
  effectifVraiMD,
  fonctionExacte,
  fonctionVraie,
  type Coef,
  type DonneesEffectivesMotifDelta,
  type ExerciceMotifDelta,
} from "./types";

/**
 * Cascade de gen7 « motif / delta » (RAPPORT §18, §38, §45, §49). Les écrans `allure`, `axeSommet`, `domaineImage`, `racines` et `tableauSignes` sont jugés sur les coefficients
 * CONFIRMÉS (même faux) quand ils sont EXPLOITABLES : « une méthode juste appliquée à une donnée de départ fausse réussit ». Exploitable : lisible EXACTEMENT (`sqrt`), `a` rationnel non nul,
 * `c` rationnel, `b` rationnel ou multiple rationnel d'UNE racine (sinon `Δ` serait irrationnel : radicaux imbriqués, hors du calcul exact) et bornés. Sinon : repli sur les VRAIS (la fonction
 * est publique dans l'énoncé : aucune fuite). Ne dépend que des réponses CONFIRMÉES et du réglage statique de la tâche.
 */
const COEFFICIENT_ABS_MIN = 1e-6;
const ORDONNEE_ABS_MAX = 1e6;

/** Coefficients d'une réponse `coefficients` confirmée ; `null` si inexploitable. */
export function lireCoefficientsConfirmes(reponseBrute: string): { a: Coef; b: Coef; c: Coef } | null {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_COEFFICIENTS_MD });
  if (!d.ok) return null;
  const lus = (["a", "b", "c"] as const).map((k) => lireValeur(d.valeur[k] as string));
  if (!lus.every((l) => l.ok)) return null;
  const [a, b, c] = lus.map((l) => (l.ok ? coefDepuisExact(l.lu.valeur) : null));
  if (a === null || b === null || c === null || a === undefined || b === undefined || c === undefined) return null;
  const bornes = [a, b, c].every((v) => Math.abs(approx(coefVersExact(v))) <= COEFFICIENT_MAX) && Math.abs(approx(coefVersExact(a))) >= COEFFICIENT_ABS_MIN;
  if (!bornes || fonctionExacte(a, b, c) === null) return null;
  return { a, b, c };
}

/** Ordonnée du sommet d'une réponse `axeSommet` confirmée ; `null` si illisible, démesurée ou non de la forme `(n/d)·√r`. */
function lireOrdonneeSommet(reponseBrute: string): Coef | null {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_AXE_SOMMET_MD });
  if (!d.ok) return null;
  const l = lireValeur(d.valeur.yS as string);
  if (!l.ok) return null;
  const y = coefDepuisExact(l.lu.valeur);
  return y !== null && Math.abs(approx(coefVersExact(y))) <= ORDONNEE_ABS_MAX ? y : null;
}

/**
 * Données effectives (RAPPORT §38) à partir des réponses CONFIRMÉES :
 *  - coefficients : ceux de la réponse confirmée (même fausse) si exploitables ; réponse `correct` → les vrais (jamais une réécriture) ; illisible/inexploitable/champ terminé sans
 *    réponse (chrono) → les vrais ;
 *  - `yImage` : l'ordonnée confirmée à `axeSommet` si elle est lisible et s'écarte du sommet effectif de plus que la tolérance de saisie, sinon `null` (= le sommet effectif).
 */
export function effectifDepuisReponsesMD(ex: Pick<ExerciceMotifDelta, "a" | "b" | "c">, reponsesConfirmees: readonly ReponseConfirmee[]): DonneesEffectivesMotifDelta {
  const vrai = effectifVraiMD(ex.a, ex.b, ex.c);
  const coef = reponsesConfirmees.find((r) => r.champ === CHAMP_COEFFICIENTS);
  const lus = coef !== undefined && coef.statut === "not_equivalent" ? lireCoefficientsConfirmes(coef.reponseBrute) : null;
  const differe = lus !== null && !(egaux(coefVersExact(lus.a), coefVersExact(ex.a)) && egaux(coefVersExact(lus.b), coefVersExact(ex.b)) && egaux(coefVersExact(lus.c), coefVersExact(ex.c)));
  let base: DonneesEffectivesMotifDelta = { ...vrai, coefficientsAffiches: coef !== undefined && (coef.statut === "correct" || lus !== null) };
  if (lus !== null && differe) base = { ...base, a: lus.a, b: lus.b, c: lus.c, coefficientsEleve: true };

  const axe = reponsesConfirmees.find((r) => r.champ === CHAMP_AXE_SOMMET);
  const y = axe !== undefined && axe.statut === "not_equivalent" ? lireOrdonneeSommet(axe.reponseBrute) : null;
  const fe = fonctionExacte(base.a, base.b, base.c) ?? fonctionVraie(ex);
  const ecarte = y !== null && Math.abs(approx(moins(coefVersExact(y), fe.yS))) > TOLERANCE_SAISIE;
  return { ...base, yImage: ecarte ? y : null };
}

/**
 * `Generateur.projeter` : l'exercice EFFECTIF vu par l'élève. Les valeurs de x du tableau ne sont montrées que si la solution a pu l'être (correction immédiate ET « Afficher la réponse
 * attendue », RAPPORT §42) ; `projeterExercice` ne transmet que les réponses CORRECTES quand la solution est montrée (RAPPORT §45) : ce module ne le refait pas.
 */
export function projeterMotifDelta(ex: ExerciceMotifDelta, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ExerciceMotifDelta {
  return { ...ex, effectif: effectifDepuisReponsesMD(ex, reponsesConfirmees), affichageTableau: contexte.solutionMontree ? "vraies" : "symboliques" };
}
