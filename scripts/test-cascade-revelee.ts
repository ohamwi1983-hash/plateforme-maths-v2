// Test permanent — la cascade repart de la VRAIE valeur dès que la solution a été montrée (RAPPORT §45), contre le VRAI `api/router.ts`, le VRAI registre
// (gen7) et une base en mémoire. Lancer : `npm run test-cascade-revelee`. Sans réseau.
//
// Règle (demande du propriétaire, qui précise D-A de §38) : quand « Afficher la réponse attendue » est cochée (correction immédiate), une réponse
// NON correcte a été RÉVÉLÉE avec sa solution. Les écrans suivants ne doivent plus réutiliser cette réponse fausse : ils partent de la vraie valeur.
// Sans solution montrée (correction coupée, ou immédiate sans la case), la cascade sur la donnée de l'élève est inchangée (§38 : une méthode juste
// appliquée à une donnée fausse réussit). Une réponse CORRECTE, elle, sert de point de départ dans tous les cas.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { factorisationVersLatex, genererExercice, reponseBruteCorrecteAnalyseFonction, type ExerciceAnalyseFonction } from "../src/generateurs/analyseFonction";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

// f(x) = 4x² + 8x (mise_en_evidence, graine 12345) : racines 0 et −2, sommet (−1 ; −4), a > 0 et ab > 0.
const COEF_FAUX = JSON.stringify({ a: "-5", b: "4", c: "0" }); // a < 0 et ab < 0 : allure, sommet, tableau changent
const ALLURE_VRAIE = JSON.stringify({ signeA: "+", signeAB: "+" });
const ALLURE_DE_SES_COEFFICIENTS = JSON.stringify({ signeA: "-", signeAB: "-" });

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
    const tache = creerTache(s, { nom: `revelee ${compteur}`, variantes: [{ variante_id: "af_mise_en_evidence", nombre_exercices: 1 }], feedback_immediat: feedback, reponse_visible: visible, tentatives_supplementaires: 0 });
    const o = Math.random;
    Math.random = () => 12345 / 2 ** 32;
    try {
      await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    } finally {
      Math.random = o;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const brut: ExerciceAnalyseFonction = genererExercice("mise_en_evidence", Number(ligne.graine));
    const poster = (champ: string, b: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: id, champ, reponse_brute: b } });
    const lire = async () => (await appeler(`exercices/${id}`, "GET", { jeton: "eleve:eleve-1" })).corps as { ecrans: EcranDeclare[]; champs: any[] };
    const statuts = (champ: string) => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === champ).map((l) => l.statut as string);
    return { brut, poster, lire, statuts };
  };
  const ecran = (g: { ecrans: EcranDeclare[] }, champ: string) => g.ecrans.find((e) => e.champ === champ) as any;
  const consigne = (g: { ecrans: EcranDeclare[] }, champ: string): string => ecran(g, champ)?.consigne ?? "";
  const D_APRES_TES_COEFFICIENTS = "d'après les coefficients que tu as donnés";

  // ── 1. Coefficients faux, puis allure : ce qui sert de point de départ ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", COEF_FAUX);
    verifier(x.statuts("coefficients")[0] === "not_equivalent", `${r.nom} : a = −5, b = 4, c = 0 est faux pour 4x² + 8x`);
    const g = await x.lire();
    const c = consigne(g, "allure");
    if (r.reveleLaVraie) {
      verifier(!c.includes(D_APRES_TES_COEFFICIENTS) && !c.includes("5x^2") && !c.includes("-5x^2"), `${r.nom} / allure : la réponse fausse n'est PAS réutilisée (« ${c.slice(0, 120)} »)`);
      verifier(c.includes("4x^2") && c.includes("8x"), `${r.nom} / allure : l'énoncé reprend la VRAIE fonction 4x² + 8x (« ${c.slice(0, 120)} »)`);
      const faux = await x.poster("allure", ALLURE_DE_SES_COEFFICIENTS);
      verifier(faux.corps.statut === "not_equivalent", `${r.nom} / allure : la méthode juste sur SES coefficients n'est plus acceptée (la vraie valeur a été montrée)`);
    } else {
      verifier(c.includes(D_APRES_TES_COEFFICIENTS) && c.includes("-5x^2"), `${r.nom} / allure : la cascade sur la donnée de l'élève est inchangée (« ${c.slice(0, 120)} »)`);
      await x.poster("allure", ALLURE_DE_SES_COEFFICIENTS);
      verifier(x.statuts("allure")[0] === "correct", `${r.nom} / allure : a < 0 et ab < 0 sont justes pour SES coefficients`);
    }
  }
  {
    const x = await nouveau(true, true);
    await x.poster("coefficients", COEF_FAUX);
    await x.poster("allure", ALLURE_VRAIE);
    verifier(x.statuts("allure")[0] === "correct", "immédiate + réponse affichée / allure : a > 0 et ab > 0 (vraie fonction) sont corrects");
  }

  // ── 2. Une réponse CORRECTE sert de point de départ, dans tous les régimes (rien ne change) ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", reponseBruteCorrecteAnalyseFonction(x.brut, "coefficients"));
    const c = consigne(await x.lire(), "allure");
    verifier(c.includes("4x^2") && c.includes("8x"), `${r.nom} / coefficients justes : allure sur la vraie fonction (« ${c.slice(0, 100)} »)`);
  }

  // ── 3. Tableau de signes : la vraie fonction sous « réponse affichée », celle de l'élève sinon ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", COEF_FAUX);
    await x.poster("allure", r.reveleLaVraie ? ALLURE_VRAIE : ALLURE_DE_SES_COEFFICIENTS);
    await x.poster("axeSommet", JSON.stringify({ axeTexte: "x = 0", xS: "0", yS: "0" }));
    await x.poster("domaineImage", JSON.stringify({ crochetGauche: "[", borneGauche: "0", crochetDroit: "[", borneDroite: "+inf" }));
    await x.poster("racinesReconnaissance", reponseBruteCorrecteAnalyseFonction(x.brut, "racinesReconnaissance"));
    await x.poster("racinesChamp1", reponseBruteCorrecteAnalyseFonction(x.brut, "racinesChamp1"));
    await x.poster("racinesChamp2", reponseBruteCorrecteAnalyseFonction(x.brut, "racinesChamp2"));
    const t = ecran(await x.lire(), "tableauSignes");
    verifier(t !== undefined, `${r.nom} / tableau : servi`);
    if (t !== undefined) {
      const valeurs: string[] = t.colonnes.filter((c: any) => c.genre === "valeur").map((c: any) => c.valeur as string);
      if (r.reveleLaVraie) verifier(valeurs.join() === "$-2$,$-1$,$0$", `${r.nom} / tableau : valeurs de x de la VRAIE fonction (−2 ; −1 ; 0), obtenu ${valeurs.join()}`);
      else verifier(valeurs.join() !== "$-2$,$-1$,$0$", `${r.nom} / tableau : pas les valeurs vraies avant la fin (obtenu ${valeurs.join()})`);
    }
  }

  // ── 4. racinesChamp2 : une factorisation fausse mais exploitable n'est plus reprise quand la solution a été montrée ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.brut, champ));
    await x.poster("racinesChamp1", "4x(x-2)"); // fausse pour 4x² + 8x, mais exploitable
    const c = consigne(await x.lire(), "racinesChamp2");
    const vraie = factorisationVersLatex(x.brut.formeFactorisee as string) as string;
    if (r.reveleLaVraie) verifier(!c.includes("4x(x - 2)") && !c.includes("D'après ta factorisation") && c.includes(vraie), `${r.nom} / racinesChamp2 : la factorisation fausse n'est pas reprise, la vraie (${vraie}) est donnée (« ${c.slice(0, 110)} »)`);
    else verifier(c.includes("D'après ta factorisation") && c.includes("4x(x - 2)"), `${r.nom} / racinesChamp2 : la cascade sur SA factorisation est inchangée (« ${c.slice(0, 110)} »)`);
  }

  // ── 5. Ordonnée du sommet fausse : domaineImage ne la reprend plus sous « réponse affichée » ──
  for (const r of REGIMES) {
    const x = await nouveau(r.feedback, r.visible);
    await x.poster("coefficients", reponseBruteCorrecteAnalyseFonction(x.brut, "coefficients"));
    await x.poster("allure", reponseBruteCorrecteAnalyseFonction(x.brut, "allure"));
    await x.poster("axeSommet", JSON.stringify({ axeTexte: "x = -1", xS: "-1", yS: "-7" })); // yS faux (vrai : −4)
    const c = consigne(await x.lire(), "domaineImage");
    if (r.reveleLaVraie) verifier(!c.includes("y_S = -7") && !c.includes("Avec $y_S"), `${r.nom} / domaineImage : l'ordonnée fausse n'est pas reprise (« ${c.slice(0, 130)} »)`);
    else verifier(c.includes("y_S = -7"), `${r.nom} / domaineImage : la cascade sur SON ordonnée est inchangée (« ${c.slice(0, 130)} »)`);
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
