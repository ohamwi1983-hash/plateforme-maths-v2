import type { ResultatVerification, SousChamp } from "../../../lib/contratGenerateur";
import { decoderChampsMultiples } from "../../../lib/reponsesEcran";
import { signe } from "./exact/nombreExact";
import { CODE_ALLURE_PARTIELLE } from "./codes";
import type { FonctionExacte } from "./types";
import { versNombreR } from "./exact/rationnel";

/**
 * Écran `allure` : DEUX réglages indépendants sur UN seul dessin (le croquis réactif existant, sans pénalité) — le SENS de la parabole (haut / bas : signe de `a`) et la POSITION du
 * sommet par rapport à l'axe Oy (`x_S < 0`, `x_S = 0`, `x_S > 0`). Comme `x_S = −b/(2a)`, le signe de `x_S` est l'opposé de celui de `a·b` : la position REMPLACE l'ancienne question « signe
 * de a·b » (RAPPORT §49). Correct ssi les DEUX sont justes ; `ALLURE_PARTIELLE` ssi exactement un des deux est juste.
 */
export const SOUS_CHAMPS_ALLURE_MD: SousChamp[] = [
  { id: "concavite", libelle: "Sens de la parabole", genre: "choix", choix: [{ id: "+", libelle: "Vers le haut" }, { id: "-", libelle: "Vers le bas" }] },
  {
    id: "positionSommet",
    libelle: "Position du sommet",
    genre: "choix",
    choix: [
      { id: "gauche", libelle: "$x_S < 0$ : à gauche de l'axe $Oy$" },
      { id: "axe", libelle: "$x_S = 0$ : sur l'axe $Oy$" },
      { id: "droite", libelle: "$x_S > 0$ : à droite de l'axe $Oy$" },
    ],
  },
];

export type Concavite = "+" | "-";
export type PositionSommet = "gauche" | "axe" | "droite";

export function allureAttendue(f: Pick<FonctionExacte, "a" | "xS">): { concavite: Concavite; position: PositionSommet } {
  const s = signe(f.xS);
  return { concavite: versNombreR(f.a) > 0 ? "+" : "-", position: s < 0 ? "gauche" : s === 0 ? "axe" : "droite" };
}

export function verifierAllureMD(f: Pick<FonctionExacte, "a" | "xS">, reponseBrute: string): ResultatVerification {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_ALLURE_MD });
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const attendu = allureAttendue(f);
  const [concaviteOk, positionOk] = [d.valeur.concavite === attendu.concavite, d.valeur.positionSommet === attendu.position];
  if (concaviteOk && positionOk) return { statut: "correct", codesCompetence: [] };
  return { statut: "not_equivalent", codesCompetence: concaviteOk !== positionOk ? [CODE_ALLURE_PARTIELLE] : [] };
}
