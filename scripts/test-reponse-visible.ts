// Test permanent — « Afficher la réponse attendue » (`reponse_visible`) COMMANDE la révélation de la solution (RAPPORT §42).
// Lancer : `npm run test-reponse-visible`. Sans réseau ; contre le VRAI `api/router.ts`, le VRAI registre et une base en mémoire.
//
// Décision du propriétaire (option B) : avant, un champ dont les essais étaient épuisés montrait sa solution QUELS QUE SOIENT les réglages
// (révélation forcée) — donc, avec 1 essai (défaut), `reponse_visible` ne changeait rien à ce que voit l'élève qui se trompe. Maintenant :
//   - correction immédiate + case DÉCOCHÉE : verdict (`statut`) et verrouillage à l'épuisement, JAMAIS de solution (ni `revele`) ;
//   - correction immédiate + case COCHÉE  : solution à l'épuisement (inchangé) ; jamais dès le 1er échec s'il reste des essais ;
//   - correction coupée : inchangé (rien avant la fin de la tâche, puis tout) ;
//   - tâche ANTÉRIEURE (échéance passée) : tout est révélé, quels que soient les réglages (inchangé).
// Tout site qui suppose « la vraie valeur a été montrée » (repli de la cascade de gen7, tableau aux valeurs vraies) doit suivre la MÊME règle :
// `solutionMontreeEnCours` (lib/reglagesCorrection.ts), seule définition.

export {}; // module

