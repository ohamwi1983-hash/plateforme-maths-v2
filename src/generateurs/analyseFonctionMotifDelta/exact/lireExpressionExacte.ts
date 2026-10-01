import { DebordementExact, estEntierR, estZeroR, rat, signeR, type Rat } from "./rationnel";
import { DivisionNonRationnelle, diviser, estRationnel, estSansFacteurCarre, estZero, exactDepuisRat, exactRacine, fois, moins, oppose, partieRationnelle, plus, type Exact } from "./nombreExact";

/**
 * Lecteur de saisie EXACT de gen7 « motif / delta » (RAPPORT §49). Limité à ce générateur : seule la notation `sqrt(n)` existe (la notation générale
 * `rac`/`rac2`/… est un chantier séparé). Grammaire :
 *
 *     expr   := terme (('+' | '-') terme)*
 *     terme  := unaire (('*' | '/' | ε) unaire)*            ε = multiplication implicite : `2sqrt(2)`, `3(1+2)`, `(1)(2)`
 *     unaire := ('+' | '-') unaire | atome
 *     atome  := nombre | 'sqrt' '(' expr ')' | '(' expr ')'
 *     nombre := chiffres [('.' | ',') chiffres]              (décimal EXACT : `0,25` = 1/4 ; jamais d'écriture scientifique)
 *
 * Le signe moins typographique « − » (U+2212) et les espaces sont admis ; `sqrt` est insensible à la casse. Tout le reste est refusé avec un message.
 *  - `sqrt(n)` avec `n < 0` → refus pédagogique ; sous `sqrt`, il faut un RATIONNEL (pas de racine imbriquée).
 *  - Division par un nombre IRRATIONNEL → refus (hors périmètre : `3/sqrt(2)`) ; division par 0 → refus.
 *  - `nonSimplifie` : un `sqrt(k)` dont `k` n'est pas un entier SANS facteur carré ≥ 2 (`sqrt(8)`, `sqrt(12)`, `sqrt(4)`, `sqrt(1/4)`…). La VALEUR peut être juste :
 *    c'est au vérificateur d'en faire un `not_equivalent` avec `RACINE_NON_SIMPLIFIEE` (jamais un `parse_error`).
 * Aucune évaluation flottante : le résultat est un `Exact`.
 */
export type LectureExacte = { ok: true; valeur: Exact; nonSimplifie: boolean } | { ok: false; message: string };

const LONGUEUR_MAX = 120;
const PROFONDEUR_MAX = 20;
const DECIMALES_MAX = 9;

class ErreurLecture extends Error {}

/**
 * Un fragment de la saisie de l'élève recopié dans un message : les messages sont du texte d'AUTEUR (balisage `$…$` interprété), la saisie d'un élève JAMAIS. On échappe
 * donc `$` (`\$` = `$` littéral hors mathématiques), on retire les retours à la ligne et on tronque.
 */
function citer(fragment: string): string {
  const court = fragment.length > 24 ? `${fragment.slice(0, 24)}…` : fragment;
  return court.replace(/[\r\n]+/g, " ").replace(/\\/g, "").replace(/\$/g, "\\$");
}

const MESSAGE_VIDE = "Écris une valeur.";
const MESSAGE_TROP_LONG = "Cette expression est trop longue.";
const MESSAGE_PARENTHESE = "Il manque une parenthèse.";

