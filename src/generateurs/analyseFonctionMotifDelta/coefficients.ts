import type { ResultatVerification, SousChamp } from "../../../lib/contratGenerateur";
import { decoderChampsMultiples } from "../../../lib/reponsesEcran";
import { lireValeur, synthese, type Comparaison } from "./comparaison";
import { CODE_RACINE_NON_SIMPLIFIEE } from "./codes";
import { coefVersExact, type Coef } from "./types";
import { egaux } from "./exact/nombreExact";

/**
 * Écran `coefficients` : trois champs texte validés ENSEMBLE, UNE tentative. Comparaison EXACTE (jamais de tolérance : `b` peut valoir `−2√2`, à écrire `-2sqrt(2)`).
 * Une valeur juste mais écrite avec une racine non simplifiée → `not_equivalent` + `RACINE_NON_SIMPLIFIEE`. Illisible (dont `sqrt` d'un négatif) → `parse_error` avec message.
 */
export const SOUS_CHAMPS_COEFFICIENTS_MD: SousChamp[] = [
  { id: "a", libelle: "$a =$", genre: "texte" },
  { id: "b", libelle: "$b =$", genre: "texte" },
  { id: "c", libelle: "$c =$", genre: "texte" },
];

const NOMS: Record<string, string> = { a: "$a$", b: "$b$", c: "$c$" };

export function verifierCoefficientsMD(vrais: { a: Coef; b: Coef; c: Coef }, reponseBrute: string): ResultatVerification {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_COEFFICIENTS_MD });
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const comparaisons: Comparaison[] = [];
  const partiesFausses: string[] = [];
  for (const k of ["a", "b", "c"] as const) {
    const l = lireValeur(d.valeur[k] as string);
    if (!l.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: `Pour ${NOMS[k]} : ${l.message}` };
    // Les coefficients sont des valeurs EXACTES : jamais de tolérance (même un coefficient rationnel doit être exact).
    const attendu = coefVersExact(vrais[k]);
    const c: Comparaison = egaux(l.lu.valeur, attendu) ? (l.lu.nonSimplifie ? "juste_non_simplifie" : "juste") : "faux";
    comparaisons.push(c);
    if (c !== "juste") partiesFausses.push(k); // une valeur juste mais non simplifiée est aussi à reprendre
  }
  const s = synthese(comparaisons);
  if (s === "correct") return { statut: "correct", codesCompetence: [] };
  return { statut: "not_equivalent", codesCompetence: s === "non_simplifie" ? [CODE_RACINE_NON_SIMPLIFIEE] : [], partiesFausses };
}

