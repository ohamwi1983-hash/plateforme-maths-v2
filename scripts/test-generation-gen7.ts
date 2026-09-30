// Test permanent — génération, écrans, cascade et solutions de gen7 (phase 3b-3, commit 2) : `src/generateurs/analyseFonction/`.
// Lancer : `npm run test-generation-gen7`. Sans réseau.
//  1. génération seedée : reproductible, JSON pur, ORDRE DES TIRAGES figé (graine → exercice, contractuel pour `_v1`), plages des 4 catégories ;
//  2. écrans : 8 (6 pour `af_irreductible`), dépendances valides, textes sains (balisage), aides valides, énoncés par écran ;
//  3. solutions : la réponse « correcte » de chaque champ, sur des centaines de graines, est jugée `correct` par la vérification ;
//  4. cascade A (`racinesChamp2` sur la factorisation confirmée) et B (valeurs du tableau vraies ou symboliques), repli à deux régimes ;
//  5. entrées hostiles de la cascade (texte de l'élève) : jamais d'exception, jamais un texte d'auteur bâti sur la chaîne brute.

export {}; // module

import { validerAide } from "../lib/aideTypee";
import { dependancesTerminees, ecransServis, validerDependances } from "../lib/cascadeEcrans";
import type { EcranDeclare, ReponseConfirmee } from "../lib/contratGenerateur";
import { verifierBalisageMath } from "./support/texteMath";
import {
  champsAnalyseFonction,
  ecransAnalyseFonction,
  genererExercice,
  projeterAnalyseFonction,
  racinesDeFactorisation,
  factorisationVersLatex,
  reponseBruteCorrecteAnalyseFonction,
  solutionAttendueAnalyseFonction,
  verifierAnalyseFonction,
  type CategorieAnalyseFonction,
  type ExerciceAnalyseFonction,
} from "../src/generateurs/analyseFonction";
import { CHAMP_RACINES_FACTORISATION, CHAMP_RACINES_ZEROS } from "../src/generateurs/analyseFonction/racines";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const CATEGORIES: CategorieAnalyseFonction[] = ["mise_en_evidence", "binome_conjugue", "produit_remarquable", "irreductible"];
const GRAINES = Array.from({ length: 300 }, (_, i) => 1 + i * 7919);

// ── 1. Génération ──
// Ordre des tirages FIGÉ : ces exercices sont la définition de `_v1` (graine → exercice). Les changer impose un `_v2`.
const PINS: Record<string, Record<number, string>> = {
  mise_en_evidence: { 1: "3,15,0|ab", 42: "3,3,0|ab", 12345: "4,8,0|ba", 987654: "1,1,0|ab" },
  binome_conjugue: { 1: "3,0,-3|ac", 42: "3,0,-27|ac", 12345: "4,0,-16|ca", 987654: "1,0,-9|ac" },
  produit_remarquable: { 1: "3,30,75|acb", 42: "3,6,3|abc", 12345: "4,16,16|acb", 987654: "1,2,1|cab" },
  irreductible: { 1: "1,-4,7|abc", 42: "1,0,4|ac", 12345: "4,-8,6|abc", 987654: "-4,4,-4|bca" },
};
for (const categorie of CATEGORIES) {
  for (const [graine, attendu] of Object.entries(PINS[categorie] as Record<number, string>)) {
    const e = genererExercice(categorie, Number(graine));
    verifier(`${e.fonction.a},${e.fonction.b},${e.fonction.c}|${e.ordreTermes.join("")}` === attendu, `${categorie} graine ${graine} : ordre des tirages figé « ${attendu} », obtenu « ${e.fonction.a},${e.fonction.b},${e.fonction.c}|${e.ordreTermes.join("")} »`);
  }
}

