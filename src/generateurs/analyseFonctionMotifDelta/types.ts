import { rat, type Rat } from "./exact/rationnel";
import { diviser, exactDepuisRat, fois, foisRat, moins, oppose, racinesDuSecondDegre, type Exact } from "./exact/nombreExact";

/**
 * gen7 « motif / delta » (RAPPORT §49) : dix sous-variantes, deux familles. Types et constantes COMMUNS. Tout est EXACT : un coefficient est `(n/d)·√rad`
 * (`rad = 1` : rationnel), jamais un flottant. L'exercice est JSON pur (le contrat l'exige) : les nombres `Exact` (des `Map`) n'en font jamais partie, ils sont
 * recalculés à la demande par `fonctionExacte`.
 */
/** Terme d'un polynôme `ax² + bx + c`. */
export type Terme = "a" | "b" | "c";

/** Valeurs de x des colonnes du tableau : « vraies » (solution montrée) ou « symboliques » (x₁, x_S, x₂). */
export type AffichageColonnes = "vraies" | "symboliques";

/** Noms de champ des six écrans (identiques pour les dix sous-variantes) ; `CHAMP_RACINES` est défini plus bas. */
export const CHAMP_COEFFICIENTS = "coefficients";
export const CHAMP_ALLURE = "allure";
export const CHAMP_AXE_SOMMET = "axeSommet";
export const CHAMP_DOMAINE_IMAGE = "domaineImage";
export const CHAMP_TABLEAU_SIGNES = "tableauSignes";

export const CHAMP_RACINES = "racines";

/** `(n/d)·√rad`, `d > 0`, fraction irréductible, `rad` entier ≥ 1 SANS facteur carré (`rad = 1` : rationnel). */
export interface Coef {
  n: number;
  d: number;
  rad: number;
}

export const coefRat = (n: number, d = 1): Coef => {
  const r = rat(n, d);
  return { n: r.n, d: r.d, rad: 1 };
};
export const coefRacine = (n: number, rad: number, d = 1): Coef => {
  const r = rat(n, d);
  return { n: r.n, d: r.d, rad };
};

export function coefVersExact(c: Coef): Exact {
  const q = rat(c.n, c.d);
  return c.rad === 1 ? exactDepuisRat(q) : foisRat(racineUnite(c.rad), q);
}
const racineUnite = (rad: number): Exact => new Map([[rad, rat(1)]]);

/** Un `Exact` en `Coef` : seulement s'il est de la forme `(n/d)·√rad` (au plus UN terme) ; sinon `null`. */
export function coefDepuisExact(x: Exact): Coef | null {
  if (x.size === 0) return coefRat(0);
  if (x.size > 1) return null;
  const [[rad, q]] = [...x.entries()] as [[number, Rat]];
  return { n: q.n, d: q.d, rad };
}

export type FamilleId =
  | "af_motif_aucune_racine"
  | "af_motif_racine_double_rationnelle"
  | "af_motif_racine_double_irrationnelle"
  | "af_motif_racines_opposees_rationnelles"
  | "af_motif_racines_opposees_irrationnelles"
  | "af_motif_racine_nulle_rationnelle"
  | "af_motif_racine_nulle_irrationnelle"
  | "af_delta_aucune_racine"
  | "af_delta_racines_rationnelles"
  | "af_delta_racines_irrationnelles";

/**
 * Fonction `ax² + bx + c` EXACTE et ses grandeurs dérivées. `a`, `c` rationnels (`a ≠ 0`), `b` rationnel ou multiple rationnel d'UNE racine (alors `Δ` est rationnel :
 * les racines restent de la forme `Σ qᵣ√r`).
 */
export interface FonctionExacte {
  a: Rat;
  b: Exact;
  c: Rat;
  /** `−b / (2a)`. */
  xS: Exact;
  /** `f(xS) = c − b²/(4a)` (rationnel : `b²` l'est). */
  yS: Exact;
  /** Racines réelles distinctes triées ; UNE seule valeur si `double`, aucune si `Δ < 0`. */
  racines: Exact[];
  double: boolean;
}

