// Test permanent — lecteur de polynômes exacts de gen8 (RAPPORT §56) : `src/generateurs/fxDepuisGraphe/polynome.ts`. Par propriété (aller-retour, équivalence de formes,
// absence de flottant), cas limites et fuzz « ne lève jamais ». Lancer : `npm run test-polynome`. Sans réseau.

export {}; // module

import { creerPrng } from "../lib/prng";
import { coefficient, decalerP, degre, egalP, estNul, foisP, lirePolynome, plusP, rapportProportionnel, type Polynome } from "../src/generateurs/fxDepuisGraphe/polynome";
import { rat, egalR, type Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const poly = (...cs: [number, number?][]): Polynome => {
  const r = cs.map(([n, d]) => rat(n, d ?? 1));
  while (r.length > 0 && r[r.length - 1]!.n === 0) r.pop();
  return r;
};
const lire = (t: string): Polynome | null => {
  const l = lirePolynome(t);
  return l.ok ? l.polynome : null;
};
const egal = (t: string, attendu: Polynome): boolean => {
  const p = lire(t);
  return p !== null && egalP(p, attendu);
};
const refuse = (t: string): boolean => lirePolynome(t).ok === false;

// ── 1. Cas fixés (coefficients par degré croissant) ──
const cas: [string, Polynome][] = [
  ["x^2", poly([0], [0], [1])],
  ["x²", poly([0], [0], [1])],
  ["X^2", poly([0], [0], [1])],
  ["2x^2 - 4x + 5", poly([5], [-4], [2])],
  ["2x²−4x+5", poly([5], [-4], [2])],
  ["(x-2)^2", poly([4], [-4], [1])],
  ["3(x-2)^2+1", poly([13], [-12], [3])],
  ["-(x+1)^2+3", poly([2], [-2], [-1])],
  ["-x^2", poly([0], [0], [-1])],
  ["1/2(x-1)^2", poly([1, 2], [-1], [1, 2])],
  ["(1/2)(x-1)^2", poly([1, 2], [-1], [1, 2])],
  ["(x-1)^2/2", poly([1, 2], [-1], [1, 2])],
  ["0,25x^2", poly([0], [0], [1, 4])],
  ["0.5(x+2)^2-3", poly([-1], [2], [1, 2])],
  ["(x+1)(x-1)", poly([-1], [0], [1])],
  ["x(x+3)", poly([0], [3], [1])],
  ["2*x*x", poly([0], [0], [2])],
  ["2×(x−1)²", poly([2], [-4], [2])],
  ["f(x) = 2(x-3)^2+1", poly([19], [-12], [2])],
  ["y=x^2", poly([0], [0], [1])],
  ["E1(x)=(x-1)^2", poly([1], [-2], [1])],
  ["--x", poly([0], [1])],
  ["x--1", poly([1], [1])],
  ["2^3", poly([8])],
  ["x^2+x^2", poly([0], [0], [2])],
  ["x^2-x^2", poly()],
  ["0", poly()],
  ["x^0", poly([1])],
  ["x^(2)", poly([0], [0], [1])],
  ["(x^2)^2", poly([0], [0], [0], [0], [1])],
  ["0,1+0,2", poly([3, 10])],
  ["1/3+1/6", poly([1, 2])],
];
for (const [t, p] of cas) verifier(egal(t, p), `lecture « ${t} »`);

// ── 2. Refus pédagogiques (jamais une exception, jamais la saisie recopiée) ──
const refus = ["", "   ", "f(x)=", "x=3", "x = 3", "a=2", "f(x)=g(x)=2", "(x-1", "x-1)", "()", "x^", "x^-1", "x^9", "x^2.5", "x^y", "1/x", "1/(x-1)", "1/0", "x/0", "2x3", "x2", "(x+1)2",
  "xy", "xx", "y2", "a", "sqrt(2)", "2+", "*x", "x**2", "x^^2", "x^5", "(x+1)^5", "(x^2)^3", "x^2*x^3", "1,2,3", ",", ".", "1..2", "0,1234567891", "99999999999999999", "$", "x²²", "x^2^2", "é", "x@1"];
for (const t of refus) {
  let l;
  try {
    l = lirePolynome(t);
  } catch {
    verifier(false, `« ${t} » lève une exception`);
    continue;
  }
  verifier(l.ok === false && typeof l.message === "string" && l.message.length > 0, `refus de « ${t} »`);
}
verifier(refuse("x".repeat(121)) && refuse("(".repeat(40) + "x" + ")".repeat(40)), "saisie trop longue / trop profonde refusée");
for (const t of ["a$b", "x^__proto__", "constructor", "<script>"]) {
  const l = lirePolynome(t);
  verifier(l.ok === false && !l.message.includes(t), `le message n'echo pas la saisie : « ${t} »`);
}

// ── 3. Propriétés : aller-retour et équivalence de formes (indépendant du lecteur : imprimeur de test) ──
const prng = creerPrng(20260610);
const fraction = (r: Rat): string => (r.d === 1 ? `${r.n}` : `(${r.n}/${r.d})`);
const imprimerDeveloppe = (p: Polynome): string => (estNul(p) ? "0" : p.map((c, k) => `${fraction(c)}${k === 0 ? "" : k === 1 ? "*x" : `*x^${k}`}`).reverse().join("+"));
const aleatoireRat = (): Rat => rat(prng.entierEntre(-9, 9), prng.choisir([1, 1, 2, 3, 4, 5, 6]));
let essais = 0;
for (let k = 0; k < 400; k++) {
  const d = prng.entierEntre(0, 4);
  const p: Polynome = (() => {
    const cs = Array.from({ length: d + 1 }, aleatoireRat);
    while (cs.length > 0 && cs[cs.length - 1]!.n === 0) cs.pop();
    return cs;
  })();
  essais++;
  verifier(egal(imprimerDeveloppe(p), p), `aller-retour développé #${k}`);
}
// Forme canonique a(x−p)²+q <-> développée, pour a, p, q rationnels tirés.
for (let k = 0; k < 400; k++) {
  const a = aleatoireRat();
  if (a.n === 0) continue;
  const p0 = aleatoireRat();
  const q = aleatoireRat();
  const canonique = `${fraction(a)}*(x-${fraction(p0)})^2+${fraction(q)}`;
  const attendu = plusP(foisP(poly([a.n, a.d]), foisP([rat(-p0.n, p0.d), rat(1)], [rat(-p0.n, p0.d), rat(1)])), poly([q.n, q.d]));
  verifier(egal(canonique, attendu), `forme canonique ${canonique}`);
  // Même polynôme écrit autrement (multiplication implicite, signe moins typographique).
  const implicite = `${fraction(a)}(x−${fraction(p0)})²+${fraction(q)}`.replace(/\*/g, "");
  verifier(egal(implicite, attendu), `forme implicite ${implicite}`);
}
// Translation : p(x−h) puis p(x−h)(x+h)… = p ; et lecture de la forme translatée.
for (let k = 0; k < 200; k++) {
  const p = poly([prng.entierEntre(-5, 5)], [prng.entierEntre(-5, 5)], [prng.entierEntre(1, 5)]);
  const h = aleatoireRat();
  verifier(egalP(decalerP(decalerP(p, h), rat(-h.n, h.d)), p), `décalage aller-retour #${k}`);
  if (h.n !== 0) verifier(!egalP(decalerP(p, h), p), `décalage non trivial #${k}`);
}
verifier(egalP(decalerP(poly([0], [0], [1]), rat(3)), poly([9], [-6], [1])), "(x−3)² par décalage de x²");
// Proportionnalité.
verifier(JSON.stringify(rapportProportionnel(poly([1], [2], [1]), poly([3], [6], [3]))) === JSON.stringify(rat(3)) && rapportProportionnel(poly([1], [2], [1]), poly([3], [6], [4])) === null && rapportProportionnel([], poly([1])) === null, "rapport de proportionnalité");
verifier(degre(poly()) === -1 && degre(poly([5])) === 0 && coefficient(poly([0], [3]), 1).n === 3 && coefficient(poly([1]), 7).n === 0, "degré / coefficient");

// ── 4. Exactitude : aucun flottant ──
verifier(egal("0,1x+0,2x", poly([0], [3, 10])), "0,1x + 0,2x = (3/10)x exactement (en flottant : 0,30000000000000004)");
verifier(egalR(coefficient(lire("1/3x")!, 1), rat(1, 3)), "1/3·x : coefficient 1/3 exact");
verifier(refuse("99999999999*99999999999"), "dépassement des entiers sûrs refusé (jamais un résultat faux)");

// ── 5. Fuzz : ne lève JAMAIS ──
const alphabet = ["x", "X", "2", "3", "0", "1", ",", ".", "+", "-", "−", "*", "/", "^", "(", ")", "=", " ", "f", "y", "²", "³", "é", "$", "_", "9"];
let leves = 0;
for (let k = 0; k < 4000; k++) {
  const n = prng.entierEntre(0, 24);
  const t = Array.from({ length: n }, () => prng.choisir(alphabet)).join("");
  try {
    const l = lirePolynome(t);
    if (l.ok) verifier(l.polynome.every((c) => Number.isInteger(c.n) && c.d > 0), `fuzz : polynôme bien formé « ${t} »`);
  } catch {
    leves++;
  }
}
verifier(leves === 0, `fuzz : aucune exception sur 4000 saisies aléatoires (${leves})`);
verifier(essais === 400, "(sanité) 400 aller-retour");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (lecteur polynomial exact : cas fixés, refus, aller-retour, formes équivalentes, translation, exactitude, fuzz)`);
