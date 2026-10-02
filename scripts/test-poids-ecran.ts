// Test permanent — poids par écran dans l'agrégation « champs corrects / total » (RAPPORT §17).
// Lancer : `npm run test-poids-ecran`. Vrai `api/router.ts` contre une base en mémoire (scripts/support/).
//
// Cinq blocs :
//  1. NON-RÉGRESSION EXHAUSTIVE : copies GELÉES des comptages d'origine (serveur `mes-resultats`, client
//     `prof.html`/`eleve.html`) comparées aux versions pondérées, tous poids à 1 (explicites ET absents),
//     sur TOUTES les listes de champs (taille 0..12 côté serveur : 8 191 sous-ensembles ; 0..8 côté
//     client : 4^n séquences de statuts). Zéro divergence exigée, pourcentage arrondi compris.
//  2. PARITÉ serveur/client sur des poids variés (tirages déterministes).
//  3. Scénario SYNTHÉTIQUE à poids différents, valeur attendue calculée à la main.
//  4. `poidsDuChamp` : repli à 1 (ligne historique, variante hors registre, champ inconnu), poids invalides rejetés.
//  5. ROUTE : le poids atteint mes-resultats (pondéré), profs/resultats et le tableau de bord élève (par champ) ;
//     ligne historique sans graine = poids 1 ; le pourcentage recalculé par le module client = celui du serveur.

export {}; // module (évite les collisions de noms globaux entre scripts/*.ts)

import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { poidsDesChampsDeLigne, poidsDuChamp, sommePonderee, validerPoids } from "../lib/poidsEcran";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { CHAMP_DIVISEURS, CHAMP_PARITE, CHAMP_SIGNES, CHAMP_SOMME, generateurTemoinTechnique as temoin, reponseBruteCorrecte, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { sommeChampsPonderee } = require("../public/moteur/scorePondere.js") as {
  sommeChampsPonderee(champs: { statut: string | null; poids?: unknown }[], options?: { ignorerSansStatut?: boolean }): { correct: number; total: number };
};

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

// ════ Copies GELÉES des comptages d'origine (avant §17) — NE JAMAIS MODIFIER ════
// Serveur : `lib/routes/eleves/mes-resultats.ts` @ cb5a3aa, boucle `for (const champ of ex.champs_attendus ?? [])`.
function ancienComptageServeur(statuts: (string | undefined)[]): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const statut of statuts) {
    total++;
    if (statut === "correct") correct++;
  }
  return { correct, total };
}
// Client prof (`calculerScoreEleve`/`calculerScoreExercice`, public/prof.html @ cb5a3aa) : tous les champs listés.
function ancienComptageClientProf(champs: { statut: string | null }[]): { correct: number; total: number } {
  let correct = 0;
  let total = 0;
  for (const champ of champs) {
    total++;
    if (champ.statut === "correct") correct++;
  }
  return { correct, total };
}
// Client élève (public/eleve.html @ cb5a3aa) : les statuts masqués (`null`) sont sautés.
function ancienComptageClientEleve(champs: { statut: string | null }[]): { correct: number; total: number } {
  let champsCorrects = 0;
  let champsRepondus = 0;
  for (const champ of champs) {
    if (champ.statut === null) continue;
    champsRepondus++;
    if (champ.statut === "correct") champsCorrects++;
  }
  return { correct: champsCorrects, total: champsRepondus };
}
const pct = (c: { correct: number; total: number }): number | null => (c.total === 0 ? null : Math.round((c.correct / c.total) * 100));
const memes = (a: { correct: number; total: number }, b: { correct: number; total: number }) => a.correct === b.correct && a.total === b.total && Object.is(pct(a), pct(b));

