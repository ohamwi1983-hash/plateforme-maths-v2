// Test permanent — la cascade repart de la VRAIE valeur dès que la solution a été montrée (RAPPORT §45), contre le VRAI `api/router.ts`, le VRAI registre
// (gen7 « motif / delta ») et une base en mémoire. Lancer : `npm run test-cascade-revelee`. Sans réseau.
//
// Règle (demande du propriétaire, qui précise D-A de §38) : quand « Afficher la réponse attendue » est cochée (correction immédiate), une réponse
// NON correcte a été RÉVÉLÉE avec sa solution. Les écrans suivants ne doivent plus réutiliser cette réponse fausse : ils partent de la vraie valeur.
// Sans solution montrée (correction coupée, ou immédiate sans la case), la cascade sur la donnée de l'élève est inchangée (§38 : une méthode juste
// appliquée à une donnée fausse réussit). Une réponse CORRECTE, elle, sert de point de départ dans tous les cas.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { fonctionVraie, type ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { latexExact } from "../src/generateurs/analyseFonctionMotifDelta/exact/nombreExact";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

// f(x) = x² + 3x − 4 (af_delta_racines_rationnelles, graine 4242) : racines −4 et 1, sommet (−3/2 ; −25/4), a > 0 et sommet à GAUCHE de l'axe Oy.
// Coefficients FAUX confirmés : a = −1, b = 3, c = 4 → f_élève(x) = −x² + 3x + 4 : racines −1 et 4, sommet (3/2 ; 25/4), a < 0 et sommet à DROITE.
const FAMILLE = "af_delta_racines_rationnelles";
const GRAINE = 4242;
const COEF_FAUX = JSON.stringify({ a: "-1", b: "3", c: "4" });
const ALLURE_VRAIE = JSON.stringify({ concavite: "+", positionSommet: "gauche" });
const ALLURE_DE_SES_COEFFICIENTS = JSON.stringify({ concavite: "-", positionSommet: "droite" });
const AXE_DE_SES_COEFFICIENTS = JSON.stringify({ axeTexte: "x = 3/2", xS: "3/2", yS: "25/4" });
const IMAGE_DE_SES_COEFFICIENTS = JSON.stringify({ crochetGauche: "]", borneGauche: "-inf", crochetDroit: "]", borneDroite: "25/4" });
const RACINES_VRAIES = JSON.stringify(["-4", "1"]);
const RACINES_DE_SES_COEFFICIENTS = JSON.stringify(["-1", "4"]);