const plages = new Map<string, { a: number[]; b: number[]; c: number[]; yS: number[]; ordres: Set<string> }>();
for (const categorie of CATEGORIES) {
  const p = { a: [] as number[], b: [] as number[], c: [] as number[], yS: [] as number[], ordres: new Set<string>() };
  plages.set(categorie, p);
  for (const graine of GRAINES) {
    const e = genererExercice(categorie, graine);
    const f = e.fonction;
    verifier(JSON.stringify(e) === JSON.stringify(genererExercice(categorie, graine)), `${categorie} graine ${graine} : non reproductible`);
    verifier(JSON.stringify(JSON.parse(JSON.stringify(e))) === JSON.stringify(e) && !JSON.stringify(e).includes("null,null") && !/NaN|undefined/.test(JSON.stringify(e)), `${categorie} graine ${graine} : exercice non JSON-pur`);
    verifier(Number.isInteger(f.a) && Number.isInteger(f.b) && Number.isInteger(f.c) && f.a !== 0, `${categorie} graine ${graine} : coefficients entiers, a ≠ 0`);
    verifier(Number.isInteger(f.xS * 2) && Number.isInteger(f.yS * 4), `${categorie} graine ${graine} : xS ∈ ½ℤ et yS ∈ ¼ℤ (${f.xS}, ${f.yS})`);
    verifier(Object.is(f.xS, -0) === false && Object.is(f.yS, -0) === false, `${categorie} graine ${graine} : jamais « -0 »`);
    const delta = f.b * f.b - 4 * f.a * f.c;
    verifier(categorie === "irreductible" ? delta < 0 && f.racines === null && e.zeros === null && e.formeFactorisee === null : delta >= 0 && f.racines !== null && e.zeros !== null && e.formeFactorisee !== null, `${categorie} graine ${graine} : Δ = ${delta} incohérent avec la catégorie`);
    verifier(e.ordreTermes[0] !== undefined && [...e.ordreTermes].sort().join("") === ["a", ...(f.b !== 0 ? ["b"] : []), ...(f.c !== 0 ? ["c"] : [])].join(""), `${categorie} graine ${graine} : ordre d'affichage = les termes non nuls (${e.ordreTermes.join("")})`);
    p.a.push(f.a);
    p.b.push(f.b);
    p.c.push(f.c);
    p.yS.push(f.yS);
    p.ordres.add(e.ordreTermes.join(""));
  }
}
const bornes = (t: number[]): [number, number] => [Math.min(...t), Math.max(...t)];
const P = (c: string) => plages.get(c)!;
verifier(bornes(P("mise_en_evidence").a)[0] >= 1 && bornes(P("mise_en_evidence").a)[1] <= 4 && bornes(P("mise_en_evidence").c).join() === "0,0" && bornes(P("mise_en_evidence").b)[0] >= -20 && bornes(P("mise_en_evidence").b)[1] <= 20, "mise_en_evidence : a ∈ [1, 4], c = 0, b ∈ [−20, 20]");
verifier(bornes(P("binome_conjugue").b).join() === "0,0" && bornes(P("binome_conjugue").c)[0] >= -100 && bornes(P("binome_conjugue").c)[1] <= -1, "binome_conjugue : b = 0, c ∈ [−100, −1]");
verifier(bornes(P("produit_remarquable").yS).join() === "0,0" && bornes(P("produit_remarquable").c)[0] >= 1 && bornes(P("produit_remarquable").b)[0] >= -40 && bornes(P("produit_remarquable").b)[1] <= 40, "produit_remarquable : yS = 0, c ∈ [1, 100], b ∈ [−40, 40]");
verifier(bornes(P("irreductible").a)[0] >= -4 && bornes(P("irreductible").a)[1] <= 4 && !P("irreductible").a.includes(0) && bornes(P("irreductible").a)[0] < 0 && bornes(P("irreductible").a)[1] > 0, "irreductible : a ∈ [−4, 4] \\ {0}, les deux signes de a apparaissent");
verifier(bornes(P("irreductible").b)[0] >= -16 && bornes(P("irreductible").b)[1] <= 16 && bornes(P("irreductible").c)[0] >= -20 && bornes(P("irreductible").c)[1] <= 20 && bornes(P("irreductible").yS)[0] >= -4.75 && bornes(P("irreductible").yS)[1] <= 4.75, "irreductible : b ∈ [−16, 16], c ∈ [−20, 20], yS ∈ [−4,75 ; 4,75] (plages de l'ancien pilote)");
verifier(CATEGORIES.every((c) => P(c).ordres.size > 1), "l'ordre d'affichage des termes varie avec la graine");

