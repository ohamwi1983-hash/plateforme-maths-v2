import type { ContexteProjection, ReponseConfirmee } from "../../../lib/contratGenerateur";
import { COEFFICIENT_MAX } from "../../../lib/aideTypee";
import { decoderChampsMultiples, lireNombreOuFraction } from "../../../lib/reponsesEcran";
import { SOUS_CHAMPS_AXE_SOMMET } from "./axeSommet";
import { SOUS_CHAMPS_COEFFICIENTS } from "./coefficients";
import { analyserExpression, extraireRacinesDuProduit, extraireTrinome, type Noeud } from "./racines/expressionAlgebrique";
import type { ExerciceAnalyseFonction } from "./exercice";
import { equationCanonique } from "./formatage";
import { CHAMP_RACINES_FACTORISATION } from "./racines/types";
import { CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, TOLERANCE_SAISIE, effectifVrai, type DonneesEffectives, type FonctionSecondDegre } from "./types";

/**
 * CASCADE de gen7 (RAPPORT §18, §33, §38). Depuis §38, la règle est UNIFORME dans les deux régimes de correction : une donnée confirmée
 * par l'élève, fausse mais exploitable, sert de point de départ à l'écran suivant, qu'on ait révélé ou non la vraie valeur (§33-D
 * limitait cette règle à la correction coupée ; décision du propriétaire, D-A). Trois écrans dépendent des coefficients confirmés
 * (`allure`, `axeSommet`, `domaineImage`, ce dernier aussi de l'ordonnée du sommet confirmée) ; `racinesChamp2` de la factorisation.
 * Un écran ne lit JAMAIS que des réponses CONFIRMÉES et le réglage statique de la tâche.
 *
 * Deux écrans affichent une donnée qui dépend d'un écran précédent (§33, inchangés) :
 *  - A. `racinesChamp2` affiche l'équation « … = 0 » issue de la factorisation CONFIRMÉE de `racinesChamp1` et vérifie les racines
 *    de CETTE équation (« une méthode juste appliquée à une donnée de départ fausse doit réussir »).
 *  - B. `tableauSignes` montre, dans sa ligne des x, les valeurs `x₁`, `xS`, `x₂` : vraies si la correction est immédiate, SYMBOLIQUES
 *    si elle est coupée (les vraies valeurs sont la solution d'`axeSommet` et de `racinesChamp2`). Cette décision ne lit AUCUNE
 *    réponse : elle suit le réglage statique de la tâche.
 */

const LONGUEUR_MAX = 200;
const TOLERANCE_DELTA = 1e-9;

function nombreLatex(v: number): string {
  if (!Number.isFinite(v)) throw new Error("nombre non fini");
  return String(Math.round(v * 1e9) / 1e9);
}

function enfant(noeud: Noeud, complexe: (n: Noeud) => boolean): string {
  return complexe(noeud) ? `(${noeudVersLatex(noeud)})` : noeudVersLatex(noeud);
}

/** Ré-écriture LaTeX d'un arbre lu par `analyserExpression` : décoder puis re-sérialiser, JAMAIS recoller la chaîne de l'élève. */
export function noeudVersLatex(noeud: Noeud): string {
  switch (noeud.type) {
    case "nombre":
      return nombreLatex(noeud.valeur);
    case "x":
      return "x";
    case "negation":
      return `-${enfant(noeud.operande, (n) => n.type === "somme" || n.type === "negation")}`;
    case "groupe":
      return `(${noeudVersLatex(noeud.interieur)})`;
    case "somme":
      return `${noeudVersLatex(noeud.gauche)} ${noeud.operateur} ${noeudVersLatex(noeud.droite)}`;
    case "puissance":
      return `${enfant(noeud.base, (n) => n.type !== "x" && n.type !== "nombre" && n.type !== "groupe")}^{${noeudVersLatex(noeud.exposant)}}`;
    case "produit": {
      if (noeud.operateur === "/") return `\\dfrac{${noeudVersLatex(noeud.gauche)}}{${noeudVersLatex(noeud.droite)}}`;
      const g = noeudVersLatex(noeud.gauche);
      const d = noeudVersLatex(noeud.droite);
      const juxtapose = noeud.droite.type === "groupe" || ((noeud.droite.type === "x" || (noeud.droite.type === "puissance" && noeud.droite.base.type === "x")) && (noeud.gauche.type === "nombre" || noeud.gauche.type === "groupe"));
      return juxtapose ? `${g}${d}` : `${g} \\cdot ${d}`;
    }
  }
}