/** `null` si les coefficients sont INEXPLOITABLES (a nul, a ou c irrationnel, b somme de plusieurs radicaux → radicaux imbriqués). */
export function fonctionExacte(a: Coef, b: Coef, c: Coef): FonctionExacte | null {
  if (a.rad !== 1 || c.rad !== 1 || a.n === 0) return null;
  const [ra, rc] = [rat(a.n, a.d), rat(c.n, c.d)];
  const eb = coefVersExact(b);
  const sol = racinesDuSecondDegre(ra, eb, rc);
  if (sol === null) return null;
  const deuxA = rat(2 * ra.n, ra.d);
  const xS = foisRat(oppose(eb), rat(deuxA.d, deuxA.n));
  const b2sur4a = diviser(fois(eb, eb), exactDepuisRat(rat(4 * ra.n, ra.d)));
  const yS = moins(exactDepuisRat(rc), b2sur4a);
  return { a: ra, b: eb, c: rc, xS, yS, racines: sol.racines, double: sol.double };
}

/**
 * Données EFFECTIVES (cascade, RAPPORT §38/§45) : vraies dans l'exercice brut ; sinon issues de la réponse CONFIRMÉE à `coefficients` quand elle est exploitable.
 *  - `coefficientsEleve` : les coefficients effectifs sont ceux de l'élève ET diffèrent des vrais ;
 *  - `coefficientsAffiches` : coefficients confirmés exploitables (justes OU faux) : l'énoncé suivant affiche SA fonction avec le MÊME libellé dans les deux cas (un libellé propre
 *    à l'erreur serait un verdict visible sous correction coupée) ;
 *  - `yImage` : ordonnée du sommet confirmée à `axeSommet` (même logique), `null` = celle de la fonction effective ; elle sert à JUGER l'ensemble-image, jamais à l'AFFICHER (RAPPORT §53).
 */
export interface DonneesEffectivesMotifDelta {
  a: Coef;
  b: Coef;
  c: Coef;
  coefficientsEleve: boolean;
  coefficientsAffiches: boolean;
  yImage: Coef | null;
}

export interface ExerciceMotifDelta {
  famille: FamilleId;
  /** Coefficients VRAIS. */
  a: Coef;
  b: Coef;
  c: Coef;
  /** Termes NON NULS de f dans l'ordre d'affichage : jamais l'ordre canonique `a, b, c` (voir `genererExerciceMD`). */
  ordreTermes: Terme[];
  effectif: DonneesEffectivesMotifDelta;
  /** Ce que le tableau montre de ses valeurs de x : vraies (solution montrée, RAPPORT §42) ou symboliques. */
  affichageTableau: AffichageColonnes;
}

export function effectifVraiMD(a: Coef, b: Coef, c: Coef): DonneesEffectivesMotifDelta {
  return { a, b, c, coefficientsEleve: false, coefficientsAffiches: false, yImage: null };
}

/** Fonction VRAIE de l'exercice (jamais `null` : les coefficients générés sont exploitables par construction). */
export function fonctionVraie(ex: Pick<ExerciceMotifDelta, "a" | "b" | "c">): FonctionExacte {
  const f = fonctionExacte(ex.a, ex.b, ex.c);
  if (f === null) throw new Error("fonctionVraie : coefficients générés inexploitables (bug de génération)");
  return f;
}

/** Fonction EFFECTIVE (celle sur laquelle les écrans dépendants sont jugés). */
export function fonctionEffective(ex: Pick<ExerciceMotifDelta, "a" | "b" | "c" | "effectif">): FonctionExacte {
  return fonctionExacte(ex.effectif.a, ex.effectif.b, ex.effectif.c) ?? fonctionVraie(ex);
}
