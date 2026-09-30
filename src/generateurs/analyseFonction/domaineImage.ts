import type { ResultatVerification } from "../../../lib/contratGenerateur";
import { decoderIntervalle, lireNombreOuFraction } from "../../../lib/reponsesEcran";
import { TOLERANCE_SAISIE, type FonctionSecondDegre } from "./types";

/**
 * Écran `domaineImage` : `Dom f = ℝ` est AFFICHÉ, jamais demandé ; seul `Im f` est vérifié
 * (`pilote:src/moteur/analyseFonction.ts:94-107` @ 6acc102) : `[yS ; +∞[` si a > 0, `]−∞ ; yS]` si a < 0. Crochets
 * EXACTEMENT ceux attendus (notation française), borne finie à ±0,005 (fraction `p/q` acceptée), bornes infinies par
 * égalité exacte. Aucun code de compétence. Illisible → `parse_error` (comme l'ancien, ici avec un message pédagogique).
 * Divergences (RAPPORT §33) : l'écriture scientifique et l'hexadécimal ne sont plus lus ; une sentinelle entourée
 * d'espaces (` -inf`) est acceptée (le décodeur retire les espaces).
 */
type Borne = number | "-inf" | "+inf";

function lireBorne(texte: string): Borne | null {
  if (texte === "-inf" || texte === "+inf") return texte;
  return lireNombreOuFraction(texte);
}

function egales(a: Borne, b: Borne): boolean {
  if (typeof a === "string" || typeof b === "string") return a === b;
  return Math.abs(a - b) <= TOLERANCE_SAISIE;
}

export function verifierDomaineImage(f: Pick<FonctionSecondDegre, "a" | "yS">, reponseBrute: string): ResultatVerification {
  const d = decoderIntervalle(reponseBrute);
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const gauche = lireBorne(d.valeur.borneGauche);
  const droite = lireBorne(d.valeur.borneDroite);
  if (gauche === null) return { statut: "parse_error", codesCompetence: [], messageErreur: "La borne de gauche doit être un nombre, une fraction $p/q$ ou l'infini." };
  if (droite === null) return { statut: "parse_error", codesCompetence: [], messageErreur: "La borne de droite doit être un nombre, une fraction $p/q$ ou l'infini." };

  const attendu = f.a > 0
    ? { crochetGauche: "[", borneGauche: f.yS as Borne, crochetDroit: "[", borneDroite: "+inf" as Borne }
    : { crochetGauche: "]", borneGauche: "-inf" as Borne, crochetDroit: "]", borneDroite: f.yS as Borne };
  const juste = d.valeur.crochetGauche === attendu.crochetGauche && d.valeur.crochetDroit === attendu.crochetDroit && egales(gauche, attendu.borneGauche) && egales(droite, attendu.borneDroite);
  return { statut: juste ? "correct" : "not_equivalent", codesCompetence: [] };
}
