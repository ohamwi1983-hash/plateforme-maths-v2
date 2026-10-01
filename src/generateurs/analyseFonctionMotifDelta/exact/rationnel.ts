/**
 * Rationnels EXACTS (entiers JS sûrs) du calcul exact de gen7 « motif / delta » (RAPPORT §49). Aucune approximation flottante :
 * tout dépassement de la plage des entiers sûrs LÈVE `DebordementExact` (jamais un résultat faux silencieux) ; le lecteur de saisie
 * le traduit en `parse_error` (« nombre trop grand »).
 */
export interface Rat {
  /** Numérateur (signé). */
  readonly n: number;
  /** Dénominateur, toujours > 0, fraction irréductible. */
  readonly d: number;
}

export class DebordementExact extends Error {
  constructor() {
    super("Nombre trop grand pour le calcul exact.");
  }
}

const sur = (v: number): number => {
  if (!Number.isSafeInteger(v)) throw new DebordementExact();
  return v;
};

export function pgcd(a: number, b: number): number {
  let [x, y] = [Math.abs(a), Math.abs(b)];
  while (y !== 0) [x, y] = [y, x % y];
  return x;
}

export function rat(n: number, d = 1): Rat {
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) throw new Error(`rat : entiers avec dénominateur non nul attendus (reçu ${n}/${d})`);
  sur(n);
  sur(d);
  const g = pgcd(n, d) || 1;
  const signe = d < 0 ? -1 : 1;
  return { n: (signe * n) / g + 0, d: (signe * d) / g }; // `+ 0` : jamais -0
}

export const ZERO_R: Rat = rat(0);
export const UN_R: Rat = rat(1);

export const estZeroR = (r: Rat): boolean => r.n === 0;
export const egalR = (x: Rat, y: Rat): boolean => x.n === y.n && x.d === y.d;
export const oppR = (x: Rat): Rat => rat(-x.n, x.d);
export const ajouterR = (x: Rat, y: Rat): Rat => rat(sur(sur(x.n * y.d) + sur(y.n * x.d)), sur(x.d * y.d));
export const soustraireR = (x: Rat, y: Rat): Rat => ajouterR(x, oppR(y));
export const multiplierR = (x: Rat, y: Rat): Rat => rat(sur(x.n * y.n), sur(x.d * y.d));
export function diviserR(x: Rat, y: Rat): Rat {
  if (y.n === 0) throw new Error("diviserR : division par zéro");
  return rat(sur(x.n * y.d), sur(x.d * y.n));
}
export const signeR = (x: Rat): -1 | 0 | 1 => (x.n > 0 ? 1 : x.n < 0 ? -1 : 0);
export const versNombreR = (x: Rat): number => x.n / x.d;
export const estEntierR = (x: Rat): boolean => x.d === 1;