import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { regenererExercice } from "../lib/etatExercice";
import { solutionMontreeEnCours } from "../lib/reglagesCorrection";
import { construireChampVue, REGLAGES_FORCEES_ANTERIEURES } from "../lib/tableauDeBord";
import { calculerEtatChampTentatives } from "../lib/moteurTentatives";
import { CHAMPS_BASE, CHAMP_SOMME, reponseBruteCorrecte as reponseBrutecorrecteTemoin } from "../src/generateurs/_temoinTechnique";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { projeterMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/cascade";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

async function main(): Promise<void> {
  // ── 0. Définition unique (table de vérité) ──
  for (const feedback_immediat of [true, false]) {
    for (const reponse_visible of [true, false]) {
      verifier(solutionMontreeEnCours({ feedback_immediat, reponse_visible }) === (feedback_immediat && reponse_visible), `solutionMontreeEnCours(${feedback_immediat}, ${reponse_visible}) = feedback ET visible`);
    }
  }

  // ── 1. Fonction pure `construireChampVue` : épuisement, réponse, chrono ──
  {
    const echec = { valeur_saisie: "x", statut: "not_equivalent" as const };
    const epuise = calculerEtatChampTentatives(["not_equivalent"], 1, false, 0);
    verifier(epuise.revelee, "1 essai, 1 échec : épuisé");
    const cache = construireChampVue("c", echec, "SOL", { feedback_immediat: true, reponse_visible: false }, false, epuise);
    verifier(cache.statut === "not_equivalent" && cache.solution_attendue === null && cache.revele === false, `épuisé, case décochée : verdict sans solution ni revele (${JSON.stringify(cache)})`);
    const montre = construireChampVue("c", echec, "SOL", { feedback_immediat: true, reponse_visible: true }, false, epuise);
    verifier(montre.statut === "not_equivalent" && montre.solution_attendue === "SOL" && montre.revele === true, "épuisé, case cochée : solution + revele");
    const coupe = construireChampVue("c", echec, "SOL", { feedback_immediat: false, reponse_visible: false }, false, epuise);
    verifier(coupe.statut === null && coupe.solution_attendue === null && coupe.revele === false, "correction coupée : rien avant la fin de la tâche");
    const ante = construireChampVue("c", echec, "SOL", REGLAGES_FORCEES_ANTERIEURES, true, epuise);
    verifier(ante.solution_attendue === "SOL" && ante.revele === true, "révélation forcée (antérieure / fin de tâche coupée) : inchangée");
    // Chrono écoulé sans aucune réponse : le champ est terminé ; la solution ne suit QUE la case.
    const chrono = calculerEtatChampTentatives([], 1, false, 0, true);
    const chronoCache = construireChampVue("c", null, "SOL", { feedback_immediat: true, reponse_visible: false }, false, chrono);
    verifier(chronoCache.solution_attendue === null && chronoCache.revele === false, "chrono écoulé sans réponse, case décochée : pas de solution");
    const chronoMontre = construireChampVue("c", null, "SOL", { feedback_immediat: true, reponse_visible: true }, false, chrono);
    verifier(chronoMontre.solution_attendue === "SOL" && chronoMontre.revele === true, "chrono écoulé sans réponse, case cochée : solution");
    // Une réussite ne montre la solution que si la case est cochée (inchangé).
    const reussi = calculerEtatChampTentatives(["correct"], 1, false, 0);
    verifier(construireChampVue("c", { valeur_saisie: "x", statut: "correct" }, "SOL", { feedback_immediat: true, reponse_visible: false }, false, reussi).solution_attendue === null, "réussite, case décochée : pas de solution");
    verifier(construireChampVue("c", { valeur_saisie: "x", statut: "correct" }, "SOL", { feedback_immediat: true, reponse_visible: true }, false, reussi).solution_attendue === "SOL", "réussite, case cochée : solution");
  }

  // ── 2. Routes réelles (témoin technique) ──
  const s = creerScenario();
  installerBase(s.base);
  imposerProfilAssignation("base");
  const jetonProf = `prof:${s.profId}`;
  let compteur = 0;
  const nouveau = async (feedback: boolean, visible: boolean, supplementaires: number) => {
    compteur++;
    const tache = creerTache(s, { nom: `visible ${compteur}`, feedback_immediat: feedback, reponse_visible: visible, tentatives_supplementaires: supplementaires });
    await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const ex = regenererExercice(ligne as never)!.exercice as Parameters<typeof reponseBrutecorrecteTemoin>[0];
    const poster = async (champ: string, brut: string) => (await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: id, champ, reponse_brute: brut } })).corps as any;
    const lire = async () => (await appeler(`exercices/${id}`, "GET", { jeton: "eleve:eleve-1" })).corps as any;
    const faux = "999999";
    const juste = (champ: string) => reponseBrutecorrecteTemoin(ex, champ);
    return { poster, lire, faux, juste };
  };
  const champLu = (g: any, champ: string) => g.champs.find((c: any) => c.champ === champ);

  // 2a. Correction immédiate, case décochée, 1 essai : verdict + verrouillage, jamais de solution.
  {
    const t = await nouveau(true, false, 0);
    const r = await t.poster(CHAMP_SOMME, t.faux);
    verifier(r.statut === "not_equivalent" && r.verrouille === true, "2a POST : verdict et champ verrouillé à l'épuisement");
    verifier(!("solution_attendue" in r) && r.revele === false, `2a POST : aucune solution, revele=false (${JSON.stringify(r)})`);
    const g = await t.lire();
    const c = champLu(g, CHAMP_SOMME);
    verifier(c.statut === "not_equivalent" && c.solution_attendue === null && c.revele === false && c.verrouille === true, `2a GET : verdict, verrouillé, sans solution (${JSON.stringify(c)})`);
    const suite = CHAMPS_BASE[1]!;
    const r2 = await t.poster(suite, t.juste(suite));
    verifier(r2.statut === "correct" && !("solution_attendue" in r2), "2a : une réussite ne montre pas non plus de solution");
  }
  // 2b. Case cochée, 1 essai : solution à l'épuisement (comportement conservé).
  {
    const t = await nouveau(true, true, 0);
    const r = await t.poster(CHAMP_SOMME, t.faux);
    verifier(typeof r.solution_attendue === "string" && r.solution_attendue.length > 0 && r.revele === true && r.verrouille === true, `2b POST : solution + revele + verrouillé (${JSON.stringify(r)})`);
    const c = champLu(await t.lire(), CHAMP_SOMME);
    verifier(typeof c.solution_attendue === "string" && c.revele === true, "2b GET : solution présente");
  }
  // 2c. Case décochée, 2 essais : ni au 1er échec, ni à l'épuisement.
  {
    const t = await nouveau(true, false, 1);
    const r1 = await t.poster(CHAMP_SOMME, t.faux);
    verifier(!("solution_attendue" in r1) && r1.verrouille === false && r1.tentatives_restantes === 1, "2c : 1er échec, il reste un essai : pas de solution");
    const r2 = await t.poster(CHAMP_SOMME, t.faux);
    verifier(!("solution_attendue" in r2) && r2.verrouille === true && r2.revele === false && r2.statut === "not_equivalent", `2c : épuisé, case décochée : verrouillé sans solution (${JSON.stringify(r2)})`);
  }
  // 2d. Case cochée, 2 essais : jamais au 1er échec (correctif URGENT antérieur), à l'épuisement seulement.
  {
    const t = await nouveau(true, true, 1);
    const r1 = await t.poster(CHAMP_SOMME, t.faux);
    verifier(!("solution_attendue" in r1) && r1.verrouille === false, "2d : 1er échec avec case cochée : toujours pas de solution");
    const r2 = await t.poster(CHAMP_SOMME, t.faux);
    verifier(typeof r2.solution_attendue === "string" && r2.revele === true, "2d : épuisé, case cochée : solution");
  }
  // 2e. Correction coupée : inchangé — rien avant la fin de la tâche, puis tout (`reponse_visible` sans effet sous correction coupée).
  {
    const t = await nouveau(false, true, 0);
    const r = await t.poster(CHAMP_SOMME, t.faux);
    verifier(!("statut" in r) && !("solution_attendue" in r) && r.revele === false, "2e : correction coupée : ni verdict ni solution avant la fin");
    let dernier: any = r;
    for (const champ of CHAMPS_BASE.slice(1)) dernier = await t.poster(champ, t.juste(champ));
    verifier(dernier.tache_terminee === true, "2e : la dernière réponse termine la tâche");
    const c = champLu(await t.lire(), CHAMP_SOMME);
    verifier(typeof c.solution_attendue === "string" && c.statut === "not_equivalent", "2e : tâche terminée sous correction coupée : tout est révélé (inchangé)");
  }

  // 2f. Le tableau de bord expose les réglages effectifs (bandeau de l'aperçu professeur) : `reponse_visible` suit la tâche.
  for (const visible of [true, false]) {
    const t = await nouveau(true, visible, 0);
    void t;
    const td = await appeler("eleves/tableau-de-bord", "GET", { jeton: "eleve:eleve-1" });
    const noms = ["en_cours", "effectuees", "anterieures"].flatMap((k) => (td.corps[k] ?? []) as any[]).filter((x) => x.nom_tache === `visible ${compteur}`);
    verifier(noms.length === 1 && noms[0].reponse_visible === visible && noms[0].correction_immediate === true, `2f tableau de bord : reponse_visible=${visible} exposé (${JSON.stringify(noms.map((n) => [n.correction_immediate, n.reponse_visible]))})`);
  }

  // ── 3. gen7 « motif / delta » : « la vraie valeur a été montrée » suit la MÊME règle (tableau aux valeurs vraies) ──
  {
    const brut = genererExerciceMD("af_delta_racines_rationnelles", 4242); // f = x² + 3x − 4, racines −4 et 1
    const inexploitable = [{ champ: "coefficients", reponseBrute: "??", statut: "parse_error" as const }];
    const cas: { nom: string; correctionImmediate: boolean; solutionMontree: boolean; tableau: "vraies" | "symboliques" }[] = [
      { nom: "immédiate + case cochée", correctionImmediate: true, solutionMontree: true, tableau: "vraies" },
      { nom: "immédiate + case décochée", correctionImmediate: true, solutionMontree: false, tableau: "symboliques" },
      { nom: "coupée", correctionImmediate: false, solutionMontree: false, tableau: "symboliques" },
    ];
    for (const c of cas) {
      const p = projeterMotifDelta(brut, inexploitable, { correctionImmediate: c.correctionImmediate, solutionMontree: c.solutionMontree });
      verifier(p.affichageTableau === c.tableau, `gen7 (${c.nom}) : tableau « ${c.tableau} » (obtenu ${p.affichageTableau})`);
    }

    // De bout en bout : ce que le navigateur reçoit (colonnes du tableau).
    for (const c of cas) {
      const tache = creerTache(s, { nom: `gen7 ${c.nom}`, variantes: [{ variante_id: "af_delta_racines_rationnelles", nombre_exercices: 1 }], feedback_immediat: c.correctionImmediate, reponse_visible: c.solutionMontree });
      const o = Math.random;
      Math.random = () => 4242 / 2 ** 32;
      try {
        await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      } finally {
        Math.random = o;
      }
      const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
      const id = ligne.id as string;
      const brutLigne = genererExerciceMD("af_delta_racines_rationnelles", Number(ligne.graine));
      const poster = (champ: string, b: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: id, champ, reponse_brute: b } });
      const lire = async () => (await appeler(`exercices/${id}`, "GET", { jeton: "eleve:eleve-1" })).corps as { ecrans: EcranDeclare[] };
      for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racines"]) await poster(champ, reponseBruteCorrecteMotifDelta(brutLigne, champ));
      const t = (await lire()).ecrans.find((e) => e.champ === "tableauSignes") as any;
      verifier(t !== undefined, `gen7 (${c.nom}) : le tableau est servi une fois coefficients, sommet et racines terminés`);
      if (t !== undefined) {
        const valeurs: string[] = t.colonnes.filter((col: any) => col.genre === "valeur").map((col: any) => col.valeur as string);
        const symboliques = valeurs.every((v) => /^\$x_(1|2|S)\$$/.test(v));
        verifier(symboliques === (c.tableau === "symboliques"), `gen7 (${c.nom}) : colonnes ${c.tableau === "vraies" ? "avec les valeurs numériques" : "symboliques seulement"} (${valeurs.join(" ; ")})`);
      }
    }
  }

  if (echecs.length > 0) {
    console.error(`✗ ${echecs.length} échec(s) sur ${nb} vérification(s) :`);
    for (const e of echecs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ ${nb} vérifications : reponse_visible commande la révélation (réglages × essais × régimes, témoin et gen7)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
