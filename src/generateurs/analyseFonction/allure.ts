import type { ResultatVerification, SousChamp } from "../../../lib/contratGenerateur";
import { decoderChampsMultiples } from "../../../lib/reponsesEcran";
import { CODE_ALLURE_PARTIELLE, type FonctionSecondDegre } from "./types";

/**
 * Écran `allure` : signe de `a` (2 choix) et signe de `a·b` (3 choix) dans UNE tentative
 * (`pilote:src/moteur/analyseFonction.ts:40-45`, `pilote:lib/routes/reponses.ts:2038-2050` @ 6acc102). Correct ssi les
 * DEUX sont justes ; `ALLURE_PARTIELLE` ssi `not_equivalent` et exactement UN des deux est juste (`signeAOk !== signeABOk`).
 * `a·b = 0` (`signeAB = "0"`) est possible : c'est le cas `b = 0` du binôme conjugué.
 *
 * Divergence DÉLIBÉRÉE (D6, RAPPORT §33) : un choix absent ou hors liste est un `parse_error` avec message (l'ancien :
 * `not_equivalent`). Un client honnête ne peut pas l'envoyer (« Valider » reste désactivé tant qu'un choix manque).
 */
export const SOUS_CHAMPS_ALLURE: SousChamp[] = [
  { id: "signeA", libelle: "Signe de $a$", genre: "choix", choix: [{ id: "+", libelle: "$a > 0$" }, { id: "-", libelle: "$a < 0$" }] },
  { id: "signeAB", libelle: "Signe de $a \\cdot b$", genre: "choix", choix: [{ id: "+", libelle: "$ab > 0$" }, { id: "-", libelle: "$ab < 0$" }, { id: "0", libelle: "$ab = 0$" }] },
];

export const signeDe = (v: number): "+" | "-" | "0" => (v > 0 ? "+" : v < 0 ? "-" : "0");

export function verifierAllure(f: Pick<FonctionSecondDegre, "a" | "b">, reponseBrute: string): ResultatVerification {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_ALLURE });
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const signeAOk = d.valeur.signeA === signeDe(f.a);
  const signeABOk = d.valeur.signeAB === signeDe(f.a * f.b);
  if (signeAOk && signeABOk) return { statut: "correct", codesCompetence: [] };
  return { statut: "not_equivalent", codesCompetence: signeAOk !== signeABOk ? [CODE_ALLURE_PARTIELLE] : [] };
}