// ── 2. Écrans ──
const ATTENDUS = ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance", "racinesChamp1", "racinesChamp2", "tableauSignes"];
const textesDe = (e: EcranDeclare): string[] => {
  const t = [e.consigne];
  if (e.type === "qcm") t.push(...e.choix.map((c) => c.libelle));
  if (e.type === "champs_multiples") for (const s of e.champs) t.push(s.libelle, ...(s.genre === "choix" ? s.choix.map((c) => c.libelle) : []));
  if (e.type === "liste_valeurs") t.push(e.etiquetteAjout, ...(e.etiquetteAucune ? [e.etiquetteAucune] : []), ...(e.etiquetteAuMoinsUne ? [e.etiquetteAuMoinsUne] : []));
  if (e.type === "tableau_signes") {
    for (const c of e.colonnes) t.push(c.libelle, ...(c.valeur ? [c.valeur] : []), ...(c.symbole ? [c.symbole] : []));
    for (const l of e.lignes) t.push(l.libelle);
  }
  if (typeof e.aide === "string") t.push(e.aide);
  return t;
};
for (const categorie of CATEGORIES) {
  for (const graine of GRAINES.slice(0, 80)) {
    const brut = genererExercice(categorie, graine);
    for (const [nom, ex] of [["brut", brut], ["projeté (immédiat)", projeterAnalyseFonction(brut, [], { correctionImmediate: true })], ["projeté (coupé)", projeterAnalyseFonction(brut, [], { correctionImmediate: false })]] as const) {
      const ecrans = ecransAnalyseFonction(ex);
      const champs = ecrans.map((e) => e.champ);
      const attendu = categorie === "irreductible" ? ATTENDUS.filter((c) => c !== "racinesChamp1" && c !== "racinesChamp2") : ATTENDUS;
      verifier(champs.join() === attendu.join() && champs.join() === champsAnalyseFonction(categorie).join(), `${categorie} ${nom} : ${categorie === "irreductible" ? 6 : 8} écrans dans l'ordre (${champs.join()})`);
      verifier(validerDependances(ecrans).length === 0, `${categorie} ${nom} : dépendances valides (${validerDependances(ecrans).join(" ; ")})`);
      for (const e of ecrans) {
        for (const texte of textesDe(e)) {
          const problemes = verifierBalisageMath(texte);
          verifier(problemes.length === 0, `${categorie} ${nom} / ${e.champ} : texte d'auteur « ${texte} » : ${problemes.join(" ; ")}`);
        }
        if (typeof e.aide === "object") verifier(validerAide(e.aide).length === 0, `${categorie} ${nom} / ${e.champ} : aide typée invalide : ${validerAide(e.aide).join(" ; ")}`);
      }
      // Énoncé par écran : les 5 écrans « fonction » répètent f(x), les écrans « racines » parlent de l'équation.
      const consigne = (c: string) => ecrans.find((e) => e.champ === c)!.consigne;
      for (const c of ["coefficients", "allure", "axeSommet", "domaineImage", "tableauSignes"]) verifier(consigne(c).startsWith("Étudie la fonction suivante : $f(x) = "), `${categorie} ${nom} / ${c} : consigne persistante « Étudie la fonction suivante : f(x) = … »`);
      verifier(/f\(x\) = .*\$/.test(consigne("coefficients")) && !consigne("coefficients").includes("²"), `${categorie} / coefficients : exposant en LaTeX, jamais « ² »`);
      if (categorie !== "irreductible") {
        verifier(/= 0\$/.test(consigne("racinesChamp1")) && /= 0\$/.test(consigne("racinesChamp2")), `${categorie} ${nom} : les écrans racines énoncent « … = 0 »`);
      }
    }
  }
}
// af_irreductible : JAMAIS un écran de racines, nulle part dans la sortie (ni écran, ni champ, ni dépendance).
{
  const irr = genererExercice("irreductible", 1);
  const brut = JSON.stringify(ecransAnalyseFonction(irr));
  verifier(!brut.includes("racinesChamp1") && !brut.includes("racinesChamp2"), "af_irreductible : aucune trace des écrans racines (6 écrans, jamais 8)");
}

