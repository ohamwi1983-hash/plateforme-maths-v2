// Test permanent — GÉNÉRATION de gen7 « motif / delta » (RAPPORT §49) : les dix sous-variantes, par PROPRIÉTÉS, EXHAUSTIVEMENT sur chaque pool.
// Lancer : `npm run test-generation-motif-delta`. Pur (aucune base, aucun réseau).
//
// Blocs :
//  A. EXHAUSTIF : chaque élément de chaque pool vérifie les invariants de sa famille (nature des racines, b / c nuls ou non, irrationalité, Δ, |c| ≤ 100, coefficients
//     entiers, a ∈ ±1..4, radicandes sans facteur carré) ; chaque racine annule f EXACTEMENT ; pas de doublon dans un pool.
//  B. COMPLEXES CONJUGUÉS INVISIBLES : le développement `a(x − z)(x − z̄)` refait ICI, en arithmétique complexe rationnelle INDÉPENDANTE, redonne exactement `b` et `c`.
//  C. GRAINES : 20 000 graines par famille → un élément du pool, déterministe, JSON pur, ordre des termes jamais canonique, termes nuls absents, jamais `1x` ni `1x²`.
//  D. COUVERTURE : sur 400 000 tirages chaque élément de chaque pool est atteint.
//  E. ÉPINGLAGE (règle `_v2`) : table graine → exercice figée à la première livraison.

export {}; // module

import { creerPrng } from "../lib/prng";
import { FAMILLES, RADICANDES, VALEURS_A, C_ABS_MAX, developperConjugues } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { genererExerciceMD, poolDe, PERMUTATIONS_NON_CANONIQUES } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { coefVersExact, fonctionVraie, type ExerciceMotifDelta, type FamilleId } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { latexPolynomeMD } from "../src/generateurs/analyseFonctionMotifDelta/formatage";
import { rat, type Rat, ajouterR, multiplierR, oppR, egalR } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";
import { egaux, estRationnel, estSansFacteurCarre, estZero, evaluerPolynome, exactDepuisEntier, moins, fois, signe, latexExact, radicandes, oppose } from "../src/generateurs/analyseFonctionMotifDelta/exact/nombreExact";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 60) echecs.push(message);
  else if (!condition) nb += 0;
}

const ENTIER = (x: number): boolean => Number.isInteger(x);

