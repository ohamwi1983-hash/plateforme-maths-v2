import type { ResultatVerification, SousChamp } from "../../../lib/contratGenerateur";
import { decoderChampsMultiples, lireNombreOuFraction } from "../../../lib/reponsesEcran";
import type { FonctionSecondDegre } from "./types";

/**
 * Écran `coefficients` (« Identifie les coefficients a, b et c ») : trois champs texte validés ENSEMBLE, en UNE tentative.
 * Comportement de `pilote:src/moteur/analyseFonction.ts:35-37` + `pilote:lib/analyseFonction.ts:14-24` @ 6acc102 :
 * égalité stricte avec l'énoncé, aucune tolérance, aucun code de compétence (valeur diagnostique jugée trop faible).
 *
 * Divergences DÉLIBÉRÉES (RAPPORT §33, comptées dans `scripts/test-verification-gen7.ts`) :
 *  1. un champ VIDE ou seulement des espaces est refusé (`parse_error`, message) : l'ancien code lisait `Number("") = 0`
 *     et acceptait `2,,-8` comme juste (pour `b = 0`) — un élève « réussissait » b ou c sans écrire 0 ;
 *  2. un texte illisible est un `parse_error` avec message (D6) — l'ancien : `not_equivalent` ;
 *  3. lecture par `lireNombreOuFraction` (le SEUL lecteur de nombre du dépôt) : `4/2` et le moins typographique `−3`
 *     sont lus (l'ancien : illisibles), l'écriture scientifique `2e0` et l'hexadécimal `0x2` ne le sont plus (l'ancien
 *     `Number()` les acceptait).
 */
export const SOUS_CHAMPS_COEFFICIENTS: SousChamp[] = [
  { id: "a", libelle: "$a =$", genre: "texte", placeholder: "$-3$" },
  { id: "b", libelle: "$b =$", genre: "texte" },
  { id: "c", libelle: "$c =$", genre: "texte" },
];

export function verifierCoefficients(f: Pick<FonctionSecondDegre, "a" | "b" | "c">, reponseBrute: string): ResultatVerification {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_COEFFICIENTS });
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const lus = (["a", "b", "c"] as const).map((k) => lireNombreOuFraction(d.valeur[k] as string));
  if (lus.some((v) => v === null)) return { statut: "parse_error", codesCompetence: [], messageErreur: "Chaque coefficient doit être un nombre, par exemple $-3$." };
  return lus[0] === f.a && lus[1] === f.b && lus[2] === f.c ? { statut: "correct", codesCompetence: [] } : { statut: "not_equivalent", codesCompetence: [] };
}
