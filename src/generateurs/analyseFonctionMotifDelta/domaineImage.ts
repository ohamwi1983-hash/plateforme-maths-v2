import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { decoderIntervalle } from "../../../lib/reponsesEcran";
import { comparerValeur, lireValeur, type Comparaison, type ValeurLue } from "./comparaison";
import { CODE_RACINE_NON_SIMPLIFIEE } from "./codes";
import type { Exact } from "./exact/nombreExact";

/**
 * Écran `domaineImage` : `Dom f = ℝ` est AFFICHÉ, jamais demandé ; seul `Im f` est vérifié : `[yS ; +∞[` si `a > 0`, `]−∞ ; yS]` si `a < 0`. Crochets EXACTEMENT ceux attendus (notation
 * française), borne finie comparée comme `axeSommet` (rationnelle : ±0,005 ; avec racine : exacte), bornes infinies par sentinelle. Aucune aide. `RACINE_NON_SIMPLIFIEE` si la borne est juste
 * mais écrite avec une racine non simplifiée.
 */
type Borne = ValeurLue | "-inf" | "+inf";

function lireBorne(texte: string): { ok: true; borne: Borne } | { ok: false } {
  if (texte === "-inf" || texte === "+inf") return { ok: true, borne: texte };
  const l = lireValeur(texte);
  return l.ok ? { ok: true, borne: l.lu } : { ok: false };
}

export function verifierDomaineImageMD(f: { aPositif: boolean; yImage: Exact }, reponseBrute: string): ResultatVerification {
  const d = decoderIntervalle(reponseBrute);
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const [gauche, droite] = [lireBorne(d.valeur.borneGauche), lireBorne(d.valeur.borneDroite)];
  if (!gauche.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: "La borne de gauche doit être un nombre (une racine s'écrit sqrt(2)) ou l'infini." };
  if (!droite.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: "La borne de droite doit être un nombre (une racine s'écrit sqrt(2)) ou l'infini." };

  const attendu = f.aPositif
    ? { crochetGauche: "[", borneGauche: f.yImage as Borne | Exact, crochetDroit: "[", borneDroite: "+inf" as const }
    : { crochetGauche: "]", borneGauche: "-inf" as const, crochetDroit: "]", borneDroite: f.yImage as Borne | Exact };
  if (d.valeur.crochetGauche !== attendu.crochetGauche || d.valeur.crochetDroit !== attendu.crochetDroit) return { statut: "not_equivalent", codesCompetence: [] };

  const comparer = (saisi: Borne, att: unknown): Comparaison => {
    if (typeof saisi === "string" || typeof att === "string") return saisi === att ? "juste" : "faux";
    return comparerValeur(att as Exact, saisi);
  };
  const resultats: Comparaison[] = [comparer(gauche.borne, attendu.borneGauche), comparer(droite.borne, attendu.borneDroite)];
  if (resultats.includes("faux")) return { statut: "not_equivalent", codesCompetence: [] };
  if (resultats.includes("juste_non_simplifie")) return { statut: "not_equivalent", codesCompetence: [CODE_RACINE_NON_SIMPLIFIEE] };
  return { statut: "correct", codesCompetence: [] };
}
