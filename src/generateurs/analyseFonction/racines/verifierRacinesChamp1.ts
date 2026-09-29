import type { ResultatVerification } from "../../../../lib/contratGenerateur";
import {
  analyserExpression,
  collecterFacteurs,
  depouiller,
  estUnProduitAvecXExplicite,
  extraireRacinesDuProduit,
  extraireTrinome,
  trinomesCorrespondent,
  type Noeud,
} from "./expressionAlgebrique";
import { messageSyntaxeFactorisation } from "./messagesSyntaxe";
import {
  CODE_SIGNE_OPPOSE,
  CODE_SIGNE_REPETE,
  CODE_X_MASQUE_PAR_NEGATION,
  type CategorieRacines,
  type DonneesRacines,
} from "./types";

/**
 * Vérification de `racinesChamp1` (« Factorise l'équation f(x) = 0 »), réécrite localement d'après le
 * comportement de `pilote:lib/routes/reponses.ts:535-570` (`traiterChamp1`) et `pilote:src/moteur/verification.ts`
 * @ 6acc102, prouvée identique par la table de vérité différentielle
 * (`scripts/support/table-verite-racines-pilote.json`, `scripts/test-verification-racines.ts`).
 *
 * Statut : illisible → `parse_error` (avec message) ; sinon la saisie doit être une FACTORISATION dont les
 * coefficients développés (tolérance 1e-6) égalent ceux de l'énoncé, avec en plus, selon la catégorie :
 *  - mise en évidence : un produit (pas une somme) où `x` est un facteur explicite ;
 *  - binôme conjugué : exactement 2 racines opposées non nulles ;
 *  - produit remarquable : exactement 2 racines identiques.
 * Une factorisation équivalente non maximale est acceptée (`(8x-12)(0.5x+0.75)`).
 *
 * Code de compétence — SEULEMENT si le statut est `not_equivalent`, un seul, selon la catégorie :
 *  - C04 (mise en évidence) : la saisie est un produit dont un facteur est `-x` au lieu de `x` ;
 *  - C05_SIGNE_REPETE (binôme) : 2 racines égales dont la valeur absolue est la racine attendue ;
 *  - C06_SIGNE_OPPOSE (produit remarquable) : 2 racines opposées non nulles, valeur absolue = racine attendue.
 * `C07_ou_C08` n'est pas émis (inatteignable pour gen7).
 */

const TOLERANCE = 1e-6;

function motifRacines(categorie: Exclude<CategorieRacines, "mise_en_evidence">, r1: number, r2: number): boolean {
  return categorie === "binome_conjugue" ? Math.abs(r1 + r2) < TOLERANCE && Math.abs(r1) > TOLERANCE : Math.abs(r1 - r2) < TOLERANCE;
}

function estCorrecte(donnees: DonneesRacines, noeud: Noeud): boolean {
  const attendu = { a: donnees.a, b: donnees.b, c: donnees.c };
  switch (donnees.categorie) {
    case "mise_en_evidence": {
      if (!estUnProduitAvecXExplicite(noeud)) return false;
      const trinome = extraireTrinome(noeud, TOLERANCE);
      return trinome !== null && trinomesCorrespondent(trinome, attendu, TOLERANCE);
    }
    case "binome_conjugue":
    case "produit_remarquable": {
      const racines = extraireRacinesDuProduit(noeud);
      if (!racines || racines.length !== 2) return false;
      const [r1, r2] = racines as [number, number];
      if (!motifRacines(donnees.categorie, r1, r2)) return false;
      const trinome = extraireTrinome(noeud, TOLERANCE);
      return trinome !== null && trinomesCorrespondent(trinome, attendu, TOLERANCE);
    }
    default:
      throw new Error(`racinesChamp1 : catégorie « ${String(donnees.categorie)} » sans racines (jamais appelé pour af_irreductible)`);
  }
}

/** C04 : un facteur du produit est `negation(x)`, une fois les groupes dépouillés (jamais pour une somme). */
function xMasqueParNegation(noeud: Noeud): boolean {
  const racine = depouiller(noeud);
  if (racine.type === "somme") return false;
  return collecterFacteurs(racine).some((facteur) => {
    const f = depouiller(facteur);
    return f.type === "negation" && depouiller(f.operande).type === "x";
  });
}

/** C05/C06 : les 2 racines du produit saisi, comparées EN VALEUR ABSOLUE à la racine attendue. */
function signeRepete(noeud: Noeud, racineAttendue: number): boolean {
  const racines = extraireRacinesDuProduit(noeud);
  if (!racines || racines.length !== 2) return false;
  const [r1, r2] = racines as [number, number];
  return Math.abs(r1 - r2) < TOLERANCE && Math.abs(Math.abs(r1) - Math.abs(racineAttendue)) < TOLERANCE;
}

function signeOppose(noeud: Noeud, racineAttendue: number): boolean {
  const racines = extraireRacinesDuProduit(noeud);
  if (!racines || racines.length !== 2) return false;
  const [r1, r2] = racines as [number, number];
  return Math.abs(r1 + r2) < TOLERANCE && Math.abs(r1) > TOLERANCE && Math.abs(Math.abs(r1) - Math.abs(racineAttendue)) < TOLERANCE;
}

function codeDeCompetence(donnees: DonneesRacines, noeud: Noeud): string | null {
  const racineAttendue = Math.abs(donnees.racines[0]);
  switch (donnees.categorie) {
    case "mise_en_evidence":
      return xMasqueParNegation(noeud) ? CODE_X_MASQUE_PAR_NEGATION : null;
    case "binome_conjugue":
      return signeRepete(noeud, racineAttendue) ? CODE_SIGNE_REPETE : null;
    case "produit_remarquable":
      return signeOppose(noeud, racineAttendue) ? CODE_SIGNE_OPPOSE : null;
  }
}

export function verifierRacinesChamp1(donnees: DonneesRacines, saisie: string): ResultatVerification {
  let noeud: Noeud;
  try {
    noeud = analyserExpression(saisie);
  } catch (erreur) {
    // Toute erreur de lecture (y compris une imbrication démesurée) est une saisie illisible : jamais `not_equivalent`.
    return { statut: "parse_error", codesCompetence: [], messageErreur: messageSyntaxeFactorisation(erreur) };
  }
  if (estCorrecte(donnees, noeud)) return { statut: "correct", codesCompetence: [] };
  const code = codeDeCompetence(donnees, noeud);
  return { statut: "not_equivalent", codesCompetence: code === null ? [] : [code] };
}
