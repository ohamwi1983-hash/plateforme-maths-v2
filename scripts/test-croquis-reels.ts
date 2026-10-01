// Test permanent — croquis de parabole à coefficients RÉELS et croquis d'allure à « position du sommet » (RAPPORT §49).
// Lancer : `npm run test-croquis-reels`. Pur : seules les fonctions sans DOM de `public/moteur/croquis.js` (le dessin SVG lui-même est mesuré en Chromium).
//
//  1. NON-RÉGRESSION EXHAUSTIVE : copie GELÉE de l'ancien `racinesParabole` / `etiquetteFraction` (coefficients entiers) comparée à la version actuelle sur une grille de
//     coefficients entiers (a, b, c ∈ [−12, 12], a ≠ 0) : zéro divergence exigée.
//  2. Coefficients RÉELS : Δ = 0 décidé à la tolérance relative (racine double d'une fonction à b irrationnel), Δ < 0 → aucune racine, racines décimales sinon.
//  3. Libellés : pas de `NaN`, pas de longues décimales ; description lisible.
//  4. Allure : la position du sommet, déduite de `signeAB` (a·b > 0 : à gauche) ou donnée directement, avec le MÊME résultat ; description.

export {}; // module

import { descriptionCroquisAllure, descriptionCroquisParabole, etiquetteFraction, positionDuSommet, racinesParabole } from "./support/croquis";
import { FAMILLES } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { poolDe } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { fonctionVraie } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { approx } from "../src/generateurs/analyseFonctionMotifDelta/exact/nombreExact";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

// ── Copie GELÉE de l'ancienne version (avant RAPPORT §49) : ne jamais la modifier ──
function pgcdGele(x: number, y: number): number {
  let a = Math.abs(x);
  let b = Math.abs(y);
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}
function fractionGelee(numerateur: number, denominateur: number): string {
  let n = numerateur;
  let d = denominateur;
  if (d < 0) [n, d] = [-n, -d];
  const g = pgcdGele(n, d);
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}
const decimaleGelee = (v: number): string => String(Math.round(v * 100) / 100).replace(".", ",");
function racinesGelees(a: number, b: number, c: number): { valeur: number; etiquette: string }[] | null {
  const delta = b * b - 4 * a * c;
  if (delta < 0) return null;
  const den = 2 * a;
  if (delta === 0) return [{ valeur: -b / den, etiquette: fractionGelee(-b, den) }];
  const s = Math.round(Math.sqrt(delta));
  const exact = s * s === delta;
  const brutes = [(-b - Math.sqrt(delta)) / den, (-b + Math.sqrt(delta)) / den].sort((x, y) => x - y);
  if (exact) {
    const [n1, n2] = [-b - s, -b + s].sort((x, y) => x / den - y / den);
    return [
      { valeur: brutes[0] as number, etiquette: fractionGelee(n1 as number, den) },
      { valeur: brutes[1] as number, etiquette: fractionGelee(n2 as number, den) },
    ];
  }
  return brutes.map((v) => ({ valeur: v, etiquette: decimaleGelee(v) }));
}

// ── 1. Non-régression exhaustive (entiers) ──
let nbGrille = 0;
for (let a = -12; a <= 12; a++) {
  if (a === 0) continue;
  for (let b = -12; b <= 12; b++) {
    for (let c = -12; c <= 12; c++) {
      verifier(JSON.stringify(racinesParabole(a, b, c)) === JSON.stringify(racinesGelees(a, b, c)), `entiers : racinesParabole(${a}, ${b}, ${c}) diverge de l'ancienne version`);
      nbGrille++;
    }
  }
}
for (let n = -30; n <= 30; n++) for (let d = -12; d <= 12; d++) if (d !== 0) verifier(etiquetteFraction(n, d) === fractionGelee(n, d), `entiers : etiquetteFraction(${n}, ${d}) diverge`);

// ── 2. Coefficients réels (cas choisis) ──
const R2 = Math.sqrt(2);
const R3 = Math.sqrt(3);
const doubleIrrationnelle = racinesParabole(1, -2 * R3, 3); // (x − √3)² : Δ = 0 EXACTEMENT, mais un flottant à ~1e-15 près
verifier(doubleIrrationnelle !== null && doubleIrrationnelle.length === 1 && Math.abs((doubleIrrationnelle[0] as { valeur: number }).valeur - R3) < 1e-12, "réels : racine double irrationnelle reconnue (Δ ≈ 0 à la tolérance)");
verifier(doubleIrrationnelle !== null && (doubleIrrationnelle[0] as { etiquette: string }).etiquette === "1,73", "réels : étiquette décimale de √3 = « 1,73 »");
const opposees = racinesParabole(1, 0, -5); // Δ = 20, pas un carré parfait
verifier(opposees !== null && opposees.length === 2 && opposees[0]!.etiquette === "-2,24" && opposees[1]!.etiquette === "2,24", "réels : racines ±√5 → « -2,24 ; 2,24 »");
const nulleIrrationnelle = racinesParabole(1, -R2, 0);
verifier(nulleIrrationnelle !== null && nulleIrrationnelle.length === 2 && nulleIrrationnelle[0]!.etiquette === "0" && nulleIrrationnelle[1]!.etiquette === "1,41", "réels : racines 0 et √2 → « 0 ; 1,41 »");
verifier(racinesParabole(1, -2 * R2, 3) === null, "réels : x² − 2√2 x + 3, Δ = 8 − 12 < 0 → aucune racine");
const deux = racinesParabole(1, -2 * R2, 1); // Δ = 8 − 4 = 4 : racines √2 ± 1
verifier(deux !== null && deux.length === 2 && deux[0]!.etiquette === "0,41" && deux[1]!.etiquette === "2,41", "réels : racines √2 ± 1 → « 0,41 ; 2,41 »");

