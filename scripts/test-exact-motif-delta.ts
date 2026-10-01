// Test permanent — calcul EXACT de gen7 « motif / delta » (RAPPORT §49) : rationnels, nombres Σ qᵣ√r, lecteur de saisie `sqrt`, formats, racines du second degré.
// Lancer : `npm run test-exact-motif-delta`. Pur (aucune base, aucun réseau) ; tirages par `creerPrng` (reproductibles).
//
// Six blocs :
//  1. ALGÈBRE par propriétés (milliers de tirages) : anneau, division par un rationnel, cohérence avec l'approximation flottante.
//  2. RACINES CARRÉES : (√N)² = N EXACTEMENT pour N = 1..3000 ; forme réduite (√8 → 2√2) ; radicandes sans facteur carré ; borne de dépassement.
//  3. LECTEUR : table de saisies acceptées (valeur, `nonSimplifie`) et refusées (message pédagogique) ; jamais d'exception.
//  4. ALLER-RETOUR : `texteSaisieExact` relu par `lireExpressionExacte` redonne le MÊME nombre, `nonSimplifie` faux.
//  5. FORMATS LaTeX : valeurs exactes attendues, y compris le signe sorti de la fraction.
//  6. SECOND DEGRÉ : pour toutes les formes exploitables, chaque racine annule f EXACTEMENT, nombre et ordre des racines justes ; formes inexploitables → `null`.

export {}; // module

