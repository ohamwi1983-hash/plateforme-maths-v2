import type { ResultatVerification, SousChamp } from "../../../lib/contratGenerateur";
import { decoderChampsMultiples } from "../../../lib/reponsesEcran";
import { comparerValeur, lireValeur, synthese, type Comparaison } from "./comparaison";
import { CODE_AXE_SYMETRIE_NOTATION, CODE_RACINE_NON_SIMPLIFIEE } from "./codes";
import type { FonctionExacte } from "./types";

/**
 * Écran `axeSommet` : `AS ≡ x = …`, `x_S`, `y_S`, UNE tentative pour les trois. Comparaison HYBRIDE (décision Q5) : valeur rationnelle attendue → ±0,005 comme avant ; valeur avec racine →
 * exacte (`sqrt`). L'axe est exigé au format `x = valeur` (sensible à la casse). `AXE_SYMETRIE_NOTATION` : valeur de l'axe correcte mais écrite SANS `x =` (le texte entier se lit comme
 * une valeur) ; `RACINE_NON_SIMPLIFIEE` : toutes les valeurs justes, au moins une racine non simplifiée.
 */
export const SOUS_CHAMPS_AXE_SOMMET_MD: SousChamp[] = [
  { id: "axeTexte", libelle: "Axe de symétrie $AS \\equiv$", genre: "texte", placeholder: "x = ..." },
  { id: "xS", libelle: "$x_S =$", genre: "texte" },
  { id: "yS", libelle: "$y_S =$", genre: "texte" },
];

const REGEX_AXE = /^x\s*=\s*(.+)$/;

export function verifierAxeSommetMD(f: Pick<FonctionExacte, "xS" | "yS">, reponseBrute: string): ResultatVerification {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_AXE_SOMMET_MD });
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const xS = lireValeur(d.valeur.xS as string);
  if (!xS.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: `Pour $x_S$ : ${xS.message}` };
  const yS = lireValeur(d.valeur.yS as string);
  if (!yS.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: `Pour $y_S$ : ${yS.message}` };

  const texteAxe = d.valeur.axeTexte as string;
  const correspondance = REGEX_AXE.exec(texteAxe.trim());
  if (!correspondance) {
    const seul = lireValeur(texteAxe);
    if (seul.ok && comparerValeur(f.xS, seul.lu) !== "faux") {
      return { statut: "parse_error", codesCompetence: [CODE_AXE_SYMETRIE_NOTATION], messageErreur: "Écris l'axe de symétrie sous la forme $x = \\dots$ (par exemple $x = 2$)." };
    }
    return { statut: "parse_error", codesCompetence: [], messageErreur: "Écris l'axe de symétrie sous la forme $x = \\dots$." };
  }
  const axe = lireValeur(correspondance[1] as string);
  if (!axe.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: `Pour l'axe de symétrie : ${axe.message}` };
  const comparaisons: Comparaison[] = [comparerValeur(f.xS, axe.lu), comparerValeur(f.xS, xS.lu), comparerValeur(f.yS, yS.lu)];
  const s = synthese(comparaisons);
  if (s === "correct") return { statut: "correct", codesCompetence: [] };
  return { statut: "not_equivalent", codesCompetence: s === "non_simplifie" ? [CODE_RACINE_NON_SIMPLIFIEE] : [] };
}
