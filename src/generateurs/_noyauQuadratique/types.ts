import { oppR, rat, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { constante, decalerP, foisScalaire, plusP, puissanceP, X, type Polynome } from "./polynome";

/**
 * Types et conversions du NOYAU partagé par les générateurs de paraboles obtenues de `x²` par transformations (gen8 « f(x) à partir du graphe », gen9 « Complète le carré »). Une parabole
 * `f(x) = a(x − p)² + q` obtenue à partir de `x²` par les transformations ACTIVES de la ligne de composition : `TH` (translation horizontale, `p`), `TV` (translation verticale, `q`), `EV`
 * (étirement vertical, `m > 1`), `CV` (compression verticale, `0 < m < 1`), `SOX` (symétrie d'axe Ox, signe de `a`). Une transformation INACTIVE vaut sa valeur NEUTRE. Tout est rationnel.
 */
export const TRANSFORMATIONS = ["TH", "TV", "EV", "CV", "SOX"] as const;
export type Transformation = (typeof TRANSFORMATIONS)[number];

export const estTransformation = (v: unknown): v is Transformation => typeof v === "string" && (TRANSFORMATIONS as readonly string[]).includes(v);

/** Les tirages d'une fonction : de quoi calculer `(a, p, q)`. Commun à l'exercice et à son repli. */
export interface TirageTransformations {
  /** Translation horizontale `p` (entier, 0 si `TH` inactive). */
  th: number;
  /** Translation verticale `q` (entier, 0 si `TV` inactive). */
  tv: number;
  /** Facteur d'échelle `m = facteurN / facteurD` (> 0, fraction irréductible ; 1/1 si ni `EV` ni `CV`). Le signe de `a` est porté par `sox`. */
  facteurN: number;
  facteurD: number;
  /** `SOX` active : `a = −m`. */
  sox: boolean;
}

/** Fonction de REPLI de l'écran 2 (RAPPORT §57) : même forme qu'un tirage. */
export type RepliFx = TirageTransformations;

/** Paramètres `(a, p, q)` d'une fonction, sous forme JSON (fractions irréductibles) : la forme stockée dans l'exercice projeté. */
export interface ParametresJson {
  an: number;
  ad: number;
  pn: number;
  pd: number;
  qn: number;
  qd: number;
}

/** Les trois paramètres de `f(x) = a(x − p)² + q`, exacts. */
export interface Parametres {
  a: Rat;
  p: Rat;
  q: Rat;
}

export const versJson = ({ a, p, q }: Parametres): ParametresJson => ({ an: a.n, ad: a.d, pn: p.n, pd: p.d, qn: q.n, qd: q.d });
export const depuisJson = (j: ParametresJson): Parametres => ({ a: rat(j.an, j.ad), p: rat(j.pn, j.pd), q: rat(j.qn, j.qd) });

export const facteur = (t: Pick<TirageTransformations, "facteurN" | "facteurD">): Rat => rat(t.facteurN, t.facteurD);

/** `(a, p, q)` d'un tirage : `a = ±m` (signe porté par `sox`), `p = th`, `q = tv`. */
export function parametresDeTirage(t: TirageTransformations): Parametres {
  const m = facteur(t);
  return { a: t.sox ? oppR(m) : m, p: rat(t.th), q: rat(t.tv) };
}

/** Les paramètres du repli. */
export const parametresRepli = (ex: { repli: RepliFx }): Parametres => parametresDeTirage(ex.repli);

/** `a(x − p)² + q`, développé. */
export function polynomeDe({ a, p, q }: Parametres): Polynome {
  const carre = decalerP(puissanceP(X, 2), p); // (x − p)²
  return plusP(foisScalaire(carre, a), constante(q));
}

