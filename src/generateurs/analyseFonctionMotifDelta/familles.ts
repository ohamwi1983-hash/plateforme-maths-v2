import { rat } from "./exact/rationnel";
import { coefRacine, coefRat, type Coef, type FamilleId } from "./types";

/**
 * Les dix sous-variantes de gen7 « motif / delta » (RAPPORT §49) et leur POOL EXHAUSTIF d'exercices.
 *
 * Une graine désigne UN élément du pool (`entierEntre(0, taille − 1)`) : le pool est énumérable, donc les tests parcourent TOUS les exercices de chaque famille
 * (pas un échantillon). L'ORDRE D'ÉNUMÉRATION est contractuel (règle `_v2`, CLAUDE.md) : le modifier change ce que `generer` produit pour une graine donnée.
 *
 * Bornes (validées par le propriétaire) : `a ∈ ±{1,2,3,4}` ; radicandes `n ∈ {2,3,5,6,7,10}` (sans facteur carré) ; `|c| ≤ 100` ; coefficients ENTIERS.
 *
 * Formes (voir `docs/gen7-v2-etat-des-lieux.md` §3.2) :
 *   motif_aucune_racine              a(x² + β²)                 β ∈ 1..4                    b = 0
 *   motif_racine_double_rationnelle  a(x − r)²                  r ∈ ±1..5
 *   motif_racine_double_irrationnelle a(x − s·m√n)²             s = ±1, m ∈ {1,2}, n         b irrationnel
 *   motif_racines_opposees_rationnelles   a(x² − r²)            r ∈ 1..5                    b = 0
 *   motif_racines_opposees_irrationnelles a(x² − m²n)           m ∈ {1,2}, n                b = 0
 *   motif_racine_nulle_rationnelle   a·x(x − r)                 r ∈ ±1..6                    c = 0
 *   motif_racine_nulle_irrationnelle a·x(x − s·m√n)             s = ±1, m ∈ {1,2,3}, n       c = 0, b irrationnel
 *   delta_aucune_racine              a[x² − 2px + p² + q²]      p ∈ ½ℤ* (|p| ≤ 3), q ∈ 1..3  b ≠ 0
 *   delta_racines_rationnelles       a(x − r₁)(x − r₂)          r₁ < r₂ non nuls, r₁ ≠ −r₂
 *   delta_racines_irrationnelles     a[(x − p)² − m²n]          p ∈ ±1..4, m ∈ {1,2}, n
 */
export const RADICANDES: readonly number[] = [2, 3, 5, 6, 7, 10];
export const VALEURS_A: readonly number[] = [-4, -3, -2, -1, 1, 2, 3, 4];
export const C_ABS_MAX = 100;

/** Un exercice du pool : coefficients vrais. */
export interface EntreePool {
  a: Coef;
  b: Coef;
  c: Coef;
}

export interface Famille {
  id: FamilleId;
  /** Numéro de sous-variante du cahier des charges (« 1.1 »…). */
  numero: string;
  groupe: "motif" | "delta";
  /** Poids de l'écran « racines » (RAPPORT §49) : 2 pour « motif », 3 pour « delta ». */
  poidsRacines: 2 | 3;
  /** `f` n'a aucune racine réelle. */
  aucuneRacine: boolean;
  /** Une grandeur demandée à l'élève est irrationnelle : exact exigé (jamais d'arrondi) sur ces écrans (décision Q5). */
  coefficientBIrrationnel: boolean;
  sommetIrrationnel: boolean;
  racinesIrrationnelles: boolean;
  /** Libellé du catalogue AFFICHÉ au professeur (identique mot pour mot dans `catalogue-generateurs-complet.json`). */
  libelle: string;
  exemple: string;
  pool: () => EntreePool[];
}

const entiersNonNuls = (max: number): number[] => Array.from({ length: 2 * max }, (_, i) => (i < max ? i - max : i - max + 1));

function ajouter(pool: EntreePool[], a: number, b: Coef, c: number): void {
  if (Math.abs(c) <= C_ABS_MAX) pool.push({ a: coefRat(a), b, c: coefRat(c) });
}

function poolAucuneRacineMotif(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (let beta = 1; beta <= 4; beta++) ajouter(pool, a, coefRat(0), a * beta * beta);
  return pool;
}