/** Valeur d'un sous-arbre sans `x` ; `null` s'il en contient un (ou si le calcul n'est pas défini). */
function valeurSansX(noeud: Noeud): number | null {
  switch (noeud.type) {
    case "nombre":
      return noeud.valeur;
    case "x":
      return null;
    case "negation": {
      const v = valeurSansX(noeud.operande);
      return v === null ? null : -v;
    }
    case "groupe":
      return valeurSansX(noeud.interieur);
    case "somme": {
      const [g, d] = [valeurSansX(noeud.gauche), valeurSansX(noeud.droite)];
      return g === null || d === null ? null : noeud.operateur === "+" ? g + d : g - d;
    }
    case "produit": {
      const [g, d] = [valeurSansX(noeud.gauche), valeurSansX(noeud.droite)];
      return g === null || d === null ? null : noeud.operateur === "*" ? g * d : g / d;
    }
    case "puissance": {
      const [b, e] = [valeurSansX(noeud.base), valeurSansX(noeud.exposant)];
      return b === null || e === null ? null : b ** e;
    }
  }
}

/** Vrai si une division a pour dénominateur une constante nulle ou non finie (`1/0`, `x/(2-2)`) : l'expression n'a aucun sens. */
function divisePar0(noeud: Noeud): boolean {
  switch (noeud.type) {
    case "nombre":
    case "x":
      return false;
    case "negation":
      return divisePar0(noeud.operande);
    case "groupe":
      return divisePar0(noeud.interieur);
    case "somme":
      return divisePar0(noeud.gauche) || divisePar0(noeud.droite);
    case "puissance":
      return divisePar0(noeud.base) || divisePar0(noeud.exposant);
    case "produit": {
      if (divisePar0(noeud.gauche) || divisePar0(noeud.droite)) return true;
      if (noeud.operateur !== "/") return false;
      const denominateur = valeurSansX(noeud.droite);
      return denominateur !== null && (!Number.isFinite(denominateur) || Math.abs(denominateur) < 1e-12);
    }
  }
}

function lire(texte: string): Noeud | null {
  if (typeof texte !== "string" || texte.trim() === "" || texte.length > LONGUEUR_MAX) return null;
  try {
    const noeud = analyserExpression(texte);
    return divisePar0(noeud) ? null : noeud;
  } catch {
    return null;
  }
}

/** Corps LaTeX (sans `$`, sans « = 0 ») d'une factorisation écrite en texte ; `null` si illisible ou démesurée. */
export function factorisationVersLatex(texte: string): string | null {
  const noeud = lire(texte);
  if (noeud === null) return null;
  try {
    const latex = noeudVersLatex(noeud);
    return latex.length <= LONGUEUR_MAX ? latex : null;
  } catch {
    return null;
  }
}

/**
 * Racines de l'équation « expression = 0 » : d'abord par les FACTEURS (exactes : `2x(x − 4)`, `(x − 3)^2`), sinon par le trinôme
 * développé. `null` si l'équation n'a pas 1 ou 2 racines réelles exploitables (produit de plus de 2 racines, constante, Δ < 0,
 * valeur non finie). Une racine unique est renvoyée `[r, r]` (une seule valeur suffit à `racinesChamp2`).
 */
