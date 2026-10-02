// Test permanent — VÉRIFICATION des écrans de gen7 « motif / delta » (RAPPORT §49), EXHAUSTIVE sur les pools des dix sous-variantes.
// Lancer : `npm run test-verification-motif-delta`. Pur (aucune base, aucun réseau).
//
// Pour CHAQUE exercice de CHAQUE pool : la réponse de référence est acceptée ; les perturbations (signe, valeur voisine, décimale pour un irrationnel, racine non simplifiée, `sqrt` d'un
// négatif, saisie hostile…) sont refusées avec le bon statut ET le bon code ; tout texte servi (consigne, aide, solution, message) passe `verifierBalisageMath`.

export {}; // module

import { validerAide } from "../lib/aideTypee";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { verifierBalisageMath } from "./support/texteMath";
import { FAMILLES } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { poolDe, genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { coefVersExact, fonctionVraie, type ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { effectifVraiMD } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { verifierMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/verification";
import { reponseBruteCorrecteMotifDelta, solutionAttendueMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { ecransMotifDelta, NOMS_ECRANS_MD } from "../src/generateurs/analyseFonctionMotifDelta/ecrans";
import { approx, estRationnel, texteSaisieExact, type Exact } from "../src/generateurs/analyseFonctionMotifDelta/exact/nombreExact";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE, CHAMP_TABLEAU_SIGNES } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { colonnesTableauMD, rangeesTableauMD, solutionTableauMD } from "../src/generateurs/analyseFonctionMotifDelta/tableauSignes";
import { CHAMP_RACINES } from "../src/generateurs/analyseFonctionMotifDelta/types";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 50) echecs.push(message);
}

const textes = new Set<string>();
const noter = (t: string | undefined): void => {
  if (t !== undefined) textes.add(t);
};

/** Une racine NON simplifiée équivalente à `x = (p/d)·√r` (|p| ≥ 2), sinon `null`. */
function nonSimplifie(x: Exact): string | null {
  if (x.size !== 1) return null;
  const [[r, q]] = [...x.entries()];
  if (r === 1 || Math.abs(q.n) < 2) return null;
  return `${q.n < 0 ? "-" : ""}sqrt(${q.n * q.n * r})${q.d > 1 ? `/${q.d}` : ""}`;
}
const CHAMPS_MD = [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_DOMAINE_IMAGE, CHAMP_RACINES, CHAMP_TABLEAU_SIGNES] as const;

for (const fam of FAMILLES) {
  for (const [i, { a, b, c }] of poolDe(fam).entries()) {
    const ex: ExerciceMotifDelta = { famille: fam.id, a, b, c, ordreTermes: ["a"], effectif: effectifVraiMD(a, b, c), affichageTableau: "vraies" };
    const f = fonctionVraie(ex);
    const ctx = `${fam.numero} #${i} (a=${a.n}, b=${texteSaisieExact(coefVersExact(b))}, c=${c.n})`;
    const V = (champ: string, brut: unknown) => verifierMotifDelta(ex, champ, typeof brut === "string" ? brut : JSON.stringify(brut));
    const sortie = (r: ReturnType<typeof V>, statut: string, codes: string[], msg: string): void => {
      noter(r.statut === "parse_error" ? r.messageErreur : undefined);
      verifier(r.statut === statut && JSON.stringify(r.codesCompetence) === JSON.stringify(codes), `${ctx} : ${msg} → ${statut} ${JSON.stringify(codes)}, obtenu ${r.statut} ${JSON.stringify(r.codesCompetence)}`);
    };

    // Réponses de référence
    for (const champ of CHAMPS_MD) sortie(V(champ, reponseBruteCorrecteMotifDelta(ex, champ)), "correct", [], `${champ} : réponse de référence`);

    // ── coefficients ──
    const ref = { a: texteSaisieExact(coefVersExact(a)), b: texteSaisieExact(coefVersExact(b)), c: texteSaisieExact(coefVersExact(c)) };
    sortie(V(CHAMP_COEFFICIENTS, { ...ref, a: String(-a.n) }), "not_equivalent", [], "coefficients : a de signe contraire");
    sortie(V(CHAMP_COEFFICIENTS, { ...ref, c: String(c.n + 1) }), "not_equivalent", [], "coefficients : c voisin");
    if (ref.a !== ref.b) sortie(V(CHAMP_COEFFICIENTS, { a: ref.b, b: ref.a, c: ref.c }), "not_equivalent", [], "coefficients : a et b échangés");
    sortie(V(CHAMP_COEFFICIENTS, { ...ref, b: "sqrt(-2)" }), "parse_error", [], "coefficients : sqrt d'un négatif");
    sortie(V(CHAMP_COEFFICIENTS, { ...ref, c: "abc" }), "parse_error", [], "coefficients : texte illisible");
    sortie(V(CHAMP_COEFFICIENTS, { ...ref, c: "$x$" }), "parse_error", [], "coefficients : saisie hostile « $x$ »");
    sortie(V(CHAMP_COEFFICIENTS, { ...ref, a: "" }), "parse_error", [], "coefficients : champ vide");
    if (!estRationnel(coefVersExact(b))) {
      sortie(V(CHAMP_COEFFICIENTS, { ...ref, b: approx(coefVersExact(b)).toFixed(3) }), "not_equivalent", [], "coefficients : b irrationnel donné en décimal");
      const ns = nonSimplifie(coefVersExact(b));
      if (ns !== null) {
        sortie(V(CHAMP_COEFFICIENTS, { ...ref, b: ns }), "not_equivalent", ["RACINE_NON_SIMPLIFIEE"], "coefficients : b juste mais racine non simplifiée");
        sortie(V(CHAMP_COEFFICIENTS, { ...ref, a: String(-a.n), b: ns }), "not_equivalent", [], "coefficients : a faux ET b non simplifié (pas de code)");
      }
    }
    // c écrit `sqrt(c²)` : pour c > 0 la valeur est juste mais la racine n'est pas simplifiée ; pour c < 0 la valeur est fausse (|c|) : jamais de code.
    if (c.n !== 0) sortie(V(CHAMP_COEFFICIENTS, { ...ref, c: `sqrt(${c.n * c.n})` }), "not_equivalent", c.n > 0 ? ["RACINE_NON_SIMPLIFIEE"] : [], "coefficients : c écrit sqrt(c²)");

    // ── allure ──
    const refAllure = JSON.parse(reponseBruteCorrecteMotifDelta(ex, CHAMP_ALLURE)) as { concavite: string; positionSommet: string };
    const autreConcavite = refAllure.concavite === "+" ? "-" : "+";
    const autrePosition = refAllure.positionSommet === "gauche" ? "droite" : "gauche";
    sortie(V(CHAMP_ALLURE, { ...refAllure, concavite: autreConcavite }), "not_equivalent", ["ALLURE_PARTIELLE"], "allure : concavité fausse seule");
    sortie(V(CHAMP_ALLURE, { ...refAllure, positionSommet: autrePosition }), "not_equivalent", ["ALLURE_PARTIELLE"], "allure : position fausse seule");
    sortie(V(CHAMP_ALLURE, { concavite: autreConcavite, positionSommet: autrePosition }), "not_equivalent", [], "allure : les deux faux");
    sortie(V(CHAMP_ALLURE, { concavite: refAllure.concavite }), "parse_error", [], "allure : position manquante");
    sortie(V(CHAMP_ALLURE, { ...refAllure, positionSommet: "milieu" }), "parse_error", [], "allure : choix inconnu");

    // ── axeSommet ──
    const refAxe = JSON.parse(reponseBruteCorrecteMotifDelta(ex, CHAMP_AXE_SOMMET)) as { axeTexte: string; xS: string; yS: string };
    sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, yS: texteSaisieExact(coefVersExact(coefDe(f.yS))) === "0" ? "1" : "0" }), "not_equivalent", [], "axeSommet : yS faux");
    sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, xS: "12345" }), "not_equivalent", [], "axeSommet : xS faux");
    sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, axeTexte: refAxe.xS }), "parse_error", ["AXE_SYMETRIE_NOTATION"], "axeSommet : axe sans « x = »");
    sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, axeTexte: `X = ${refAxe.xS}` }), "parse_error", [], "axeSommet : « X = » majuscule");
    sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, axeTexte: "x = " }), "parse_error", [], "axeSommet : axe sans valeur");
    if (estRationnel(f.xS)) {
      const v = approx(f.xS);
      sortie(V(CHAMP_AXE_SOMMET, { axeTexte: `x = ${(v + 0.004).toFixed(3).replace(".", ",")}`, xS: (v - 0.004).toFixed(3), yS: refAxe.yS }), "correct", [], "axeSommet : valeurs arrondies à ±0,005 (rationnel) acceptées");
      sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, xS: (v + 0.02).toFixed(2) }), "not_equivalent", [], "axeSommet : écart de 0,02 refusé");
    } else {
      const v = approx(f.xS);
      sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, xS: v.toFixed(3) }), "not_equivalent", [], "axeSommet : xS irrationnel donné en décimal (exact exigé)");
      sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, axeTexte: `x = ${v.toFixed(3)}` }), "not_equivalent", [], "axeSommet : axe irrationnel donné en décimal");
      const ns = nonSimplifie(f.xS);
      if (ns !== null) sortie(V(CHAMP_AXE_SOMMET, { ...refAxe, xS: ns }), "not_equivalent", ["RACINE_NON_SIMPLIFIEE"], "axeSommet : xS juste mais non simplifié");
    }

    // ── domaineImage ──
    const refImg = JSON.parse(reponseBruteCorrecteMotifDelta(ex, CHAMP_DOMAINE_IMAGE)) as Record<string, string>;
    const y = approx(f.yS);
    const inverse = a.n > 0 ? { crochetGauche: "]", borneGauche: "-inf", crochetDroit: "]", borneDroite: refImg.borneGauche } : { crochetGauche: "[", borneGauche: refImg.borneDroite, crochetDroit: "[", borneDroite: "+inf" };
    sortie(V(CHAMP_DOMAINE_IMAGE, inverse), "not_equivalent", [], "domaineImage : intervalle du mauvais côté");
    sortie(V(CHAMP_DOMAINE_IMAGE, { ...refImg, crochetGauche: refImg.crochetGauche === "[" ? "]" : "[" }), "not_equivalent", [], "domaineImage : mauvais crochet gauche");
    sortie(V(CHAMP_DOMAINE_IMAGE, { ...refImg, [a.n > 0 ? "borneGauche" : "borneDroite"]: String(y + 3) }), "not_equivalent", [], "domaineImage : borne fausse");
    sortie(V(CHAMP_DOMAINE_IMAGE, { ...refImg, [a.n > 0 ? "borneGauche" : "borneDroite"]: (y + 0.004).toFixed(3) }), "correct", [], "domaineImage : borne à +0,004 acceptée (rationnelle)");
    sortie(V(CHAMP_DOMAINE_IMAGE, { ...refImg, [a.n > 0 ? "borneGauche" : "borneDroite"]: "sqrt(-1)" }), "parse_error", [], "domaineImage : sqrt d'un négatif");
    sortie(V(CHAMP_DOMAINE_IMAGE, { ...refImg, [a.n > 0 ? "borneGauche" : "borneDroite"]: "" }), "parse_error", [], "domaineImage : borne vide");

    // ── racines ──
    const E = f.racines;
    const txt = E.map((r) => texteSaisieExact(r));
    const faux1 = "101"; // jamais une racine : toutes les racines de ces familles sont de valeur absolue < 12
    const faux2 = "103";
    sortie(V(CHAMP_RACINES, ["x"]), "parse_error", [], "racines : texte illisible");
    sortie(V(CHAMP_RACINES, ["$x$"]), "parse_error", [], "racines : saisie hostile « $x$ »");
    sortie(V(CHAMP_RACINES, ["sqrt(-1)"]), "parse_error", [], "racines : sqrt d'un négatif");
    sortie(V(CHAMP_RACINES, ["   "]), "parse_error", [], "racines : liste de valeurs vides");
    if (E.length === 0) {
      sortie(V(CHAMP_RACINES, []), "correct", [], "racines : « pas de racine » (Δ < 0)");
      sortie(V(CHAMP_RACINES, ["0"]), "not_equivalent", ["RACINES_NOMBRE_INCORRECT"], "racines : une valeur alors qu'il n'y a pas de racine");
      sortie(V(CHAMP_RACINES, ["1", "2"]), "not_equivalent", ["RACINES_NOMBRE_INCORRECT"], "racines : deux valeurs alors qu'il n'y a pas de racine");
    } else {
      sortie(V(CHAMP_RACINES, []), "not_equivalent", ["RACINES_NOMBRE_INCORRECT"], "racines : « pas de racine » alors qu'il y en a");
      sortie(V(CHAMP_RACINES, [...txt, faux1, faux2]), "not_equivalent", ["RACINES_NOMBRE_INCORRECT"], "racines : plus de deux lignes");
      if (E.length === 1) {
        sortie(V(CHAMP_RACINES, [txt[0], txt[0]]), "correct", [], "racines : racine double écrite deux fois");
        sortie(V(CHAMP_RACINES, [faux1]), "not_equivalent", [], "racines : racine double fausse");
        sortie(V(CHAMP_RACINES, [txt[0], faux1]), "not_equivalent", ["RACINES_NOMBRE_INCORRECT"], "racines : racine double + une valeur de trop");
      } else {
        sortie(V(CHAMP_RACINES, [...txt].reverse()), "correct", [], "racines : ordre indifférent");
        sortie(V(CHAMP_RACINES, [txt[0]]), "not_equivalent", ["RACINES_NOMBRE_INCORRECT"], "racines : une seule des deux racines");
        sortie(V(CHAMP_RACINES, [txt[0], txt[0]]), "not_equivalent", ["RACINES_NOMBRE_INCORRECT"], "racines : la même racine deux fois");
        sortie(V(CHAMP_RACINES, [txt[0], faux1]), "not_equivalent", ["RACINE_PARTIELLE"], "racines : une racine juste, l'autre fausse");
        sortie(V(CHAMP_RACINES, [txt[1], faux1]), "not_equivalent", ["RACINE_PARTIELLE"], "racines : l'autre racine juste, la première fausse");
        sortie(V(CHAMP_RACINES, [faux1, faux2]), "not_equivalent", [], "racines : les deux fausses");
      }
      for (const [j, r] of E.entries()) {
        if (!estRationnel(r)) {
          const autres = txt.map((t, jj) => (jj === j ? approx(r).toFixed(3) : t));
          sortie(V(CHAMP_RACINES, autres), "not_equivalent", E.length === 2 ? ["RACINE_PARTIELLE"] : [], "racines : une racine irrationnelle donnée en décimal");
          const ns = nonSimplifie(r);
          if (ns !== null) sortie(V(CHAMP_RACINES, txt.map((t, jj) => (jj === j ? ns : t))), "not_equivalent", ["RACINE_NON_SIMPLIFIEE"], "racines : racine juste non simplifiée");
        }
      }
    }

    // ── tableauSignes : solution exacte recoupée par un oracle FLOTTANT indépendant, structure, détecteurs ──
    {
      const sol = solutionTableauMD(f) as { signe: Record<string, string>; variation: Record<string, string> };
      const cols = colonnesTableauMD(f, "symboliques");
      const [A, Bf, Cf] = [a.n, approx(coefVersExact(b)), c.n];
      for (const col of cols) {
        if (col.colonne.genre !== "intervalle") continue;
        const xr = approx(col.x);
        const v = A * xr * xr + Bf * xr + Cf;
        verifier(Math.abs(v) > 1e-9 && sol.signe[col.colonne.id] === (v > 0 ? "+" : "-"), `${ctx} : signe exact de la colonne ${col.colonne.id} recoupé par l'oracle flottant (f(${xr.toFixed(4)}) = ${v.toFixed(4)})`);
      }
      const nbZeros = Object.values(sol.signe).filter((v) => v === "0").length;
      verifier(nbZeros === f.racines.length && cols.length === (f.racines.length === 2 ? 7 : 3), `${ctx} : ${nbZeros} « 0 » et ${cols.length} colonnes pour ${f.racines.length} racine(s)`);
      const alphabets = rangeesTableauMD(f)[0]!.cellules.map((cell) => cell.alphabet.includes("0"));
      verifier(alphabets.filter(Boolean).length === nbZeros, `${ctx} : « 0 » offert seulement sur une colonne racine`);
      const symboliques = cols.map((cc) => cc.colonne.libelle + (cc.colonne.valeur ?? "")).join(" ");
      verifier(!/\\sqrt|\\dfrac/.test(symboliques) && !/\d/.test(symboliques.replace(/x_[12S]/g, "")), `${ctx} : valeurs de x non révélées en mode symbolique (${symboliques.slice(0, 80)})`);
      const vraies = colonnesTableauMD(f, "vraies").map((cc) => cc.colonne.libelle).join(" ");
      if (f.racines.some((r) => !estRationnel(r)) || !estRationnel(f.xS)) verifier(/\\sqrt|\\dfrac/.test(vraies), `${ctx} : valeurs vraies en LaTeX exact (${vraies.slice(0, 80)})`);
      const flipS: Record<string, string> = { "+": "-", "-": "+", "0": "0" };
      const flipV: Record<string, string> = { "↗": "↘", "↘": "↗", "⌢": "⌣", "⌣": "⌢" };
      const mapper = (ligne: Record<string, string>, t: Record<string, string>) => Object.fromEntries(Object.entries(ligne).map(([k, x]) => [k, t[x] as string]));
      const un = (ligne: Record<string, string>, t: Record<string, string>) => {
        const [premier] = Object.keys(ligne).filter((k) => t[ligne[k] as string] !== ligne[k]);
        return { ...ligne, [premier as string]: t[ligne[premier as string] as string] as string };
      };
      const T = (signe: unknown, variation: unknown) => V(CHAMP_TABLEAU_SIGNES, { signe, variation });
      sortie(T(mapper(sol.signe, flipS), sol.variation), "not_equivalent", ["TABLEAU_SIGNE_INVERSE"], "tableau : ligne de signe inversée");
      sortie(T(sol.signe, mapper(sol.variation, flipV)), "not_equivalent", ["TABLEAU_CONCAVITE_INCORRECTE"], "tableau : variations inversées (concavité)");
      sortie(T(mapper(sol.signe, flipS), mapper(sol.variation, flipV)), "not_equivalent", ["TABLEAU_SIGNE_INVERSE", "TABLEAU_CONCAVITE_INCORRECTE"], "tableau : les deux lignes inversées");
      sortie(T(un(sol.signe, flipS), sol.variation), "not_equivalent", ["TABLEAU_SIGNE_PARTIEL"], "tableau : signe en partie juste");
      sortie(T(sol.signe, un(sol.variation, flipV)), "not_equivalent", ["TABLEAU_VARIATION_PARTIEL"], "tableau : variations en partie justes");
      sortie(T(un(sol.signe, flipS), un(sol.variation, flipV)), "not_equivalent", ["TABLEAU_SIGNE_PARTIEL", "TABLEAU_VARIATION_PARTIEL"], "tableau : les deux en partie justes");
      sortie(T(un(sol.signe, flipS), mapper(sol.variation, flipV)), "not_equivalent", ["TABLEAU_SIGNE_PARTIEL", "TABLEAU_CONCAVITE_INCORRECTE"], "tableau : signe partiel et variations inversées");
      if (nbZeros > 0) {
        const fausse = Object.fromEntries(Object.entries(sol.signe).map(([k, x]) => [k, x === "0" ? "+" : flipS[x]]));
        sortie(T(fausse, sol.variation), "not_equivalent", [], "tableau : ligne de signe entièrement fausse SANS être l'inverse (aucun code)");
      }
      const { [Object.keys(sol.signe)[0] as string]: _retiree, ...incomplet } = sol.signe;
      void _retiree;
      sortie(T(incomplet, sol.variation), "parse_error", [], "tableau : case manquante");
      sortie(T({ ...sol.signe, c0: "0" }, sol.variation), "parse_error", [], "tableau : « 0 » sur une case qui ne l'offre pas");
      sortie(V(CHAMP_TABLEAU_SIGNES, { signe: sol.signe }), "parse_error", [], "tableau : ligne des variations absente");
    }

    // ── déclaration des écrans et textes servis (un exercice sur 9, tous les pools couverts) ──
    if (i % 9 === 0) {
      const gen = genererExerciceMD(fam.id, 4242 + i);
      const ecrans: EcranDeclare[] = ecransMotifDelta(gen);
      verifier(ecrans.map((e) => e.champ).join() === `${CHAMP_COEFFICIENTS},${CHAMP_ALLURE},${CHAMP_AXE_SOMMET},${CHAMP_DOMAINE_IMAGE},${CHAMP_RACINES},${CHAMP_TABLEAU_SIGNES}`, `${ctx} : les six écrans, dans l'ordre`);
      for (const e of ecrans) {
        verifier(e.nom === NOMS_ECRANS_MD[e.champ] && typeof e.poids === "number", `${ctx} / ${e.champ} : nom et poids déclarés`);
        noter(e.consigne);
        if (typeof e.aide === "string") noter(e.aide);
        else if (e.aide !== undefined) verifier(validerAide(e.aide).length === 0, `${ctx} / ${e.champ} : aide typée valide (${validerAide(e.aide).join(" ; ")})`);
        verifier(e.consigne.startsWith("Étudie la fonction suivante : $f(x) = "), `${ctx} / ${e.champ} : énoncé persistant`);
        if (e.type === "champs_multiples") for (const sc of e.champs) {
          noter(sc.libelle);
          if (sc.genre === "choix") sc.choix.forEach((ch) => noter(ch.libelle));
        }
        noter(solutionAttendueMotifDelta(gen, e.champ));
      }
      const poids = ecrans.map((e) => e.poids).join();
      verifier(poids === `1,1,2,1,${fam.poidsRacines},3`, `${ctx} : poids 1, 1, 2, 1, ${fam.poidsRacines}, 3 (obtenu ${poids})`);
      const tabEcran = ecrans.find((e) => e.champ === CHAMP_TABLEAU_SIGNES);
      verifier(tabEcran?.type === "tableau_signes" && tabEcran.dependDe?.join() === `${CHAMP_COEFFICIENTS},${CHAMP_AXE_SOMMET},${CHAMP_RACINES}` && typeof tabEcran.aide === "object" && tabEcran.aide.type === "croquis_parabole" && tabEcran.aide.marquesOx === true, `${ctx} : tableau : dépendances, aide croquis_parabole (coefficients réels)`);
      const rac = ecrans.find((e) => e.champ === CHAMP_RACINES);
      verifier(rac?.type === "liste_valeurs" && rac.permetAucune === true && rac.aide === undefined && rac.dependDe?.join() === CHAMP_COEFFICIENTS, `${ctx} : racines : liste_valeurs permetAucune, aucune aide, dépend des coefficients`);
      const allure = ecrans.find((e) => e.champ === CHAMP_ALLURE);
      verifier(allure?.type === "champs_multiples" && allure.illustration?.champPositionSommet === "positionSommet" && allure.illustration.champSigneAB === undefined && typeof allure.aide === "string", `${ctx} : allure : illustration « position du sommet » et UNE aide combinée`);
      const img = ecrans.find((e) => e.champ === CHAMP_DOMAINE_IMAGE);
      verifier(img?.type === "intervalle" && img.apercu?.auDessus === true && img.apercu.libelle.includes("\\mathrm{im}") && img.aide === undefined, `${ctx} : ensemble-image : aperçu « im f = » au-dessus, aucune aide`);
    }
  }
}

function coefDe(x: Exact): never | { n: number; d: number; rad: number } {
  const [[r, q]] = x.size === 0 ? [[1, { n: 0, d: 1 }]] : [...x.entries()];
  return { n: q.n, d: q.d, rad: r };
}

// Tous les textes servis passent le contrôle de balisage mathématique
let nbTextes = 0;
for (const t of textes) {
  nbTextes++;
  const p = verifierBalisageMath(t);
  verifier(p.length === 0, `texte servi invalide (« ${t.slice(0, 70)} ») : ${p.join(" ; ")}`);
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length}+ vérification(s) en échec sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (les six écrans sur les pools exhaustifs des 10 familles, perturbations, codes, ${nbTextes} textes servis contrôlés)`);