// ── 2 bis. TOUS les exercices des dix pools : le nombre de racines dessinées = le nombre exact, et les valeurs concordent ──
let nbPool = 0;
for (const fam of FAMILLES) {
  for (const { a, b, c } of poolDe(fam)) {
    const f = fonctionVraie({ a, b, c });
    const [A, B, C] = [a.n, (b.rad === 1 ? 1 : Math.sqrt(b.rad)) * b.n, c.n];
    const dessinees = racinesParabole(A, B, C);
    const attendu = f.racines.map((x) => approx(x));
    verifier((dessinees === null ? 0 : dessinees.length) === attendu.length, `pool ${fam.numero} (a=${A}, b=${B}, c=${C}) : ${attendu.length} racine(s) exacte(s), ${dessinees === null ? 0 : dessinees.length} dessinée(s)`);
    if (dessinees !== null && dessinees.length === attendu.length) dessinees.forEach((r, i) => verifier(Math.abs(r.valeur - (attendu[i] as number)) < 1e-9, `pool ${fam.numero} : racine ${i} dessinée ${r.valeur}, exacte ${attendu[i]}`));
    nbPool++;
  }
}

// ── 3. Libellés ──
for (const [a, b, c] of [[1, -2 * R3, 3], [2, R2, -1], [-3, 0.5, 4.25], [1, 2.8284271247461903, 3.5]] as [number, number, number][]) {
  const d = descriptionCroquisParabole({ a, b, c });
  verifier(!d.includes("NaN") && !/\d\.\d{3,}/.test(d) && d.includes("x²"), `description sans NaN ni longue décimale : « ${d} »`);
  for (const r of racinesParabole(a, b, c) ?? []) verifier(!r.etiquette.includes("NaN") && r.etiquette.length <= 8, `étiquette de racine lisible : « ${r.etiquette} »`);
}
verifier(descriptionCroquisParabole({ a: 1, b: -8, c: 16 }) === "Croquis de la parabole d'équation y = x² − 8x + 16, ouverte vers le haut.", "description d'une parabole à coefficients entiers INCHANGÉE");
verifier(descriptionCroquisParabole({ a: -2, b: 0, c: 3 }) === "Croquis de la parabole d'équation y = -2x² + 3, ouverte vers le bas.", "description (a négatif) INCHANGÉE");

// ── 4. Allure : position du sommet ──
verifier(positionDuSommet("+", null) === "gauche" && positionDuSommet("-", null) === "droite" && positionDuSommet("0", null) === "axe" && positionDuSommet(null, null) === null, "position déduite de signeAB : + → gauche, − → droite, 0 → axe");
verifier(positionDuSommet(null, "gauche") === "gauche" && positionDuSommet(null, "axe") === "axe" && positionDuSommet(null, "droite") === "droite", "position donnée directement");
verifier(positionDuSommet("+", "droite") === "droite" && positionDuSommet(null, "n'importe quoi") === null, "la position donnée l'emporte ; valeur inconnue → null (courbe neutre)");
for (const [ab, pos] of [["+", "gauche"], ["-", "droite"], ["0", "axe"]] as const) {
  for (const sa of ["+", "-"]) verifier(descriptionCroquisAllure(sa, ab) === descriptionCroquisAllure(sa, null, pos), `description : signeAB « ${ab} » ≡ position « ${pos} » (signeA ${sa})`);
}
verifier(descriptionCroquisAllure("+", "+") === "Croquis de l'axe des ordonnées : parabole ouverte vers le haut, sommet à gauche de l'axe des ordonnées.", "description allure historique INCHANGÉE");
verifier(descriptionCroquisAllure(null, null, "gauche").includes("fais tes deux choix") && descriptionCroquisAllure("+", null, null).includes("fais tes deux choix"), "description : un choix manquant → consigne neutre");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length}+ vérification(s) en échec sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (${nbGrille} paraboles entières identiques à l'ancienne version, ${nbPool} exercices des pools, coefficients réels, allure)`);