export function racinesDeFactorisation(texte: string): [number, number] | null {
  const noeud = lire(texte);
  if (noeud === null) return null;
  const facteurs = extraireRacinesDuProduit(noeud);
  if (facteurs !== null) {
    if (facteurs.length === 1 && Number.isFinite(facteurs[0])) return [facteurs[0] as number, facteurs[0] as number];
    if (facteurs.length === 2 && facteurs.every(Number.isFinite)) {
      const [r1, r2] = facteurs as [number, number];
      return r1 <= r2 ? [r1, r2] : [r2, r1];
    }
    return null;
  }
  const t = extraireTrinome(noeud, 1e-6);
  if (t === null || ![t.a, t.b, t.c].every(Number.isFinite)) return null;
  if (Math.abs(t.a) < 1e-9) {
    if (Math.abs(t.b) < 1e-9) return null;
    const r = -t.c / t.b;
    return Number.isFinite(r) ? [r, r] : null;
  }
  const delta = t.b * t.b - 4 * t.a * t.c;
  if (delta < -TOLERANCE_DELTA) return null;
  const s = Math.abs(delta) < TOLERANCE_DELTA ? 0 : Math.sqrt(delta);
  const [r1, r2] = [(-t.b - s) / (2 * t.a), (-t.b + s) / (2 * t.a)];
  return Number.isFinite(r1) && Number.isFinite(r2) ? (r1 <= r2 ? [r1, r2] : [r2, r1]) : null;
}

/** Bornes d'un coefficient EXPLOITABLE (même plafond que l'aide `croquis_parabole`) ; `a` ne peut pas être quasi nul (xS = −b/2a explose). */
const COEFFICIENT_ABS_MIN = 1e-6;
const ORDONNEE_ABS_MAX = 1e6;

/** Coefficients d'une réponse `coefficients` confirmée ; `null` si illisible, `a` quasi nul ou démesuré (inexploitable -> repli sur les vrais). */
function lireCoefficients(reponseBrute: string): { a: number; b: number; c: number } | null {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_COEFFICIENTS });
  if (!d.ok) return null;
  const [a, b, c] = (["a", "b", "c"] as const).map((k) => lireNombreOuFraction(d.valeur[k] as string));
  if (a === null || b === null || c === null || a === undefined || b === undefined || c === undefined) return null;
  if (![a, b, c].every((v) => Number.isFinite(v) && Math.abs(v) <= COEFFICIENT_MAX) || Math.abs(a) < COEFFICIENT_ABS_MIN) return null;
  return { a, b, c };
}

/** Ordonnée du sommet d'une réponse `axeSommet` confirmée ; `null` si illisible ou démesurée. */
function lireOrdonneeSommet(reponseBrute: string): number | null {
  const d = decoderChampsMultiples(reponseBrute, { champs: SOUS_CHAMPS_AXE_SOMMET });
  if (!d.ok) return null;
  const y = lireNombreOuFraction(d.valeur.yS as string);
  return y !== null && Number.isFinite(y) && Math.abs(y) <= ORDONNEE_ABS_MAX ? y : null;
}

/**
 * Données effectives de `allure`, `axeSommet` et `domaineImage` (RAPPORT §38) à partir des réponses CONFIRMÉES, dans les deux régimes.
 *  - Coefficients : ceux de la réponse confirmée à `coefficients` (même fausse) s'ils sont exploitables ; réponse `correct` -> les vrais
 *    (jamais un flottant issu de « 4/2 ») ; illisible, `a` nul, démesuré ou champ terminé sans réponse (chrono) -> les vrais. Repli sans
 *    fuite sous correction coupée : la fonction est publique dans l'énoncé.
 *  - Sommet : celui de la parabole de ces coefficients (le vrai s'ils sont vrais).
 *  - `yImage` : l'ordonnée confirmée à `axeSommet` si elle est lisible et s'écarte du sommet effectif de plus que la tolérance de saisie
 *    (un arrondi accepté n'est pas une autre donnée) ; sinon le sommet effectif. Réponse `parse_error` : inexploitable -> sommet effectif.
 */
