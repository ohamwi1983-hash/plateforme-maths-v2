import type { ContexteProjection, ReponseConfirmee } from "../../../lib/contratGenerateur";
import { analyserExpression, extraireRacinesDuProduit, extraireTrinome, type Noeud } from "./racines/expressionAlgebrique";
import type { ExerciceAnalyseFonction } from "./exercice";
import { equationCanonique } from "./formatage";
import { CHAMP_RACINES_FACTORISATION } from "./racines/types";

/**
 * CASCADE de gen7 (RAPPORT §18, §33) : deux écrans affichent une donnée qui dépend d'un écran précédent.
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

/**
 * `Generateur.projeter` de gen7 : l'exercice EFFECTIF vu par l'élève. Ne dépend que des confirmations de `racinesChamp1` et du réglage
 * statique `correctionImmediate`.
 *  - Réponse confirmée « utilisable » = elle se lit (`analyserExpression`), donne 1 ou 2 racines réelles, et (`statut === "correct"` OU
 *    correction coupée). Sous correction immédiate une réponse fausse a été RÉVÉLÉE : on utilise alors la vraie factorisation.
 *  - `statut === "correct"` : la factorisation de l'élève est celle de l'énoncé (à 1e-6 près) — les racines attendues restent les VRAIES
 *    (jamais celles d'une factorisation « presque » juste), seul l'affichage est celui de l'élève.
 *  - Correction coupée et factorisation fausse mais exploitable : équation et racines sont celles de la réponse de l'élève.
 *  - Inexploitable : correction immédiate → vraie factorisation ; correction coupée → équation DÉVELOPPÉE de l'énoncé (publique), racines
 *    vraies. Jamais un texte qui ne suivrait pas le réglage STATIQUE de la tâche (jamais `revele`).
 */
export function projeterAnalyseFonction(ex: ExerciceAnalyseFonction, reponsesConfirmees: readonly ReponseConfirmee[], contexte: ContexteProjection): ExerciceAnalyseFonction {
  const affichageTableau = contexte.correctionImmediate ? "vraies" : "symboliques";
  if (ex.fonction.racines === null || ex.formeFactorisee === null) return { ...ex, affichageTableau };
  const vraiesRacines = ex.fonction.racines;
  const vraieLatex = factorisationVersLatex(ex.formeFactorisee) as string;
  const confirmee = reponsesConfirmees.find((r) => r.champ === CHAMP_RACINES_FACTORISATION);
  const utilisable = confirmee !== undefined && confirmee.statut !== "parse_error" && (confirmee.statut === "correct" || !contexte.correctionImmediate);
  if (utilisable) {
    const latex = factorisationVersLatex(confirmee.reponseBrute);
    const racines = racinesDeFactorisation(confirmee.reponseBrute);
    if (latex !== null && racines !== null) {
      return { ...ex, affichageTableau, zeros: { racines: confirmee.statut === "correct" ? vraiesRacines : racines, factorisationLatex: latex, origine: "eleve" } };
    }
  }
  return {
    ...ex,
    affichageTableau,
    zeros: contexte.correctionImmediate
      ? { racines: vraiesRacines, factorisationLatex: vraieLatex, origine: "solution" }
      : { racines: vraiesRacines, factorisationLatex: equationCanonique(ex.fonction), origine: "enonce" },
  };
}
