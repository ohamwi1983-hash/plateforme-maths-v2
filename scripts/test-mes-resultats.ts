// Test permanent — GET /api/eleves/mes-resultats, exécuté contre le VRAI handler (via le vrai routeur)
// et une base en mémoire (scripts/support/). Réécrit en phase 2 pour utiliser le faux Supabase à filtres
// réels (l'ancien faux ignorait `.eq`/`.in`, donc incapable de tester la complétion par le moteur de
// tentatives). Les 4 vérifications d'origine (historique, C04, évolution, ordreCategories) sont
// conservées ; s'y ajoutent les cas de complétion : un champ n'est « terminé » qu'à l'état du moteur de
// tentatives, jamais dès la première réponse.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase, type Scenario } from "./support/harnaisRouteur";

const FUTUR = "2099-01-01T00:00:00.000Z";
const PASSE = "2020-01-01T00:00:00.000Z";
const DEBUT = "2024-01-01T00:00:00.000Z";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

let horloge = 0;
function repondre(s: Scenario, exercice: string, champ: string, statut: string, bug: string | null = null): void {
  s.base.inserer("reponses", { exercice_assigne_id: exercice, champ, valeur_saisie: "x", statut, bug_detecte: bug, indice_utilise: false, horodatage: new Date(Date.UTC(2024, 1, 1, 0, 0, horloge++)).toISOString(), duree_ecoulee_secondes: null });
}

function exercice(s: Scenario, tacheId: string, champs: string[], eleveId = "eleve-1"): string {
  return s.base.inserer("exercices_assignes", { tache_id: tacheId, eleve_id: eleveId, generateur_id: "g", variante_id: "v", champs_attendus: champs, graine: 1 }).id as string;
}

function classe(s: Scenario, tacheId: string, echeance: string, debut = DEBUT): void {
  s.base.inserer("taches_assignations", { tache_id: tacheId, classe_id: s.classeId, date_echeance: echeance, date_debut: debut });
}

const lire = async (jeton = "eleve:eleve-1") => appeler("eleves/mes-resultats", "GET", { jeton });

