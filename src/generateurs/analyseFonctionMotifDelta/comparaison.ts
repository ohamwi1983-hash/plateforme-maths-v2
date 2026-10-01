import { approx, egaux, estRationnel, type Exact } from "./exact/nombreExact";
import { lireExpressionExacte } from "./exact/lireExpressionExacte";

/**
 * Comparaison d'une valeur SAISIE à une valeur attendue (RAPPORT §49, décision Q5 du propriétaire) :
 *  - attendue RATIONNELLE : comportement historique de gen7 — la valeur saisie doit être rationnelle et à ±0,005 de l'attendue (« arrondi au centième accepté ») ;
 *  - attendue IRRATIONNELLE (contient une racine) : comparaison EXACTE-symbolique, jamais numérique : `1,41` n'est pas `sqrt(2)`.
 * Une valeur juste mais écrite avec une racine non simplifiée (`sqrt(8)` pour `2sqrt(2)`) est `juste_non_simplifie` : le vérificateur en fait un `not_equivalent` avec
 * `RACINE_NON_SIMPLIFIEE`.
 */
export const TOLERANCE_SAISIE = 0.005;

export interface ValeurLue {
  valeur: Exact;
  nonSimplifie: boolean;
}

export type Comparaison = "juste" | "juste_non_simplifie" | "faux";

export function lireValeur(texte: string): { ok: true; lu: ValeurLue } | { ok: false; message: string } {
  const l = lireExpressionExacte(texte);
  return l.ok ? { ok: true, lu: { valeur: l.valeur, nonSimplifie: l.nonSimplifie } } : { ok: false, message: l.message };
}

export function comparerValeur(attendu: Exact, lu: ValeurLue): Comparaison {
  const egal = estRationnel(attendu) ? estRationnel(lu.valeur) && Math.abs(approx(lu.valeur) - approx(attendu)) <= TOLERANCE_SAISIE : egaux(lu.valeur, attendu);
  if (!egal) return "faux";
  return lu.nonSimplifie ? "juste_non_simplifie" : "juste";
}

/** Synthèse de plusieurs comparaisons (un écran à plusieurs champs) : juste ssi toutes justes ; non simplifié ssi toutes justes en valeur dont au moins une non simplifiée. */
export function synthese(comparaisons: readonly Comparaison[]): "correct" | "non_simplifie" | "faux" {
  if (comparaisons.some((c) => c === "faux")) return "faux";
  return comparaisons.some((c) => c === "juste_non_simplifie") ? "non_simplifie" : "correct";
}