const REGIMES: { nom: string; feedback: boolean; visible: boolean; reveleLaVraie: boolean }[] = [
  { nom: "immédiate + réponse attendue affichée", feedback: true, visible: true, reveleLaVraie: true },
  { nom: "immédiate SANS la case", feedback: true, visible: false, reveleLaVraie: false },
  { nom: "correction coupée", feedback: false, visible: false, reveleLaVraie: false },
];

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  let compteur = 0;

  const nouveau = async (feedback: boolean, visible: boolean) => {
    compteur++;
    const tache = creerTache(s, { nom: `revelee ${compteur}`, variantes: [{ variante_id: FAMILLE, nombre_exercices: 1 }], feedback_immediat: feedback, reponse_visible: visible, tentatives_supplementaires: 0 });
    const o = Math.random;
    Math.random = () => GRAINE / 2 ** 32;
    try {
      await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    } finally {
      Math.random = o;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const brut: ExerciceMotifDelta = genererExerciceMD(FAMILLE, Number(ligne.graine));
    const poster = (champ: string, b: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: id, champ, reponse_brute: b } });
    const lire = async () => (await appeler(`exercices/${id}`, "GET", { jeton: "eleve:eleve-1" })).corps as { ecrans: EcranDeclare[]; champs: any[] };
    const statuts = (champ: string) => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === champ).map((l) => l.statut as string);
    return { brut, poster, lire, statuts };
  };
  const ecran = (g: { ecrans: EcranDeclare[] }, champ: string) => g.ecrans.find((e) => e.champ === champ) as any;
  const consigne = (g: { ecrans: EcranDeclare[] }, champ: string): string => ecran(g, champ)?.consigne ?? "";
  const D_APRES_TES_COEFFICIENTS = "d'après les coefficients que tu as donnés";
  // Sanité de l'exercice épinglé : si le tirage change, ce test doit le dire avant de mentir.
  {
    const f = fonctionVraie(genererExerciceMD(FAMILLE, GRAINE));
    verifier(f.a.n === 1 && f.racines.length === 2 && latexExact(f.racines[0]!) === "-4" && latexExact(f.racines[1]!) === "1" && latexExact(f.yS) === "-\\dfrac{25}{4}", `(sanité) ${FAMILLE} graine ${GRAINE} : f = x² + 3x − 4, racines −4 et 1, y_S = −25/4 (${latexExact(f.yS)})`);
  }

  // ── 1. Coefficients faux, puis allure : ce qui sert de point de départ ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", COEF_FAUX);
    verifier(x.statuts("coefficients")[0] === "not_equivalent", `${r.nom} : a = −1, b = 3, c = 4 est faux pour x² + 3x − 4`);
    const g = await x.lire();
    const c = consigne(g, "allure");
    if (r.reveleLaVraie) {
      verifier(!c.includes(D_APRES_TES_COEFFICIENTS) && !c.includes("-x^2") && !c.includes("- x^2"), `${r.nom} / allure : la réponse fausse n'est PAS réutilisée (« ${c.slice(0, 120)} »)`);
      verifier(c.includes("x^2") && c.includes("3x"), `${r.nom} / allure : l'énoncé reprend la VRAIE fonction x² + 3x − 4 (« ${c.slice(0, 120)} »)`);
      const faux = await x.poster("allure", ALLURE_DE_SES_COEFFICIENTS);
      verifier(faux.corps.statut === "not_equivalent", `${r.nom} / allure : la méthode juste sur SES coefficients n'est plus acceptée (la vraie valeur a été montrée)`);
    } else {
      verifier(c.includes(D_APRES_TES_COEFFICIENTS) && (c.includes("-x^2") || c.includes("- x^2")), `${r.nom} / allure : la cascade sur la donnée de l'élève est inchangée (« ${c.slice(0, 120)} »)`);
      await x.poster("allure", ALLURE_DE_SES_COEFFICIENTS);
      verifier(x.statuts("allure")[0] === "correct", `${r.nom} / allure : « vers le bas, sommet à droite » est juste pour SES coefficients`);
    }
  }
  {
    const x = await nouveau(true, true);
    await x.poster("coefficients", COEF_FAUX);
    await x.poster("allure", ALLURE_VRAIE);
    verifier(x.statuts("allure")[0] === "correct", "immédiate + réponse affichée / allure : « vers le haut, sommet à gauche » (vraie fonction) est correct");
  }

  // ── 2. Une réponse CORRECTE sert de point de départ, dans tous les régimes (rien ne change) ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", reponseBruteCorrecteMotifDelta(x.brut, "coefficients"));
    const g = await x.lire();
    await x.poster("allure", ALLURE_VRAIE);
    verifier(x.statuts("allure")[0] === "correct", `${r.nom} / coefficients justes : l'allure se juge sur la vraie fonction`);
    verifier(consigne(g, "allure").includes("3x") && consigne(g, "allure").includes("x^2"), `${r.nom} / coefficients justes : l'énoncé de l'allure est celui de la vraie fonction (« ${consigne(g, "allure").slice(0, 100)} »)`);
  }

  // ── 3. Tableau de signes : la vraie fonction sous « réponse affichée », celle de l'élève sinon ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", COEF_FAUX);
    if (r.reveleLaVraie) {
      for (const champ of ["allure", "axeSommet", "domaineImage", "racines"]) await x.poster(champ, reponseBruteCorrecteMotifDelta(x.brut, champ));
    } else {
      await x.poster("allure", ALLURE_DE_SES_COEFFICIENTS);
      await x.poster("axeSommet", AXE_DE_SES_COEFFICIENTS);
      await x.poster("domaineImage", IMAGE_DE_SES_COEFFICIENTS);
      await x.poster("racines", RACINES_DE_SES_COEFFICIENTS);
    }
    const t = ecran(await x.lire(), "tableauSignes");
    verifier(t !== undefined, `${r.nom} / tableau : servi`);
    if (t !== undefined) {
      const valeurs: string[] = t.colonnes.filter((c: any) => c.genre === "valeur").map((c: any) => c.valeur as string);
      const vraies = ["$-4$", "$-\\dfrac{3}{2}$", "$1$"];
      if (r.reveleLaVraie) verifier(valeurs.join() === vraies.join(), `${r.nom} / tableau : valeurs de x de la VRAIE fonction (${vraies.join(" ; ")}), obtenu ${valeurs.join()}`);
      else verifier(valeurs.join() !== vraies.join() && valeurs.every((v) => /^\$x_(1|2|S)\$$/.test(v)), `${r.nom} / tableau : valeurs symboliques, pas les valeurs vraies avant la fin (obtenu ${valeurs.join()})`);
    }
  }

  // ── 4. Racines : une liste fausse mais cohérente avec SES coefficients n'est plus reprise quand la solution a été montrée ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", COEF_FAUX);
    if (r.reveleLaVraie) for (const champ of ["allure", "axeSommet", "domaineImage"]) await x.poster(champ, reponseBruteCorrecteMotifDelta(x.brut, champ));
    else for (const [champ, brut] of [["allure", ALLURE_DE_SES_COEFFICIENTS], ["axeSommet", AXE_DE_SES_COEFFICIENTS], ["domaineImage", IMAGE_DE_SES_COEFFICIENTS]] as const) await x.poster(champ, brut);
    await x.poster("racines", RACINES_DE_SES_COEFFICIENTS);
    if (r.reveleLaVraie) verifier(x.statuts("racines")[0] === "not_equivalent", `${r.nom} / racines : −1 et 4 (racines de SA fonction) ne sont plus acceptées, la vraie valeur a été montrée`);
    else verifier(x.statuts("racines")[0] === "correct", `${r.nom} / racines : −1 et 4 sont les racines de SA fonction, donc justes (cascade inchangée)`);
    const y = await nouveau(r.feedback, r.visible);
    await y.poster("coefficients", COEF_FAUX);
    if (r.reveleLaVraie) {
      for (const champ of ["allure", "axeSommet", "domaineImage"]) await y.poster(champ, reponseBruteCorrecteMotifDelta(y.brut, champ));
      await y.poster("racines", RACINES_VRAIES);
      verifier(y.statuts("racines")[0] === "correct", `${r.nom} / racines : −4 et 1 (vraie fonction) sont justes`);
    }
  }

  // ── 5. Ordonnée du sommet fausse : domaineImage est jugé sur SON ordonnée, sauf quand la solution a été montrée (RAPPORT §53 : l'énoncé ne l'affiche plus, on le vérifie par le verdict) ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", reponseBruteCorrecteMotifDelta(x.brut, "coefficients"));
    await x.poster("allure", reponseBruteCorrecteMotifDelta(x.brut, "allure"));
    await x.poster("axeSommet", JSON.stringify({ axeTexte: "x = -3/2", xS: "-3/2", yS: "-7" })); // yS faux (vrai : −25/4)
    verifier(!consigne(await x.lire(), "domaineImage").includes("y_S"), `${r.nom} / domaineImage : l'énoncé ne rappelle jamais l'ordonnée du sommet`);
    await x.poster("domaineImage", JSON.stringify({ crochetGauche: "[", borneGauche: "-7", crochetDroit: "[", borneDroite: "+inf" })); // juste POUR SON ordonnée (−7)
    if (r.reveleLaVraie) verifier(x.statuts("domaineImage")[0] === "not_equivalent", `${r.nom} / domaineImage : [−7 ; +∞[ n'est plus accepté (la vraie ordonnée a été montrée)`);
    else verifier(x.statuts("domaineImage")[0] === "correct", `${r.nom} / domaineImage : [−7 ; +∞[ est juste pour SON ordonnée (cascade inchangée)`);
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (la cascade repart de la vraie valeur quand la solution a été montrée ; inchangée sinon ; réponse correcte : rien ne change)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