async function main() {
  // ── Aucun exercice ──
  {
    const s = creerScenario();
    installerBase(s.base);
    const { statut, corps } = await lire();
    verifier(statut === 200 && corps.competences.length === 0 && corps.evolution.length === 0 && corps.historiqueTaches.length === 0, "vide : tout vide attendu");
    verifier(corps.tendanceScore === "stable", "vide : tendanceScore « stable »");
  }

  // ── Scénario d'origine (avec 1 tentative supplémentaire : « échec puis réussite » est alors réaliste) ──
  {
    const s = creerScenario();
    installerBase(s.base);
    const tA = creerTache(s, { nom: "Devoir A", tentatives_supplementaires: 1 });
    const tB = creerTache(s, { nom: "Devoir B", tentatives_supplementaires: 1 });
    const exA = exercice(s, tA, ["champ1", "champ2"]);
    const exB = exercice(s, tB, ["champ1"]);
    classe(s, tA, FUTUR); // pas encore échue + complète -> « effectuées »
    classe(s, tB, PASSE); // échue -> « antérieures »
    repondre(s, exA, "champ1", "not_equivalent", "C04");
    repondre(s, exA, "champ2", "not_equivalent", "C04");
    repondre(s, exA, "champ1", "correct");
    repondre(s, exA, "champ2", "correct");
    repondre(s, exB, "champ1", "correct");
    const { statut, corps } = await lire();
    verifier(statut === 200, `principal : 200 attendu, obtenu ${statut}`);
    verifier(corps.historiqueTaches.length === 2, `historique : 2 tâches attendues, obtenu ${corps.historiqueTaches.length}`);
    const [a, b] = corps.historiqueTaches;
    verifier(a?.tacheId === tA && a.correct === 2 && a.total === 2 && a.pourcentage === 100, `tâche A : ${JSON.stringify(a)}`);
    verifier(b?.tacheId === tB && b.correct === 1 && b.total === 1, `tâche B : ${JSON.stringify(b)}`);
    const c04 = corps.competences.find((c: any) => c.code === "C04");
    verifier(!!c04 && c04.statut === "non_maitrisee" && c04.occurrences === 2, `C04 : ${JSON.stringify(c04)}`);
    const evo = corps.evolution.find((e: any) => e.code === "C04");
    verifier(!!evo && evo.tendance === "en_progres" && evo.occurrencesAnciennes === 2 && evo.occurrencesRecentes === 0, `évolution C04 : ${JSON.stringify(evo)}`);
    verifier(corps.ordreCategories !== undefined, "ordreCategories absent");
  }

  // ── Complétion : pas « terminé » dès la première réponse quand des tentatives supplémentaires existent ──
  {
    const s = creerScenario();
    installerBase(s.base);
    const t = creerTache(s, { nom: "Deux essais", tentatives_supplementaires: 1 });
    const ex = exercice(s, t, ["champ1"]);
    classe(s, t, FUTUR);
    repondre(s, ex, "champ1", "not_equivalent"); // 1 essai raté sur 2 : le champ reste OUVERT
    let { corps } = await lire();
    verifier(corps.historiqueTaches.length === 0, "1 échec sur 2 essais : la tâche ne doit PAS être notée (champ encore ouvert)");
    repondre(s, ex, "champ1", "not_equivalent"); // 2e échec : révélé -> terminé, score 0
    ({ corps } = await lire());
    verifier(corps.historiqueTaches.length === 1 && corps.historiqueTaches[0].correct === 0 && corps.historiqueTaches[0].total === 1, `2 échecs : tâche notée 0/1, obtenu ${JSON.stringify(corps.historiqueTaches)}`);
  }
  {
    const s = creerScenario();
    installerBase(s.base);
    const t = creerTache(s, { nom: "Un essai" }); // 0 tentative supplémentaire : la 1re réponse termine le champ
    const ex = exercice(s, t, ["champ1"]);
    classe(s, t, FUTUR);
    repondre(s, ex, "champ1", "not_equivalent");
    const { corps } = await lire();
    verifier(corps.historiqueTaches.length === 1 && corps.historiqueTaches[0].correct === 0, "sans tentative supplémentaire : une seule réponse suffit à noter la tâche");
  }

  // ── Chrono écoulé sans réponse : champ terminé (révélé), compté raté dans le total ──
  {
    const s = creerScenario();
    installerBase(s.base);
    const t = creerTache(s, { nom: "Chrono", chrono_mode: "par_ecran", chrono_duree_secondes: 60 });
    const ex = exercice(s, t, ["champ1", "champ2"]);
    classe(s, t, FUTUR);
    repondre(s, ex, "champ1", "correct");
    s.base.inserer("debuts_ecran", { exercice_assigne_id: ex, champ: "champ2", horodatage_debut: new Date(Date.now() - 3600_000).toISOString() });
    const { corps } = await lire();
    verifier(corps.historiqueTaches.length === 1 && corps.historiqueTaches[0].correct === 1 && corps.historiqueTaches[0].total === 2, `chrono écoulé : 1/2 attendu, obtenu ${JSON.stringify(corps.historiqueTaches)}`);
  }

  // ── Assignation par élève : fenêtre de dates respectée ──
  {
    const s = creerScenario();
    installerBase(s.base);
    const t = creerTache(s, { nom: "Individuelle passée" });
    const ex = exercice(s, t, ["champ1"]);
    s.base.inserer("taches_assignations_eleves", { tache_id: t, eleve_id: "eleve-1", date_echeance: PASSE, date_debut: DEBUT });
    repondre(s, ex, "champ1", "correct");
    const { corps } = await lire();
    verifier(corps.historiqueTaches.length === 1, "tâche assignée à l'élève, échue : classée « antérieure » (notée)");
    const t2 = creerTache(s, { nom: "Individuelle future" });
    const ex2 = exercice(s, t2, ["champ1"]);
    s.base.inserer("taches_assignations_eleves", { tache_id: t2, eleve_id: "eleve-1", date_echeance: FUTUR, date_debut: FUTUR });
    repondre(s, ex2, "champ1", "correct");
    const apres = (await lire()).corps;
    verifier(apres.historiqueTaches.length === 1, "tâche assignée à l'élève, pas encore commencée : absente de l'historique");
  }

  if (echecs.length > 0) {
    console.error(`ECHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`TOUS LES TESTS MES-RESULTATS PASSENT (${nb} vérifications)`);
}

main().catch((e) => {
  console.error("ECHEC :", e);
  process.exit(1);
});