// ── 3. Solutions : la réponse correcte de chaque champ est jugée correcte ──
for (const categorie of CATEGORIES) {
  for (const graine of GRAINES) {
    const ex = genererExercice(categorie, graine);
    for (const projete of [ex, projeterAnalyseFonction(ex, [], { correctionImmediate: true }), projeterAnalyseFonction(ex, [], { correctionImmediate: false })]) {
      for (const champ of champsAnalyseFonction(categorie)) {
        const brute = reponseBruteCorrecteAnalyseFonction(projete, champ);
        const r = verifierAnalyseFonction(projete, champ, brute);
        verifier(r.statut === "correct", `${categorie} graine ${graine} / ${champ} : la réponse correcte « ${brute.slice(0, 60)} » doit être jugée correcte (${r.statut})`);
        const solution = solutionAttendueAnalyseFonction(projete, champ);
        verifier(solution.trim() !== "" && verifierBalisageMath(solution).length === 0 && !/-0\b|NaN|undefined/.test(solution), `${categorie} graine ${graine} / ${champ} : solution lisible saine « ${solution} »`);
      }
    }
  }
}
verifier(solutionAttendueAnalyseFonction(genererExercice("mise_en_evidence", 12345), "axeSommet").startsWith("$x = "), "solution d'axeSommet : « x = … » (l'ancien pilote l'omettait, D8)");
try {
  reponseBruteCorrecteAnalyseFonction(genererExercice("irreductible", 1), "racinesChamp1");
  verifier(false, "racinesChamp1 sur af_irreductible doit lever");
} catch {
  verifier(true, "racinesChamp1 / racinesChamp2 sur af_irreductible : échec bruyant (jamais « toujours correct »)");
}
try {
  verifierAnalyseFonction(genererExercice("irreductible", 1), "racinesChamp2", "[]");
  verifier(false, "racinesChamp2 sur af_irreductible doit lever");
} catch {
  verifier(true, "racinesChamp2 forcé sur af_irreductible : lève");
}

// ── 4. Cascade ──
const conf = (champ: string, brute: string, statut: ReponseConfirmee["statut"]): ReponseConfirmee => ({ champ, reponseBrute: brute, statut });
const me = genererExercice("mise_en_evidence", 12345); // f = 4x² + 8x = 4x(x + 2)
verifier(me.formeFactorisee === "4x(x + 2)" && me.fonction.racines!.join() === "-2,0", `exercice de référence de la cascade : 4x(x + 2), racines −2 ; 0 (${me.formeFactorisee})`);
const vraies = "-2,0";
const zerosDe = (e: ExerciceAnalyseFonction) => e.zeros!;
const jugerZeros = (e: ExerciceAnalyseFonction, valeurs: string[]) => verifierAnalyseFonction(e, CHAMP_RACINES_ZEROS, JSON.stringify(valeurs)).statut;

