// Test permanent — cascade des coefficients sur le TABLEAU DE SIGNES de gen7 (RAPPORT §41), contre le VRAI `api/router.ts` et le VRAI registre.
// Lancer : `npm run test-cascade-tableau-gen7`. Sans réseau.
//
// Décision : le tableau est jugé sur la fonction EFFECTIVE (celle des coefficients CONFIRMÉS, comme `allure`, `axeSommet`, `domaineImage`) ; ses
// racines et son sommet en sont DÉRIVÉS (jamais des réponses tapées à `axeSommet`/`racinesChamp2`, dont l'incohérence produirait un tableau mal
// formé). Coefficients inexploitables ou justes -> la vraie fonction, tableau inchangé. Deux régimes de correction.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import type { EcranDeclare } from "../lib/contratGenerateur";
import {
  fonctionEffective,
  genererExercice,
  projeterAnalyseFonction,
  reponseBruteCorrecteAnalyseFonction,
  solutionTableau,
  type ExerciceAnalyseFonction,
} from "../src/generateurs/analyseFonction";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

// RAPPORT §45 : avec « Afficher la réponse attendue » la réponse fausse est révélée et le tableau repart de la VRAIE fonction (section 5) ; la cascade sur
// SA fonction ne vit donc que là où rien n'a été montré : immédiate SANS la case, et correction coupée.
const REGIMES: { nom: string; feedback: boolean }[] = [{ nom: "correction immédiate sans la case", feedback: true }, { nom: "correction coupée", feedback: false }];
const COEF = (a: string, b: string, c: string) => JSON.stringify({ a, b, c });

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  let compteur = 0;

  /** Assigne UN exercice (mise_en_evidence, f = 4x² + 8x pour la graine 12345), répond à coefficients puis aux écrans intermédiaires, et renvoie l'exercice prêt au tableau. */
  const jusquAuTableau = async (feedback: boolean, coefficients: string, visible = false) => {
    compteur++;
    const tache = creerTache(s, { nom: `tableau ${compteur}`, variantes: [{ variante_id: "af_mise_en_evidence", nombre_exercices: 1 }], feedback_immediat: feedback, reponse_visible: visible }); // (visible = case « Afficher la réponse attendue » cochée (RAPPORT §42) : seule elle montre les valeurs vraies
    const o = Math.random;
    Math.random = () => 12345 / 2 ** 32;
    try {
      await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    } finally {
      Math.random = o;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const brut = genererExercice("mise_en_evidence", Number(ligne.graine));
    const poster = (champ: string, b: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: id, champ, reponse_brute: b } });
    await poster("coefficients", coefficients);
    // Les écrans intermédiaires reçoivent une réponse quelconque (leur verdict n'est pas le sujet) : ils doivent seulement être TERMINÉS.
    await poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
    await poster("axeSommet", JSON.stringify({ axeTexte: "x = 0", xS: "0", yS: "0" }));
    await poster("domaineImage", JSON.stringify({ crochetGauche: "[", borneGauche: "0", crochetDroit: "[", borneDroite: "+inf" }));
    await poster("racinesReconnaissance", reponseBruteCorrecteAnalyseFonction(brut, "racinesReconnaissance"));
    await poster("racinesChamp1", reponseBruteCorrecteAnalyseFonction(brut, "racinesChamp1"));
    await poster("racinesChamp2", reponseBruteCorrecteAnalyseFonction(brut, "racinesChamp2"));
    const lire = async () => (await appeler(`exercices/${id}`, "GET", { jeton: "eleve:eleve-1" })).corps as { ecrans: EcranDeclare[]; champs: any[] };
    const statuts = (champ: string) => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === champ).map((l) => l.statut as string);
    return { id, brut, poster, lire, statuts };
  };
  const tableauServi = (g: { ecrans: EcranDeclare[] }) => g.ecrans.find((e) => e.champ === "tableauSignes") as any;
  /** Fonction effective attendue pour des coefficients confirmés donnés. */
  const effectiveDe = (brut: ExerciceAnalyseFonction, coefficients: string, feedback: boolean) =>
    fonctionEffective(projeterAnalyseFonction(brut, [{ champ: "coefficients", reponseBrute: coefficients, statut: "not_equivalent" }], { correctionImmediate: feedback, solutionMontree: false }));

  // ── 1. Signe de a opposé : le tableau change (2 racines, a < 0) ──
  for (const r of REGIMES) {
    const c = COEF("-5", "4", "0"); // f_eff = −5x² + 4x : racines 0 et 0,8 ; a < 0 ; vraie f = 4x² + 8x (a > 0)
    const x = await jusquAuTableau(r.feedback, c);
    const eff = effectiveDe(x.brut, c, r.feedback);
    const sol = solutionTableau(eff);
    verifier(JSON.stringify(sol.signe) !== JSON.stringify(solutionTableau(x.brut.fonction).signe), `${r.nom} / a<0 : le tableau attendu diffère de celui de la vraie fonction`);
    verifier(sol.variation.c3 === "⌢" && sol.signe.c0 === "-" && sol.signe.c1 === "0", `${r.nom} / a<0 : attendu − 0 + … et ⌢ (${JSON.stringify(sol)})`);
    const g = await x.lire();
    const t = tableauServi(g);
    verifier(t !== undefined && t.colonnes.length === 7, `${r.nom} / a<0 : tableau à 7 colonnes servi`);
    if (r.feedback) verifier(!/racines? \$x_1/.test(t.consigne) && !t.consigne.includes("racine double"), `${r.nom} / a<0 : le panneau ne rappelle pas de racines qui contredisent SA fonction (« ${t.consigne.slice(0, 140).replace(/\n/g, " / ")} »)`);
    const valeurs = t.colonnes.filter((k: any) => k.genre === "valeur").map((k: any) => k.valeur);
    verifier(JSON.stringify(valeurs) === JSON.stringify(["$x_1$", "$x_S$", "$x_2$"]), `${r.nom} / a<0 : valeurs de x SYMBOLIQUES (aucune solution montrée), obtenu ${JSON.stringify(valeurs)}`);
    await x.poster("tableauSignes", JSON.stringify(sol));
    verifier(x.statuts("tableauSignes")[0] === "correct", `${r.nom} / a<0 : le tableau de SA fonction est accepté`);
    const y = await jusquAuTableau(r.feedback, c);
    await y.poster("tableauSignes", JSON.stringify(solutionTableau(y.brut.fonction)));
    verifier(y.statuts("tableauSignes")[0] === "not_equivalent", `${r.nom} / a<0 : le tableau de la VRAIE fonction n'est pas celui de SA fonction`);
  }

  // ── 2. Δ < 0 pour ses coefficients : structure à 3 colonnes ──
  for (const r of REGIMES) {
    const c = COEF("5", "1", "5"); // Δ = 1 − 100 < 0
    const x = await jusquAuTableau(r.feedback, c);
    const g = await x.lire();
    const t = tableauServi(g);
    verifier(t.colonnes.length === 3, `${r.nom} / Δ<0 : tableau à 3 colonnes (${t.colonnes.length})`);
    const eff = effectiveDe(x.brut, c, r.feedback);
    await x.poster("tableauSignes", JSON.stringify(solutionTableau(eff)));
    verifier(x.statuts("tableauSignes")[0] === "correct", `${r.nom} / Δ<0 : accepté`);
  }

  // ── 3. Racines irrationnelles : « 0 » aux colonnes de racine malgré l'arrondi flottant ──
  for (const r of REGIMES) {
    const c = COEF("5", "4", "-4"); // Δ = 96 : racines (−4 ± √96)/10
    const x = await jusquAuTableau(r.feedback, c);
    const sol = solutionTableau(effectiveDe(x.brut, c, r.feedback));
    verifier(sol.signe.c1 === "0" && sol.signe.c5 === "0" && sol.signe.c0 === "+" && sol.signe.c2 === "-" && sol.signe.c3 === "-" && sol.signe.c6 === "+", `${r.nom} / racines irrationnelles : 0 aux racines (${JSON.stringify(sol.signe)})`);
    await x.poster("tableauSignes", JSON.stringify(sol));
    verifier(x.statuts("tableauSignes")[0] === "correct", `${r.nom} / racines irrationnelles : accepté`);
  }

  // ── 4. Coefficients illisibles -> vraie fonction (les coefficients justes sont couverts par test-cascade-gen7-coefficients et les tests d'origine) ──
  for (const r of REGIMES) {
    const x0 = await jusquAuTableau(r.feedback, "{}"); // illisible : repli
    const { ecransAnalyseFonction } = await import("../src/generateurs/analyseFonction");
    const attendu = ecransAnalyseFonction(projeterAnalyseFonction(x0.brut, [], { correctionImmediate: r.feedback, solutionMontree: false })).find((e) => e.champ === "tableauSignes") as any;
    verifier(JSON.stringify(tableauServi(await x0.lire()).colonnes) === JSON.stringify(attendu.colonnes), `${r.nom} / illisibles : colonnes de la vraie fonction`);
    await x0.poster("tableauSignes", JSON.stringify(solutionTableau(x0.brut.fonction)));
    verifier(x0.statuts("tableauSignes")[0] === "correct", `${r.nom} / illisibles : la vraie fonction sert`);
  }

  // ── 4 bis. Avec « Afficher la réponse attendue » (RAPPORT §45) : coefficients faux RÉVÉLÉS -> le tableau repart de la VRAIE fonction, valeurs de x numériques ──
  {
    const c = COEF("-5", "4", "0"); // SA fonction : −5x² + 4x ; la vraie : 4x² + 8x (racines −2 et 0, sommet −1)
    const x = await jusquAuTableau(true, c, true);
    const t = tableauServi(await x.lire());
    const valeurs = t.colonnes.filter((k: any) => k.genre === "valeur").map((k: any) => k.valeur);
    verifier(JSON.stringify(valeurs) === JSON.stringify(["$-2$", "$-1$", "$0$"]), `avec la case : valeurs de x de la VRAIE fonction, obtenu ${JSON.stringify(valeurs)}`);
    await x.poster("tableauSignes", JSON.stringify(solutionTableau(x.brut.fonction)));
    verifier(x.statuts("tableauSignes")[0] === "correct", "avec la case : le tableau de la VRAIE fonction est accepté");
    const y = await jusquAuTableau(true, c, true);
    await y.poster("tableauSignes", JSON.stringify(solutionTableau(effectiveDe(y.brut, c, true))));
    verifier(y.statuts("tableauSignes")[0] === "not_equivalent", "avec la case : le tableau de SA fonction (fausse, révélée) n'est plus accepté");
  }

  // ── 5. Déclaration de dépendance ──
  {
    const { ecransAnalyseFonction } = await import("../src/generateurs/analyseFonction");
    const t = ecransAnalyseFonction(genererExercice("mise_en_evidence", 12345)).find((e) => e.champ === "tableauSignes") as any;
    verifier(t.dependDe.includes("coefficients") && t.dependDe.includes("axeSommet") && t.dependDe.includes("racinesChamp2"), `dependDe du tableau : coefficients, axeSommet, racinesChamp2 (${JSON.stringify(t.dependDe)})`);
    const irr = ecransAnalyseFonction(genererExercice("irreductible", 42)).find((e) => e.champ === "tableauSignes") as any;
    verifier(irr.dependDe.includes("coefficients") && !irr.dependDe.includes("racinesChamp2"), "irréductible : dependDe sans racinesChamp2");
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (tableau jugé sur la fonction effective : a<0, Δ<0, racines irrationnelles, repli, dépendances ; deux régimes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