import { creerPrng } from "../lib/prng";
import { rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";
import {
  approx,
  egaux,
  estRationnel,
  estSansFacteurCarre,
  evaluerPolynome,
  exactDepuisEntier,
  exactDepuisRat,
  exactRacine,
  extraireCarre,
  fois,
  foisRat,
  latexExact,
  moins,
  plus,
  racineCarreeRat,
  racinesDuSecondDegre,
  signe,
  texteSaisieExact,
  ZERO,
  diviser,
  type Exact,
} from "../src/generateurs/analyseFonctionMotifDelta/exact/nombreExact";
import { lireExpressionExacte } from "../src/generateurs/analyseFonctionMotifDelta/exact/lireExpressionExacte";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const RADICANDES = [2, 3, 5, 6, 7, 10, 11, 13];
const prng = creerPrng(20260930);
function exactAleatoire(): Exact {
  let x: Exact = ZERO;
  const nbTermes = prng.entierEntre(0, 3);
  for (let i = 0; i < nbTermes; i++) {
    const q = rat(prng.entierEntre(-9, 9), prng.entierEntre(1, 6));
    x = plus(x, prng.suivant() < 0.4 ? exactDepuisRat(q) : foisRat(exactRacine(rat(1), prng.choisir(RADICANDES)), q));
  }
  return x;
}
const proche = (a: number, b: number): boolean => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

// ── 1. Algèbre ──
for (let k = 0; k < 4000; k++) {
  const [x, y, z] = [exactAleatoire(), exactAleatoire(), exactAleatoire()];
  verifier(egaux(plus(x, y), plus(y, x)), "algèbre : + commutatif");
  verifier(egaux(fois(x, y), fois(y, x)), "algèbre : × commutatif");
  verifier(egaux(plus(plus(x, y), z), plus(x, plus(y, z))), "algèbre : + associatif");
  verifier(egaux(fois(fois(x, y), z), fois(x, fois(y, z))), "algèbre : × associatif");
  verifier(egaux(fois(x, plus(y, z)), plus(fois(x, y), fois(x, z))), "algèbre : distributivité");
  verifier(egaux(moins(plus(x, y), y), x), "algèbre : (x + y) − y = x");
  verifier(proche(approx(fois(x, y)), approx(x) * approx(y)), "algèbre : approximation de x·y cohérente avec le flottant");
  verifier(proche(approx(plus(x, y)), approx(x) + approx(y)), "algèbre : approximation de x+y cohérente");
  const q = rat(prng.choisir([-7, -3, -2, -1, 1, 2, 3, 5, 11]), prng.entierEntre(1, 5));
  verifier(egaux(foisRat(diviser(x, exactDepuisRat(q)), q), x), "algèbre : (x / q)·q = x pour un rationnel q ≠ 0");
  verifier(signe(x) === (x.size === 0 ? 0 : approx(x) > 0 ? 1 : -1), "signe cohérent avec l'approximation");
}
verifier(egaux(plus(exactRacine(rat(1), 2), exactRacine(rat(-1), 2)), ZERO), "√2 − √2 = 0 EXACTEMENT");
verifier(!egaux(exactRacine(rat(1), 2), exactDepuisRat(rat(1414213562, 1000000000))), "√2 ≠ une décimale, jamais");

// ── 2. Racines carrées ──
for (let N = 1; N <= 3000; N++) {
  const r = exactRacine(rat(1), N);
  verifier(egaux(fois(r, r), exactDepuisEntier(N)), `(√${N})² = ${N} exactement`);
  const [s, t] = extraireCarre(N);
  verifier(s * s * t === N && estSansFacteurCarre(t) || t === 1, `extraireCarre(${N}) = ${s}²·${t}`);
  for (const [cle] of r) verifier(cle === 1 || estSansFacteurCarre(cle), `forme canonique de √${N} : radicande ${cle} sans facteur carré`);
}
verifier(egaux(exactRacine(rat(1), 8), foisRat(exactRacine(rat(1), 2), rat(2))), "√8 = 2√2");
verifier(egaux(exactRacine(rat(1), 12), foisRat(exactRacine(rat(1), 3), rat(2))), "√12 = 2√3");
verifier(estRationnel(exactRacine(rat(1), 49)) && egaux(exactRacine(rat(1), 49), exactDepuisEntier(7)), "√49 = 7 (rationnel)");
verifier(egaux(racineCarreeRat(rat(9, 4)), exactDepuisRat(rat(3, 2))), "√(9/4) = 3/2");
verifier(egaux(racineCarreeRat(rat(1, 2)), foisRat(exactRacine(rat(1), 2), rat(1, 2))), "√(1/2) = √2/2");
let leve = false;
try {
  extraireCarre(1e13);
} catch {
  leve = true;
}
verifier(leve, "un radicande démesuré lève DebordementExact (jamais un résultat faux)");

// ── 3. Lecteur : saisies acceptées ──
const ACCEPTEES: [string, string, boolean][] = [
  // [saisie, valeur attendue (texteSaisieExact), nonSimplifie]
  ["3", "3", false],
  ["-3", "-3", false],
  ["−3", "-3", false],
  ["+3", "3", false],
  ["0", "0", false],
  ["0,5", "1/2", false],
  ["0.25", "1/4", false],
  [".5", "1/2", false],
  ["12,50", "25/2", false],
  ["1/2", "1/2", false],
  ["-9/4", "-9/4", false],
  ["4/2", "2", false],
  ["6/-3", "-2", false],
  ["sqrt(2)", "sqrt(2)", false],
  ["SQRT(2)", "sqrt(2)", false],
  ["Sqrt(5)", "sqrt(5)", false],
  ["-sqrt(3)", "-sqrt(3)", false],
  ["2sqrt(2)", "2sqrt(2)", false],
  ["2*sqrt(2)", "2sqrt(2)", false],
  ["sqrt(2)*2", "2sqrt(2)", false],
  ["2 sqrt( 2 )", "2sqrt(2)", false],
  ["-2sqrt(3)", "-2sqrt(3)", false],
  ["sqrt(2)/2", "sqrt(2)/2", false],
  ["1/2*sqrt(2)", "sqrt(2)/2", false],
  ["(3+sqrt(5))/4", "(3+sqrt(5))/4", false],
  ["3/4+sqrt(5)/4", "(3+sqrt(5))/4", false],
  ["(-3-sqrt(5))/4", "(-3-sqrt(5))/4", false],
  ["1-sqrt(2)", "1-sqrt(2)", false],
  ["-1+2sqrt(3)", "-1+2sqrt(3)", false],
  ["sqrt(2)+sqrt(3)", "sqrt(2)+sqrt(3)", false],
  ["sqrt(2)*sqrt(3)", "sqrt(6)", false],
  ["sqrt(6)", "sqrt(6)", false],
  ["sqrt(2*3)", "sqrt(6)", false],
  ["(1)(2)", "2", false],
  ["3(1+2)", "9", false],
  ["2(sqrt(2))", "2sqrt(2)", false],
  ["((2))", "2", false],
  ["-(-2)", "2", false],
  ["- -2", "2", false],
  // radicande non simplifié : la VALEUR est lue (c'est au vérificateur de conclure), l'indicateur est levé
  ["sqrt(8)", "2sqrt(2)", true],
  ["sqrt(12)", "2sqrt(3)", true],
  ["sqrt(4)", "2", true],
  ["sqrt(1)", "1", true],
  ["sqrt(0)", "0", true],
  ["sqrt(1/4)", "1/2", true],
  ["sqrt(1/2)", "sqrt(2)/2", true],
  ["3sqrt(8)", "6sqrt(2)", true],
  ["1+sqrt(18)", "1+3sqrt(2)", true],
];
for (const [saisie, attendu, nonSimp] of ACCEPTEES) {
  const l = lireExpressionExacte(saisie);
  if (!l.ok) {
    verifier(false, `lecteur : « ${saisie} » devait être lue (refusée : ${l.message})`);
    continue;
  }
  verifier(texteSaisieExact(l.valeur) === attendu, `lecteur : « ${saisie} » = ${attendu}, obtenu ${texteSaisieExact(l.valeur)}`);
  verifier(l.nonSimplifie === nonSimp, `lecteur : « ${saisie} » nonSimplifie = ${nonSimp}, obtenu ${l.nonSimplifie}`);
}

// ── 3 bis. Lecteur : saisies refusées (parse_error, message non vide, jamais d'exception) ──
const REFUSEES: [string, RegExp][] = [
  ["", /Écris une valeur/],
  ["   ", /Écris une valeur/],
  ["sqrt(-1)", /négatif/],
  ["sqrt(-4)", /négatif/],
  ["sqrt(2-5)", /négatif/],
  ["sqrt", /parenthèse/],
  ["sqrt 2", /parenthèse/],
  ["sqrt(2", /parenthèse/],
  ["sqrt()", /valeur/],
  ["2)", /parenthèse fermante/],
  ["(2", /parenthèse/],
  ["sqrt(sqrt(2))", /pas une autre racine/],
  ["sqrt(1+sqrt(2))", /pas une autre racine/],
  ["3/sqrt(2)", /diviser par une racine/],
  ["1/(1+sqrt(2))", /diviser par une racine/],
  ["1/0", /zéro/],
  ["3/(2-2)", /zéro/],
  ["x", /Je ne comprends pas/],
  ["2x", /Je ne comprends pas/],
  ["abc", /Je ne comprends pas/],
  ["racine(2)", /Je ne comprends pas/],
  ["√2", /Je ne comprends pas/],
  ["2e3", /Je ne comprends pas/],
  ["0x10", /Je ne comprends pas/],
  ["1,2,3", /Je ne comprends pas/],
  ["2^2", /Je ne comprends pas/],
  ["2+", /Il manque/],
  ["+", /Il manque/],
  ["*3", /Je ne comprends pas/],
  ["1234567890123456789", /trop grand/],
  ["0,1234567891", /décimales/],
  ["1".repeat(130), /trop longue/],
  ["(".repeat(30) + "1" + ")".repeat(30), /trop longue/],
];
for (const [saisie, motif] of REFUSEES) {
  let l;
  try {
    l = lireExpressionExacte(saisie);
  } catch (e) {
    verifier(false, `lecteur : « ${saisie.slice(0, 30)} » a LEVÉ une exception (${String(e)}) au lieu de renvoyer un refus`);
    continue;
  }
  verifier(!l.ok && motif.test(l.message) && l.message.length > 0, `lecteur : « ${saisie.slice(0, 30)} » refusée avec un message attendu ${String(motif)} (obtenu ${l.ok ? "acceptée" : l.message})`);
}
// Un fragment de la saisie recopié dans un message ne doit JAMAIS ouvrir un balisage mathématique : aucun « $ » non échappé.
for (const hostile of ["$x$", "a$b", "$$", "2$", "x$", "$sqrt(2)", "ab$cd$ef", "\\$", "$\\frac{1}{2}$"]) {
  const l = lireExpressionExacte(hostile);
  verifier(!l.ok && !/(^|[^\\])\$/.test(l.message), `lecteur : le message pour « ${hostile} » ne contient aucun « $ » non échappé (« ${l.ok ? "" : l.message} »)`);
}
for (let k = 0; k < 3000; k++) {
  const alphabet = "0123456789+-*/(),.sqrtSQRTx −";
  const n = prng.entierEntre(0, 14);
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet.charAt(prng.entierEntre(0, alphabet.length - 1));
  try {
    const l = lireExpressionExacte(s);
    verifier(l.ok || l.message.length > 0, `lecteur (aléatoire) : refus sans message pour « ${s} »`);
  } catch (e) {
    verifier(false, `lecteur (aléatoire) : exception pour « ${s} » : ${String(e)}`);
  }
}

// ── 4. Aller-retour saisie ──
for (let k = 0; k < 4000; k++) {
  const x = exactAleatoire();
  const t = texteSaisieExact(x);
  const l = lireExpressionExacte(t);
  verifier(l.ok && egaux(l.valeur, x) && !l.nonSimplifie, `aller-retour : « ${t} » relu comme le même nombre`);
}

// ── 5. Formats LaTeX ──
const LATEX: [Exact, string][] = [
  [exactDepuisEntier(3), "3"],
  [exactDepuisEntier(-3), "-3"],
  [ZERO, "0"],
  [exactDepuisRat(rat(-9, 4)), "-\\dfrac{9}{4}"],
  [exactDepuisRat(rat(5, 2)), "\\dfrac{5}{2}"],
  [exactRacine(rat(1), 2), "\\sqrt{2}"],
  [exactRacine(rat(-1), 2), "-\\sqrt{2}"],
  [foisRat(exactRacine(rat(1), 2), rat(-2)), "-2\\sqrt{2}"],
  [foisRat(exactRacine(rat(1), 5), rat(1, 2)), "\\dfrac{\\sqrt{5}}{2}"],
  [foisRat(exactRacine(rat(1), 5), rat(-3, 2)), "-\\dfrac{3\\sqrt{5}}{2}"],
  [plus(exactDepuisEntier(3), exactRacine(rat(1), 5)), "3+\\sqrt{5}"],
  [moins(exactDepuisEntier(3), exactRacine(rat(1), 5)), "3-\\sqrt{5}"],
  [foisRat(plus(exactDepuisEntier(3), exactRacine(rat(1), 5)), rat(1, 4)), "\\dfrac{3+\\sqrt{5}}{4}"],
  [foisRat(plus(exactDepuisEntier(-3), foisRat(exactRacine(rat(1), 5), rat(-1))), rat(1, 4)), "\\dfrac{-3-\\sqrt{5}}{4}"],
  [plus(exactRacine(rat(1), 2), exactRacine(rat(1), 3)), "\\sqrt{2}+\\sqrt{3}"],
  [plus(exactDepuisRat(rat(1, 2)), foisRat(exactRacine(rat(1), 2), rat(-1, 3))), "\\dfrac{3-2\\sqrt{2}}{6}"],
];
for (const [x, attendu] of LATEX) verifier(latexExact(x) === attendu, `LaTeX : attendu ${attendu}, obtenu ${latexExact(x)}`);

// ── 6. Second degré ──
const exploitables = [-4, -3, -2, -1, 1, 2, 3, 4];
let nbCas = 0;
for (const a of exploitables) {
  for (const cNum of [-12, -6, -3, -1, 0, 1, 2, 5, 9, 16]) {
    const formesB: Exact[] = [ZERO, exactDepuisEntier(-6), exactDepuisEntier(5), exactDepuisRat(rat(1, 2))];
    for (const n of [2, 3, 5]) for (const q of [-3, -1, 1, 2]) formesB.push(foisRat(exactRacine(rat(1), n), rat(q)));
    for (const b of formesB) {
      const r = racinesDuSecondDegre(rat(a), b, rat(cNum));
      nbCas++;
      if (r === null) {
        verifier(false, `racines : a=${a} b=${texteSaisieExact(b)} c=${cNum} devait être exploitable`);
        continue;
      }
      const delta = moins(fois(b, b), exactDepuisEntier(4 * a * cNum));
      verifier(estRationnel(delta), "Δ rationnel pour b = q√n");
      const attendu = signe(delta) < 0 ? 0 : signe(delta) === 0 ? 1 : 2;
      verifier(r.racines.length === attendu && r.double === (attendu === 1), `racines : a=${a} b=${texteSaisieExact(b)} c=${cNum} : ${attendu} racine(s) attendue(s), obtenu ${r.racines.length}`);
      for (const x of r.racines) verifier(egaux(evaluerPolynome(exactDepuisEntier(a), b, exactDepuisEntier(cNum), x), ZERO), `racines : ${latexExact(x)} annule f EXACTEMENT (a=${a}, b=${texteSaisieExact(b)}, c=${cNum})`);
      if (r.racines.length === 2) verifier(signe(moins(r.racines[1] as Exact, r.racines[0] as Exact)) > 0, "racines triées par ordre croissant");
    }
  }
}
verifier(racinesDuSecondDegre(rat(1), plus(exactDepuisEntier(1), exactRacine(rat(1), 2)), rat(1)) === null, "b = 1 + √2 : inexploitable (radicaux imbriqués) → null");
verifier(racinesDuSecondDegre(rat(1), plus(exactRacine(rat(1), 2), exactRacine(rat(1), 3)), rat(1)) === null, "b = √2 + √3 : inexploitable → null");
verifier(nbCas > 1000, `second degré : ${nbCas} cas exploités`);

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (algèbre exacte, racines carrées, lecteur sqrt, aller-retour, LaTeX, second degré exact)`);