// ── A. Exhaustif ──
for (const fam of FAMILLES) {
  const pool = poolDe(fam);
  const vus = new Set<string>();
  const e = (m: string): string => `${fam.numero} ${fam.id} : ${m}`;
  verifier(pool.length >= 30, e(`pool de ${pool.length} exercices (≥ 30 attendus)`));
  for (const { a, b, c } of pool) {
    const cle = JSON.stringify([a, b, c]);
    verifier(!vus.has(cle), e(`doublon dans le pool : ${cle}`));
    vus.add(cle);
    const f = fonctionVraie({ a, b, c });
    const [A, B, C] = [a.n, coefVersExact(b), c.n];
    const ctx = e(`a=${A} b=${latexExact(B)} c=${C}`);
    verifier(a.d === 1 && a.rad === 1 && VALEURS_A.includes(a.n), ctx + " : a entier de ±1..4");
    verifier(c.d === 1 && c.rad === 1 && ENTIER(c.n) && Math.abs(c.n) <= C_ABS_MAX, ctx + " : c entier, |c| ≤ 100");
    verifier(b.d === 1 && ENTIER(b.n) && (b.rad === 1 || (RADICANDES.includes(b.rad) && estSansFacteurCarre(b.rad))), ctx + " : b entier ou entier·√n, n sans facteur carré dans les radicandes simples");
    const delta = moins(fois(B, B), exactDepuisEntier(4 * A * C));
    verifier(estRationnel(delta), ctx + " : Δ rationnel");
    for (const x of f.racines) verifier(egaux(evaluerPolynome(exactDepuisEntier(A), B, exactDepuisEntier(C), x), exactDepuisEntier(0)), ctx + ` : la racine ${latexExact(x)} annule f EXACTEMENT`);
    const [bNul, cNul] = [estZero(B), C === 0];
    const racRationnelle = (x: typeof f.xS): boolean => estRationnel(x);
    switch (fam.id) {
      case "af_motif_aucune_racine":
        verifier(bNul && !cNul && signe(delta) < 0 && f.racines.length === 0 && A * C > 0, ctx + " : b=0, c du signe de a, Δ<0, aucune racine");
        verifier(egaux(f.xS, exactDepuisEntier(0)) && egaux(f.yS, exactDepuisEntier(C)), ctx + " : xS=0, yS=c");
        break;
      case "af_motif_racine_double_rationnelle":
        verifier(!bNul && estZero(delta) && f.double && f.racines.length === 1 && racRationnelle(f.racines[0] as typeof B) && !estZero(f.racines[0] as typeof B), ctx + " : racine double rationnelle non nulle");
        verifier(egaux(f.yS, exactDepuisEntier(0)) && egaux(f.xS, f.racines[0] as typeof B), ctx + " : sommet sur la racine");
        break;
      case "af_motif_racine_double_irrationnelle":
        verifier(estZero(delta) && f.double && !racRationnelle(f.racines[0] as typeof B), ctx + " : racine double irrationnelle");
        verifier(!estRationnel(B) && estRationnel(exactDepuisEntier(C)) && !racRationnelle(f.xS) && egaux(f.yS, exactDepuisEntier(0)), ctx + " : b irrationnel, xS irrationnel, yS=0");
        break;
      case "af_motif_racines_opposees_rationnelles":
        verifier(bNul && signe(delta) > 0 && f.racines.length === 2 && f.racines.every((x) => racRationnelle(x) && !estZero(x)) && egaux(oppose(f.racines[0] as typeof B), f.racines[1] as typeof B), ctx + " : b=0, deux racines opposées rationnelles non nulles");
        break;
      case "af_motif_racines_opposees_irrationnelles":
        verifier(bNul && f.racines.length === 2 && f.racines.every((x) => !racRationnelle(x)) && egaux(oppose(f.racines[0] as typeof B), f.racines[1] as typeof B), ctx + " : b=0, deux racines opposées irrationnelles");
        break;
      case "af_motif_racine_nulle_rationnelle":
        verifier(cNul && !bNul && f.racines.length === 2 && f.racines.some(estZero) && f.racines.every(racRationnelle), ctx + " : c=0, racines 0 et r rationnelle ≠ 0");
        break;
      case "af_motif_racine_nulle_irrationnelle":
        verifier(cNul && !estRationnel(B) && f.racines.length === 2 && f.racines.some(estZero) && f.racines.some((x) => !racRationnelle(x)), ctx + " : c=0, racines 0 et irrationnelle");
        verifier(!racRationnelle(f.xS) && racRationnelle(f.yS) && !estZero(f.yS), ctx + " : xS irrationnel, yS RATIONNEL non nul");
        break;
      case "af_delta_aucune_racine":
        verifier(!bNul && signe(delta) < 0 && f.racines.length === 0, ctx + " : b≠0, Δ<0, aucune racine");
        break;
      case "af_delta_racines_rationnelles": {
        const [r1, r2] = f.racines as [typeof B, typeof B];
        verifier(!bNul && !cNul && f.racines.length === 2 && racRationnelle(r1) && racRationnelle(r2) && !estZero(r1) && !estZero(r2) && !egaux(r1, oppose(r2)) && signe(moins(r2, r1)) > 0, ctx + " : deux racines rationnelles distinctes, non nulles, non opposées");
        break;
      }
      case "af_delta_racines_irrationnelles": {
        const [r1, r2] = f.racines as [typeof B, typeof B];
        verifier(!bNul && !cNul && estRationnel(B) && f.racines.length === 2 && !racRationnelle(r1) && !racRationnelle(r2) && !estZero(r1) && !estZero(r2) && !egaux(r1, oppose(r2)), ctx + " : deux racines irrationnelles distinctes, non nulles, non opposées, b rationnel");
        const radsDelta = radicandes(f.racines[0] as typeof B);
        verifier(radsDelta.length === 1 && estSansFacteurCarre(radsDelta[0] as number), ctx + " : racines p ± m√n avec n sans facteur carré");
        break;
      }
    }
  }
}

// ── B. Complexes conjugués invisibles : développement INDÉPENDANT en arithmétique complexe rationnelle ──
type Cx = { re: Rat; im: Rat };
const cx = (re: Rat, im: Rat): Cx => ({ re, im });
const cMul = (x: Cx, y: Cx): Cx => cx(ajouterR(multiplierR(x.re, y.re), oppR(multiplierR(x.im, y.im))), ajouterR(multiplierR(x.re, y.im), multiplierR(x.im, y.re)));
const cAdd = (x: Cx, y: Cx): Cx => cx(ajouterR(x.re, y.re), ajouterR(x.im, y.im));
let nbConjugues = 0;
for (const a of VALEURS_A) {
  for (const k of [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]) {
    for (const q of [1, 2, 3]) {
      const p = rat(k, 2);
      const z = cx(p, rat(q));
      const zbarre = cx(p, rat(-q));
      // (x − z)(x − z̄) = x² − (z + z̄)x + z·z̄
      const somme = cAdd(z, zbarre);
      const produit = cMul(z, zbarre);
      verifier(egalR(somme.im, rat(0)) && egalR(produit.im, rat(0)), `conjugués : z+z̄ et z·z̄ réels (a=${a}, p=${k}/2, q=${q})`);
      const bAttendu = oppR(multiplierR(rat(a), somme.re));
      const cAttendu = multiplierR(rat(a), produit.re);
      const d = developperConjugues(a, { n: k, d: 2 }, q);
      if (bAttendu.d === 1 && cAttendu.d === 1) {
        verifier(d !== null && d.b === bAttendu.n && d.c === cAttendu.n, `conjugués : développement de a(x − z)(x − z̄) (a=${a}, p=${k}/2, q=${q}) = (${bAttendu.n}, ${cAttendu.n}), obtenu ${JSON.stringify(d)}`);
        nbConjugues++;
      } else verifier(d === null, `conjugués : coefficients non entiers → écartés (a=${a}, p=${k}/2, q=${q})`);
    }
  }
}
verifier(nbConjugues > 100, `conjugués : ${nbConjugues} développements vérifiés`);