function blocNonRegression(): void {
  let serveur = 0;
  let divServeur = 0;
  for (let n = 0; n <= 12; n++) {
    for (let masque = 0; masque < 1 << n; masque++) {
      const statuts = Array.from({ length: n }, (_, i) => ((masque >> i) & 1 ? "correct" : "not_equivalent"));
      serveur++;
      const ref = ancienComptageServeur(statuts);
      if (!memes(ref, sommePonderee(statuts.map((s) => ({ correct: s === "correct", poids: 1 }))))) divServeur++;
    }
  }
  const STATUTS = ["correct", "not_equivalent", "parse_error", null] as const;
  let client = 0;
  let divClient = 0;
  const parcourir = (courant: (typeof STATUTS)[number][], max: number): void => {
    client++;
    const sansPoids = courant.map((statut) => ({ statut }));
    const avecPoids1 = courant.map((statut) => ({ statut, poids: 1 }));
    for (const champs of [sansPoids, avecPoids1]) {
      if (!memes(ancienComptageClientProf(champs), sommeChampsPonderee(champs))) divClient++;
      if (!memes(ancienComptageClientEleve(champs), sommeChampsPonderee(champs, { ignorerSansStatut: true }))) divClient++;
    }
    if (courant.length === max) return;
    for (const s of STATUTS) {
      courant.push(s);
      parcourir(courant, max);
      courant.pop();
    }
  };
  parcourir([], 8);
  console.log(`  1) non-régression : ${serveur} listes serveur (tailles 0..12), ${client} listes client (statuts ×4, tailles 0..8), poids absents ET à 1 — divergences ${divServeur + divClient}`);
  verifier(serveur === 8191, `nombre de listes serveur inattendu : ${serveur}`);
  verifier(client === 87381, `nombre de listes client inattendu : ${client}`);
  verifier(divServeur === 0, `divergences serveur : ${divServeur}`);
  verifier(divClient === 0, `divergences client : ${divClient}`);
}

