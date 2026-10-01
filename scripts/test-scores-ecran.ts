// Test permanent — SCORES par écran et cumul en points (RAPPORT §50). Lancer : `npm run test-scores-ecran`. Sans réseau ; vrai `api/router.ts`, vrai registre, base en mémoire.
//
// Décision du propriétaire : « le score suit la solution ». Le score d'un écran (0 à 100, `calculerEtatChampTentatives` : essais ratés, score partiel, pénalité d'indice)
// n'est envoyé au navigateur QUE si la solution l'est : `solutionMontreeEnCours` (correction immédiate ET « Afficher la réponse attendue ») ou révélation forcée (tâche antérieure,
// tâche entièrement terminée sous correction coupée). Immédiat sans la case : verdict seul, JAMAIS de score. Un champ non terminé n'a pas de score.
// Exception ASSUMÉE à la règle « fractionCorrecte ne sort jamais d'une réponse HTTP » (CLAUDE.md, RAPPORT §16) : un score partiel (ex. 37,5) la révèle ; elle n'est donc exposée que
// là où le verdict l'est déjà (même gate que la solution), jamais sous correction coupée avant la fin.
//
//  1. `construireChampVue` (pur) : table réglages × état du champ.
//  2. Route réelle : les trois régimes, la pénalité d'essais et d'indice, `poids` de TOUS les champs, la réponse POST sans `score`, le tableau de bord.
//  3. `public/moteur/pointsEcran.js` (module client pur) : points pondérés, arrondi, total = somme des lignes, format français.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { construireChampVue, REGLAGES_FORCEES_ANTERIEURES } from "../lib/tableauDeBord";
import type { EtatChampTentatives } from "../lib/moteurTentatives";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import type { ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const points: {
  arrondirPoints(x: number): number;
  pointsParChamp(champs: { champ: string; poids?: unknown; score?: number | null }[]): { champ: string; poids: number; possibles: number; obtenus: number | null }[];
  totalPoints(champs: { champ: string; poids?: unknown; score?: number | null }[]): { obtenus: number; possibles: number; visible: boolean };
  formaterPoints(x: number): string;
  formaterScore(obtenus: number, possibles: number): string;
} = require("../public/moteur/pointsEcran.js");

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const etat = (sur: Partial<EtatChampTentatives>): EtatChampTentatives => ({ tentativesUtilisees: 0, terminee: false, reussie: false, revelee: false, score: null, ...sur });

async function main(): Promise<void> {
  // ── 1. `construireChampVue` : le score suit la solution ──
  {
    const reponse = { valeur_saisie: "x", statut: "correct" as const };
    const echec = { valeur_saisie: "x", statut: "not_equivalent" as const };
    const reussi = etat({ terminee: true, reussie: true, score: 90 });
    const epuise = etat({ terminee: true, revelee: true, tentativesUtilisees: 2, score: 0 });
    const partiel = etat({ terminee: true, revelee: true, tentativesUtilisees: 2, score: 37.5 });
    const enCours = etat({ tentativesUtilisees: 1 });
    const immediatCase = { feedback_immediat: true, reponse_visible: true };
    const immediatSansCase = { feedback_immediat: true, reponse_visible: false };
    const coupe = { feedback_immediat: false, reponse_visible: false };
    const coupeCase = { feedback_immediat: false, reponse_visible: true };

    verifier(construireChampVue("c", reponse, "S", immediatCase, false, reussi).score === 90, "immédiat + case, champ réussi : score 90 exposé");
    verifier(construireChampVue("c", echec, "S", immediatCase, false, epuise).score === 0, "immédiat + case, essais épuisés : score 0 exposé (0 est un score, pas « absent »)");
    verifier(construireChampVue("c", echec, "S", immediatCase, false, partiel).score === 37.5, "immédiat + case : le score partiel est exposé (exception assumée)");
    verifier(construireChampVue("c", echec, "S", immediatCase, false, enCours).score === null, "immédiat + case, champ non terminé : pas de score");
    verifier(construireChampVue("c", null, "S", immediatCase, false, enCours).score === null, "immédiat + case, champ jamais répondu : pas de score");
    verifier(construireChampVue("c", reponse, "S", immediatSansCase, false, reussi).score === null, "immédiat SANS la case, champ réussi : pas de score");
    verifier(construireChampVue("c", echec, "S", immediatSansCase, false, partiel).score === null, "immédiat SANS la case : le score partiel ne fuit pas");
    verifier(construireChampVue("c", reponse, "S", coupe, false, reussi).score === null, "correction coupée, tâche en cours : pas de score");
    verifier(construireChampVue("c", reponse, "S", coupeCase, false, reussi).score === null, "correction coupée (case cochée sans effet) : pas de score");
    verifier(construireChampVue("c", echec, "S", coupe, false, partiel).score === null, "correction coupée : le score partiel ne fuit pas");
    verifier(construireChampVue("c", reponse, "S", REGLAGES_FORCEES_ANTERIEURES, true, reussi).score === 90, "révélation forcée (fin de tâche coupée, antérieure) : score exposé");
    verifier(construireChampVue("c", echec, "S", REGLAGES_FORCEES_ANTERIEURES, true, partiel).score === 37.5, "révélation forcée : score partiel exposé");
    verifier(construireChampVue("c", null, "S", REGLAGES_FORCEES_ANTERIEURES, true, enCours).score === null, "révélation forcée, champ jamais répondu et non terminé : pas de score");
    verifier(construireChampVue("c", null, "S", REGLAGES_FORCEES_ANTERIEURES, true, etat({ terminee: true, revelee: true, score: 0 })).score === 0, "révélation forcée, chrono écoulé sans réponse : score 0");
  }

  // ── 2. Route réelle ──
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let compteur = 0;
  const FAMILLE = "af_motif_aucune_racine";
  const nouveau = async (options: { feedback: boolean; visible: boolean; tentatives?: number; aide?: boolean }) => {
    compteur++;
    const numero = compteur;
    const tache = creerTache(s, {
      nom: `scores ${numero}`,
      variantes: [{ variante_id: FAMILLE, nombre_exercices: 1 }],
      feedback_immediat: options.feedback,
      reponse_visible: options.visible,
      tentatives_supplementaires: options.tentatives ?? 0,
      aide_activee: options.aide ?? false,
      aide_penalite_pourcent: options.aide ? 10 : 0,
    });
    const origine = Math.random;
    Math.random = () => 4242 / 2 ** 32;
    try {
      const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `assignation : ${a.statut}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const ex = genererExerciceMD(FAMILLE, Number(ligne.graine)) as ExerciceMotifDelta;
    return {
      ex,
      poster: (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: brute } }),
      juste: (champ: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: reponseBruteCorrecteMotifDelta(ex, champ) } }),
      aide: (champ: string) => appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: ligne.id, champ } }),
      lire: async () => (await appeler(`exercices/${ligne.id}`, "GET", { jeton: jetonEleve })).corps as { champs: { champ: string; score?: number | null; poids?: number; solution_attendue: unknown }[]; ecrans: { champ: string; poids?: number }[] },
      // Le tableau de bord de l'élève liste TOUTES ses tâches : on isole celle de ce scénario (les sections partagent l'élève).
      tableauDeBord: async () => {
        const corps = (await appeler("eleves/tableau-de-bord", "GET", { jeton: jetonEleve })).corps as Record<string, { nom_tache: string }[]>;
        return Object.values(corps).flat().find((t) => t.nom_tache === `scores ${numero}`) ?? null;
      },
    };
  };
  const scores = (g: { champs: { score?: number | null }[] }) => g.champs.map((c) => (c.score === undefined ? "absent" : c.score));
  const trouverChamps = (o: unknown, sortie: { champ: string; score?: unknown }[] = []): { champ: string; score?: unknown }[] => {
    if (Array.isArray(o)) o.forEach((x) => trouverChamps(x, sortie));
    else if (typeof o === "object" && o !== null) {
      if (typeof (o as { champ?: unknown }).champ === "string" && "statut" in o) sortie.push(o as unknown as { champ: string });
      Object.values(o).forEach((x) => trouverChamps(x, sortie));
    }
    return sortie;
  };
  const CHAMPS = ["coefficients", "allure", "axeSommet", "domaineImage", "racines", "tableauSignes"];

  // 2a. immédiat + case : scores au fil de l'eau (essais, indice), `poids` de TOUS les champs, POST sans `score`
  {
    const x = await nouveau({ feedback: true, visible: true, tentatives: 1, aide: true });
    const g0 = await x.lire();
    verifier(g0.champs.every((c) => c.score === null), `immédiat + case, au départ : aucun score (${JSON.stringify(scores(g0))})`);
    verifier(JSON.stringify(g0.champs.map((c) => c.poids)) === JSON.stringify([1, 1, 2, 1, 2, 3]), `GET : le poids de TOUS les champs, écrans pas encore servis compris (${JSON.stringify(g0.champs.map((c) => c.poids))})`);
    const p1 = await x.juste("coefficients");
    verifier(p1.corps.statut === "correct" && !("score" in p1.corps), `POST : la réponse HTTP ne porte pas de score (${JSON.stringify(p1.corps)})`);
    verifier((await x.lire()).champs[0]!.score === 100, "coefficients juste du premier coup : 100");
    await x.aide("allure");
    await x.juste("allure");
    verifier((await x.lire()).champs[1]!.score === 90, "allure juste après l'indice (pénalité 10 %) : 90");
    const faux = JSON.stringify({ axeTexte: "x = 101", xS: "101", yS: "103" });
    await x.poster("axeSommet", faux);
    verifier((await x.lire()).champs[2]!.score === null, "axeSommet, un essai raté sur deux : pas encore de score (champ non terminé)");
    await x.juste("axeSommet");
    verifier((await x.lire()).champs[2]!.score === 50, "axeSommet juste au 2e essai (tentativesMax 2) : 50");
    const gaucheFaux = JSON.stringify({ crochetGauche: "[", borneGauche: "101", crochetDroit: "[", borneDroite: "+inf" });
    await x.poster("domaineImage", gaucheFaux);
    await x.poster("domaineImage", gaucheFaux);
    const g = await x.lire();
    verifier(g.champs[3]!.score === 0 && g.champs[3]!.solution_attendue !== null, `domaineImage épuisé : score 0 avec la solution montrée (${JSON.stringify(scores(g))})`);
    const tdb = trouverChamps(await x.tableauDeBord());
    verifier(tdb.length === 6 && tdb.slice(0, 4).map((c) => c.score).join() === "100,90,50,0" && tdb[4]!.score === null, `tableau de bord : même `+"`score`"+` (${JSON.stringify(tdb.map((c) => c.score))})`);
    // une fois tout répondu juste : tous les scores sont là
    await x.juste("racines");
    await x.juste("tableauSignes");
    const fin = await x.lire();
    verifier(scores(fin).join() === "100,90,50,0,100,100", `immédiat + case, exercice terminé : ${JSON.stringify(scores(fin))}`);
  }

  // 2b. immédiat SANS la case : verdict seul, JAMAIS de score — même exercice terminé
  {
    const x = await nouveau({ feedback: true, visible: false });
    for (const champ of CHAMPS) {
      await x.juste(champ);
      const g = await x.lire();
      verifier(g.champs.every((c) => c.score === null), `immédiat sans la case, après ${champ} : aucun score (${JSON.stringify(scores(g))})`);
    }
    verifier(trouverChamps(await x.tableauDeBord()).every((c) => c.score === null || c.score === undefined), "immédiat sans la case : le tableau de bord n'expose aucun score");
  }

  // 2c. correction coupée : rien avant la fin de la TÂCHE entière, puis tous les scores
  {
    const x = await nouveau({ feedback: false, visible: true });
    for (const champ of CHAMPS.slice(0, -1)) {
      const r = await x.juste(champ);
      verifier(!("score" in r.corps) && r.corps.statut === undefined, `coupé / ${champ} : ni verdict ni score dans la réponse POST`);
      const g = await x.lire();
      verifier(g.champs.every((c) => c.score === null), `coupé, après ${champ} : aucun score (${JSON.stringify(scores(g))})`);
    }
    verifier(trouverChamps(await x.tableauDeBord()).every((c) => c.score === null || c.score === undefined), "coupé, tâche en cours : le tableau de bord n'expose aucun score");
    const dernier = await x.juste("tableauSignes");
    verifier(!("score" in dernier.corps), "coupé : même la réponse qui termine la tâche n'envoie pas de score dans le POST");
    const fin = await x.lire();
    verifier(scores(fin).join() === "100,100,100,100,100,100", `coupé, tâche terminée : tous les scores sont révélés (${JSON.stringify(scores(fin))})`);
  }

  // ── 3. Module client `pointsEcran.js` ──
  {
    const champs = [
      { champ: "a", poids: 1, score: 100 },
      { champ: "b", poids: 1, score: 90 },
      { champ: "c", poids: 2, score: 50 },
      { champ: "d", poids: 1, score: 0 },
      { champ: "e", poids: 2, score: null },
      { champ: "f", poids: 3, score: null },
    ];
    const t = points.totalPoints(champs);
    verifier(t.obtenus === 2.9 && t.possibles === 10 && t.visible === true, `total : 1 + 0,9 + 1 + 0 = 2,9 sur 10 (${JSON.stringify(t)})`);
    verifier(JSON.stringify(points.pointsParChamp(champs).map((c) => c.obtenus)) === "[1,0.9,1,0,null,null]", "points par champ : poids × score / 100, null si pas de score");
    verifier(points.totalPoints([{ champ: "a", poids: 1, score: null }]).visible === false, "aucun score : rien à afficher");
    verifier(points.totalPoints([{ champ: "a", poids: 1, score: 0 }]).visible === true, "un score de 0 est un score (affiché)");
    // arrondi à 1 décimale ; total = somme des lignes AFFICHÉES (jamais deux nombres qui se contredisent)
    const tiers = [{ champ: "a", poids: 1, score: 100 / 3 }, { champ: "b", poids: 1, score: 100 / 3 }, { champ: "c", poids: 1, score: 100 / 3 }];
    verifier(JSON.stringify(points.pointsParChamp(tiers).map((c) => c.obtenus)) === "[0.3,0.3,0.3]" && points.totalPoints(tiers).obtenus === 0.9, `total = somme des lignes arrondies (${JSON.stringify(points.totalPoints(tiers))})`);
    verifier(points.arrondirPoints(0.95) === 1 || points.arrondirPoints(0.95) === 0.9, "arrondi défini (aucune exception)");
    // poids invalide ou absent → 1 (comme `scorePondere.js`)
    verifier(points.totalPoints([{ champ: "a", score: 100 }, { champ: "b", poids: 0, score: 100 }, { champ: "c", poids: 2.5, score: 100 }, { champ: "d", poids: "3", score: 100 }]).possibles === 4, "poids absent, nul, décimal ou texte : 1");
    // clé hostile : jamais interprétée
    verifier(points.totalPoints([{ champ: "__proto__", poids: 1, score: 100 }, { champ: "constructor", poids: 1, score: 100 }]).obtenus === 2, "noms de champ hostiles : sans effet");
    // format français
    verifier(points.formaterPoints(4.8) === "4,8" && points.formaterPoints(10) === "10" && points.formaterPoints(0) === "0" && points.formaterPoints(0.5) === "0,5", "format : virgule, pas de « ,0 » inutile");
    verifier(points.formaterScore(1.8, 2) === "1,8 / 2 pts" && points.formaterScore(0, 1) === "0 / 1 pt" && points.formaterScore(2.8, 11) === "2,8 / 11 pts", "« 1,8 / 2 pts », « 0 / 1 pt » : l'unité suit le dénominateur");
    // score hors bornes ou non fini : ignoré, jamais NaN affiché
    const bizarre = points.totalPoints([{ champ: "a", poids: 1, score: Number.NaN }, { champ: "b", poids: 1, score: 140 }, { champ: "c", poids: 1, score: -5 }]);
    verifier(Number.isFinite(bizarre.obtenus) && bizarre.obtenus <= bizarre.possibles && bizarre.obtenus >= 0, `scores incohérents : bornés, jamais NaN (${JSON.stringify(bizarre)})`);
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (le score suit la solution : gate pur, trois régimes sur le vrai routeur, pénalités d'essais et d'indice, poids de tous les champs, points pondérés côté client)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
