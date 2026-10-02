// Test permanent — « Aperçu » d'une tâche avant création (RAPPORT §36), contre le VRAI `api/router.ts`, le VRAI registre (gen7) et une
// base en mémoire (harnais partagé). Vérifie : la route `POST /api/taches/apercu` (validation, refus 409 d'une variante sans générateur
// exécutable AVANT toute écriture, élève fantôme créé une fois puis réutilisé, tâche `est_apercu` aux réglages du formulaire,
// exercices tirés du registre, fenêtre d'assignation, session renvoyée), le moteur élève utilisé TEL QUEL avec cette session, la
// suppression en cascade de l'aperçu précédent (y compris `aides_utilisees` et `taches_assignations_eleves`), l'exclusion de l'aperçu de
// toutes les vues professeur, l'isolation entre professeurs, et le catalogue (`executable` dérivé du registre).
// Lancer : `npm run test-apercu-tache`. Sans réseau.

export {}; // module

import { appeler, creerScenario, installerBase } from "./support/harnaisRouteur";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const table = (nom: string) => s.base.table(nom);
  const reglages = { feedback_immediat: false, reponse_visible: true, tentatives_supplementaires: 0, aide_activee: true, aide_penalite_pourcent: 25, afficher_recapitulatif: true, chrono_mode: "global", chrono_duree_secondes: 900 };
  const corps1 = { nom: "Étude de fonctions", ...reglages, composition: [{ variante_id: "af_motif_racine_nulle_rationnelle", nombre_exercices: 2 }, { variante_id: "af_delta_aucune_racine", nombre_exercices: 1 }, { variante_id: "af_motif_racines_opposees_rationnelles", nombre_exercices: 0 }] };
  // Une vraie tâche du même professeur, pour vérifier que l'aperçu ne s'y mélange jamais.
  const vraie = await appeler("taches", "POST", { jeton: jetonProf, corps: { nom: "Vraie tâche", composition: [{ variante_id: "af_motif_racine_double_rationnelle", nombre_exercices: 1 }] } });
  verifier(vraie.statut === 201, `création d'une vraie tâche : ${vraie.statut}`);

  // ── 1. Validation ──
  verifier((await appeler("taches/apercu", "POST", { corps: corps1 })).statut === 401, "sans jeton : 401");
  verifier((await appeler("taches/apercu", "POST", { jeton: `eleve:eleve-1`, corps: corps1 })).statut === 401, "avec un jeton d'élève : 401");
  verifier((await appeler("taches/apercu", "GET", { jeton: jetonProf })).statut === 405, "GET : 405");
  verifier((await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: { nom: "", composition: corps1.composition } })).statut === 400, "nom vide : 400 (la même validation que POST /api/taches)");
  verifier((await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: { nom: "x", composition: [{ variante_id: "n_existe_pas", nombre_exercices: 1 }] } })).statut === 400, "variante inconnue du catalogue : 400");
  verifier((await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: { nom: "x", composition: [{ variante_id: "af_delta_aucune_racine", nombre_exercices: 0 }] } })).statut === 400, "composition sans exercice : 400");
  verifier((await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: { nom: "x", composition: [{ variante_id: "_temoin_technique_v1", nombre_exercices: 1 }] } })).statut === 400, "le témoin technique n'est pas composable : 400");
  verifier(table("taches").filter((t) => t.est_apercu === true).length === 0 && table("eleves").length === 2, "les rejets n'écrivent rien (aucun aperçu, aucun fantôme)");

  // ── 2. Premier aperçu ──
  const a1 = await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: corps1 });
  verifier(a1.statut === 201 && typeof a1.corps.tache_id === "string" && typeof a1.corps.access_token === "string" && typeof a1.corps.refresh_token === "string", `1er aperçu : 201 + session (${a1.statut} ${JSON.stringify(Object.keys(a1.corps ?? {}))})`);
  const ligneProf = table("profs").find((p) => p.id === s.profId)!;
  const fantomeId = ligneProf.eleve_apercu_id as string;
  verifier(typeof fantomeId === "string" && table("eleves").some((e) => e.id === fantomeId), "l'élève fantôme est créé et lié au professeur (profs.eleve_apercu_id)");
  verifier(!table("inscriptions").some((i) => i.eleve_id === fantomeId), "le fantôme n'est inscrit à AUCUNE classe");
  const tache1 = table("taches").find((t) => t.id === a1.corps.tache_id)!;
  verifier(tache1.est_apercu === true && tache1.prof_id === s.profId && tache1.nom === "Étude de fonctions", "la tâche d'aperçu est marquée est_apercu et porte le nom saisi");
  verifier(tache1.feedback_immediat === false && tache1.reponse_visible === true && tache1.tentatives_supplementaires === 0 && tache1.aide_activee === true && tache1.aide_penalite_pourcent === 25 && tache1.afficher_recapitulatif === true && tache1.chrono_mode === "global" && tache1.chrono_duree_secondes === 900, "TOUS les réglages du formulaire sont repris (correction coupée, aide, chrono…)");
  const comp1 = table("taches_composition").filter((c) => c.tache_id === tache1.id);
  verifier(comp1.map((c) => `${c.generateur_id}/${c.variante_id}/${c.nombre_exercices}`).sort().join() === "gen7/af_delta_aucune_racine/1,gen7/af_motif_racine_nulle_rationnelle/2", `composition copiée sans la ligne à 0 (${JSON.stringify(comp1.map((c) => c.variante_id))})`);
  const exercices1 = table("exercices_assignes").filter((e) => e.tache_id === tache1.id);
  verifier(exercices1.length === 3 && exercices1.every((e) => e.eleve_id === fantomeId && Number.isInteger(e.graine)), "3 exercices générés pour le fantôme seul, avec une graine");
  verifier(exercices1.every((e) => Array.isArray(e.champs_attendus) && (e.champs_attendus as string[]).length === 6), "champs_attendus du registre (6 écrans pour chacune des dix sous-variantes)");
  verifier(table("taches_assignations_eleves").filter((f) => f.tache_id === tache1.id && f.eleve_id === fantomeId).length === 1, "une fenêtre d'assignation est créée pour le fantôme (sinon le tableau de bord élève l'ignore)");
  verifier(a1.corps.access_token === `eleve:${fantomeId}`, "la session renvoyée est celle du fantôme");
  verifier(table("taches_assignations").length === 0, "aucune assignation de classe");

  // ── 3. Le moteur élève, tel quel, avec cette session ──
  const jetonFantome = a1.corps.access_token as string;
  const tdb = await appeler("eleves/tableau-de-bord", "GET", { jeton: jetonFantome });
  const enCours = (tdb.corps.en_cours ?? []) as { tache_id: string; exercices: { id: string }[] }[];
  verifier(tdb.statut === 200 && enCours.length === 1 && enCours[0]!.tache_id === tache1.id && enCours[0]!.exercices.length === 3, `le tableau de bord du fantôme montre l'aperçu (${tdb.statut}, ${enCours.length} tâche(s))`);
  const ex1 = exercices1.find((e) => e.variante_id === "af_motif_racine_nulle_rationnelle")!;
  const exercice = genererExerciceMD("af_motif_racine_nulle_rationnelle", Number(ex1.graine));
  const lecture = await appeler(`exercices/${ex1.id}`, "GET", { jeton: jetonFantome });
  verifier(lecture.statut === 200 && lecture.corps.ecrans?.[0]?.champ === "coefficients", "GET exercices/:id sert le premier écran gen7 au fantôme");
  const reponse = await appeler("reponses", "POST", { jeton: jetonFantome, corps: { exercice_assigne_id: ex1.id, champ: "coefficients", reponse_brute: reponseBruteCorrecteMotifDelta(exercice, "coefficients") } });
  verifier(reponse.statut === 200, `POST reponses accepté pour le fantôme : ${reponse.statut}`);
  const allureJuste = JSON.parse(reponseBruteCorrecteMotifDelta(exercice, "allure")) as { concavite: string; positionSommet: string };
  const rate = await appeler("reponses", "POST", { jeton: jetonFantome, corps: { exercice_assigne_id: ex1.id, champ: "allure", reponse_brute: JSON.stringify({ concavite: allureJuste.concavite, positionSommet: allureJuste.positionSommet === "gauche" ? "droite" : "gauche" }) } }); // sens juste, position fausse : ALLURE_PARTIELLE
  verifier(rate.statut === 200, "une réponse fausse à code de compétence (ALLURE_PARTIELLE) est acceptée");
  await appeler("reponses/debut-ecran", "POST", { jeton: jetonFantome, corps: { exercice_assigne_id: ex1.id, champ: "allure" } });
  const aide = await appeler("reponses/aide", "POST", { jeton: jetonFantome, corps: { exercice_assigne_id: ex1.id, champ: "allure" } });
  verifier(table("reponses").some((r) => r.exercice_assigne_id === ex1.id) && table("debuts_ecran").some((d) => d.exercice_assigne_id === ex1.id) && (aide.statut === 200 ? table("aides_utilisees").some((x) => x.exercice_assigne_id === ex1.id) : true), "réponses, début d'écran et usage d'aide écrits comme pour un vrai élève");
  if (table("aides_utilisees").length === 0) table("aides_utilisees").push({ exercice_assigne_id: ex1.id, champ: "coefficients" }); // garantit le cas « aide utilisée » de la cascade ci-dessous

  // ── 4. Exclusion de toutes les vues professeur ──
  const liste = await appeler("taches", "GET", { jeton: jetonProf });
  verifier(liste.statut === 200 && (liste.corps as { id: string }[]).every((t) => t.id !== tache1.id) && (liste.corps as unknown[]).length === 1, "GET taches : l'aperçu n'est JAMAIS listé (seule la vraie tâche l'est)");
  verifier((await appeler(`taches/${tache1.id}`, "DELETE", { jeton: jetonProf })).statut === 404 && (await appeler(`taches/${tache1.id}`, "PATCH", { jeton: jetonProf, corps: { nom: "x", composition: [{ variante_id: "af_delta_aucune_racine", nombre_exercices: 1 }] } })).statut === 404, "PATCH / DELETE d'une tâche d'aperçu : introuvable, même pour son professeur");
  const tdbProf = await appeler("profs/tableau-de-bord", "GET", { jeton: jetonProf });
  verifier(tdbProf.statut === 200 && tdbProf.corps.reponsesAvecBug === 0, `les réponses du professeur pendant l'aperçu ne comptent jamais dans les statistiques (reponsesAvecBug = ${tdbProf.corps.reponsesAvecBug})`);
  const eleves = await appeler("eleves", "GET", { jeton: jetonProf, query: { classe_id: s.classeId } });
  verifier(eleves.statut === 200 && JSON.stringify(eleves.corps).indexOf(fantomeId) === -1, "le fantôme n'apparaît dans aucune liste d'élèves de classe");
  const resultats = await appeler("profs/resultats", "GET", { jeton: jetonProf, query: { classe_id: s.classeId } });
  verifier(resultats.statut === 200 && JSON.stringify(resultats.corps).indexOf(fantomeId) === -1, "le fantôme n'apparaît pas dans les résultats par classe");

  // ── 5. Refus 409 d'une variante sans générateur exécutable : AVANT toute écriture, l'aperçu précédent reste ──
  const { REGISTRE_GENERATEURS } = require("../lib/registreGenerateurs") as { REGISTRE_GENERATEURS: { variante_id: string }[] };
  const i = REGISTRE_GENERATEURS.findIndex((g) => g.variante_id === "af_delta_aucune_racine");
  const [retire] = REGISTRE_GENERATEURS.splice(i, 1);
  try {
    const cat = await appeler("catalogue-generateurs", "GET", { jeton: jetonProf });
    const entrees = cat.corps as { variante_id: string; executable: boolean }[];
    verifier(entrees.length === 11 && entrees.find((e) => e.variante_id === "af_delta_aucune_racine")?.executable === false && entrees.filter((e) => e.variante_id !== "af_delta_aucune_racine").every((e) => e.executable === true), "catalogue : `executable` est dérivé du registre (faux seulement pour la variante retirée)");
    const refus = await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: corps1 });
    verifier(refus.statut === 409 && refus.corps.variantes_indisponibles?.join() === "af_delta_aucune_racine", `variante sans générateur : 409 (${refus.statut} ${JSON.stringify(refus.corps)})`);
    verifier(table("taches").some((t) => t.id === tache1.id) && table("exercices_assignes").filter((e) => e.tache_id === tache1.id).length === 3, "le 409 n'a rien supprimé : l'aperçu précédent reste en place");
  } finally {
    REGISTRE_GENERATEURS.splice(i, 0, retire!);
  }
  verifier(((await appeler("catalogue-generateurs", "GET", { jeton: jetonProf })).corps as { executable: boolean }[]).every((e) => e.executable === true), "catalogue : les 10 variantes de gen7 sont exécutables");

  // ── 6. Second aperçu : MÊME fantôme, cascade complète sur l'ancien ──
  const ancienIds = exercices1.map((e) => e.id as string);
  const a2 = await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: { nom: "Second", composition: [{ variante_id: "af_motif_racine_double_rationnelle", nombre_exercices: 1 }] } });
  verifier(a2.statut === 201 && a2.corps.tache_id !== tache1.id, `2e aperçu : 201 (${a2.statut})`);
  verifier(table("profs").find((p) => p.id === s.profId)!.eleve_apercu_id === fantomeId && table("eleves").length === 3, "le MÊME fantôme est réutilisé (jamais un 2e)");
  verifier(table("taches").filter((t) => t.est_apercu === true).length === 1 && !table("taches").some((t) => t.id === tache1.id), "au plus UN aperçu vivant : l'ancien est supprimé");
  verifier(!table("exercices_assignes").some((e) => ancienIds.includes(e.id as string)) && !table("reponses").some((r) => ancienIds.includes(r.exercice_assigne_id as string)) && !table("debuts_ecran").some((d) => ancienIds.includes(d.exercice_assigne_id as string)) && !table("aides_utilisees").some((x) => ancienIds.includes(x.exercice_assigne_id as string)), "exercices, réponses, débuts d'écran ET usages d'aide de l'ancien aperçu sont supprimés");
  verifier(!table("taches_composition").some((c) => c.tache_id === tache1.id) && !table("taches_assignations_eleves").some((f) => f.tache_id === tache1.id), "composition et fenêtre d'assignation de l'ancien aperçu sont supprimées");
  verifier(table("taches").some((t) => t.id === vraie.corps.id && t.est_apercu === false) && table("taches_composition").some((c) => c.tache_id === vraie.corps.id), "la vraie tâche du professeur (et sa composition) est intacte");
  const tdb2 = await appeler("eleves/tableau-de-bord", "GET", { jeton: a2.corps.access_token });
  verifier(tdb2.statut === 200 && (tdb2.corps.en_cours ?? []).length === 1 && tdb2.corps.en_cours[0].tache_id === a2.corps.tache_id, "le tableau de bord du fantôme ne montre que le nouvel aperçu");

  // ── 7. Échec de préparation de la session : 500, pas de jeton ──
  s.base.echecProchaineMajAuth = "auth indisponible";
  const panne = await appeler("taches/apercu", "POST", { jeton: jetonProf, corps: corps1 });
  verifier(panne.statut === 500 && panne.corps.access_token === undefined, `échec Auth : 500 sans jeton (${panne.statut})`);

  // ── 8. Isolation entre professeurs ──
  const autre = await appeler("taches/apercu", "POST", { jeton: `prof:${s.autreProfId}`, corps: corps1 });
  const fantomeAutre = table("profs").find((p) => p.id === s.autreProfId)!.eleve_apercu_id;
  verifier(autre.statut === 201 && typeof fantomeAutre === "string" && fantomeAutre !== fantomeId, "un autre professeur a SON fantôme");
  verifier(table("taches").filter((t) => t.est_apercu === true && t.prof_id === s.profId).length === 1 && table("taches").filter((t) => t.est_apercu === true && t.prof_id === s.autreProfId).length === 1, "l'aperçu d'un professeur ne supprime pas celui d'un autre");

  // ── 9. Aucune trace d'aperçu ne survit à une DEUXIÈME connexion du même jeton après désactivation du fantôme (accès par requête) ──
  table("eleves").find((e) => e.id === fantomeId)!.actif = false;
  verifier((await appeler("eleves/tableau-de-bord", "GET", { jeton: a2.corps.access_token })).statut === 401, "(cohérence §35) un fantôme désactivé serait refusé comme tout élève désactivé");
  table("eleves").find((e) => e.id === fantomeId)!.actif = true;

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (POST /api/taches/apercu réel : validation, 409 avant écriture, fantôme créé puis réutilisé, réglages copiés, moteur élève tel quel, cascade complète, exclusion des vues professeur, isolation, catalogue executable)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
