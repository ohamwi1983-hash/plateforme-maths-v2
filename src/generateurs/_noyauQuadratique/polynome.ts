import { DebordementExact, UN_R, ZERO_R, ajouterR, diviserR, egalR, estZeroR, multiplierR, oppR, rat, signeR, soustraireR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";

/**
 * Polynômes en `x` à coefficients RATIONNELS EXACTS (gen8 « f(x) à partir du graphe », RAPPORT §56) : lecteur de saisie d'élève et opérations.
 * Aucun irrationnel, aucune racine carrée (hors sujet ici), aucune approximation flottante : un dépassement des entiers sûrs lève `DebordementExact` en interne et devient un refus
 * pédagogique, jamais un résultat faux. Représentation : coefficients par degré croissant, SANS zéro de tête ; le polynôme nul est `[]`.
 *
 * Grammaire (celle de `lireExpressionExacte`, restreinte à ℚ et étendue à la variable `x`) :
 *
 *     saisie := [prefixe '='] expr                          prefixe : `f(x)`, `y`, `E1(x)`… (une lettre/identifiant, `(x)` facultatif)
 *     expr   := terme (('+' | '-') terme)*
 *     terme  := unaire (('*' | '/' | ε) unaire)*            ε = multiplication implicite, SEULEMENT devant `x` ou `(` : `2x`, `3(x-2)^2`, `(x+1)(x-1)`
 *     unaire := ('+' | '-') unaire | puissance
 *     puissance := atome ('^' exposant | '²' | '³' | '⁴')?
 *     atome  := nombre | 'x' | '(' expr ')'
 *     nombre := chiffres [('.' | ',') chiffres]             (décimal EXACT : `0,25` = 1/4)
 *
 * Lecture de gauche à droite : `1/2(x-1)^2` = (1/2)·(x-1)² ; `-x^2` = −(x²) ; `2^3` = 8. La division n'est admise que par une CONSTANTE non nulle. Le moins typographique `−`, `×`, `·` et les
 * espaces sont admis. Degré du résultat ≤ 4, exposant écrit ≤ 8 ; saisie ≤ 120 caractères. La saisie de l'élève n'est jamais recopiée dans un message.
 */
export type Polynome = readonly Rat[];

export type LecturePolynome = { ok: true; polynome: Polynome } | { ok: false; message: string };

export const DEGRE_MAX = 4;
const LONGUEUR_MAX = 120;
const PROFONDEUR_MAX = 20;
const DECIMALES_MAX = 9;
const EXPOSANT_MAX = 8;

// ── Opérations (pures, exactes) ──
function normaliser(coefs: Rat[]): Polynome {
  let n = coefs.length;
  while (n > 0 && estZeroR(coefs[n - 1] as Rat)) n--;
  return coefs.slice(0, n);
}
export const constante = (c: Rat): Polynome => normaliser([c]);
export const X: Polynome = [ZERO_R, UN_R];
export const degre = (p: Polynome): number => p.length - 1; // −1 pour le polynôme nul
export const estNul = (p: Polynome): boolean => p.length === 0;
export const estConstant = (p: Polynome): boolean => p.length <= 1;
export const coefficient = (p: Polynome, k: number): Rat => p[k] ?? ZERO_R;
export function egalP(p: Polynome, q: Polynome): boolean {
  return p.length === q.length && p.every((c, k) => egalR(c, q[k] as Rat));
}
export function plusP(p: Polynome, q: Polynome): Polynome {
  const n = Math.max(p.length, q.length);
  return normaliser(Array.from({ length: n }, (_, k) => ajouterR(coefficient(p, k), coefficient(q, k))));
}
export const oppP = (p: Polynome): Polynome => p.map(oppR);
export const moinsP = (p: Polynome, q: Polynome): Polynome => plusP(p, oppP(q));
export function foisP(p: Polynome, q: Polynome): Polynome {
  if (estNul(p) || estNul(q)) return [];
  const sortie: Rat[] = Array.from({ length: p.length + q.length - 1 }, () => ZERO_R);
  p.forEach((a, i) => q.forEach((b, j) => (sortie[i + j] = ajouterR(sortie[i + j] as Rat, multiplierR(a, b)))));
  return normaliser(sortie);
}
export const foisScalaire = (p: Polynome, c: Rat): Polynome => normaliser(p.map((a) => multiplierR(a, c)));
export function puissanceP(p: Polynome, e: number): Polynome {
  let r: Polynome = constante(UN_R);
  for (let k = 0; k < e; k++) r = foisP(r, p);
  return r;
}
/** `p(x − h)` : le graphe de `p` translaté de `h` vers la droite (TH). */
export function decalerP(p: Polynome, h: Rat): Polynome {
  const base: Polynome = normaliser([oppR(h), UN_R]); // x − h
  let r: Polynome = [];
  for (let k = p.length - 1; k >= 0; k--) r = plusP(foisP(r, base), constante(p[k] as Rat)); // Horner
  return r;
}
/** `q = m·p` avec `m` rationnel ? Renvoie `m`, ou `null` (p nul, ou pas proportionnels). */
export function rapportProportionnel(p: Polynome, q: Polynome): Rat | null {
  if (estNul(p) || p.length !== q.length) return null;
  const m = diviserR(q[q.length - 1] as Rat, p[p.length - 1] as Rat);
  return egalP(foisScalaire(p, m), q) ? m : null;
}
export { signeR, soustraireR, rat };

// ── Lecteur ──
class ErreurLecture extends Error {}

const MESSAGES = {
  vide: "Écris une expression.",
  longue: "Cette expression est trop longue.",
  parenthese: "Il manque une parenthèse.",
  valeurFin: "Il manque une valeur à la fin de l'expression.",
  valeurAvantFermante: "Il manque une valeur avant la parenthèse fermante.",
  lettre: "Seule la lettre x est admise comme inconnue.",
  operateur: "Il manque un opérateur (+, −, *, /) ou une parenthèse entre deux éléments.",
  exposant: `L'exposant doit être un entier positif (au plus ${EXPOSANT_MAX}), par exemple x^2.`,
  degre: `Cette expression a un degré trop élevé (au plus ${DEGRE_MAX}).`,
  division: "On ne peut diviser que par un nombre non nul (par exemple (x-1)^2/2).",
  decimales: "Ce nombre a trop de décimales.",
  decimal: "Un nombre décimal doit comporter au moins un chiffre.",
  trop: "Nombre trop grand pour le calcul exact.",
  prefixe: "Écris l'expression seule, ou précédée de f(x) =.",
  signe: "Un caractère de cette expression n'est pas reconnu : utilise des nombres, x, + − * / ^ et des parenthèses.",
};

const SUPERSCRIPT: Record<string, number> = { "²": 2, "³": 3, "⁴": 4 };

/**
 * CORPS d'une saisie : signes typographiques normalisés, espaces retirés, longueur bornée, préfixe facultatif « f(x)= », « y= », « E1(x)= » (un identifiant, `(x)` facultatif, puis UN signe égal)
 * retiré. Unique normalisation : `lirePolynome` et `lireFormeCanonique` passent toutes deux ici (jamais une seconde implémentation, RAPPORT §59).
 */
export function corpsDeSaisie(texte: string): { ok: true; corps: string } | { ok: false; message: string } {
  if (typeof texte !== "string") return { ok: false, message: MESSAGES.vide };
  let brut = texte.replace(/[−–—]/g, "-").replace(/[×·]/g, "*").replace(/\s+/g, "");
  if (brut === "") return { ok: false, message: MESSAGES.vide };
  if (brut.length > LONGUEUR_MAX) return { ok: false, message: MESSAGES.longue };
  const egal = brut.indexOf("=");
  if (egal >= 0) {
    // Noms de fonction admis : f, g, y, E (E1, E_2…). `x = 3` ou `a = 2` ne sont PAS des préfixes (équations) : refusés plutôt que lus comme la constante.
    if (!/^(?:[fgFG]|[yY]|[eE][0-9_]*)(\([xX]\))?=/.test(brut) || brut.indexOf("=", egal + 1) >= 0) return { ok: false, message: MESSAGES.prefixe };
    brut = brut.slice(egal + 1);
    if (brut === "") return { ok: false, message: MESSAGES.vide };
  }
  return { ok: true, corps: brut };
}

export function lirePolynome(texte: string): LecturePolynome {
  const normalise = corpsDeSaisie(texte);
  if (!normalise.ok) return { ok: false, message: normalise.message };
  const brut = normalise.corps;
  let i = 0;
  let profondeur = 0;
  const fin = (): boolean => i >= brut.length;
  const courant = (): string => brut.charAt(i);
  const estChiffre = (c: string): boolean => c >= "0" && c <= "9";
  const estX = (c: string): boolean => c === "x" || c === "X";

  function nombre(): Polynome {
    const debut = i;
    while (!fin() && estChiffre(courant())) i++;
    let entier = brut.slice(debut, i);
    let decimales = "";
    if (!fin() && (courant() === "." || courant() === ",")) {
      i++;
      const d0 = i;
      while (!fin() && estChiffre(courant())) i++;
      decimales = brut.slice(d0, i);
      if (entier === "" && decimales === "") throw new ErreurLecture(MESSAGES.decimal);
      if (decimales.length > DECIMALES_MAX) throw new ErreurLecture(MESSAGES.decimales);
    }
    if (entier === "") entier = "0";
    const n = Number(entier + decimales);
    if (!Number.isSafeInteger(n)) throw new DebordementExact();
    return constante(rat(n, 10 ** decimales.length));
  }

  function atome(): Polynome {
    if (fin()) throw new ErreurLecture(MESSAGES.valeurFin);
    const c = courant();
    if (c === ")") throw new ErreurLecture(MESSAGES.valeurAvantFermante);
    if (estChiffre(c) || c === "." || c === ",") return nombre();
    if (estX(c)) {
      i++;
      if (!fin() && /[A-Za-zÀ-ÿ_]/.test(courant())) throw new ErreurLecture(MESSAGES.lettre); // `xy`, `xx`
      return X;
    }
    if (c === "(") {
      if (++profondeur > PROFONDEUR_MAX) throw new ErreurLecture(MESSAGES.longue);
      i++;
      const v = expression();
      if (courant() !== ")") throw new ErreurLecture(MESSAGES.parenthese);
      i++;
      profondeur--;
      return v;
    }
    if (/[A-Za-zÀ-ÿ_]/.test(c)) throw new ErreurLecture(MESSAGES.lettre);
    throw new ErreurLecture(MESSAGES.signe);
  }

  function puissance(): Polynome {
    const base = atome();
    if (!fin() && Object.hasOwn(SUPERSCRIPT, courant())) {
      const e = SUPERSCRIPT[courant()] as number;
      i++;
      return elever(base, e);
    }
    if (!fin() && courant() === "^") {
      i++;
      let signeNeg = false;
      if (courant() === "-") {
        signeNeg = true;
        i++;
      } else if (courant() === "+") i++;
      const parenthese = courant() === "(";
      if (parenthese) i++;
      const d0 = i;
      while (!fin() && estChiffre(courant())) i++;
      if (i === d0) throw new ErreurLecture(MESSAGES.exposant);
      const e = Number(brut.slice(d0, i));
      if (parenthese) {
        if (courant() !== ")") throw new ErreurLecture(MESSAGES.parenthese);
        i++;
      }
      if (signeNeg || !Number.isSafeInteger(e) || e > EXPOSANT_MAX) throw new ErreurLecture(MESSAGES.exposant);
      return elever(base, e);
    }
    return base;
  }

  function elever(base: Polynome, e: number): Polynome {
    if (!estNul(base) && degre(base) * e > DEGRE_MAX) throw new ErreurLecture(MESSAGES.degre);
    return puissanceP(base, e);
  }

  function unaire(): Polynome {
    if (courant() === "-") {
      i++;
      return oppP(unaire());
    }
    if (courant() === "+") {
      i++;
      return unaire();
    }
    return puissance();
  }

  function terme(): Polynome {
    let v = unaire();
    for (;;) {
      if (fin()) break;
      const c = courant();
      if (c === "*") {
        i++;
        v = produit(v, unaire());
      } else if (c === "/") {
        i++;
        const diviseur = unaire();
        if (!estConstant(diviseur) || estNul(diviseur)) throw new ErreurLecture(MESSAGES.division);
        v = foisScalaire(v, diviserR(UN_R, coefficient(diviseur, 0)));
      } else if (estX(c) || c === "(") {
        v = produit(v, puissance()); // multiplication implicite : seulement devant `x` ou `(`
      } else if (estChiffre(c) || c === "." || c === ",") {
        throw new ErreurLecture(MESSAGES.operateur);
      } else break;
    }
    return v;
  }

  function produit(a: Polynome, b: Polynome): Polynome {
    if (!estNul(a) && !estNul(b) && degre(a) + degre(b) > DEGRE_MAX) throw new ErreurLecture(MESSAGES.degre);
    return foisP(a, b);
  }

  function expression(): Polynome {
    let v = terme();
    while (!fin() && (courant() === "+" || courant() === "-")) {
      const plus = courant() === "+";
      i++;
      const t = terme();
      v = plus ? plusP(v, t) : moinsP(v, t);
    }
    return v;
  }

  try {
    const polynome = expression();
    if (!fin()) {
      if (courant() === ")") throw new ErreurLecture(MESSAGES.parenthese);
      throw new ErreurLecture(estChiffre(courant()) || /[A-Za-zÀ-ÿ_]/.test(courant()) ? MESSAGES.operateur : MESSAGES.signe);
    }
    return { ok: true, polynome };
  } catch (e) {
    if (e instanceof ErreurLecture) return { ok: false, message: e.message };
    if (e instanceof DebordementExact) return { ok: false, message: MESSAGES.trop };
    throw e;
  }
}