function blocParite(): void {
  let graine = 4242;
  const alea = () => (graine = (graine * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let divergences = 0;
  const TIRAGES = 100_000;
  for (let i = 0; i < TIRAGES; i++) {
    const n = Math.floor(alea() * 10);
    const champs = Array.from({ length: n }, () => ({ statut: ["correct", "not_equivalent", "parse_error"][Math.floor(alea() * 3)], poids: 1 + Math.floor(alea() * 5) }));
    const s = sommePonderee(champs.map((c) => ({ correct: c.statut === "correct", poids: c.poids })));
    if (!memes(s, sommeChampsPonderee(champs))) divergences++;
  }
  console.log(`  2) parité serveur/client : ${TIRAGES} tirages à poids 1..5, divergences ${divergences}`);
  verifier(divergences === 0, `parité serveur/client : ${divergences} divergences`);
}

function blocScenarioSynthetique(): void {
  // 4 champs, poids 3/1/1/2 ; réussis : le 1er (3) et le 3e (1), ratés : 2e et 4e → 4/7 (et NON 2/4).
  const champs = [
    { statut: "correct", poids: 3 },
    { statut: "not_equivalent", poids: 1 },
    { statut: "correct", poids: 1 },
    { statut: "parse_error", poids: 2 },
  ];
  const s = sommeChampsPonderee(champs);
  verifier(s.correct === 4 && s.total === 7 && pct(s) === 57, `scénario pondéré : attendu 4/7 (57 %), reçu ${JSON.stringify(s)}`);
  verifier(pct(ancienComptageClientProf(champs)) === 50, "témoin : sans poids, la même liste donne 2/4 = 50 %");
  const ignore = sommeChampsPonderee([{ statut: null, poids: 5 }, { statut: "correct", poids: 2 }], { ignorerSansStatut: true });
  verifier(ignore.correct === 2 && ignore.total === 2, `statut masqué ignoré malgré son poids : ${JSON.stringify(ignore)}`);
  verifier(sommeChampsPonderee([{ statut: "correct", poids: 0 }, { statut: "correct", poids: 2.5 }, { statut: "correct", poids: "3" }]).total === 3, "poids invalide côté client : replié à 1 (jamais NaN)");
  console.log("  3) scénario synthétique : 4/7 = 57 % (et non 2/4 = 50 %)");
}

function blocPoidsDuChamp(): void {
  const ex = temoin.generer(0);
  verifier(poidsDuChamp(temoin, ex, CHAMP_SOMME) === 1, "sans poids déclaré : 1");
  verifier(poidsDuChamp(null, ex, CHAMP_SOMME) === 1, "générateur absent : repli à 1");
  verifier(poidsDuChamp(temoin, ex, "champ_inconnu") === 1, "champ inconnu : repli à 1");
  verifier(poidsDesChampsDeLigne({ variante_id: "variante_historique_inconnue", graine: 5, configuration: null }).size === 0, "variante hors registre : map vide (poids 1)");
  verifier(poidsDesChampsDeLigne({ variante_id: VARIANTE_TEMOIN, graine: null, configuration: null }).size === 0, "ligne sans graine : map vide (poids 1)");
  verifier(poidsDesChampsDeLigne({ variante_id: VARIANTE_TEMOIN, graine: -3, configuration: null }).size === 0, "graine invalide : map vide (poids 1)");
  verifier(poidsDesChampsDeLigne({ variante_id: VARIANTE_TEMOIN, graine: 0, configuration: null }).size > 0, "ligne exécutable : un poids par champ");
  for (const v of [1, 2, 10]) verifier(validerPoids(v) === v, `poids ${v} valide`);
  for (const v of [0, -1, 1.5, NaN, Infinity, "2", null, undefined]) {
    let leve = false;
    try {
      validerPoids(v);
    } catch {
      leve = true;
    }
    verifier(leve, `poids ${String(v)} : doit être rejeté`);
  }
  console.log("  4) poidsDuChamp : repli à 1 et rejets vérifiés");
}

async function blocRoute(): Promise<void> {
  imposerProfilAssignation("base");
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  const POIDS: Record<string, number> = { [CHAMP_SOMME]: 3, [CHAMP_PARITE]: 2, [CHAMP_DIVISEURS]: 1, [CHAMP_SIGNES]: 4 };

  // Injection de test UNIQUEMENT (le témoin réel n'est pas modifié : restauré dans `finally`).
  const ecransOrigine = temoin.ecrans;
  temoin.ecrans = (ex) => ecransOrigine.call(temoin, ex).map((e: EcranDeclare) => ({ ...e, poids: POIDS[e.champ] }));
  try {
    const tache = creerTache(s, { nom: "pondérée", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
    verifier((await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } })).statut === 201, "assignation");
    const ex = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const exercice = temoin.generer(Number(ex.graine));
    const poster = (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: ex.id, champ, reponse_brute: brute } });
    // somme ✔ (3), parité ✘ (2), diviseurs ✔ (1), signes ✔ (4) : 8/10 pondéré, 3/4 non pondéré.
    const fausseParite = reponseBruteCorrecte(exercice, CHAMP_PARITE) === "pair" ? "impair" : "pair";
    for (const [champ, brute] of [[CHAMP_SOMME, reponseBruteCorrecte(exercice, CHAMP_SOMME)], [CHAMP_PARITE, fausseParite], [CHAMP_DIVISEURS, reponseBruteCorrecte(exercice, CHAMP_DIVISEURS)], [CHAMP_SIGNES, reponseBruteCorrecte(exercice, CHAMP_SIGNES)]]) {
      const r = await poster(champ, brute);
      verifier(r.statut === 200, `POST ${champ} : ${r.statut} ${JSON.stringify(r.corps).slice(0, 120)}`);
    }

    // Ligne HISTORIQUE (sans graine, variante hors registre) dans une 2e tâche : poids 1, comptage d'origine.
    const tacheH = creerTache(s, { nom: "historique", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
    s.base.inserer("taches_assignations", { tache_id: tacheH, eleve_id: "eleve-1", date_debut: new Date(Date.now() - 86_400_000).toISOString(), date_echeance: null });
    const lh = s.base.inserer("exercices_assignes", { tache_id: tacheH, eleve_id: "eleve-1", generateur_id: "gen_historique", variante_id: "variante_historique", graine: null, champs_attendus: ["c1", "c2"], date_creation: new Date().toISOString() });
    s.base.inserer("reponses", { exercice_assigne_id: lh.id, champ: "c1", valeur_saisie: "x", statut: "correct", bug_detecte: null, indice_utilise: false, duree_ecoulee_secondes: null });
    s.base.inserer("reponses", { exercice_assigne_id: lh.id, champ: "c2", valeur_saisie: "y", statut: "not_equivalent", bug_detecte: null, indice_utilise: false, duree_ecoulee_secondes: null });

    // ── mes-resultats : score PONDÉRÉ de la tâche, comptage d'origine pour la ligne historique ──
    const mr = await appeler("eleves/mes-resultats", "GET", { jeton: jetonEleve });
    verifier(mr.statut === 200, `mes-resultats : ${mr.statut}`);
    const parNom = (nom: string) => (mr.corps.historiqueTaches as { nomTache: string; correct: number; total: number; pourcentage: number }[]).find((t) => t.nomTache === nom);
    const tp = parNom("pondérée");
    verifier(tp !== undefined && tp.correct === 8 && tp.total === 10 && tp.pourcentage === 80, `mes-resultats pondéré : attendu 8/10 (80 %), reçu ${JSON.stringify(tp)}`);
    const th = parNom("historique");
    verifier(th !== undefined && th.correct === 1 && th.total === 2 && th.pourcentage === 50, `mes-resultats ligne historique : attendu 1/2 (50 %) inchangé, reçu ${JSON.stringify(th)}`);

    // ── profs/resultats : `poids` par champ ; le module client retrouve le pourcentage serveur ──
    const pr = await appeler("profs/resultats", "GET", { jeton: jetonProf, query: { tache_id: tache } });
    verifier(pr.statut === 200, `profs/resultats : ${pr.statut} ${JSON.stringify(pr.corps).slice(0, 150)}`);
    const exRes = pr.corps.eleves?.find((e: any) => e.id === "eleve-1")?.exercices?.[0];
    const poidsRecus = Object.fromEntries((exRes?.champs ?? []).map((c: any) => [c.champ, c.poids]));
    verifier(JSON.stringify(poidsRecus) === JSON.stringify(POIDS) || Object.keys(POIDS).every((k) => poidsRecus[k] === POIDS[k]), `profs/resultats : poids par champ attendus ${JSON.stringify(POIDS)}, reçus ${JSON.stringify(poidsRecus)}`);
    const scoreClient = sommeChampsPonderee(exRes?.champs ?? []);
    verifier(scoreClient.correct === 8 && scoreClient.total === 10, `module client sur profs/resultats : attendu 8/10, reçu ${JSON.stringify(scoreClient)}`);
    verifier(pct(scoreClient) === tp?.pourcentage, "pourcentage client (profs/resultats) = pourcentage serveur (mes-resultats)");

    // ── tableau de bord élève : `poids` par champ ──
    const td = await appeler("eleves/tableau-de-bord", "GET", { jeton: jetonEleve });
    verifier(td.statut === 200, `tableau de bord élève : ${td.statut}`);
    const champsTd = ["en_cours", "effectuees", "anterieures"].flatMap((k) => (td.corps[k] ?? []) as any[]).flatMap((t) => t.exercices ?? []).filter((e: any) => e.variante_id === VARIANTE_TEMOIN).flatMap((e: any) => e.champs);
    verifier(champsTd.length === 4 && champsTd.every((c: any) => c.poids === POIDS[c.champ]), `tableau de bord élève : poids par champ attendus, reçus ${JSON.stringify(champsTd.map((c: any) => [c.champ, c.poids]))}`);
    const scoreEleve = sommeChampsPonderee(champsTd, { ignorerSansStatut: true });
    verifier(scoreEleve.correct === 8 && scoreEleve.total === 10, `module client sur le tableau de bord élève : attendu 8/10, reçu ${JSON.stringify(scoreEleve)}`);
    console.log("  5) route : mes-resultats 8/10 = 80 % (3/4 sans poids), poids servis par champ, ligne historique 1/2 inchangée");
  } finally {
    temoin.ecrans = ecransOrigine;
  }
}

async function main() {
  console.log("Poids par écran");
  blocNonRegression();
  blocParite();
  blocScenarioSynthetique();
  blocPoidsDuChamp();
  await blocRoute();
  console.log(`${nbVerifs} vérifications`);
  if (echecs.length > 0) {
    console.error(`ÉCHEC — ${echecs.length} vérification(s) :\n - ${echecs.join("\n - ")}`);
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
