import type { ResultatVerification, SousChamp } from "../../../lib/contratGenerateur";
import { decoderChampsMultiples, lireNombreOuFraction } from "../../../lib/reponsesEcran";
import { CODE_AXE_SYMETRIE_NOTATION, TOLERANCE_SAISIE, type FonctionSecondDegre } from "./types";

/**
 * Écran `axeSommet` : `AS ≡ x = …`, `x_S`, `y_S`, UNE tentative pour les trois. Comportement de
 * `pilote:src/moteur/analyseFonction.ts:20-86` + `pilote:lib/routes/reponses.ts:2051-2062` @ 6acc102 : chaque valeur à
 * ±0,005 (`<=`), fraction `p/q` acceptée, l'axe est exigé au format `x = valeur` (`REGEX_AXE`, SENSIBLE À LA CASSE :
 * `X = 2` est refusé).
 *
 * `AXE_SYMETRIE_NOTATION` : valeur de l'axe correcte (à ±0,005 de `xS`) mais écrite SANS le préfixe `x =`, le texte
 * entier se lisant comme un nombre ou une fraction (jamais un préfixe partiel). Condition identique à l'ancienne, y
 * compris son indépendance vis-à-vis de `xS`/`yS` saisis (à condition qu'ils soient lisibles).
 *
 * Divergences DÉLIBÉRÉES (D6, RAPPORT §33) : tout ce qui est illisible — champ vide, `xS`/`yS` non numériques, axe sans
 * `x =` ou dont la valeur est illisible — est un `parse_error` avec message (l'ancien : `not_equivalent`). Le code
 * `AXE_SYMETRIE_NOTATION` accompagne alors ce `parse_error` (le contrat v2 le permet) : « valeur juste, notation à corriger ».
 */
export const SOUS_CHAMPS_AXE_SOMMET: SousChamp[] = [
  { id: "axeTexte", libelle: "Axe de symétrie $AS \\equiv$", genre: "texte", placeholder: "$x = \\dots$ (fraction $p/q$ acceptée)" },
  { id: "xS", libelle: "$x_S =$", genre: "texte" },
  { id: "yS", libelle: "$y_S =$", genre: "texte" },
];

const REGEX_AXE = /^x\s*=\s*(.+)$/;
const MESSAGE_NOMBRE = "Une valeur n'est pas un nombre lisible (entier, décimal ou fraction $p/q$).";

export function verifierAxeSommet(f: Pick<FonctionSecondDegre, "xS" | "yS">, reponseBrute: string): ResultatVerification {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_AXE_SOMMET });
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const [xS, yS] = [lireNombreOuFraction(d.valeur.xS as string), lireNombreOuFraction(d.valeur.yS as string)];
  if (xS === null || yS === null) return { statut: "parse_error", codesCompetence: [], messageErreur: MESSAGE_NOMBRE };

  const correspondance = REGEX_AXE.exec(d.valeur.axeTexte as string);
  if (!correspondance) {
    const seul = lireNombreOuFraction(d.valeur.axeTexte as string);
    if (seul !== null && Math.abs(seul - f.xS) <= TOLERANCE_SAISIE) {
      return { statut: "parse_error", codesCompetence: [CODE_AXE_SYMETRIE_NOTATION], messageErreur: "Écris l'axe de symétrie sous la forme $x = \\dots$ (par exemple $x = 2$)." };
    }
    return { statut: "parse_error", codesCompetence: [], messageErreur: "Écris l'axe de symétrie sous la forme $x = \\dots$." };
  }
  const axe = lireNombreOuFraction(correspondance[1] as string);
  if (axe === null) return { statut: "parse_error", codesCompetence: [], messageErreur: MESSAGE_NOMBRE };
  const juste = Math.abs(axe - f.xS) <= TOLERANCE_SAISIE && Math.abs(xS - f.xS) <= TOLERANCE_SAISIE && Math.abs(yS - f.yS) <= TOLERANCE_SAISIE;
  return { statut: juste ? "correct" : "not_equivalent", codesCompetence: [] };
}