// A1. Correction immédiate, factorisation juste (écrite autrement) : affichage de l'élève, racines vraies.
{
  const p = projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, "(4x)(x+2) = 0", "correct")], { correctionImmediate: true });
  verifier(zerosDe(p).origine === "eleve" && zerosDe(p).racines.join() === vraies && !zerosDe(p).factorisationLatex.includes("(4x)(x+2)"), `A1 : factorisation juste de l'élève, ré-écrite (${zerosDe(p).factorisationLatex})`);
  verifier(zerosDe(p).factorisationLatex === "(4x)(x + 2)", `A1 : re-sérialisation LaTeX propre (${zerosDe(p).factorisationLatex})`);
  verifier(jugerZeros(p, ["-2", "0"]) === "correct", "A1 : « −2 ; 0 » juste");
}
// A2. Correction coupée, factorisation FAUSSE mais exploitable : l'équation et les racines sont celles de l'élève.
{
  const p = projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, "3x(x-2)", "not_equivalent")], { correctionImmediate: false });
  verifier(zerosDe(p).origine === "eleve" && zerosDe(p).racines.join() === "0,2" && zerosDe(p).factorisationLatex === "3x(x - 2)", `A2 : correction coupée, la donnée de départ est celle de l'élève (${JSON.stringify(zerosDe(p))})`);
  verifier(jugerZeros(p, ["0", "2"]) === "correct" && jugerZeros(p, ["-2", "0"]) === "not_equivalent", "A2 : une méthode juste sur une donnée fausse RÉUSSIT ; les vraies racines ne réussissent plus (§18)");
  verifier(zerosDe(genererExercice("mise_en_evidence", 12345)).racines.join() === vraies, "A2 : l'exercice brut n'est jamais modifié (projection pure)");
}
// A3. Correction immédiate, réponse fausse RÉVÉLÉE. §33-D : vraie factorisation. RAPPORT §38 (D-A du propriétaire, cascade uniforme dans les deux
// régimes) : la factorisation de l'élève, fausse mais exploitable, reste la donnée de départ — comme en correction coupée (A2).
{
  const p = projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, "3x(x-2)", "not_equivalent")], { correctionImmediate: true });
  verifier(zerosDe(p).origine === "eleve" && zerosDe(p).racines.join() === "0,2" && zerosDe(p).factorisationLatex === "3x(x - 2)", `A3 : correction immédiate, réponse révélée mais exploitable → SA factorisation (${JSON.stringify(zerosDe(p))})`);
  verifier(jugerZeros(p, ["0", "2"]) === "correct" && jugerZeros(p, ["-2", "0"]) === "not_equivalent", "A3 : une méthode juste sur SA donnée réussit aussi sous correction immédiate");
}
// A4. Inexploitable : repli à deux régimes.
const INEXPLOITABLES: [string, string, ReponseConfirmee["statut"]][] = [
  ["illisible", "abc((", "not_equivalent"],
  ["statut parse_error", "4x(x+2)", "parse_error"],
  ["vide", "", "not_equivalent"],
  ["cubique (3 racines)", "x(x-1)(x-2)", "not_equivalent"],
  ["sans racine réelle", "x^2+1", "not_equivalent"],
  ["constante", "7", "not_equivalent"],
  ["trop long", "x".repeat(500), "not_equivalent"],
  ["valeur non finie", "1/0*x", "not_equivalent"],
];
for (const [nom, brute, statut] of INEXPLOITABLES) {
  const coupe = projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, brute, statut)], { correctionImmediate: false });
  const immediat = projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, brute, statut)], { correctionImmediate: true });
  verifier(zerosDe(coupe).origine === "enonce" && zerosDe(coupe).racines.join() === vraies && zerosDe(coupe).factorisationLatex === "4x^2 + 8x", `A4 « ${nom} » : correction coupée → équation développée PUBLIQUE, racines vraies (${JSON.stringify(zerosDe(coupe))})`);
  verifier(zerosDe(immediat).origine === "solution" && zerosDe(immediat).factorisationLatex === "4x(x + 2)", `A4 « ${nom} » : correction immédiate → vraie factorisation`);
  verifier(!JSON.stringify(zerosDe(coupe)).includes("(x + 2)"), `A4 « ${nom} » : sous correction coupée, la vraie factorisation ne fuit pas`);
}
// A5. Formes exploitables : développée, racine unique, puissance, décimales.
for (const [brute, attendu] of [["x^2-4", "-2,2"], ["2x-6", "3,3"], ["(x-3)^2", "3,3"], ["0.5x(x-0.5)", "0,0.5"], ["-x(x+2)", "-2,0"], ["(x+1)(x-1) = 0", "-1,1"], ["x²-9", "-3,3"]] as const) {
  const r = racinesDeFactorisation(brute);
  verifier(r !== null && r.join() === attendu, `A5 : racines de « ${brute} » = ${attendu} (obtenu ${String(r)})`);
}
// A6. Un `statut: correct` garde les VRAIES racines, même si l'écriture de l'élève en donnerait de légèrement différentes.
{
  const p = projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, "4x(x+2.0000001)", "correct")], { correctionImmediate: false });
  verifier(zerosDe(p).racines.join() === vraies && zerosDe(p).origine === "eleve", "A6 : « correct » (tolérance 1e-6) → racines attendues exactes");
}
// A7. Le filtrage serveur : racinesChamp2 n'est servi qu'une fois racinesChamp1 terminé.
{
  const ecrans = ecransAnalyseFonction(me);
  const ch2 = ecrans.find((e) => e.champ === CHAMP_RACINES_ZEROS)!;
  verifier(!dependancesTerminees(ch2, new Set(["coefficients"])) && dependancesTerminees(ch2, new Set([CHAMP_RACINES_FACTORISATION])), "A7 : racinesChamp2 dépend de racinesChamp1");
  verifier(!ecransServis(ecrans, new Set(), false).some((e) => e.champ === CHAMP_RACINES_ZEROS) && ecransServis(ecrans, new Set([CHAMP_RACINES_FACTORISATION]), false).some((e) => e.champ === CHAMP_RACINES_ZEROS), "A7 : écran servi seulement après racinesChamp1");
}
// B. Tableau : valeurs vraies (immédiat) ou symboliques (coupé) ; gating par dependDe.
for (const categorie of CATEGORIES) {
  const ex = genererExercice(categorie, 12345);
  const tab = (e: ExerciceAnalyseFonction) => ecransAnalyseFonction(e).find((s) => s.champ === "tableauSignes")!;
  const serie = (e: EcranDeclare) => (e.type === "tableau_signes" ? e.colonnes : []);
  const immediat = serie(tab(projeterAnalyseFonction(ex, [], { correctionImmediate: true })));
  const coupe = serie(tab(projeterAnalyseFonction(ex, [], { correctionImmediate: false })));
  verifier(immediat.filter((c) => c.genre === "valeur").every((c) => /^\$-?[\d\\]/.test(c.valeur ?? "") && c.symbole !== undefined), `B ${categorie} : correction immédiate → valeurs numériques + symboles`);
  verifier(coupe.filter((c) => c.genre === "valeur").every((c) => /^\$x_(1|2|S)\$$/.test(c.valeur ?? "") && c.symbole === undefined), `B ${categorie} : correction coupée → valeurs SYMBOLIQUES, pas de bande de symboles`);
  verifier(!/[0-9]/.test(JSON.stringify(coupe.map((c) => [c.libelle, c.valeur, c.symbole])).replace(/x_[12]/g, "x_")), `B ${categorie} : correction coupée → aucun chiffre dans le tableau servi (${JSON.stringify(coupe.map((c) => c.libelle))})`);
  const dep = tab(ex).dependDe ?? [];
  // RAPPORT §41 : le tableau dépend aussi de `coefficients` (il est jugé sur la fonction effective).
  verifier(categorie === "irreductible" ? dep.join() === "coefficients,axeSommet" : dep.join() === "coefficients,axeSommet,racinesChamp2", `B ${categorie} : tableau gardé par ${dep.join()}`);
  verifier(!ecransServis(ecransAnalyseFonction(ex), new Set(["coefficients", "axeSommet"]), false).some((s) => s.champ === "tableauSignes") === (categorie !== "irreductible"), `B ${categorie} : tableau non servi tant que ses prédécesseurs ne sont pas terminés`);
  // La vérification du tableau ne dépend PAS de l'affichage.
  const brute = reponseBruteCorrecteAnalyseFonction(ex, "tableauSignes");
  verifier(verifierAnalyseFonction(projeterAnalyseFonction(ex, [], { correctionImmediate: false }), "tableauSignes", brute).statut === "correct", `B ${categorie} : le tableau attendu est celui de la vraie fonction, quel que soit l'affichage`);
}

