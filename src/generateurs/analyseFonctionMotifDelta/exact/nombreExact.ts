import { ajouterR, DebordementExact, diviserR, egalR, estZeroR, multiplierR, oppR, pgcd, rat, signeR, UN_R, versNombreR, ZERO_R, type Rat } from "./rationnel";

/**
 * Nombre EXACT de gen7 « motif / delta » (RAPPORT §49) : une somme finie `Σ qᵣ·√r`, `qᵣ ∈ ℚ`, `r` entier SANS FACTEUR CARRÉ (`r = 1` : la partie
 * rationnelle). Forme canonique UNIQUE (les `√r` sans facteur carré sont linéairement indépendants sur ℚ) : l'égalité de deux nombres est donc
 * l'égalité de leurs formes, jamais une comparaison flottante. Fermé par `+`, `−`, `×` ; la division n'est admise que par un RATIONNEL non nul.
 *
 * Le signe d'un nombre non nul est celui de son approximation flottante : sûr ici (quelques termes de petits coefficients, jamais un écart de
 * l'ordre de 1e-15 : un nombre non nul de cette forme est minoré très largement au-dessus de l'erreur d'arrondi). Le ZÉRO, lui, est exact.
 */
export type Exact = ReadonlyMap<number, Rat>;

export class DivisionNonRationnelle extends Error {
  constructor() {
    super("Division par un nombre irrationnel (non prise en charge).");
  }
}

const LIMITE_RADICANDE = 1e12;

/** `true` ssi `n ≥ 2` n'est divisible par aucun carré > 1. */
export function estSansFacteurCarre(n: number): boolean {
  if (!Number.isInteger(n) || n < 1) return false;
  for (let p = 2; p * p <= n; p++) if (n % (p * p) === 0) return false;
  return true;
}

/** `N = s²·t` avec `t` sans facteur carré (`N ≥ 1`) → `[s, t]`. */
export function extraireCarre(N: number): [number, number] {
  if (!Number.isInteger(N) || N < 1) throw new Error(`extraireCarre : entier ≥ 1 attendu (reçu ${N})`);
  if (N > LIMITE_RADICANDE) throw new DebordementExact();
  let [s, t] = [1, N];
  for (let p = 2; p * p <= t; p++) {
    while (t % (p * p) === 0) {
      t /= p * p;
      s *= p;
    }
  }
  return [s, t];
}

function construire(entrees: Iterable<[number, Rat]>): Exact {
  const m = new Map<number, Rat>();
  for (const [r, q] of entrees) {
    if (estZeroR(q)) continue;
    const present = m.get(r);
    const somme = present === undefined ? q : ajouterR(present, q);
    if (estZeroR(somme)) m.delete(r);
    else m.set(r, somme);
  }
  return new Map([...m.entries()].sort((x, y) => x[0] - y[0]));
}

export const ZERO: Exact = construire([]);
export const exactDepuisRat = (q: Rat): Exact => construire([[1, q]]);
export const exactDepuisEntier = (n: number): Exact => exactDepuisRat(rat(n));
/** `q·√r` pour `r` entier ≥ 1 quelconque (réduit : `√8 → 2√2`). */
export function exactRacine(q: Rat, r: number): Exact {
  const [s, t] = extraireCarre(r);
  return construire([[t, multiplierR(q, rat(s))]]);
}

export const estZero = (x: Exact): boolean => x.size === 0;
export const estRationnel = (x: Exact): boolean => x.size === 0 || (x.size === 1 && x.has(1));
/** Partie rationnelle (la valeur elle-même si `estRationnel`). */
export const partieRationnelle = (x: Exact): Rat => x.get(1) ?? ZERO_R;
export const radicandes = (x: Exact): number[] => [...x.keys()].filter((r) => r !== 1);

export function egaux(x: Exact, y: Exact): boolean {
  if (x.size !== y.size) return false;
  for (const [r, q] of x) {
    const autre = y.get(r);
    if (autre === undefined || !egalR(q, autre)) return false;
  }
  return true;
}

export const plus = (x: Exact, y: Exact): Exact => construire([...x.entries(), ...y.entries()]);
export const oppose = (x: Exact): Exact => construire([...x.entries()].map(([r, q]) => [r, oppR(q)] as [number, Rat]));
export const moins = (x: Exact, y: Exact): Exact => plus(x, oppose(y));

export function fois(x: Exact, y: Exact): Exact {
  const termes: [number, Rat][] = [];
  for (const [r1, q1] of x) {
    for (const [r2, q2] of y) {
      const g = pgcd(r1, r2);
      termes.push([(r1 / g) * (r2 / g), multiplierR(multiplierR(q1, q2), rat(g))]); // √r1·√r2 = g·√((r1/g)(r2/g)), (r1/g)(r2/g) sans facteur carré
    }
  }
  return construire(termes);
}

export const foisRat = (x: Exact, q: Rat): Exact => construire([...x.entries()].map(([r, c]) => [r, multiplierR(c, q)] as [number, Rat]));

/** Division : le diviseur doit être un RATIONNEL non nul (sinon `DivisionNonRationnelle` / erreur de division par zéro). */
export function diviser(x: Exact, y: Exact): Exact {
  if (estZero(y)) throw new Error("diviser : division par zéro");
  if (!estRationnel(y)) throw new DivisionNonRationnelle();
  return foisRat(x, diviserR(UN_R, partieRationnelle(y)));
}

export function approx(x: Exact): number {
  let s = 0;
  for (const [r, q] of x) s += versNombreR(q) * Math.sqrt(r);
  return s;
}

export function signe(x: Exact): -1 | 0 | 1 {
  if (estZero(x)) return 0;
  const v = approx(x);
  return v > 0 ? 1 : -1;
}