export function lireExpressionExacte(texte: string): LectureExacte {
  const brut = texte.replace(/−/g, "-").replace(/\s+/g, "");
  if (brut === "") return { ok: false, message: MESSAGE_VIDE };
  if (brut.length > LONGUEUR_MAX) return { ok: false, message: MESSAGE_TROP_LONG };
  let i = 0;
  let nonSimplifie = false;
  let profondeur = 0;

  const fin = (): boolean => i >= brut.length;
  const courant = (): string => brut.charAt(i);
  const estChiffre = (c: string): boolean => c >= "0" && c <= "9";
  const debutAtome = (): boolean => {
    const c = courant();
    // Multiplication implicite : seulement devant un chiffre, une parenthèse ou `sqrt` (jamais devant un séparateur décimal : `1,2,3` n'est pas 1,2 × 0,3).
    return estChiffre(c) || c === "(" || /^sqrt/i.test(brut.slice(i, i + 4));
  };

  function nombre(): Exact {
    const debut = i;
    while (!fin() && estChiffre(courant())) i++;
    let entier = brut.slice(debut, i);
    let decimales = "";
    if (!fin() && (courant() === "." || courant() === ",")) {
      i++;
      const d0 = i;
      while (!fin() && estChiffre(courant())) i++;
      decimales = brut.slice(d0, i);
      if (entier === "" && decimales === "") throw new ErreurLecture("Un nombre décimal doit comporter au moins un chiffre.");
      if (decimales.length > DECIMALES_MAX) throw new ErreurLecture("Ce nombre a trop de décimales.");
    }
    if (entier === "") entier = "0";
    const chiffres = entier + decimales;
    const n = Number(chiffres);
    if (!Number.isSafeInteger(n)) throw new DebordementExact();
    return exactDepuisRat(rat(n, 10 ** decimales.length));
  }

  function appelSqrt(): Exact {
    i += 4; // « sqrt »
    if (courant() !== "(") throw new ErreurLecture("Après sqrt, ouvre une parenthèse : par exemple sqrt(2).");
    i++;
    const interieur = expression();
    if (courant() !== ")") throw new ErreurLecture(MESSAGE_PARENTHESE);
    i++;
    if (!estRationnel(interieur)) throw new ErreurLecture("Sous sqrt(…), écris un nombre (entier ou fraction), pas une autre racine.");
    const q: Rat = partieRationnelle(interieur);
    if (signeR(q) < 0) throw new ErreurLecture("La racine carrée d'un nombre négatif n'existe pas : vérifie ce qu'il y a sous sqrt(…).");
    if (!(estEntierR(q) && q.n >= 2 && estSansFacteurCarre(q.n))) nonSimplifie = true;
    if (estZeroR(q)) return exactDepuisRat(rat(0));
    return exactRacine(rat(1, q.d), q.n * q.d);
  }

  function atome(): Exact {
    if (fin()) throw new ErreurLecture("Il manque une valeur à la fin de l'expression.");
    const c = courant();
    if (c === ")") throw new ErreurLecture("Il manque une valeur avant la parenthèse fermante.");
    if (estChiffre(c) || c === "." || c === ",") return nombre();
    if (c === "(") {
      if (++profondeur > PROFONDEUR_MAX) throw new ErreurLecture(MESSAGE_TROP_LONG);
      i++;
      const v = expression();
      if (courant() !== ")") throw new ErreurLecture(MESSAGE_PARENTHESE);
      i++;
      profondeur--;
      return v;
    }
    if (/^sqrt/i.test(brut.slice(i, i + 4))) return appelSqrt();
    const mot = /^[A-Za-zÀ-ÿ_√]+/.exec(brut.slice(i))?.[0] ?? c;
    throw new ErreurLecture(`Je ne comprends pas « ${citer(mot)} » : pour une racine carrée, écris sqrt(2) ; sinon utilise des nombres, + − * / et des parenthèses.`);
  }

  function unaire(): Exact {
    if (courant() === "-") {
      i++;
      return oppose(unaire());
    }
    if (courant() === "+") {
      i++;
      return unaire();
    }
    return atome();
  }

  function terme(): Exact {
    let v = unaire();
    for (;;) {
      const c = courant();
      if (c === "*" || c === "·" || c === "×") {
        i++;
        v = fois(v, unaire());
      } else if (c === "/") {
        i++;
        const d = unaire();
        if (estZero(d)) throw new ErreurLecture("On ne peut pas diviser par zéro.");
        try {
          v = diviser(v, d);
        } catch (e) {
          if (e instanceof DivisionNonRationnelle) throw new ErreurLecture("Je ne sais pas diviser par une racine carrée : écris la valeur autrement (par exemple en multipliant en haut et en bas pour supprimer la racine du dénominateur).");
          throw e;
        }
      } else if (!fin() && debutAtome()) {
        v = fois(v, atome()); // multiplication implicite
      } else return v;
    }
  }

  function expression(): Exact {
    let v = terme();
    while (courant() === "+" || courant() === "-") {
      const op = courant();
      i++;
      const t = terme();
      v = op === "+" ? plus(v, t) : moins(v, t);
    }
    return v;
  }

  try {
    const valeur = expression();
    if (!fin()) {
      if (courant() === ")") throw new ErreurLecture("Il y a une parenthèse fermante en trop.");
      throw new ErreurLecture(`Je ne comprends pas « ${citer(brut.slice(i))} » dans ta réponse.`);
    }
    return { ok: true, valeur, nonSimplifie };
  } catch (e) {
    if (e instanceof ErreurLecture) return { ok: false, message: e.message };
    if (e instanceof DebordementExact) return { ok: false, message: "Ce nombre est trop grand." };
    throw e;
  }
}