// ── 5. Entrées hostiles (texte de l'élève) ──
for (const hostile of ["__proto__", "constructor", "toString", "{\"a\":1}", "'; DROP TABLE reponses;--", "<script>alert(1)</script>", "\\textcolor{red}{x}", "$x$", "x)(x", "((((((((((((((((((((x", "𝒳(x-1)", "x".repeat(10000), "\u0000", "1e999*x", "NaN", "Infinity*x"]) {
  for (const statut of ["correct", "not_equivalent", "parse_error"] as const) {
    for (const immediat of [true, false]) {
      let sain = true;
      let z;
      try {
        z = zerosDe(projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, hostile, statut)], { correctionImmediate: immediat }));
        const texte = ecransAnalyseFonction(projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, hostile, statut)], { correctionImmediate: immediat })).map((e) => e.consigne).join(" ");
        sain = verifierBalisageMath(texte).length === 0 && !texte.includes("<script") && !texte.includes("textcolor") && !texte.includes("DROP TABLE");
      } catch (erreur) {
        sain = false;
        echecs.push(`entrée hostile « ${hostile.slice(0, 30)} » (${statut}, ${immediat ? "immédiat" : "coupé"}) : exception ${(erreur as Error).message}`);
      }
      verifier(sain && z !== undefined && z.racines.every(Number.isFinite), `entrée hostile « ${hostile.slice(0, 30)} » (${statut}, ${immediat ? "immédiat" : "coupé"}) : consigne saine, racines finies`);
    }
  }
}
verifier(factorisationVersLatex("__proto__") === null && racinesDeFactorisation("constructor") === null, "« __proto__ » et « constructor » : illisibles, jamais un membre du prototype");
verifier(projeterAnalyseFonction(genererExercice("irreductible", 5), [conf(CHAMP_RACINES_FACTORISATION, "x(x-1)", "correct")], { correctionImmediate: true }).zeros === null, "af_irreductible : aucune donnée de racines même si une réponse forgée existe");
verifier(ecransAnalyseFonction(me).map((e) => e.champ).join() === ecransAnalyseFonction(projeterAnalyseFonction(me, [conf(CHAMP_RACINES_FACTORISATION, "3x(x-2)", "not_equivalent")], { correctionImmediate: false })).map((e) => e.champ).join(), "la projection ne change JAMAIS la liste des champs (champs_attendus figé à l'assignation)");