function poolDoubleRationnelle(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (const r of entiersNonNuls(5)) ajouter(pool, a, coefRat(-2 * a * r), a * r * r);
  return pool;
}

function poolDoubleIrrationnelle(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (const s of [-1, 1]) for (const m of [1, 2]) for (const n of RADICANDES) ajouter(pool, a, coefRacine(-2 * a * s * m, n), a * m * m * n);
  return pool;
}

function poolOpposeesRationnelles(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (let r = 1; r <= 5; r++) ajouter(pool, a, coefRat(0), -a * r * r);
  return pool;
}

function poolOpposeesIrrationnelles(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (const m of [1, 2]) for (const n of RADICANDES) ajouter(pool, a, coefRat(0), -a * m * m * n);
  return pool;
}

function poolNulleRationnelle(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (const r of entiersNonNuls(6)) ajouter(pool, a, coefRat(-a * r), 0);
  return pool;
}

function poolNulleIrrationnelle(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (const s of [-1, 1]) for (const m of [1, 2, 3]) for (const n of RADICANDES) ajouter(pool, a, coefRacine(-a * s * m, n), 0);
  return pool;
}

/**
 * Complexes CONJUGUÉS INVISIBLES (familles `*_aucune_racine`) : `f(x) = a·(x − z)(x − z̄)` avec `z = p + i·q`, `q > 0`. Développé dans le générateur SEULEMENT :
 *     (x − z)(x − z̄) = x² − 2p·x + (p² + q²)     ⇒     b = −2ap ,  c = a(p² + q²) ,  Δ = −4a²q² < 0.
 * `b` et `c` sont réels PAR CONSTRUCTION ; `z` et `z̄` ne quittent jamais cette fonction (l'exercice ne porte que `a, b, c`). On ne garde que les tirages qui donnent
 * des coefficients ENTIERS.
 */
export function developperConjugues(a: number, p: { n: number; d: number }, q: number): { b: number; c: number } | null {
  const [P, Q] = [rat(p.n, p.d), rat(q)];
  const b = rat(-2 * a * P.n, P.d);
  const p2 = rat(P.n * P.n, P.d * P.d);
  const c = rat(a * (p2.n + Q.n * Q.n * p2.d), p2.d);
  return b.d === 1 && c.d === 1 ? { b: b.n, c: c.n } : null;
}

function poolDeltaAucuneRacine(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) {
    for (const k of [-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6]) {
      for (const q of [1, 2, 3]) {
        const d = developperConjugues(a, { n: k, d: 2 }, q);
        if (d !== null) ajouter(pool, a, coefRat(d.b), d.c);
      }
    }
  }
  return pool;
}

function poolDeltaRationnelles(): EntreePool[] {
  const pool: EntreePool[] = [];
  const R = entiersNonNuls(6);
  for (const a of VALEURS_A) for (const r1 of R) for (const r2 of R) if (r1 < r2 && r1 !== -r2) ajouter(pool, a, coefRat(-a * (r1 + r2)), a * r1 * r2);
  return pool;
}

function poolDeltaIrrationnelles(): EntreePool[] {
  const pool: EntreePool[] = [];
  for (const a of VALEURS_A) for (const p of entiersNonNuls(4)) for (const m of [1, 2]) for (const n of RADICANDES) ajouter(pool, a, coefRat(-2 * a * p), a * (p * p - m * m * n));
  return pool;
}