// ── C. Graines ──
const prng = creerPrng(987654321);
for (const fam of FAMILLES) {
  const pool = poolDe(fam);
  const poolCles = new Set(pool.map((p) => JSON.stringify([p.a, p.b, p.c])));
  for (let k = 0; k < 20000; k++) {
    const graine = k < 5 ? k : prng.entierEntre(0, 2 ** 32 - 1);
    const ex = genererExerciceMD(fam.id, graine);
    const ctx = `${fam.numero} graine ${graine}`;
    verifier(poolCles.has(JSON.stringify([ex.a, ex.b, ex.c])), `${ctx} : l'exercice appartient au pool`);
    verifier(JSON.stringify(genererExerciceMD(fam.id, graine)) === JSON.stringify(ex), `${ctx} : déterministe`);
    verifier(JSON.stringify(JSON.parse(JSON.stringify(ex))) === JSON.stringify(ex), `${ctx} : JSON pur (aller-retour exact)`);
    const attendus = (["a", "b", "c"] as const).filter((t) => t === "a" || coefVersExact(ex[t]).size > 0);
    verifier([...ex.ordreTermes].sort().join() === [...attendus].sort().join(), `${ctx} : l'ordre contient exactement les termes non nuls (${ex.ordreTermes.join()})`);
    verifier(ex.ordreTermes.join() !== "a,b,c" && ex.ordreTermes.join() !== "a,b" && ex.ordreTermes.join() !== "a,c", `${ctx} : jamais l'ordre canonique (${ex.ordreTermes.join()})`);
    if (attendus.length === 2) verifier(ex.ordreTermes.join() === `${attendus[1]},a`, `${ctx} : deux termes → l'unique ordre non canonique`);
    else verifier(PERMUTATIONS_NON_CANONIQUES.some((p) => p.join() === ex.ordreTermes.join()), `${ctx} : trois termes → une permutation non canonique`);
    const latex = latexPolynomeMD(ex, ex.ordreTermes);
    verifier(!/(^|[^0-9.}])1x/.test(latex), `${ctx} : jamais « 1x » (${latex})`);
    verifier(!/(^|[^0-9.}])1x\^2/.test(latex), `${ctx} : jamais « 1x² » (${latex})`);
    verifier(!/(^|[ +-])0x/.test(latex) && !/[+-] 0$/.test(latex) && !/^0/.test(latex), `${ctx} : aucun terme nul affiché (${latex})`);
    verifier(!latex.includes("sqrt(") && !latex.includes("√"), `${ctx} : jamais « sqrt(… » ni « √ » en clair dans un texte servi (${latex})`);
  }
}

// ── D. Couverture ──
for (const fam of FAMILLES) {
  const pool = poolDe(fam);
  const atteints = new Set<string>();
  const p = creerPrng(31415926);
  const N = 400000;
  for (let k = 0; k < N && atteints.size < pool.length; k++) {
    const ex = genererExerciceMD(fam.id, p.entierEntre(0, 2 ** 32 - 1));
    atteints.add(JSON.stringify([ex.a, ex.b, ex.c]));
  }
  verifier(atteints.size === pool.length, `${fam.numero} : ${atteints.size}/${pool.length} exercices atteints par les graines`);
}

// ── E. Épinglage (règle `_v2`) : graine → exercice, figé à la première livraison ──
const GRAINES = [0, 1, 12345, 987654321, 4294967295];
const ECRIRE = process.argv.includes("--ecrire");
const instantane: Record<string, string[]> = {};
for (const fam of FAMILLES) {
  instantane[fam.id] = GRAINES.map((g) => {
    const ex: ExerciceMotifDelta = genererExerciceMD(fam.id, g);
    return latexPolynomeMD(ex, ex.ordreTermes);
  });
}
if (ECRIRE) {
  console.log(JSON.stringify(instantane, null, 2));
  process.exit(0);
}
const EPINGLE: Record<FamilleId, string[]> = JSON.parse(require("node:fs").readFileSync(require("node:path").join(__dirname, "support/epinglage-motif-delta.json"), "utf8"));
for (const fam of FAMILLES) {
  for (const [i, g] of GRAINES.entries()) verifier(instantane[fam.id]![i] === EPINGLE[fam.id]![i], `ÉPINGLAGE ${fam.id} graine ${g} : attendu « ${EPINGLE[fam.id]![i]} », obtenu « ${instantane[fam.id]![i]} » (toute modification impose un nouveau variante_id)`);
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length}+ vérification(s) en échec sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
const tailles = FAMILLES.map((f) => `${f.numero}:${poolDe(f).length}`).join(" ");
console.log(`OK : ${nb} vérifications (pools exhaustifs ${tailles}, complexes conjugués, 20 000 graines par famille, couverture, épinglage)`);
