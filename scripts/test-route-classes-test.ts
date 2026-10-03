// Test permanent — CLASSES DE TEST du compte administrateur (RAPPORT §61), dans le VRAI `api/router.ts` avec le VRAI registre, base en mémoire, sans réseau. Lancer : `npm run test-route-classes-test`.
// Accès (401 / 403 avant toute validation, aucun effet de bord), création (`est_test` jamais écrit par `POST /api/classes`, ni accepté en corps), élèves de test (noms réservés, mot de passe commun renvoyé
// une fois), scénario de bout en bout (tâche assignée, réponses, aide, début d'écran, RÉSULTATS affichés normalement), coexistence avec une vraie classe, suppression (oracle balayant toutes les tables, comptes
// Auth compris, le reste STRICTEMENT identique, tâche de nouveau supprimable), gardes (transfert, code, homonymes), connexion des élèves de test.

export {}; // module

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { appeler, creerScenario, installerBase } from "./support/harnaisRouteur";
import { genererExerciceCc } from "../src/generateurs/completionDuCarre/generation";
import { parametres } from "../src/generateurs/completionDuCarre/types";
import type { Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}
const rationnel = (r: Rat): string => `(${r.n}${r.d === 1 ? "" : `/${r.d}`})`;
const RACINE = join(__dirname, "..");