// ── 6. Panneau « Ce que tu sais déjà » : texte de consigne, seulement les écrans RÉUSSIS qui PRÉCÈDENT, jamais sous correction coupée ──
{
  const PANNEAU = "Ce que tu sais déjà :";
  const consigneDe2 = (ex: ExerciceAnalyseFonction, champ: string): string => ecransAnalyseFonction(ex).find((e) => e.champ === champ)?.consigne ?? "";
  for (const categorie of CATEGORIES) {
    for (const graine of [1, 42, 12345, 987654]) {
      const brut = genererExercice(categorie, graine);
      const ordre = champsAnalyseFonction(categorie);
      const f = brut.fonction;
      const bonnes = ordre.map((champ) => conf(champ, reponseBruteCorrecteAnalyseFonction(brut, champ), "correct"));
      // aucune réponse, ou correction coupée avec TOUT confirmé : jamais de panneau
      for (const [nom, ex] of [["brut", brut], ["aucune réponse", projeterAnalyseFonction(brut, [], { correctionImmediate: true })], ["coupé, tout réussi", projeterAnalyseFonction(brut, bonnes, { correctionImmediate: false })]] as const) {
        verifier(ecransAnalyseFonction(ex).every((e) => !e.consigne.includes(PANNEAU)), `${categorie}/${graine} ${nom} : aucun panneau`);
      }
      for (let k = 0; k <= ordre.length; k++) {
        const ex = projeterAnalyseFonction(brut, bonnes.slice(0, k), { correctionImmediate: true });
        ordre.forEach((champ, i) => {
          const c = consigneDe2(ex, champ);
          const reussis = ordre.slice(0, Math.min(i, k));
          const attendu = (c2: string) => reussis.includes(c2);
          const aPanneau = c.includes(PANNEAU);
          const doitAvoir = reussis.some((r) => ["coefficients", "allure", "axeSommet", "domaineImage"].includes(r)) || (attendu("racinesChamp1") && attendu("racinesChamp2"));
          verifier(aPanneau === doitAvoir, `${categorie}/${graine} k=${k} ${champ} : panneau ${aPanneau ? "présent" : "absent"}, attendu ${doitAvoir ? "présent" : "absent"}`);
          const ligne = c.split("\n").find((l) => l.startsWith(PANNEAU)) ?? "";
          verifier(ligne.includes("$a = ") === attendu("coefficients"), `${categorie}/${graine} k=${k} ${champ} : coefficients rappelés ssi réussis avant`);
          verifier(ligne.includes("parabole tournée vers le ") === attendu("allure"), `${categorie}/${graine} k=${k} ${champ} : allure rappelée ssi réussie avant`);
          verifier(ligne.includes("sommet $S(") === attendu("axeSommet"), `${categorie}/${graine} k=${k} ${champ} : sommet rappelé ssi réussi avant`);
          verifier(ligne.includes("\\mathrm{im}") === attendu("domaineImage"), `${categorie}/${graine} k=${k} ${champ} : ensemble-image rappelé ssi réussi avant`);
          verifier((/\$x_[12]\s*=/.test(ligne)) === (attendu("racinesChamp1") && attendu("racinesChamp2") && categorie !== "irreductible"), `${categorie}/${graine} k=${k} ${champ} : racines rappelées ssi les deux écrans racines sont réussis avant (${ligne})`);
          verifier(verifierBalisageMath(c).length === 0, `${categorie}/${graine} k=${k} ${champ} : consigne avec panneau saine`);
          if (champ !== "racinesChamp1" && champ !== "racinesChamp2" && champ !== "racinesReconnaissance") // RAPPORT §38 : après « coefficients » confirmés (justes ou faux, même libellé), allure/axeSommet/domaineImage disent « d'après les coefficients que tu as donnés ».
            verifier(c.startsWith("Étudie la fonction suivante") && c.split("\n")[0]!.includes(" : $f(x) = ") && (!aPanneau || c.split("\n")[0]!.endsWith("$.")), `${categorie}/${graine} ${champ} : la première ligne reste l'énoncé de la fonction`);
        });
      }
      // un écran RATÉ (même révélé par la correction immédiate) n'est jamais rappelé
      const rate = projeterAnalyseFonction(brut, [conf("coefficients", "{}", "not_equivalent"), conf("allure", reponseBruteCorrecteAnalyseFonction(brut, "allure"), "correct")], { correctionImmediate: true });
      const cAxe = consigneDe2(rate, "axeSommet");
      verifier(cAxe.includes("parabole tournée vers le ") && !cAxe.includes("$a = ") && !cAxe.includes(`$b = ${f.b}$`), `${categorie}/${graine} : un écran raté n'est jamais rappelé (${cAxe.split("\n")[1] ?? ""})`);
      // un écran ne rappelle jamais SA propre réponse
      const seul = projeterAnalyseFonction(brut, bonnes.slice(0, 1), { correctionImmediate: true });
      verifier(!consigneDe2(seul, "coefficients").includes(PANNEAU), `${categorie}/${graine} : l'écran coefficients ne rappelle pas ses propres coefficients`);
    }
  }
  // Le panneau ne change ni la liste des champs ni le nombre d'écrans (champs_attendus figé à l'assignation).
  const brut = genererExercice("mise_en_evidence", 12345);
  const tous = ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance", "racinesChamp1", "racinesChamp2", "tableauSignes"].map((c) => conf(c, reponseBruteCorrecteAnalyseFonction(brut, c), "correct"));
  verifier(ecransAnalyseFonction(projeterAnalyseFonction(brut, tous, { correctionImmediate: true })).map((e) => e.champ).join() === champsAnalyseFonction("mise_en_evidence").join(), "le panneau ne change pas la liste des champs");
  const tab = consigneDe2(projeterAnalyseFonction(brut, tous, { correctionImmediate: true }), "tableauSignes");
  verifier(tab.includes("racines $x_1 = -2$ et $x_2 = 0$") && tab.includes("sommet $S(-1\\,;\\,-4)$") && tab.includes("$\\mathrm{im}\\,f = [-4\\,;\\,+\\infty[$"), `panneau complet de 4x²+8x avant le tableau : « ${tab.split("\n")[1]} »`);
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (génération seedée + ordre des tirages figé, 8/6 écrans, dépendances, textes sains, solutions, cascade A/B, entrées hostiles)`);
