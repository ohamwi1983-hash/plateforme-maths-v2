// Test permanent — gen8 « f(x) à partir du graphe », modèle, génération, figure, écran 1 (RAPPORT §56) : `src/generateurs/fxDepuisGraphe/`. Par propriété sur TOUTES les configurations
// (23) × un pool de graines : bornes du prompt, valeurs neutres, point A entier à écart minimal, S et A sur la courbe de la figure, aide à deux paliers, vérification exacte par
// coefficients développés (formes équivalentes), partition des quatre codes contrôlée par un ORACLE indépendant (paramètres a, p, q de la réponse). Lancer : `npm run test-fx-ecran1`.

export {}; // module

import type { ConfigurationCases } from "../lib/contratGenerateur";
import { validerAide, aideAuPalier, type AideAnnotationsFigure } from "../lib/aideTypee";
import { DICTIONNAIRE_COMPETENCES } from "../lib/dictionnaireCompetences";
import { EXPLICATIONS_COMPETENCES } from "../lib/explicationsCompetences";
import { EXPLICATIONS_COMPETENCES_ELEVE } from "../lib/explicationsCompetencesEleve";
import { categoriserCompetence } from "../lib/categoriesCompetences";
import { ConfigurationDeLigneInvalide, genererPourLigne } from "../lib/genererPourLigne";
import { validerConfigurationDeLigne } from "../lib/configurationLigne";
import { ordonneeSurLaCourbe } from "../lib/figureParabole";
import { creerPrng } from "../lib/prng";
import { generateurFxDepuisGraphe as G } from "../src/generateurs/fxDepuisGraphe/generateur";
import { POOL_CV, POOL_EV, POOL_TRANSLATION, genererExerciceFx } from "../src/generateurs/fxDepuisGraphe/generation";
import { CODES_FX_ECRAN_EXPRESSION } from "../src/generateurs/fxDepuisGraphe/codes";
import { coefficientsDe } from "../src/generateurs/fxDepuisGraphe/diagnostic";
import { aideExpression, CHAMP_EXPRESSION, figureEtPoints } from "../src/generateurs/fxDepuisGraphe/ecrans";
import { latexFonction } from "../src/generateurs/fxDepuisGraphe/formatage";
import { ecartHorizontal, parametres, pointsDe, polynomeDe, polynomeVrai, TRANSFORMATIONS, type ExerciceFx, type Transformation } from "../src/generateurs/fxDepuisGraphe/types";
import { coefficient, lirePolynome } from "../src/generateurs/fxDepuisGraphe/polynome";
import { ajouterR, egalR, multiplierR, oppR, rat, signeR, versNombreR, type Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

// ── Les 23 configurations : sous-ensembles non vides de {TH, TV, (EV | CV | ∅), SOX} ──
const CONFIGURATIONS: Transformation[][] = [];
for (const th of [false, true]) for (const tv of [false, true]) for (const echelle of [null, "EV", "CV"] as const) for (const sox of [false, true]) {
  const actives = TRANSFORMATIONS.filter((t) => (t === "TH" && th) || (t === "TV" && tv) || (t === echelle) || (t === "SOX" && sox));
  if (actives.length > 0) CONFIGURATIONS.push(actives);
}
verifier(CONFIGURATIONS.length === 23, `23 configurations (reçu ${CONFIGURATIONS.length})`);
const cfg = (actives: readonly string[]): ConfigurationCases => ({ actives: [...actives] });
const GRAINES = Array.from({ length: 200 }, (_, i) => i * 21_474_836 + 7); // couvre [0, 2^32[

const pgcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : pgcd(b, a % b));