async function main(): Promise<void> {
  const s = creerScenario(); // prof-1 (admin ici), prof-2, classe-1 (4A, de prof-1), eleve-1, eleve-2
  const b = s.base;
  for (const p of b.table("profs")) {
    p.est_admin = p.id === "prof-1";
    p.actif = true;
  }
  b.inserer("profs", { id: "prof-3", est_admin: true, actif: true }); // un AUTRE admin
  b.table("classes")[0]!.code = "REEL01";
  installerBase(b);
  const jAdmin = "prof:prof-1";
  const jOrdinaire = "prof:prof-2";
  const jAutreAdmin = "prof:prof-3";

  // ── 1. Accès : 401 / 403 explicites, aucun effet de bord ──
  {
    const etat = () => JSON.stringify([[...b.tables.entries()], [...b.utilisateursAuth.keys()]]);
    const avant = etat();
    const ROUTES: [string, string, unknown][] = [
      ["admin/classes-test", "GET", undefined],
      ["admin/classes-test", "POST", { nom: "T" }],
      ["admin/classes-test/classe-1", "DELETE", undefined],
      ["admin/classes-test/classe-1/eleves", "POST", { nombre: 2 }],
    ];
    for (const [chemin, methode, corps] of ROUTES) {
      const sans = await appeler(chemin, methode, { corps });
      const ordinaire = await appeler(chemin, methode, { jeton: jOrdinaire, corps });
      const eleve = await appeler(chemin, methode, { jeton: "eleve:eleve-1", corps });
      verifier(sans.statut === 401 && eleve.statut === 401, `${methode} ${chemin} : 401 sans authentification / pour un élève`);
      verifier(ordinaire.statut === 403, `${methode} ${chemin} : 403 pour un professeur non admin`);
      // 403 AVANT toute validation : un corps invalide ne change pas le code.
      verifier((await appeler(chemin, methode, { jeton: jOrdinaire, corps: { n: "importe quoi" } })).statut === 403, `${methode} ${chemin} : 403 avant la validation du corps`);
    }
    verifier(etat() === avant, "les refus n'ont aucun effet de bord");
    // Source : chaque gestionnaire de lib/routes/admin/** commence par exigerAdmin (garde de forme, comme pour les routes de gestion des professeurs).
    const fichiers: string[] = [];
    const parcourir = (d: string): void => {
      for (const n of readdirSync(d)) (statSync(join(d, n)).isDirectory() ? parcourir(join(d, n)) : fichiers.push(join(d, n)));
    };
    parcourir(join(RACINE, "lib", "routes", "admin", "classes-test"));
    verifier(fichiers.length === 3 && fichiers.every((f) => readFileSync(f, "utf8").includes("await exigerAdmin(req, res)")), "les trois gestionnaires appellent exigerAdmin");
  }

  // ── 2. Création ──
  const cree = await appeler("admin/classes-test", "POST", { jeton: jAdmin, corps: { nom: "  Classe de test 1  " } });
  const classeTest = cree.corps.id as string;
  verifier(cree.statut === 201 && cree.corps.nom === "Classe de test 1" && cree.corps.est_test === true, `création (${cree.statut})`);
  const ligneClasse = b.table("classes").find((c) => c.id === classeTest)!;
  verifier(ligneClasse.est_test === true && ligneClasse.prof_id === "prof-1" && (ligneClasse.code ?? null) === null, "classe de test : est_test, prof de l'admin, AUCUN code");
  for (const corps of [{ nom: "x", est_test: false }, { nom: "x", code: "ABC123" }, {}, { nom: "" }, { nom: 3 }, { nom: "x".repeat(81) }, []]) {
    const r = await appeler("admin/classes-test", "POST", { jeton: jAdmin, corps });
    verifier(r.statut === 400, `corps refusé : ${JSON.stringify(corps).slice(0, 40)} (${r.statut})`);
  }
  verifier(b.table("classes").filter((c) => c.est_test === true).length === 1, "les corps refusés n'ont rien créé");
  // `POST /api/classes` (ouvert à tout professeur) n'écrit jamais est_test.
  const piege = await appeler("classes", "POST", { jeton: jOrdinaire, corps: { nom: "Piège", est_test: true } });
  verifier(piege.statut === 201 && b.table("classes").find((c) => c.id === piege.corps.id)!.est_test === false, "POST /api/classes ignore un est_test envoyé par un professeur");

  // ── 3. Élèves de test ──
  for (const corps of [{ nombre: 0 }, { nombre: 41 }, { nombre: "3" }, { nombre: 2.5 }, { nombre: 2, motDePasse: "x" }, {}]) {
    verifier((await appeler(`admin/classes-test/${classeTest}/eleves`, "POST", { jeton: jAdmin, corps })).statut === 400, `nombre refusé : ${JSON.stringify(corps)}`);
  }
  verifier((await appeler("admin/classes-test/classe-1/eleves", "POST", { jeton: jAdmin, corps: { nombre: 1 } })).statut === 404, "une VRAIE classe n'accepte pas d'élèves de test (404)");
  verifier((await appeler(`admin/classes-test/${classeTest}/eleves`, "POST", { jeton: jAutreAdmin, corps: { nombre: 1 } })).statut === 404, "la classe de test d'un autre admin : 404");
  const eleves = await appeler(`admin/classes-test/${classeTest}/eleves`, "POST", { jeton: jAdmin, corps: { nombre: 3 } });
  const crees = eleves.corps.eleves as { id: string; nom: string; prenom: string }[];
  const motDePasse = eleves.corps.mot_de_passe as string;
  verifier(eleves.statut === 201 && crees.length === 3 && /^[a-z2-9]{8}$/.test(motDePasse), `3 élèves créés, mot de passe commun de 8 caractères (${eleves.statut})`);
  verifier(crees.map((e) => e.prenom).join() === "Élève 01,Élève 02,Élève 03" && crees.every((e) => /^Test-[a-z0-9]{1,4}$/.test(e.nom)), `noms réservés (${crees.map((e) => `${e.prenom} ${e.nom}`).join(" | ")})`);
  verifier(crees.every((e) => b.table("inscriptions").some((i) => i.eleve_id === e.id && i.classe_id === classeTest) && b.utilisateursAuth.has(e.id)), "inscrits dans la classe de test, comptes Auth créés");
  const suite = await appeler(`admin/classes-test/${classeTest}/eleves`, "POST", { jeton: jAdmin, corps: { nombre: 1 } });
  verifier(suite.corps.eleves[0].prenom === "Élève 04", "la numérotation continue après les élèves existants");
  crees.push(suite.corps.eleves[0]);
  verifier(JSON.stringify((await appeler("admin/classes-test", "GET", { jeton: jAdmin })).corps).includes(motDePasse) === false, "le mot de passe n'est JAMAIS relisible ensuite (GET)");
  const liste = await appeler("admin/classes-test", "GET", { jeton: jAdmin });
  verifier(liste.statut === 200 && liste.corps.classes.length === 1 && liste.corps.classes[0].nombre_eleves === 4 && liste.corps.classes[0].eleves[3].prenom === "Élève 04", "GET : la classe de test et ses élèves de connexion");
  // Connexion : les élèves de test restent candidats (l'admin s'y connecte).
  const connexion = await appeler("connexion-eleve", "POST", { corps: { nom: crees[0]!.nom, prenom: crees[0]!.prenom, motDePasse } });
  verifier(connexion.statut === 200 && connexion.corps.eleve?.id === crees[0]!.id, `un élève de test peut se connecter par nom + mot de passe (${connexion.statut})`);

  // ── 4. Classes : badge, jamais de code ──
  {
    const vue = await appeler("classes", "GET", { jeton: jAdmin });
    const test = (vue.corps as any[]).find((c) => c.id === classeTest);
    const reelle = (vue.corps as any[]).find((c) => c.id === "classe-1");
    verifier(test?.est_test === true && (test.code ?? null) === null && test.nombre_eleves_actifs === 4, "GET /api/classes : la classe de test est marquée est_test, SANS code généré paresseusement");
    verifier(reelle?.est_test === false && reelle.code === "REEL01", "la vraie classe est est_test = false");
    const vueOrdinaire = await appeler("classes", "GET", { jeton: jOrdinaire });
    verifier(!(vueOrdinaire.corps as any[]).some((c) => c.id === classeTest || c.id === "classe-1"), "un autre professeur ne voit ni la classe de test ni la classe de l'admin");
    verifier((await appeler("classes/regenerer-code", "POST", { jeton: jAdmin, corps: { classe_id: classeTest } })).statut === 400, "pas de code pour une classe de test (régénération refusée)");
  }

  // ── 5. Scénario de bout en bout : tâche gen9 assignée à la classe de test ET à la vraie classe ──
  const tache = await appeler("taches", "POST", { jeton: jAdmin, corps: { nom: "Tâche de test", feedback_immediat: true, reponse_visible: true, tentatives_supplementaires: 0, aide_activee: true, composition: [{ variante_id: "completion_du_carre", nombre_exercices: 1, configuration: { actives: ["TH"] } }] } });
  const tacheId = tache.corps.id as string;
  verifier(tache.statut === 201, `création de la tâche (${tache.statut})`);
  const tacheSeule = await appeler("taches", "POST", { jeton: jAdmin, corps: { nom: "Tâche réservée au test", feedback_immediat: true, reponse_visible: true, tentatives_supplementaires: 0, composition: [{ variante_id: "completion_du_carre", nombre_exercices: 1, configuration: { actives: ["TH"] } }] } });
  const tacheSeuleId = tacheSeule.corps.id as string;
  verifier((await appeler("assignations", "POST", { jeton: jAdmin, corps: { tache_id: tacheId, classe_id: "classe-1" } })).statut === 201, "assignation à la vraie classe");
  verifier((await appeler("assignations", "POST", { jeton: jAdmin, corps: { tache_id: tacheId, classe_id: classeTest } })).statut === 201, "assignation à la classe de test");
  verifier((await appeler("assignations", "POST", { jeton: jAdmin, corps: { tache_id: tacheSeuleId, classe_id: classeTest } })).statut === 201, "assignation de la tâche réservée au test");
  verifier((await appeler(`taches/${tacheSeuleId}`, "DELETE", { jeton: jAdmin })).statut === 400, "la tâche assignée n'est pas supprimable tant que la classe de test existe");

  const exercicesDe = (eleveId: string, tId: string) => b.table("exercices_assignes").find((e) => e.eleve_id === eleveId && e.tache_id === tId)!;
  const repondre = async (eleveId: string, tId: string, juste: boolean) => {
    const ex = exercicesDe(eleveId, tId);
    const f = parametres(genererExerciceCc(Number(ex.graine), { actives: ["TH"] }));
    const jeton = `eleve:${eleveId}`;
    await appeler("reponses/debut-ecran", "POST", { jeton, corps: { exercice_assigne_id: ex.id, champ: "forme" } });
    if (tId === tacheId) await appeler("reponses/aide", "POST", { jeton, corps: { exercice_assigne_id: ex.id, champ: "forme" } });
    const brute = juste ? `${rationnel(f.a)}*(x-${rationnel(f.p)})^2+${rationnel(f.q)}` : "x^2";
    const r = await appeler("reponses", "POST", { jeton, corps: { exercice_assigne_id: ex.id, champ: "forme", reponse_brute: brute } });
    verifier(r.statut === 200, `réponse de ${eleveId} (${r.statut})`);
  };
  for (const e of crees) await repondre(e.id, tacheId, e.id !== crees[3]!.id); // 3 justes, 1 fausse
  await repondre(crees[0]!.id, tacheSeuleId, true);
  for (const id of ["eleve-1", "eleve-2"]) await repondre(id, tacheId, true);
  verifier(b.table("aides_utilisees").length > 0 && b.table("debuts_ecran").length > 0 && b.table("reponses").length >= 7, "les données de test existent dans reponses, debuts_ecran, aides_utilisees");

  // RÉSULTATS : visibles normalement pour l'admin (pas d'exclusion des agrégats).
  {
    const par_classe = await appeler("profs/resultats", "GET", { jeton: jAdmin, query: { classe_id: classeTest } });
    verifier(par_classe.statut === 200 && par_classe.corps.eleves.length === 4, `résultats de la classe de test affichés (${par_classe.statut}, ${par_classe.corps?.eleves?.length} élèves)`);
    verifier(par_classe.corps.eleves.every((e: any) => /Test-/.test(JSON.stringify(e)) || e.nom !== undefined), "chaque élève de test a sa ligne de résultats");
    const par_tache = await appeler("profs/resultats", "GET", { jeton: jAdmin, query: { tache_id: tacheId } });
    verifier(par_tache.statut === 200 && par_tache.corps.eleves.length === 6, `résultats de la tâche : élèves de la classe de test ET de la vraie classe (${par_tache.corps?.eleves?.length})`);
    const tdb = await appeler("profs/tableau-de-bord", "GET", { jeton: jAdmin });
    verifier(tdb.statut === 200, "tableau de bord de l'admin");
    verifier(JSON.stringify((await appeler("profs/resultats", "GET", { jeton: jOrdinaire, query: { classe_id: classeTest } })).corps).includes("Test-") === false, "un autre professeur n'obtient rien de la classe de test");
  }

  // ── 6. Gardes : transfert, auto-inscription, homonymes ──
  {
    const vers = await appeler("profs/transferer-eleve", "POST", { jeton: jAdmin, corps: { eleve_id: "eleve-1", nouvelle_classe_id: classeTest } });
    const depuis = await appeler("profs/transferer-eleve", "POST", { jeton: jAdmin, corps: { eleve_id: crees[0]!.id, nouvelle_classe_id: "classe-1" } });
    verifier(vers.statut === 400 && depuis.statut === 400 && b.table("inscriptions").some((i) => i.eleve_id === "eleve-1" && i.classe_id === "classe-1") && b.table("inscriptions").some((i) => i.eleve_id === crees[0]!.id && i.classe_id === classeTest), `transfert vers ou depuis une classe de test : 400, rien déplacé (${vers.statut}, ${depuis.statut})`);
    // Code d'inscription : une classe de test n'en a pas ; même si une donnée historique en portait un, l'inscription répond « code invalide ».
    b.table("classes").find((c) => c.id === classeTest)!.code = "TEST99";
    const avantEleves = b.table("eleves").length;
    const inscription = await appeler("inscription-eleve", "POST", { corps: { code: "TEST99", nom: "Dupont", prenom: "Zoé", motDePasse: "secret12" } });
    verifier(inscription.statut === 404 && b.table("eleves").length === avantEleves, "auto-inscription par le code d'une classe de test : refusée comme un code invalide, rien créé");
    b.table("classes").find((c) => c.id === classeTest)!.code = null;
    // Homonymes : un élève de test « Léa Dubois » ne fait pas afficher « (2) » une vraie « Léa Dubois » créée ensuite.
    const testLea = await appeler("profs/creer-eleve", "POST", { jeton: jAdmin, corps: { classe_id: classeTest, nom: "Dubois", prenom: "Léa", motDePasse: "secret12" } });
    const vraieLea = await appeler("profs/creer-eleve", "POST", { jeton: jAdmin, corps: { classe_id: "classe-1", nom: "Dubois", prenom: "Léa", motDePasse: "secret12" } });
    verifier(testLea.statut === 201 && vraieLea.statut === 201 && vraieLea.corps.affichage === "Léa Dubois", `une vraie élève ignore l'homonyme de test : « ${vraieLea.corps.affichage} »`);
    const autreTest = await appeler("profs/creer-eleve", "POST", { jeton: jAdmin, corps: { classe_id: classeTest, nom: "Dubois", prenom: "Léa", motDePasse: "secret12" } });
    verifier(autreTest.corps.affichage === "Léa Dubois (3)", `un élève de test compte tout le monde : « ${autreTest.corps.affichage} »`);
    // nettoyage de ces trois élèves de test/réels pour la suite : les réels restent (vraie classe), les tests partent avec la classe.
  }

  // ── 7. Suppression : irréversible, complète, sans toucher au reste ──
  const elevesTestIds = b.table("inscriptions").filter((i) => i.classe_id === classeTest).map((i) => i.eleve_id as string);
  const exercicesTestIds = b.table("exercices_assignes").filter((e) => elevesTestIds.includes(e.eleve_id as string)).map((e) => e.id as string);
  const supprimes = new Set<string>([classeTest, ...elevesTestIds, ...exercicesTestIds]);
  verifier(elevesTestIds.length === 6 && exercicesTestIds.length === 8, `avant : 6 élèves de test (4 + 2 « Léa »), 8 exercices — les « Léa » ont été créées après l'assignation (${elevesTestIds.length}, ${exercicesTestIds.length})`);
  const instantane = (): string => {
    const sortie: Record<string, string[]> = {};
    for (const [nom, lignes] of [...b.tables.entries()].sort(([x], [y]) => x.localeCompare(y))) sortie[nom] = lignes.filter((l) => !Object.values(l).some((v) => typeof v === "string" && supprimes.has(v))).map((l) => JSON.stringify(l, Object.keys(l).sort()));
    return JSON.stringify(sortie);
  };
  const avant = instantane();
  // Refus : vraie classe, classe inconnue, autre admin, non admin.
  verifier((await appeler("admin/classes-test/classe-1", "DELETE", { jeton: jAdmin })).statut === 404 && b.table("classes").some((c) => c.id === "classe-1"), "DELETE sur une VRAIE classe : 404, intacte");
  verifier((await appeler(`admin/classes-test/${classeTest}`, "DELETE", { jeton: jAutreAdmin })).statut === 404 && b.table("classes").some((c) => c.id === classeTest), "DELETE par un autre admin : 404");
  verifier((await appeler("admin/classes-test/inexistante", "DELETE", { jeton: jAdmin })).statut === 404, "DELETE d'une classe inconnue : 404");
  b.inserer("inscriptions", { eleve_id: elevesTestIds[0], classe_id: "classe-1" }); // élève de test AUSSI dans une vraie classe (donnée forgée)
  const toutAvant409 = JSON.stringify([...b.tables.entries()]);
  const partage = await appeler(`admin/classes-test/${classeTest}`, "DELETE", { jeton: jAdmin });
  verifier(partage.statut === 409 && Array.isArray(partage.corps.eleves_partages) && JSON.stringify([...b.tables.entries()]) === toutAvant409, `élève partagé : 409 avec son nom, RIEN n'est supprimé (${partage.statut})`);
  b.table("inscriptions").splice(b.table("inscriptions").findIndex((i) => i.eleve_id === elevesTestIds[0] && i.classe_id === "classe-1"), 1);

  const suppression = await appeler(`admin/classes-test/${classeTest}`, "DELETE", { jeton: jAdmin });
  verifier(suppression.statut === 200 && suppression.corps.eleves_supprimes === 6 && suppression.corps.exercices_supprimes === 8 && !("comptes_auth_non_supprimes" in suppression.corps), `suppression (${suppression.statut} ${JSON.stringify(suppression.corps)})`);
  // ORACLE : aucune cellule d'aucune table ne cite un identifiant supprimé ; aucun compte Auth ne reste.
  const restes: string[] = [];
  for (const [nom, lignes] of b.tables) for (const l of lignes) for (const [col, v] of Object.entries(l)) if (typeof v === "string" && supprimes.has(v)) restes.push(`${nom}.${col}`);
  for (const id of supprimes) if (b.utilisateursAuth.has(id)) restes.push(`auth.${id}`);
  verifier(restes.length === 0, `aucune ligne ne subsiste : ${restes.slice(0, 6).join(", ")}`);
  verifier(instantane() === avant, "tout le reste est STRICTEMENT identique (vraie classe, ses élèves et leurs réponses, tâches, compositions, autre professeur)");
  verifier(b.table("reponses").some((r) => exercicesDe("eleve-1", tacheId).id === r.exercice_assigne_id), "les réponses de la vraie classe sont intactes");
  verifier((await appeler(`admin/classes-test/${classeTest}`, "DELETE", { jeton: jAdmin })).statut === 404, "une seconde suppression : 404");
  // La tâche réservée au test redevient supprimable ; l'autre (assignée à la vraie classe) reste verrouillée.
  verifier((await appeler(`taches/${tacheSeuleId}`, "DELETE", { jeton: jAdmin })).statut === 200, "la tâche qui n'était assignée qu'à la classe de test redevient supprimable");
  verifier((await appeler(`taches/${tacheId}`, "DELETE", { jeton: jAdmin })).statut === 400, "la tâche assignée à la vraie classe reste verrouillée");
  // La vraie classe fonctionne comme avant : résultats lisibles.
  const resultatsReels = await appeler("profs/resultats", "GET", { jeton: jAdmin, query: { classe_id: "classe-1" } });
  verifier(resultatsReels.statut === 200 && resultatsReels.corps.eleves.length === 3, `résultats de la vraie classe après suppression (eleve-1, eleve-2, la vraie Léa) (${resultatsReels.corps?.eleves?.length} élèves)`);
}

main()
  .then(() => {
    if (echecs.length > 0) {
      console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
      for (const e of echecs) console.error(` - ${e}`);
      process.exit(1);
    }
    console.log(`OK : ${nb} vérifications (classes de test dans le vrai routeur : accès admin, création, élèves de test, scénario complet avec résultats, coexistence, gardes, suppression sans reste)`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