export function effectifDepuisReponses(f: FonctionSecondDegre, reponsesConfirmees: readonly ReponseConfirmee[]): DonneesEffectives {
  const vrai = effectifVrai(f);
  const coef = reponsesConfirmees.find((r) => r.champ === CHAMP_COEFFICIENTS);
  const lus = coef !== undefined && coef.statut === "not_equivalent" ? lireCoefficients(coef.reponseBrute) : null;
  const differe = lus !== null && (lus.a !== f.a || lus.b !== f.b || lus.c !== f.c);
  let base = vrai;
  if (lus !== null && differe) {
    const xS = -lus.b / (2 * lus.a);
    const yS = lus.a * xS * xS + lus.b * xS + lus.c;
    base = { ...vrai, a: lus.a, b: lus.b, c: lus.c, xS: xS === 0 ? 0 : xS, yS: yS === 0 ? 0 : yS, yImage: yS === 0 ? 0 : yS, coefficientsEleve: true };
  }
  const axe = reponsesConfirmees.find((r) => r.champ === CHAMP_AXE_SOMMET);
  const y = axe !== undefined && axe.statut === "not_equivalent" ? lireOrdonneeSommet(axe.reponseBrute) : null;
  const yImage = y !== null && Math.abs(y - base.yS) > TOLERANCE_SAISIE ? y : base.yS;
  return { ...base, yImage, ordonneeEleve: Math.abs(yImage - f.yS) > 1e-9 };
}

/**
 * `Generateur.projeter` de gen7 : l'exercice EFFECTIF vu par l'élève. Ne dépend que des réponses CONFIRMÉES et du réglage statique
 * `correctionImmediate`, qui ne choisit plus que l'AFFICHAGE du tableau et le panneau de faits, jamais quelle donnée sert de départ.
 *  - Coefficients, sommet, ordonnée : `effectifDepuisReponses` (RAPPORT §38).
 *  - `racinesChamp2` : réponse confirmée à `racinesChamp1` « utilisable » = elle se lit (`analyserExpression`) et donne 1 ou 2 racines
 *    réelles. **Dans les deux régimes** (§33-D la réservait à la correction coupée, D-A du propriétaire l'étend : une méthode juste sur
 *    une donnée fausse réussit, qu'on ait ou non montré la vraie).
 *  - `statut === "correct"` : la factorisation de l'élève est celle de l'énoncé (à 1e-6 près) — les racines attendues restent les VRAIES
 *    (jamais celles d'une factorisation « presque » juste), seul l'affichage est celui de l'élève.
 *  - Inexploitable : correction immédiate -> vraie factorisation ; correction coupée -> équation DÉVELOPPÉE de l'énoncé (publique), racines
 *    vraies. Jamais un texte qui ne suivrait pas le réglage STATIQUE de la tâche (jamais `revele`).
 */
export function projeterAnalyseFonction(ex: ExerciceAnalyseFonction, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ExerciceAnalyseFonction {
  const affichageTableau = contexte.correctionImmediate ? "vraies" : "symboliques";
  // Panneau « Ce que tu sais déjà » (RAPPORT §33) : seuls les écrans RÉUSSIS y figurent, et jamais sous correction coupée (un fait est
  // la bonne valeur : le montrer avant la fin de la tâche révélerait la réponse). Un écran raté n'y figure jamais, même révélé.
  const corrects = contexte.correctionImmediate ? reponsesConfirmees.filter((r) => r.statut === "correct").map((r) => r.champ) : [];
  const effectif = effectifDepuisReponses(ex.fonction, reponsesConfirmees);
  if (ex.fonction.racines === null || ex.formeFactorisee === null) return { ...ex, effectif, affichageTableau, corrects };
  const vraiesRacines = ex.fonction.racines;
  const vraieLatex = factorisationVersLatex(ex.formeFactorisee) as string;
  const confirmee = reponsesConfirmees.find((r) => r.champ === CHAMP_RACINES_FACTORISATION);
  const utilisable = confirmee !== undefined && confirmee.statut !== "parse_error";
  if (utilisable) {
    const latex = factorisationVersLatex(confirmee.reponseBrute);
    const racines = racinesDeFactorisation(confirmee.reponseBrute);
    if (latex !== null && racines !== null) {
      return { ...ex, effectif, affichageTableau, corrects, zeros: { racines: confirmee.statut === "correct" ? vraiesRacines : racines, factorisationLatex: latex, origine: "eleve" } };
    }
  }
  return {
    ...ex,
    effectif,
    affichageTableau,
    corrects,
    zeros: contexte.correctionImmediate
      ? { racines: vraiesRacines, factorisationLatex: vraieLatex, origine: "solution" }
      : { racines: vraiesRacines, factorisationLatex: equationCanonique(ex.fonction), origine: "enonce" },
  };
}