// ── 1. Les pools (contrat : l'ORDRE est contractuel) ──
verifier(POOL_TRANSLATION.length === 10 && !POOL_TRANSLATION.includes(0) && POOL_TRANSLATION.every((v) => v >= -5 && v <= 5), "pool de translation : [-5, 5] sans 0");
verifier(POOL_EV.length === 13, "pool EV : 4 entiers + 9 fractions");
verifier(POOL_EV.every(([n, d]) => pgcd(n, d) === 1 && n / d > 1 && ((d === 1 && n >= 2 && n <= 5) || ((d === 2 || d === 4) && n / d <= 4))), "pool EV : entiers 2..5, fractions irréductibles > 1 de dénominateur 2 ou 4, valeur ≤ 4");
verifier(new Set(POOL_EV.map(([n, d]) => `${n}/${d}`)).size === POOL_EV.length, "pool EV : sans doublon");
verifier(POOL_EV.filter(([, d]) => d > 1).length === 9, "pool EV : 9 fractions");
verifier(POOL_CV.length === 6, "pool CV : 6 valeurs");
verifier(POOL_CV.every(([n, d]) => pgcd(n, d) === 1 && n < d && d <= 5 && ((n === 1 && d >= 2) || (n >= 2 && n <= 5 && d <= 4))), "pool CV : 1/d (d 2..5) ou n/d irréductible, n 2..5, n < d, d ≤ 4");
verifier(JSON.stringify(POOL_CV) === JSON.stringify([[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [3, 4]]), "pool CV : ordre contractuel");
verifier(JSON.stringify(POOL_EV) === JSON.stringify([[2, 1], [3, 1], [4, 1], [5, 1], [3, 2], [5, 2], [7, 2], [5, 4], [7, 4], [9, 4], [11, 4], [13, 4], [15, 4]]), "pool EV : ordre contractuel");

// ── 2. Génération, par configuration × graine ──
const vus = { th: new Set<number>(), tv: new Set<number>(), ev: new Set<string>(), cv: new Set<string>() };
for (const actives of CONFIGURATIONS) {
  for (const graine of GRAINES) {
    const nom = `${actives.join("+")} g=${graine}`;
    const ex = genererExerciceFx(graine, cfg(actives));
    verifier(JSON.stringify(ex) === JSON.stringify(genererExerciceFx(graine, cfg(actives))), `${nom} : déterministe`);
    verifier(JSON.stringify(JSON.parse(JSON.stringify(ex))) === JSON.stringify(ex), `${nom} : JSON-sérialisable`);
    verifier(JSON.stringify(ex.actives) === JSON.stringify(actives), `${nom} : actives dans l'ordre canonique`);
    const has = (t: Transformation): boolean => actives.includes(t);
    verifier(has("TH") ? POOL_TRANSLATION.includes(ex.th) : ex.th === 0, `${nom} : TH`);
    verifier(has("TV") ? POOL_TRANSLATION.includes(ex.tv) : ex.tv === 0, `${nom} : TV`);
    verifier(has("SOX") === ex.sox, `${nom} : SOX`);
    const m = ex.facteurN / ex.facteurD;
    if (has("EV")) verifier(POOL_EV.some(([n, d]) => n === ex.facteurN && d === ex.facteurD) && m > 1, `${nom} : EV dans le pool`);
    else if (has("CV")) verifier(POOL_CV.some(([n, d]) => n === ex.facteurN && d === ex.facteurD) && m > 0 && m < 1, `${nom} : CV dans le pool`);
    else verifier(ex.facteurN === 1 && ex.facteurD === 1, `${nom} : facteur neutre`);
    if (has("TH")) vus.th.add(ex.th);
    if (has("TV")) vus.tv.add(ex.tv);
    if (has("EV")) vus.ev.add(`${ex.facteurN}/${ex.facteurD}`);
    if (has("CV")) vus.cv.add(`${ex.facteurN}/${ex.facteurD}`);

    // La fonction vraie : a(x−p)²+q, jamais a = 0.
    const par = parametres(ex);
    verifier(signeR(par.a) !== 0 && (signeR(par.a) < 0) === ex.sox, `${nom} : signe de a`);
    const vrai = polynomeVrai(ex);
    verifier(egalR(coefficient(vrai, 2), par.a), `${nom} : A = a`);

    // Le point A : coordonnées entières, écart minimal, sur la courbe.
    const pts = pointsDe(ex);
    verifier(Number.isInteger(pts.pointA.x) && Number.isInteger(pts.pointA.y) && Number.isInteger(pts.sommet.x) && Number.isInteger(pts.sommet.y), `${nom} : S et A entiers`);
    verifier(pts.pointA.x === ex.th + ex.signeEcart * pts.d, `${nom} : A à l'écart d`);
    verifier(pts.d >= 1 && (pts.d * pts.d) % par.a.d === 0, `${nom} : d² multiple du dénominateur`);
    verifier(Array.from({ length: pts.d - 1 }, (_, i) => i + 1).every((k) => (k * k) % par.a.d !== 0), `${nom} : d minimal`);
    verifier(par.a.d === 1 ? pts.d === 1 : true, `${nom} : d = 1 si a entier`);
    const yA = ajouterR(multiplierR(par.a, multiplierR(rat(pts.d), rat(pts.d))), par.q);
    verifier(yA.d === 1 && yA.n === pts.pointA.y, `${nom} : y_A = f(x_A)`);
    verifier(Math.abs(versNombreR(multiplierR(par.a, rat(pts.d * pts.d)))) <= 15, `${nom} : A à au plus 15 unités de S (D3)`);

    // La figure : une seule, stable, contient S et A avec marge, S et A sur la courbe (Bézier), aucune coordonnée remarquable.
    const { figure } = figureEtPoints(ex);
    const { fenetre } = figure;
    verifier(fenetre.xMin < Math.min(pts.sommet.x, pts.pointA.x) && fenetre.xMax > Math.max(pts.sommet.x, pts.pointA.x), `${nom} : fenêtre x contient S et A avec marge`);
    verifier(fenetre.yMin < Math.min(pts.sommet.y, pts.pointA.y) && fenetre.yMax > Math.max(pts.sommet.y, pts.pointA.y), `${nom} : fenêtre y contient S et A avec marge`);
    verifier(Math.abs(ordonneeSurLaCourbe(figure, pts.sommet.x) - pts.sommet.y) < 1e-6, `${nom} : S sur la courbe de la figure`);
    verifier(Math.abs(ordonneeSurLaCourbe(figure, pts.pointA.x) - pts.pointA.y) < 1e-6, `${nom} : A sur la courbe de la figure`);
    verifier(figure.fenetre.xMax - figure.fenetre.xMin <= 30 && figure.fenetre.yMax - figure.fenetre.yMin <= 45, `${nom} : fenêtre raisonnable`);

    // L'écran : un seul, avec figure, aide à deux paliers valide, poids 2, sans solution ni coordonnée dans l'écran servi.
    const ecrans = G.ecrans(ex);
    verifier(ecrans.length === 1 && ecrans[0]!.champ === CHAMP_EXPRESSION && ecrans[0]!.type === "champ_expression", `${nom} : un écran champ_expression`);
    const e0 = ecrans[0]!;
    verifier(e0.poids === 2 && e0.figure !== undefined && e0.aide !== undefined && e0.dependDe === undefined, `${nom} : poids 2, figure, aide, indépendant`);
    verifier(e0.consigne.startsWith("Détermine l'expression analytique de la parabole ci-dessous."), `${nom} : consigne globale`);
    verifier(JSON.stringify(e0.figure) === JSON.stringify(figure), `${nom} : figure de l'écran = figure de l'exercice`);
    const aide = e0.aide as AideAnnotationsFigure;
    verifier(validerAide(aide).length === 0, `${nom} : aide valide (${validerAide(aide).join(" ; ")})`);
    verifier(aide.paliers.length === 2, `${nom} : deux paliers`);
    const p1 = aideAuPalier(aide, 1);
    const p2 = aideAuPalier(aide, 2);
    verifier(p1.annotations.length === 1 && p1.annotations[0]!.genre === "point" && p1.annotations[0]!.x === pts.sommet.x && p1.annotations[0]!.y === pts.sommet.y, `${nom} : palier 1 = S seul`);
    verifier(p2.annotations.length === 4 && p2.annotations[0]!.genre === "point", `${nom} : palier 2 cumulatif (S, A, 2 vecteurs)`);
    const [, a2, h, v] = p2.annotations;
    verifier(a2!.genre === "point" && a2!.x === pts.pointA.x && a2!.y === pts.pointA.y, `${nom} : palier 2 marque A`);
    verifier(h!.genre === "vecteur" && h!.de[0] === pts.sommet.x && h!.de[1] === pts.sommet.y && h!.vers[0] === pts.pointA.x && h!.vers[1] === pts.sommet.y && h!.etiquette === String(pts.d), `${nom} : vecteur horizontal S → (xA ; yS), longueur d`);
    verifier(v!.genre === "vecteur" && v!.de[0] === pts.pointA.x && v!.de[1] === pts.sommet.y && v!.vers[0] === pts.pointA.x && v!.vers[1] === pts.pointA.y && v!.etiquette === String(Math.abs(pts.pointA.y - pts.sommet.y)), `${nom} : vecteur vertical (xA ; yS) → A, longueur |Δy|`);
    const servi = JSON.stringify({ ...e0, aide: undefined });
    verifier(!servi.includes("annotations") && !servi.includes(`S(${pts.sommet.x}`) && !servi.includes(`A(${pts.pointA.x}`), `${nom} : l'écran servi ne contient ni aide ni coordonnée de S/A`);
    verifier(aideExpression(ex).paliers[1]!.legende.includes("$A$") && !/\ba\s*=/.test(aide.paliers.map((p) => p.legende).join(" ")), `${nom} : la légende ne donne pas a`);

    // Solution lisible : jamais un terme neutre.
    const sol = G.solutionAttendue(ex, CHAMP_EXPRESSION);
    verifier(sol === `$f(x) = ${latexFonction(par)}$`, `${nom} : solution = forme canonique`);
    verifier(!/\(x [-+] 0\)/.test(sol) && !/[+-] 0\$?$/.test(sol) && !/\b1\(x|\b1x/.test(sol), `${nom} : aucun terme neutre dans la solution (${sol})`);
    verifier(has("TH") === /\(x [-+]/.test(sol), `${nom} : (x ± p) présent ssi TH active`);
    verifier(has("TV") === /(\)\^2|x\^2) [+-] /.test(sol), `${nom} : « + q » présent ssi TV active`);

    // Vérification : la bonne réponse, sous plusieurs écritures équivalentes.
    const { A, B, C } = coefficientsDe(par);
    const frac = (r: Rat): string => (r.d === 1 ? `(${r.n})` : `(${r.n}/${r.d})`);
    const ecritures = [
      `${frac(par.a)}*(x-${frac(par.p)})^2+${frac(par.q)}`,
      `f(x) = ${frac(A)}x^2+${frac(B)}x+${frac(C)}`,
      `${frac(C)}+${frac(B)}x+${frac(A)}x²`,
      `y = ${frac(par.a)}(x-${frac(par.p)})(x-${frac(par.p)})+${frac(par.q)}`,
    ];
    for (const t of ecritures) verifier(G.verifier(ex, CHAMP_EXPRESSION, t).statut === "correct", `${nom} : « ${t} » est correct`);
    verifier(JSON.stringify(G.verifier(ex, CHAMP_EXPRESSION, ecritures[0]!)) === JSON.stringify({ statut: "correct", codesCompetence: [] }), `${nom} : correct sans code`);
  }
}
verifier(vus.th.size === 10 && vus.tv.size === 10, `les 10 valeurs de TH et TV sont tirées (${vus.th.size}, ${vus.tv.size})`);
verifier(vus.ev.size === 13 && vus.cv.size === 6, `toutes les valeurs de EV et CV sont tirées (${vus.ev.size}, ${vus.cv.size})`);

// ── 3. Ordre contractuel des tirages : TH, TV, facteur, côté ; une case non cochée ne consomme aucun tirage ──
for (const graine of GRAINES) {
  const complet = genererExerciceFx(graine, cfg(["TH", "TV", "EV", "SOX"]));
  const prng = creerPrng(graine);
  verifier(complet.th === prng.choisir(POOL_TRANSLATION) && complet.tv === prng.choisir(POOL_TRANSLATION), `g=${graine} : TH puis TV`);
  const [n, d] = prng.choisir(POOL_EV);
  verifier(complet.facteurN === n && complet.facteurD === d, `g=${graine} : facteur après TH et TV`);
  verifier(complet.signeEcart === prng.choisir([-1, 1] as const), `g=${graine} : côté de A en dernier`);
  verifier(genererExerciceFx(graine, cfg(["TH"])).th === complet.th, `g=${graine} : TH identique quand on ajoute TV, EV, SOX`);
  verifier(genererExerciceFx(graine, cfg(["TH", "TV"])).tv === complet.tv, `g=${graine} : TV identique quand on ajoute EV, SOX`);
  const sansTh = genererExerciceFx(graine, cfg(["TV", "EV"]));
  const p2 = creerPrng(graine);
  verifier(sansTh.tv === p2.choisir(POOL_TRANSLATION), `g=${graine} : sans TH, TV est le premier tirage`);
}

// ── 3bis. Épinglage (règle `_v2`) : quelques tirages EXACTS. Ce test casse si un changement fait produire à `generer` autre chose pour la même (graine, configuration) : il faudrait alors un NOUVEAU variante_id. ──
const EPINGLES: [string[], number, ExerciceFx][] = [
  [["TH", "TV", "EV", "SOX"], 1, { actives: ["TH", "TV", "EV", "SOX"], th: 2, tv: -5, facteurN: 7, facteurD: 2, sox: true, signeEcart: 1 }],
  [["TH", "TV", "EV", "SOX"], 123456789, { actives: ["TH", "TV", "EV", "SOX"], th: -3, tv: 5, facteurN: 11, facteurD: 4, sox: true, signeEcart: -1 }],
  [["TV", "CV"], 42, { actives: ["TV", "CV"], th: 0, tv: 2, facteurN: 1, facteurD: 4, sox: false, signeEcart: 1 }],
  [["TH"], 4294967295, { actives: ["TH"], th: 4, tv: 0, facteurN: 1, facteurD: 1, sox: false, signeEcart: -1 }],
  [["SOX"], 0, { actives: ["SOX"], th: 0, tv: 0, facteurN: 1, facteurD: 1, sox: true, signeEcart: -1 }],
  [["EV"], 7777, { actives: ["EV"], th: 0, tv: 0, facteurN: 2, facteurD: 1, sox: false, signeEcart: 1 }],
  [["TH", "TV", "CV", "SOX"], 2024, { actives: ["TH", "TV", "CV", "SOX"], th: 4, tv: 3, facteurN: 1, facteurD: 5, sox: true, signeEcart: 1 }],
];
for (const [actives, graine, attendu] of EPINGLES) verifier(JSON.stringify(genererExerciceFx(graine, cfg(actives))) === JSON.stringify(attendu), `épinglage ${actives.join("+")} g=${graine}`);

// ── 4. Configuration absente, vide, inconnue, EV+CV : refus bruyant, jamais un défaut ──
const refuse = (f: () => unknown): boolean => {
  try {
    f();
    return false;
  } catch (e) {
    return e instanceof ConfigurationDeLigneInvalide;
  }
};
verifier(refuse(() => genererExerciceFx(1, undefined)), "sans configuration : refus");
verifier(refuse(() => genererExerciceFx(1, cfg([]))), "configuration vide : refus");
verifier(refuse(() => genererExerciceFx(1, cfg(["TH", "XX"]))), "transformation inconnue : refus");
verifier(refuse(() => genererExerciceFx(1, cfg(["EV", "CV"]))), "EV + CV : refus");
verifier(refuse(() => genererPourLigne(G, 1, null)), "genererPourLigne sans configuration : refus");
verifier(refuse(() => genererPourLigne(G, 1, { actives: ["EV", "CV"] })), "genererPourLigne EV+CV : refus");
verifier(JSON.stringify(genererPourLigne(G, 5, { actives: ["SOX", "TH"] })) === JSON.stringify(genererExerciceFx(5, cfg(["TH", "SOX"]))), "genererPourLigne canonise l'ordre des cases");
verifier(!validerConfigurationDeLigne(G, { actives: [] }).ok && !validerConfigurationDeLigne(G, { actives: ["EV", "CV"] }).ok && validerConfigurationDeLigne(G, { actives: ["CV", "TH"] }).ok, "le descripteur refuse vide et EV+CV");

// ── 5. Formatage : jamais de terme neutre ──
const P = (a: [number, number], p: [number, number], q: [number, number]) => ({ a: rat(...a), p: rat(...p), q: rat(...q) });
const FORMES: [ReturnType<typeof P>, string][] = [
  [P([1, 1], [0, 1], [0, 1]), "x^2"],
  [P([-1, 1], [0, 1], [0, 1]), "-x^2"],
  [P([2, 1], [3, 1], [1, 1]), "2(x - 3)^2 + 1"],
  [P([2, 1], [-3, 1], [-4, 1]), "2(x + 3)^2 - 4"],
  [P([1, 1], [2, 1], [0, 1]), "(x - 2)^2"],
  [P([1, 1], [0, 1], [5, 1]), "x^2 + 5"],
  [P([-1, 1], [-1, 1], [-1, 1]), "-(x + 1)^2 - 1"],
  [P([3, 2], [0, 1], [-2, 1]), "\\dfrac{3}{2}x^2 - 2"],
  [P([-1, 3], [4, 1], [0, 1]), "-\\dfrac{1}{3}(x - 4)^2"],
  [P([2, 3], [1, 2], [-3, 4]), "\\dfrac{2}{3}(x - \\dfrac{1}{2})^2 - \\dfrac{3}{4}"],
];
for (const [par, attendu] of FORMES) verifier(latexFonction(par) === attendu, `formatage : ${attendu} (reçu ${latexFonction(par)})`);
verifier((() => { try { latexFonction(P([0, 1], [0, 1], [0, 1])); return false; } catch { return true; } })(), "formatage : a = 0 refusé");

// ── 6. Partition des quatre codes : ORACLE sur les paramètres (a', p', q') de la réponse ──
// SIGNE_P_INVERSE ⇔ a'=a, q'=q, p'=−p (p ≠ 0) ; Q_INCORRECT ⇔ a'=a, p'=p, q'≠q ; A_INCORRECT ⇔ a'≠a, p'=p, q'=q ; P_MAGNITUDE ⇔ a'=a, q'=q, p' ∉ {p, −p} ; sinon aucun code.
const A_CANDIDATS: Rat[] = [rat(1), rat(-1), rat(2), rat(-2), rat(3), rat(-3), rat(1, 2), rat(-1, 2), rat(3, 2), rat(-3, 2), rat(1, 3), rat(2, 3), rat(-3, 4), rat(15, 4), rat(5)];
const P_CANDIDATS: Rat[] = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((n) => rat(n)).concat([rat(1, 2), rat(-1, 2), rat(5, 2)]);
const Q_CANDIDATS: Rat[] = [-6, -5, -3, -1, 0, 1, 2, 4, 5, 6].map((n) => rat(n)).concat([rat(1, 2), rat(-3, 4)]);
function oracle(vrai: ReturnType<typeof parametres>, a: Rat, p: Rat, q: Rat): string | null {
  const memeA = egalR(a, vrai.a);
  const memeQ = egalR(q, vrai.q);
  const memeP = egalR(p, vrai.p);
  if (memeA && memeP && memeQ) return null;
  if (memeA && memeQ && egalR(p, oppR(vrai.p)) && !egalR(vrai.p, rat(0))) return "SIGNE_P_INVERSE";
  if (memeA && memeP && !memeQ) return "Q_INCORRECT";
  if (!memeA && memeP && memeQ) return "A_INCORRECT";
  if (memeA && memeQ && !memeP && !egalR(p, oppR(vrai.p))) return "P_MAGNITUDE_INCORRECTE";
  return null;
}
const compteCodes = new Map<string, number>();
for (const actives of CONFIGURATIONS) {
  for (const graine of GRAINES.filter((_, i) => i % 50 === 0)) {
    const ex = genererExerciceFx(graine, cfg(actives));
    const vrai = parametres(ex);
    for (const a of A_CANDIDATS) for (const p of P_CANDIDATS) for (const q of Q_CANDIDATS) {
      const saisie = polynomeDe({ a, p, q });
      const attendu = oracle(vrai, a, p, q);
      const c = coefficientsDe({ a, p, q });
      const texte = `${c.A.n}/${c.A.d}*x^2+(${c.B.n}/${c.B.d})*x+(${c.C.n}/${c.C.d})`;
      const lu = lirePolynome(texte);
      verifier(lu.ok && [0, 1, 2].every((k) => egalR(coefficient(lu.polynome, k), coefficient(saisie, k))), `lecture de ${texte}`);
      const r = G.verifier(ex, CHAMP_EXPRESSION, texte);
      const juste = egalR(a, vrai.a) && egalR(p, vrai.p) && egalR(q, vrai.q);
      if (juste) {
        verifier(r.statut === "correct", `${actives.join("+")} g=${graine} : réponse juste reconnue`);
      } else {
        verifier(r.statut === "not_equivalent", `${actives.join("+")} g=${graine} : fausse reconnue fausse`);
        if (r.statut === "not_equivalent") {
          verifier(r.codesCompetence.length === (attendu ? 1 : 0) && (attendu === null || r.codesCompetence[0] === attendu), `${actives.join("+")} g=${graine} a'=${a.n}/${a.d} p'=${p.n}/${p.d} q'=${q.n}/${q.d} : code ${r.codesCompetence.join(",") || "∅"} ≠ oracle ${attendu ?? "∅"}`);
          verifier(JSON.stringify(r.partiesFausses) === JSON.stringify(["champ"]) && r.fractionCorrecte === undefined, "partie fausse = champ, jamais de fraction de mérite");
          if (attendu) compteCodes.set(attendu, (compteCodes.get(attendu) ?? 0) + 1);
        }
      }
    }
  }
}
for (const code of CODES_FX_ECRAN_EXPRESSION) verifier((compteCodes.get(code) ?? 0) >= 10, `le code ${code} est réellement atteint (${compteCodes.get(code) ?? 0})`);

// p = 0 (TH inactive) : SIGNE_P_INVERSE est impossible (B = 0), jamais d'étiquette sur une erreur qui n'existe pas.
for (const graine of GRAINES) {
  const ex = genererExerciceFx(graine, cfg(["TV", "SOX"]));
  verifier(ex.th === 0, "TH inactive : p = 0");
  const vrai = parametres(ex);
  for (const p of P_CANDIDATS.filter((v) => v.n !== 0)) {
    const c = coefficientsDe({ a: vrai.a, p, q: vrai.q });
    const r = G.verifier(ex, CHAMP_EXPRESSION, `(${c.A.n}/${c.A.d})x^2+(${c.B.n}/${c.B.d})x+(${c.C.n}/${c.C.d})`);
    verifier(r.statut === "not_equivalent" && JSON.stringify(r.codesCompetence) === JSON.stringify(["P_MAGNITUDE_INCORRECTE"]), "p = 0 : l'erreur sur p est P_MAGNITUDE_INCORRECTE (jamais SIGNE_P_INVERSE)");
  }
}

// Deux erreurs combinées ou plus : not_equivalent sans code.
{
  const ex = genererExerciceFx(11, cfg(["TH", "TV", "EV", "SOX"]));
  const v = parametres(ex);
  const faux = (a: Rat, p: Rat, q: Rat): string => {
    const c = coefficientsDe({ a, p, q });
    return `(${c.A.n}/${c.A.d})x^2+(${c.B.n}/${c.B.d})x+(${c.C.n}/${c.C.d})`;
  };
  const deux = G.verifier(ex, CHAMP_EXPRESSION, faux(oppR(v.a), oppR(v.p), v.q));
  verifier(deux.statut === "not_equivalent" && deux.codesCompetence.length === 0, "deux erreurs combinées : aucun code");
  const trois = G.verifier(ex, CHAMP_EXPRESSION, faux(oppR(v.a), ajouterR(v.p, rat(7)), ajouterR(v.q, rat(3))));
  verifier(trois.statut === "not_equivalent" && trois.codesCompetence.length === 0, "trois erreurs combinées : aucun code");
}

// ── 7. Saisies illisibles ou de mauvais degré : parse_error, aucun code, message sans la saisie ──
{
  const ex = genererExerciceFx(3, cfg(["TH", "TV"]));
  for (const t of ["", "   ", "2x+", "(x-1", "3", "x", "2x+1", "x^3", "x^2-x^2+x", "0", "sqrt(2)x^2", "x^2/0", "2x^2y", "a(x-p)^2+q", "f(x)=", "abc", "1/2x^2 ="]) {
    const r = G.verifier(ex, CHAMP_EXPRESSION, t);
    verifier(r.statut === "parse_error" && r.codesCompetence.length === 0 && r.messageErreur.length > 0, `saisie « ${t} » : parse_error`);
    if (r.statut === "parse_error" && t.trim() !== "") verifier(!r.messageErreur.includes(t) || t.length < 2, `saisie « ${t} » : message sans recopie`);
  }
  verifier(G.verifier(ex, CHAMP_EXPRESSION, "x^2-2x+1+x^3-x^3").statut !== "parse_error", "x³ qui s'annule : degré 2, lisible");
  let leve = 0;
  const prng = creerPrng(99);
  const alphabet = "x^2+-*/()0123456789., =fy²³ ";
  for (let i = 0; i < 3000; i++) {
    const t = Array.from({ length: prng.entierEntre(0, 14) }, () => alphabet[prng.entierEntre(0, alphabet.length - 1)]).join("");
    try {
      G.verifier(ex, CHAMP_EXPRESSION, t);
    } catch {
      leve++;
    }
  }
  verifier(leve === 0, `fuzz : verifier ne lève jamais (${leve})`);
  verifier((() => { try { G.verifier(ex, "inconnu", "x"); return false; } catch { return true; } })(), "champ inconnu : refus bruyant");
}

// ── 8. Codes : déclarés, au dictionnaire, expliqués, catégorisés ──
verifier(JSON.stringify([...G.codesCompetenceDeclares].sort()) === JSON.stringify([...CODES_FX_ECRAN_EXPRESSION].sort()) && G.codesCompetenceDeclares.length === 4, "quatre codes déclarés");
for (const code of CODES_FX_ECRAN_EXPRESSION) {
  verifier(Object.hasOwn(DICTIONNAIRE_COMPETENCES, code), `${code} : dictionnaire`);
  verifier(Object.hasOwn(EXPLICATIONS_COMPETENCES, code) && EXPLICATIONS_COMPETENCES[code]!.explication.length > 20 && EXPLICATIONS_COMPETENCES[code]!.exemple.length > 10, `${code} : explication professeur`);
  verifier(Object.hasOwn(EXPLICATIONS_COMPETENCES_ELEVE, code), `${code} : explication élève`);
  verifier(categoriserCompetence(code).categorie !== "Non classé", `${code} : catégorie`);
}
verifier(G.curriculaire && G.generateur_id === "gen8" && G.variante_id === "fx_depuis_graphe", "identité du générateur");
verifier(G.configuration?.cases.map((c) => c.id).join() === "TH,TV,EV,CV,SOX" && JSON.stringify(G.configuration?.exclusifs) === JSON.stringify([["EV", "CV"]]), "descripteur de configuration");
verifier(ecartHorizontal(1) === 1 && ecartHorizontal(2) === 2 && ecartHorizontal(3) === 3 && ecartHorizontal(4) === 2 && ecartHorizontal(5) === 5 && ecartHorizontal(6) === 6 && ecartHorizontal(8) === 4 && ecartHorizontal(12) === 6, "écart horizontal minimal");

// Cohérence interne : l'objet `ExerciceFx` n'a que des champs sérialisables sans `undefined`.
{
  const ex: ExerciceFx = genererExerciceFx(1, cfg(["TH"]));
  verifier(Object.values(ex).every((v) => v !== undefined), "ExerciceFx sans undefined");
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (gen8 écran 1 : 23 configurations × ${GRAINES.length} graines, pools, point A, figure, aide à deux paliers, vérification exacte, partition des quatre codes)`);