export function comparer(x: Exact, y: Exact): -1 | 0 | 1 {
  return signe(moins(x, y));
}

/** `√q` pour un rationnel `q ≥ 0` : `√(p/d) = √(p·d)/d`, réduit. */
export function racineCarreeRat(q: Rat): Exact {
  if (signeR(q) < 0) throw new Error("racineCarreeRat : rationnel négatif");
  if (estZeroR(q)) return ZERO;
  return exactRacine(rat(1, q.d), q.n * q.d);
}

/**
 * `ax² + bx + c = 0` pour `a`, `c` rationnels (`a ≠ 0`) et `b` rationnel OU multiple rationnel d'UNE racine : alors `b²` est rationnel, donc `Δ` aussi, et les racines
 * `(−b ± √Δ)/(2a)` restent dans la forme `Σ qᵣ√r`. Toute autre forme de `b` (somme de deux termes irrationnels, par exemple) donnerait un `Δ` irrationnel, donc des
 * radicaux imbriqués : `null` (coefficients « inexploitables », repli de la cascade sur les vrais).
 * `racines` : triées croissantes, une seule valeur (`double: true`) si `Δ = 0`, vide si `Δ < 0`.
 */
export function racinesDuSecondDegre(a: Rat, b: Exact, c: Rat): { racines: Exact[]; double: boolean } | null {
  if (estZeroR(a)) throw new Error("racinesDuSecondDegre : a = 0");
  if (b.size > 1) return null;
  const b2 = fois(b, b);
  const delta = moins(b2, exactDepuisRat(multiplierR(rat(4), multiplierR(a, c))));
  if (!estRationnel(delta)) return null;
  const d = partieRationnelle(delta);
  const deuxA = multiplierR(rat(2), a);
  const sur2a = (x: Exact): Exact => foisRat(x, diviserR(UN_R, deuxA));
  const mb = oppose(b);
  if (signeR(d) < 0) return { racines: [], double: false };
  if (estZeroR(d)) return { racines: [sur2a(mb)], double: true };
  const s = racineCarreeRat(d);
  const [r1, r2] = [sur2a(moins(mb, s)), sur2a(plus(mb, s))];
  return { racines: comparer(r1, r2) <= 0 ? [r1, r2] : [r2, r1], double: false };
}

/** Évalue `ax² + bx + c` en un nombre exact (sert aux preuves « la racine annule bien f »). */
export function evaluerPolynome(a: Exact, b: Exact, c: Exact, x: Exact): Exact {
  return plus(plus(fois(a, fois(x, x)), fois(b, x)), c);
}

// ── Formats ──────────────────────────────────────────────────────────────────────────────────────

const ppcm = (a: number, b: number): number => (a / pgcd(a, b)) * b;

function termes(x: Exact, ecrireRacine: (r: number) => string, produit: (coef: string, rac: string) => string): { signe: 1 | -1; texte: string }[] {
  return [...x.entries()].map(([r, q]) => {
    const k = Math.abs(q.n);
    const coef = k === 1 && r !== 1 ? "" : String(k);
    return { signe: q.n < 0 ? -1 : 1, texte: r === 1 ? String(k) : produit(coef, ecrireRacine(r)) };
  });
}

function assembler(ts: { signe: 1 | -1; texte: string }[], espace: string): string {
  // Ordre : partie rationnelle d'abord, puis les radicaux par radicande croissant (déjà l'ordre de la Map).
  return ts.map((t, i) => (i === 0 ? (t.signe < 0 ? "-" : "") : `${espace}${t.signe < 0 ? "-" : "+"}${espace}`) + t.texte).join("");
}

/** Dénominateur commun et numérateurs entiers : `x = (Σ kᵣ√r) / L`. */
function surDenominateurCommun(x: Exact): { L: number; numerateur: Exact } {
  let L = 1;
  for (const q of x.values()) L = ppcm(L, q.d);
  return { L, numerateur: construire([...x.entries()].map(([r, q]) => [r, rat((q.n * L) / q.d)] as [number, Rat])) };
}

/** LaTeX (sans `$`) : `3`, `-\dfrac{9}{4}`, `-2\sqrt{2}`, `\dfrac{\sqrt{5}}{2}`, `\dfrac{3+\sqrt{5}}{4}`. Fractions toujours `\dfrac`, le signe d'un terme seul SORTI de la fraction. */
export function latexExact(x: Exact): string {
  if (estZero(x)) return "0";
  const { L, numerateur } = surDenominateurCommun(x);
  const ts = termes(numerateur, (r) => `\\sqrt{${r}}`, (coef, rac) => `${coef}${rac}`);
  if (L === 1) return assembler(ts, "");
  if (ts.length === 1) return `${(ts[0] as { signe: number }).signe < 0 ? "-" : ""}\\dfrac{${(ts[0] as { texte: string }).texte}}{${L}}`;
  return `\\dfrac{${assembler(ts, "")}}{${L}}`;
}

/** Saisie (ce que l'élève taperait, relisible par `lireExpressionExacte`) : `3`, `-9/4`, `-2sqrt(2)`, `sqrt(5)/2`, `(3+sqrt(5))/4`. Sert aux tests et aux réponses de référence. */
export function texteSaisieExact(x: Exact): string {
  if (estZero(x)) return "0";
  const { L, numerateur } = surDenominateurCommun(x);
  const ts = termes(numerateur, (r) => `sqrt(${r})`, (coef, rac) => `${coef}${rac}`);
  if (L === 1) return assembler(ts, "");
  if (ts.length === 1) return `${(ts[0] as { signe: number }).signe < 0 ? "-" : ""}${(ts[0] as { texte: string }).texte}/${L}`;
  return `(${assembler(ts, "")})/${L}`;
}

