import { multiplierR, oppR, rat, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { constante, decalerP, foisScalaire, plusP, puissanceP, X, type Polynome } from "./polynome";

/**
 * Modèle de gen8 « f(x) à partir du graphe » (`variante_id` `fx_depuis_graphe`, RAPPORT §56). Une parabole `f(x) = a(x − p)² + q` obtenue à partir de `x²` par les transformations ACTIVES de la
 * ligne de composition : `TH` (translation horizontale, `p`), `TV` (translation verticale, `q`), `EV` (étirement vertical, `m > 1`), `CV` (compression verticale, `0 < m < 1`), `SOX` (symétrie
 * d'axe Ox, signe de `a`). Une transformation INACTIVE vaut sa valeur NEUTRE (`p = 0`, `q = 0`, `m = 1`, pas de symétrie) et n'est JAMAIS affichée. Tout est rationnel : aucun irrationnel.
 */
export const TRANSFORMATIONS = ["TH", "TV", "EV", "CV", "SOX"] as const;
export type Transformation = (typeof TRANSFORMATIONS)[number];

export const estTransformation = (v: unknown): v is Transformation => typeof v === "string" && (TRANSFORMATIONS as readonly string[]).includes(v);

/** Exercice brut, JSON-sérialisable, régénéré depuis `(graine, configuration)` : jamais stocké. */
export interface ExerciceFx {
  /** Transformations actives, dans l'ordre canonique de `TRANSFORMATIONS` (copie de la configuration figée). */
  actives: Transformation[];
  /** Translation horizontale `p` (entier, 0 si `TH` inactive). */
  th: number;
  /** Translation verticale `q` (entier, 0 si `TV` inactive). */
  tv: number;
  /** Facteur d'échelle `m = facteurN / facteurD` (> 0, fraction irréductible ; 1/1 si ni `EV` ni `CV`). Le signe de `a` est porté par `sox`. */
  facteurN: number;
  facteurD: number;
  /** `SOX` active : `a = −m`. */
  sox: boolean;
  /** Côté du second point `A` : `x_A = p + signeEcart · d`. Indifférent pour l'élève. */
  signeEcart: 1 | -1;
  /**
   * Fonction de REPLI de l'écran 2 (RAPPORT §57) : tirée APRÈS les quatre tirages ci-dessus, atteignable avec la même configuration, JAMAIS égale à la vraie. Ne sert que lorsqu'aucune
   * réponse n'a été confirmée à l'écran 1 (chrono expiré) et que la solution n'a pas été montrée : la vraie fonction ne doit alors pas fuiter par l'énoncé de l'écran 2.
   */
  repli: RepliFx;
  /**
   * Fonction EFFECTIVE de l'écran 2 (cascade, RAPPORT §18), posée par `projeter` seulement : la fonction CONFIRMÉE par l'élève à l'écran 1 (même fausse), re-sérialisée ; la vraie fonction si
   * la solution a été montrée ; le repli si aucune réponse n'existe. Absente de l'exercice BRUT : l'écran 2 ne s'écrit ni ne se juge jamais sur la vraie fonction par oubli de projection.
   */
  effectif?: ParametresJson;
}

export interface RepliFx {
  th: number;
  tv: number;
  facteurN: number;
  facteurD: number;
  sox: boolean;
}

/** Paramètres `(a, p, q)` d'une fonction, sous forme JSON (fractions irréductibles) : la forme stockée dans l'exercice projeté. */
export interface ParametresJson {
  an: number;
  ad: number;
  pn: number;
  pd: number;
  qn: number;
  qd: number;
}

export const estActive = (ex: Pick<ExerciceFx, "actives">, t: Transformation): boolean => ex.actives.includes(t);

/** Les trois paramètres de `f(x) = a(x − p)² + q`, exacts. */
export interface Parametres {
  a: Rat;
  p: Rat;
  q: Rat;
}

export const versJson = ({ a, p, q }: Parametres): ParametresJson => ({ an: a.n, ad: a.d, pn: p.n, pd: p.d, qn: q.n, qd: q.d });
export const depuisJson = (j: ParametresJson): Parametres => ({ a: rat(j.an, j.ad), p: rat(j.pn, j.pd), q: rat(j.qn, j.qd) });

/** Les paramètres du repli (même construction que `parametres`, sur les champs `repli`). */
export function parametresRepli(ex: Pick<ExerciceFx, "repli">): Parametres {
  const m = rat(ex.repli.facteurN, ex.repli.facteurD);
  return { a: ex.repli.sox ? oppR(m) : m, p: rat(ex.repli.th), q: rat(ex.repli.tv) };
}

export const facteur = (ex: Pick<ExerciceFx, "facteurN" | "facteurD">): Rat => rat(ex.facteurN, ex.facteurD);

export function parametres(ex: ExerciceFx): Parametres {
  const m = facteur(ex);
  return { a: ex.sox ? oppR(m) : m, p: rat(ex.th), q: rat(ex.tv) };
}

/** `a(x − p)² + q`, développé. */
export function polynomeDe({ a, p, q }: Parametres): Polynome {
  const carre = decalerP(puissanceP(X, 2), p); // (x − p)²
  return plusP(foisScalaire(carre, a), constante(q));
}

export const polynomeVrai = (ex: ExerciceFx): Polynome => polynomeDe(parametres(ex));

/**
 * Plus petit entier `d ≥ 1` tel que `d²` soit un multiple de `den` (`den ≥ 1`) : l'écart horizontal `d` entre `S` et `A` qui rend `y_A = q + a·d²` ENTIER pour `a = n/den` irréductible. */
export function ecartHorizontal(den: number): number {
  for (let d = 1; ; d++) if ((d * d) % den === 0) return d;
}

export interface PointsFx {
  sommet: { x: number; y: number };
  pointA: { x: number; y: number };
  /** Écart horizontal `d ≥ 1` (valeur absolue). */
  d: number;
}

/** `S = (p ; q)` et `A = (p ± d ; q + a·d²)`, à coordonnées entières. */
export function pointsDe(ex: ExerciceFx): PointsFx {
  const { a } = parametres(ex);
  const d = ecartHorizontal(a.d);
  const dy = multiplierR(a, rat(d * d)); // entier par construction de d
  if (dy.d !== 1) throw new Error(`gen8 : écart vertical non entier (${dy.n}/${dy.d}) pour d = ${d}`);
  return { sommet: { x: ex.th, y: ex.tv }, pointA: { x: ex.th + ex.signeEcart * d, y: ex.tv + dy.n }, d };
}