export const FAMILLES: readonly Famille[] = [
  {
    id: "af_motif_aucune_racine", numero: "1.1", groupe: "motif", poidsRacines: 2, aucuneRacine: true,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: false,
    libelle: "Sans discriminant : aucune racine réelle (b=0)",
    exemple: "Étudier f(x) = 2x² + 18 (b=0) : aucune racine réelle, trouver le sommet, l'ensemble-image et le tableau de signe.",
    pool: poolAucuneRacineMotif,
  },
  {
    id: "af_motif_racine_double_rationnelle", numero: "1.2", groupe: "motif", poidsRacines: 2, aucuneRacine: false,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: false,
    libelle: "Sans discriminant : racine double rationnelle",
    exemple: "Étudier f(x) = 2x² − 12x + 18 : reconnaître le carré parfait, trouver la racine double, le sommet et le tableau de signe.",
    pool: poolDoubleRationnelle,
  },
  {
    id: "af_motif_racine_double_irrationnelle", numero: "1.3", groupe: "motif", poidsRacines: 2, aucuneRacine: false,
    coefficientBIrrationnel: true, sommetIrrationnel: true, racinesIrrationnelles: true,
    libelle: "Sans discriminant : racine double irrationnelle",
    exemple: "Étudier f(x) = x² − 2√3 x + 3 : reconnaître le carré parfait, la racine double est √3 (écrire sqrt(3)).",
    pool: poolDoubleIrrationnelle,
  },
  {
    id: "af_motif_racines_opposees_rationnelles", numero: "1.4", groupe: "motif", poidsRacines: 2, aucuneRacine: false,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: false,
    libelle: "Sans discriminant : racines opposées rationnelles (b=0)",
    exemple: "Étudier f(x) = 3x² − 12 (b=0) : deux racines opposées, le sommet, l'ensemble-image et le tableau de signe.",
    pool: poolOpposeesRationnelles,
  },
  {
    id: "af_motif_racines_opposees_irrationnelles", numero: "1.5", groupe: "motif", poidsRacines: 2, aucuneRacine: false,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: true,
    libelle: "Sans discriminant : racines opposées irrationnelles (b=0)",
    exemple: "Étudier f(x) = x² − 5 (b=0) : deux racines opposées irrationnelles ±√5 (écrire sqrt(5)).",
    pool: poolOpposeesIrrationnelles,
  },
  {
    id: "af_motif_racine_nulle_rationnelle", numero: "1.6", groupe: "motif", poidsRacines: 2, aucuneRacine: false,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: false,
    libelle: "Sans discriminant : une racine nulle, l'autre rationnelle (c=0)",
    exemple: "Étudier f(x) = 2x² − 6x (c=0) : mettre x en évidence, les racines 0 et 3, le sommet et le tableau de signe.",
    pool: poolNulleRationnelle,
  },
  {
    id: "af_motif_racine_nulle_irrationnelle", numero: "1.7", groupe: "motif", poidsRacines: 2, aucuneRacine: false,
    coefficientBIrrationnel: true, sommetIrrationnel: true, racinesIrrationnelles: true,
    libelle: "Sans discriminant : une racine nulle, l'autre irrationnelle (c=0)",
    exemple: "Étudier f(x) = x² − √2 x (c=0) : les racines 0 et √2 (écrire sqrt(2)), le sommet d'abscisse √2/2.",
    pool: poolNulleIrrationnelle,
  },
  {
    id: "af_delta_aucune_racine", numero: "2.1", groupe: "delta", poidsRacines: 3, aucuneRacine: true,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: false,
    libelle: "Avec discriminant : aucune racine réelle (Δ<0)",
    exemple: "Étudier f(x) = x² − 2x + 5 (Δ<0) : aucune racine réelle, trouver le sommet, l'ensemble-image et le tableau de signe.",
    pool: poolDeltaAucuneRacine,
  },
  {
    id: "af_delta_racines_rationnelles", numero: "2.2", groupe: "delta", poidsRacines: 3, aucuneRacine: false,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: false,
    libelle: "Avec discriminant : deux racines distinctes rationnelles",
    exemple: "Étudier f(x) = x² − x − 6 : calculer Δ, deux racines rationnelles, le sommet et le tableau de signe.",
    pool: poolDeltaRationnelles,
  },
  {
    id: "af_delta_racines_irrationnelles", numero: "2.3", groupe: "delta", poidsRacines: 3, aucuneRacine: false,
    coefficientBIrrationnel: false, sommetIrrationnel: false, racinesIrrationnelles: true,
    libelle: "Avec discriminant : deux racines distinctes irrationnelles",
    exemple: "Étudier f(x) = x² − 2x − 4 : calculer Δ, deux racines irrationnelles 1 ± √5 (écrire sqrt(5)), le sommet et le tableau de signe.",
    pool: poolDeltaIrrationnelles,
  },
];

export function chercherFamille(id: string): Famille | undefined {
  return FAMILLES.find((f) => f.id === id);
}
