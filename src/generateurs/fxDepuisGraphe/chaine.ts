import { DebordementExact, diviserR, egalR, multiplierR, oppR, rat, signeR, soustraireR, UN_R, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { coefficient, decalerP, degre, egalP, moinsP, puissanceP, rapportProportionnel, X, type Polynome } from "./polynome";
import { polynomeDe, type Parametres, type Transformation } from "./types";

/**
 * Règles de l'écran 2 « chaîne de transformations » (RAPPORT §57) : atteignabilité, ensemble de transformations ADMISES pour l'élève, longueur minimale, règles LOCALES d'une étape,
 * chaîne canonique. Aucune dépendance au contrat de générateur : fonctions pures sur des paramètres exacts `(a, p, q)` et des polynômes.
 *
 * Les cinq transformations agissent sur des coordonnées INDÉPENDANTES de `g = a(x − p)² + q` : TH sur `p`, TV sur `q`, EV | CV sur `|a|` (> 1 | < 1), SOX sur le signe de `a`. L'ensemble des
 * transformations NÉCESSAIRES pour atteindre `g` depuis `x²` est donc unique et exact.
 */
const abs = (r: Rat): Rat => (signeR(r) < 0 ? oppR(r) : r);

/** Transformations dont `g` ne peut pas se passer. */
export function necessaires(g: Parametres): Set<Transformation> {
  const s = new Set<Transformation>();
  if (signeR(g.p) !== 0) s.add("TH");
  if (signeR(g.q) !== 0) s.add("TV");
  const m = abs(g.a);
  if (m.n > m.d) s.add("EV");
  if (m.n < m.d) s.add("CV");
  if (signeR(g.a) < 0) s.add("SOX");
  return s;
}

/** `g = x²` : aucune transformation nécessaire, mais une chaîne a AU MOINS une étape et aucune étape seule ne ramène à `x²`. */
export const estXCarre = (g: Parametres): boolean => signeR(g.p) === 0 && signeR(g.q) === 0 && egalR(g.a, UN_R);

const REVERSIBLES: readonly Transformation[] = ["TH", "TV", "SOX"];

/**
 * Transformations ADMISES pour cet élève (décision du propriétaire, option 4) : la configuration du professeur, UNIE à ce que sa fonction confirmée exige structurellement. Un élève dont
 * l'écran 1 était faux n'est jamais bloqué par une transformation que SA fonction rend indispensable. Clause `x²` : sans transformation réversible (TH, TV, SOX) active, `x²` n'est
 * atteignable que par la paire EV puis CV (ou l'inverse) : on ajoute le complément manquant. Pour la VRAIE fonction, aucune extension (`necessaires(f) ⊆ actives` par construction).
 */
export function transformationsAdmises(actives: readonly Transformation[], g: Parametres): Set<Transformation> {
  const s = new Set<Transformation>(actives);
  for (const t of necessaires(g)) s.add(t);
  if (estXCarre(g) && !REVERSIBLES.some((t) => s.has(t))) {
    s.add("EV");
    s.add("CV");
  }
  return s;
}

/** Longueur de la plus courte chaîne qui atteint `g` : une étape par transformation nécessaire, deux pour `x²`. Plafond du crédit partiel (D5). */
export function longueurMinimale(g: Parametres): number {
  return estXCarre(g) ? 2 : necessaires(g).size;
}

export interface EtapeCanonique {
  transformation: Transformation;
  /** La fonction obtenue après cette étape. */
  apres: Parametres;
}

/**
 * Une chaîne valide (ordre TH, EV | CV, SOX, TV) de `x²` à `g`, n'utilisant que `admises`. Pour `x²` : la paire réversible disponible. `null` seulement si `admises` ne suffit pas (jamais pour
 * `transformationsAdmises`, vérifié par le test).
 */
export function chaineCanonique(g: Parametres, admises: ReadonlySet<Transformation>): EtapeCanonique[] | null {
  const un = rat(1);
  const zero = rat(0);
  if (estXCarre(g)) {
    const base: Parametres = { a: un, p: zero, q: zero };
    if (admises.has("TH")) return [{ transformation: "TH", apres: { ...base, p: un } }, { transformation: "TH", apres: base }];
    if (admises.has("TV")) return [{ transformation: "TV", apres: { ...base, q: un } }, { transformation: "TV", apres: base }];
    if (admises.has("SOX")) return [{ transformation: "SOX", apres: { ...base, a: rat(-1) } }, { transformation: "SOX", apres: base }];
    if (admises.has("EV") && admises.has("CV")) return [{ transformation: "EV", apres: { ...base, a: rat(2) } }, { transformation: "CV", apres: base }];
    return null;
  }
  const etapes: EtapeCanonique[] = [];
  let courant: Parametres = { a: un, p: zero, q: zero };
  const ajouter = (transformation: Transformation, apres: Parametres): void => {
    etapes.push({ transformation, apres });
    courant = apres;
  };
  for (const t of necessaires(g)) if (!admises.has(t)) return null;
  if (signeR(g.p) !== 0) ajouter("TH", { ...courant, p: g.p });
  const m = abs(g.a);
  if (m.n > m.d) ajouter("EV", { ...courant, a: m });
  else if (m.n < m.d) ajouter("CV", { ...courant, a: m });
  if (signeR(g.a) < 0) ajouter("SOX", { ...courant, a: oppR(courant.a) });
  if (signeR(g.q) !== 0) ajouter("TV", { ...courant, q: g.q });
  return etapes;
}

/**
 * Règle LOCALE d'une étape `E_{i-1} → E_i` pour la transformation CHOISIE (conception §3.4) :
 *  - `TH`  : `E_i(x) = E_{i-1}(x − h)`, `h ≠ 0` (`E_{i-1}` non constant : sur une constante la « translation » ne ferait rien) ;
 *  - `TV`  : `E_i − E_{i-1}` est une constante non nulle ;
 *  - `EV` / `CV` : `E_i = m·E_{i-1}` avec `m > 1` / `0 < m < 1` ; `SOX` : `m = −1` exactement.
 * Jamais d'exception : un dépassement d'entiers sûrs (saisie démesurée) rend l'étape fausse.
 */
export function etapeLocalementValide(transformation: Transformation, avant: Polynome, apres: Polynome): boolean {
  try {
    switch (transformation) {
      case "TH": {
        const n = degre(avant);
        if (n < 1 || degre(apres) !== n) return false;
        const h = diviserR(soustraireR(coefficient(avant, n - 1), coefficient(apres, n - 1)), multiplierR(rat(n), coefficient(avant, n)));
        return signeR(h) !== 0 && egalP(decalerP(avant, h), apres);
      }
      case "TV":
        return moinsP(apres, avant).length === 1;
      case "EV":
      case "CV":
      case "SOX": {
        const m = rapportProportionnel(avant, apres);
        if (m === null) return false;
        if (transformation === "SOX") return egalR(m, rat(-1));
        if (signeR(m) <= 0) return false;
        return transformation === "EV" ? m.n > m.d : m.n < m.d;
      }
    }
  } catch (e) {
    if (e instanceof DebordementExact) return false;
    throw e;
  }
}

/** `x²` : le point de départ de toute chaîne. */
export const POLYNOME_DEPART: Polynome = puissanceP(X, 2);

/** Polynôme de `g` (réexporté pour la vérification) ; peut lever `DebordementExact` si `g` est démesurée (le projeteur refuse alors la réponse). */
export const polynomeDeG = (g: Parametres): Polynome => polynomeDe(g);

