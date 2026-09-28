/**
 * Test de fumée exécutable — pas une suite de tests unitaires complète, juste une vérification
 * bout en bout des fonctions PURES du socle de gestion (phase 1), sans dépendance à
 * Supabase/Vercel. Exécuter avec `npx tsx scripts/smoke-test.ts`.
 *
 * Extrait de `scripts/smoke-test.ts` de l'ancien pilote (voir RAPPORT.md) : seuls les blocs
 * portant sur des fonctions de gestion (code de classe, normalisation, homonymes, réglages de
 * correction, tableau de bord, moteur de tentatives, profil de compétences) sont conservés — tout
 * ce qui exerçait `src/generateurs/`, `src/moteur/`, `src/diagnostic/` (gen1/gen6/secondDegre) est
 * abandonné, ainsi que le bloc `estPeriodeAssignationValide` (dépend de `lib/routes/assignations`,
 * différé phase 2, jamais copié ici) et les blocs `formatQuadratique`/`formatMembreGaucheKatex`
 * (dépendent de `lib/formatQuadratique.ts`, jamais copié — hors des 29 fichiers `lib/` du socle).
 */
import { genererCodeClasse } from "../lib/codeClasse";
import { normaliserTexte } from "../lib/normaliserTexte";
import { filtrerHomonymes, formaterAffichage } from "../lib/homonymes";
import { construireReponseHttpReponses } from "../lib/reglagesCorrection";
import {
  exerciceEstComplet,
  tacheEstComplete,
  classifierTache,
  construireChampVue,
  REGLAGES_FORCEES_ANTERIEURES,
  resumeExercice,
  resumeTache,
  calculerSerieActuelle,
} from "../lib/tableauDeBord";
import { nombreTachesEnCoursDepuisAssignations, compterBugsDepuisReponses } from "../lib/routes/profs/tableau-de-bord";
import { calculerProfilCompetences } from "../lib/profilCompetences";
import { calculerEtatChampTentatives, tentativesMaxDepuisReglages, statutRecap, libelleStatutRecap, construireLigneRecap } from "../lib/moteurTentatives";

const NB_TIRAGES = 500;

// --- code de classe : format (6 caractères, exclut 0/O/1/I/L), unicité de la génération pure ---
{
  const AMBIGUS = new Set(["0", "O", "1", "I", "L"]);
  const codes = new Set<string>();
  for (let i = 0; i < NB_TIRAGES; i++) {
    const code = genererCodeClasse();
    if (code.length !== 6) throw new Error(`code de classe de longueur inattendue : ${code}`);
    if (!/^[A-Z0-9]+$/.test(code)) throw new Error(`code de classe hors charte alphanumérique majuscule : ${code}`);
    for (const car of code) {
      if (AMBIGUS.has(car)) throw new Error(`code de classe contient un caractère ambigu exclu (${car}) : ${code}`);
    }
    codes.add(code);
  }
  if (codes.size < NB_TIRAGES * 0.99) throw new Error(`trop de collisions parmi ${NB_TIRAGES} générations indépendantes (${codes.size} valeurs distinctes) — génération suspecte`);
  console.log(`OK: genererCodeClasse (format, exclusions 0/O/1/I/L, quasi-unicité sur ${NB_TIRAGES} tirages)`);
}

// --- normalisation : insensible à la casse et aux accents ---
{
  if (normaliserTexte("Léa") !== normaliserTexte("lea")) throw new Error("normaliserTexte : accent non ignoré");
  if (normaliserTexte("DUBOIS") !== normaliserTexte("dubois")) throw new Error("normaliserTexte : casse non ignorée");
  if (normaliserTexte("  Noël  ") !== "noel") throw new Error(`normaliserTexte : trim/accent inattendu, obtenu "${normaliserTexte("  Noël  ")}"`);
  if (normaliserTexte("François") !== "francois") throw new Error(`normaliserTexte : cédille non gérée, obtenu "${normaliserTexte("François")}"`);
  console.log("OK: normaliserTexte (casse + accents + cédille + trim)");
}

// --- homonymes : filtrage insensible casse/accents, non-appariement sur nom OU prénom différent, suffixe d'affichage ---
{
  const existants = [
    { nom: "Dubois", prenom: "Léa" },
    { nom: "Martin", prenom: "Noé" },
  ];
  const memeHomonyme = filtrerHomonymes(existants, { nom: "DUBOIS", prenom: "lea" });
  if (memeHomonyme.length !== 1) throw new Error(`filtrerHomonymes : devrait apparier "DUBOIS"/"lea" à "Dubois"/"Léa" (insensible casse/accents), obtenu ${memeHomonyme.length} résultat(s)`);

  const nomDifferent = filtrerHomonymes(existants, { nom: "Durand", prenom: "Léa" });
  if (nomDifferent.length !== 0) throw new Error("filtrerHomonymes : ne devrait pas apparier un nom différent même avec le même prénom");

  const prenomDifferent = filtrerHomonymes(existants, { nom: "Dubois", prenom: "Léo" });
  if (prenomDifferent.length !== 0) throw new Error("filtrerHomonymes : ne devrait pas apparier un prénom différent même avec le même nom");

  if (formaterAffichage("Dubois", "Léa", 1) !== "Léa Dubois") throw new Error(`formaterAffichage : suffixe 1 ne devrait jamais être affiché, obtenu "${formaterAffichage("Dubois", "Léa", 1)}"`);
  if (formaterAffichage("Dubois", "Léa", null) !== "Léa Dubois") throw new Error("formaterAffichage : suffixe absent ne devrait jamais être affiché");
  if (formaterAffichage("Dubois", "Léa", 2) !== "Léa Dubois (2)") throw new Error(`formaterAffichage : suffixe 2 attendu "(2)", obtenu "${formaterAffichage("Dubois", "Léa", 2)}"`);
  console.log("OK: filtrerHomonymes/formaterAffichage (appariement nom+prénom, non-appariement partiel, suffixe d'affichage)");
}

// --- réglages de correction : les 3 combinaisons de feedback_immediat/reponse_visible (Étape 4) ---
{
  const solution = "cas_general";

  const rienDuTout = construireReponseHttpReponses({ feedback_immediat: false, reponse_visible: false }, "correct", solution);
  if (Object.keys(rienDuTout).length !== 0) throw new Error(`feedback_immediat=false : réponse HTTP devrait être vide, obtenu ${JSON.stringify(rienDuTout)}`);

  // reponse_visible=true ne devrait pas non plus s'appliquer quand feedback_immediat=false (Étape 4 : "n'a d'effet que si feedback_immediat est vrai").
  const rienMemeAvecReponseVisible = construireReponseHttpReponses({ feedback_immediat: false, reponse_visible: true }, "correct", solution);
  if (Object.keys(rienMemeAvecReponseVisible).length !== 0) throw new Error("reponse_visible ne devrait avoir aucun effet quand feedback_immediat=false");

  const statutSeul = construireReponseHttpReponses({ feedback_immediat: true, reponse_visible: false }, "not_equivalent", solution);
  if (statutSeul.statut !== "not_equivalent" || "solution_attendue" in statutSeul) {
    throw new Error(`feedback_immediat=true,reponse_visible=false : attendu { statut } seul, obtenu ${JSON.stringify(statutSeul)}`);
  }

  const statutEtSolution = construireReponseHttpReponses({ feedback_immediat: true, reponse_visible: true }, "not_equivalent", solution);
  if (statutEtSolution.statut !== "not_equivalent" || statutEtSolution.solution_attendue !== solution) {
    throw new Error(`feedback_immediat=true,reponse_visible=true : attendu { statut, solution_attendue }, obtenu ${JSON.stringify(statutEtSolution)}`);
  }
  console.log("OK: construireReponseHttpReponses (3 combinaisons de réglages de correction)");
}
// --- complétion : exerciceEstComplet / tacheEstComplete ---
{
  const attendus = ["reconnaissance", "isolement", "champ1"];
  if (exerciceEstComplet(attendus, new Set(attendus))) {
    // rien : cas nominal, testé plus bas avec l'assertion positive
  } else {
    throw new Error("exerciceEstComplet : devrait être complet quand tous les champs attendus ont une réponse");
  }
  if (exerciceEstComplet(attendus, new Set(["reconnaissance", "isolement"]))) {
    throw new Error("exerciceEstComplet : ne devrait pas être complet s'il manque un champ (champ1)");
  }
  if (exerciceEstComplet(attendus, new Set())) throw new Error("exerciceEstComplet : ne devrait pas être complet sans aucune réponse");
  if (!exerciceEstComplet([], new Set())) throw new Error("exerciceEstComplet : un exercice sans aucun champ attendu est vacuously complet");

  if (!tacheEstComplete([true, true, true])) throw new Error("tacheEstComplete : devrait être vraie si tous les exercices sont complets");
  if (tacheEstComplete([true, false, true])) throw new Error("tacheEstComplete : devrait être fausse si un seul exercice est incomplet");
  if (tacheEstComplete([])) throw new Error("tacheEstComplete : une tâche sans aucun exercice ne devrait jamais être complète");
  console.log("OK: exerciceEstComplet/tacheEstComplete (partiel, complet, cas vides)");
}

// --- classification en 3 catégories (Étape 3) ---
{
  const maintenant = new Date("2026-06-15T12:00:00Z");
  const avantHier = new Date("2026-06-13T12:00:00Z").toISOString();
  const hier = new Date("2026-06-14T12:00:00Z").toISOString();
  const demain = new Date("2026-06-16T12:00:00Z").toISOString();
  const maintenantPile = maintenant.toISOString();

  // `dateDebut` = avantHier (déjà commencée) pour tous les cas déjà existants — comportement
  // inchangé, seule la signature de classifierTache a gagné ce 1er paramètre (prompt "Date de
  // début de tâche", 2/3, Étape 3/4).
  if (classifierTache(avantHier, demain, false, maintenant) !== "en_cours") throw new Error("échéance future + incomplet -> en_cours attendu");
  if (classifierTache(avantHier, demain, true, maintenant) !== "effectuees") throw new Error("échéance future + complet -> effectuees attendu");
  if (classifierTache(avantHier, hier, false, maintenant) !== "anterieures") throw new Error("échéance passée + incomplet -> anterieures attendu (quel que soit le taux de complétion)");
  if (classifierTache(avantHier, hier, true, maintenant) !== "anterieures") throw new Error("échéance passée + complet -> anterieures attendu");
  if (classifierTache(avantHier, maintenantPile, false, maintenant) !== "anterieures") throw new Error("échéance atteinte pile à l'instant -> anterieures attendu (\"non atteinte\" exclut l'égalité)");
  if (classifierTache(avantHier, null, false, maintenant) !== "en_cours") throw new Error("pas d'échéance + incomplet -> en_cours attendu (jamais en retard sans échéance)");
  if (classifierTache(avantHier, null, true, maintenant) !== "effectuees") throw new Error("pas d'échéance + complet -> effectuees attendu");
  console.log("OK: classifierTache (les 3 catégories, échéance null, égalité pile à l'échéance)");

  // --- date_debut future (prompt "Date de début de tâche", 2/3, Étape 3/4) ---
  if (classifierTache(demain, null, false, maintenant) !== "pas_commencee") throw new Error("date_debut future -> pas_commencee attendu, quelle que soit l'échéance/complétion");
  if (classifierTache(demain, hier, true, maintenant) !== "pas_commencee") throw new Error("date_debut future -> pas_commencee attendu MÊME avec une échéance déjà dépassée (le début prime, Étape 3/4)");
  if (classifierTache(maintenantPile, null, false, maintenant) !== "en_cours") throw new Error("date_debut atteinte pile à l'instant -> en_cours attendu (\"pas encore atteinte\" exclut l'égalité, même convention que l'échéance)");
  console.log("OK: classifierTache (date_debut future -> pas_commencee, prioritaire sur l'échéance ; égalité pile à l'instant -> déjà commencée)");
}
// --- construireChampVue : gating réel avant échéance, révélation forcée après (Étape 3) ---
{
  const reglagesCaches: import("../lib/reglagesCorrection").ReglagesCorrection = { feedback_immediat: false, reponse_visible: false };
  const reglagesVisibles: import("../lib/reglagesCorrection").ReglagesCorrection = { feedback_immediat: true, reponse_visible: true };
  const solutionTexte = "cas_general";

  // Jamais répondu, réglages réels (en_cours/effectuees), revelerSansReponse=false -> rien, même
  // si reponse_visible=true sur la tâche : c'est PRÉCISÉMENT le bug trouvé en écrivant ce test
  // (voir lib/tableauDeBord.ts) — une première version dérivait ce cas de reglagesEffectifs elle-
  // même, révélant la correction d'un champ jamais tenté dès qu'une tâche EN COURS avait
  // reponse_visible=true.
  const etatNonTerminee = { tentativesUtilisees: 0, terminee: false, reussie: false, revelee: false, score: null };
  const vueNonRepondueEnCours = construireChampVue("reconnaissance", null, solutionTexte, reglagesVisibles, false, etatNonTerminee);
  if (vueNonRepondueEnCours.valeur_saisie !== null || vueNonRepondueEnCours.statut !== null || vueNonRepondueEnCours.solution_attendue !== null) {
    throw new Error(`construireChampVue : champ jamais répondu en_cours/effectuees ne devrait rien montrer, obtenu ${JSON.stringify(vueNonRepondueEnCours)}`);
  }

  // Jamais répondu, revelerSansReponse=true (antérieures) -> la correction est montrée quand même, jamais de statut (rien à corriger)
  const vueNonRepondueAnterieure = construireChampVue("reconnaissance", null, solutionTexte, REGLAGES_FORCEES_ANTERIEURES, true, etatNonTerminee);
  if (vueNonRepondueAnterieure.solution_attendue !== solutionTexte) {
    throw new Error(`construireChampVue : champ jamais répondu en antérieures doit quand même montrer la correction, obtenu ${JSON.stringify(vueNonRepondueAnterieure)}`);
  }
  if (vueNonRepondueAnterieure.statut !== null) throw new Error("construireChampVue : pas de statut pour un champ jamais répondu, même en antérieures");

  // Répondu, feedback_immediat=false -> statut/correction cachés (mêmes règles qu'en direct), mais
  // valeur_saisie (ce que l'élève a tapé) reste montrée : ce n'est pas une information nouvelle
  // pour lui, contrairement au verdict — voir le commentaire de construireChampVue.
  const reponse = { valeur_saisie: "cas_general", statut: "correct" as const };
  const etatReussie = { tentativesUtilisees: 0, terminee: true, reussie: true, revelee: false, score: 100 };
  const vueCachee = construireChampVue("reconnaissance", reponse, solutionTexte, reglagesCaches, false, etatReussie);
  if (vueCachee.valeur_saisie !== "cas_general") throw new Error(`construireChampVue : valeur_saisie devrait rester visible même si feedback_immediat=false, obtenu ${JSON.stringify(vueCachee)}`);
  if (vueCachee.statut !== null || vueCachee.solution_attendue !== null) {
    throw new Error(`construireChampVue : feedback_immediat=false ne devrait montrer ni statut ni correction, obtenu ${JSON.stringify(vueCachee)}`);
  }

  // Répondu, réglages forcés "antérieures" -> statut ET correction toujours montrés, quels que soient les réglages réels de la tâche
  const vueAnterieure = construireChampVue("reconnaissance", reponse, solutionTexte, REGLAGES_FORCEES_ANTERIEURES, true, etatReussie);
  if (vueAnterieure.valeur_saisie !== "cas_general" || vueAnterieure.statut !== "correct" || vueAnterieure.solution_attendue !== solutionTexte) {
    throw new Error(`construireChampVue : antérieures doit toujours tout montrer, obtenu ${JSON.stringify(vueAnterieure)}`);
  }
  console.log("OK: construireChampVue (jamais répondu/répondu × réglages réels/forcés-antérieures, révélation forcée après échéance)");

  // Bug trouvé après livraison du prompt "Tentatives, aide, récapitulatif" (3/3), signalé par
  // l'utilisateur (URGENT) : `reponse_visible=true` révélait `solution_attendue` dès le 1er échec en
  // COURS, alors que des tentatives restaient disponibles — l'ancienne logique de révélation
  // tournait sans savoir que le nouveau mécanisme de tentatives existait. `reponse_visible` ne doit
  // avoir d'effet que sur une réponse CORRECTE, ou une fois le champ réellement révélé/en antérieures.
  const reponseIncorrecte = { valeur_saisie: "faux", statut: "not_equivalent" as const };
  const etatEnCoursNonTerminee = { tentativesUtilisees: 1, terminee: false, reussie: false, revelee: false, score: null };
  const vueIncorrecteEnCours = construireChampVue("champ1", reponseIncorrecte, solutionTexte, reglagesVisibles, false, etatEnCoursNonTerminee);
  if (vueIncorrecteEnCours.statut !== "not_equivalent" || vueIncorrecteEnCours.solution_attendue !== null) {
    throw new Error(`construireChampVue : échec en cours avec tentatives restantes ne doit PAS révéler la solution même si reponse_visible=true, obtenu ${JSON.stringify(vueIncorrecteEnCours)}`);
  }
  // Une fois le champ réellement révélé (tentatives épuisées), la révélation est forcée MÊME si la
  // tâche a reponse_visible=false (mécanisme préexistant, jamais cassé par ce correctif).
  const etatRevelee = { tentativesUtilisees: 3, terminee: true, reussie: false, revelee: true, score: 0 };
  const vueRevelee = construireChampVue("champ1", reponseIncorrecte, solutionTexte, reglagesCaches, false, etatRevelee);
  if (vueRevelee.solution_attendue !== solutionTexte) {
    throw new Error(`construireChampVue : tentatives épuisées -> révélation forcée même avec reponse_visible=false, obtenu ${JSON.stringify(vueRevelee)}`);
  }
  // "Antérieures" (échéance dépassée) reste inchangé : révélation totale même sur un échec avec
  // tentatives restantes (comportement volontairement distinct du cas "en cours" ci-dessus).
  const vueIncorrecteAnterieure = construireChampVue("champ1", reponseIncorrecte, solutionTexte, REGLAGES_FORCEES_ANTERIEURES, true, etatEnCoursNonTerminee);
  if (vueIncorrecteAnterieure.solution_attendue !== solutionTexte) {
    throw new Error(`construireChampVue : antérieures doit toujours tout montrer, y compris tentatives non épuisées, obtenu ${JSON.stringify(vueIncorrecteAnterieure)}`);
  }
  console.log("OK: construireChampVue — reponse_visible n'a d'effet que sur une réponse correcte tant que les tentatives ne sont pas épuisées (bug post-livraison corrigé)");
}
{
  // Prompt "Tableau de bord professeur" (2/5), Étape 3 : les 3 définitions exactement telles que
  // formulées à l'Étape 1, en particulier les 2 cas explicitement cités.
  const maintenant = new Date("2026-06-15T12:00:00Z");
  const passe = "2026-01-01T00:00:00Z";
  const futur = "2026-12-31T00:00:00Z";

  // Cas explicite : échéance passée sur une classe MAIS future sur une autre -> compte comme "en cours".
  const n1 = nombreTachesEnCoursDepuisAssignations(
    [
      { tache_id: "t1", date_echeance: passe },
      { tache_id: "t1", date_echeance: futur },
    ],
    maintenant,
  );
  if (n1 !== 1) throw new Error(`nombreTachesEnCoursDepuisAssignations : tâche avec échéance passée+future doit compter 1 fois "en cours", obtenu ${n1}`);

  // Cas explicite : une tâche jamais assignée (absente de la liste) ne doit pas compter.
  const n2 = nombreTachesEnCoursDepuisAssignations([{ tache_id: "t1", date_echeance: futur }], maintenant);
  if (n2 !== 1) throw new Error(`nombreTachesEnCoursDepuisAssignations : seule t1 assignée doit compter 1 (t2 jamais assignée absente), obtenu ${n2}`);

  // Échéance null -> qualifie comme "en cours" (même convention que classifierTache).
  const n3 = nombreTachesEnCoursDepuisAssignations([{ tache_id: "t1", date_echeance: null }], maintenant);
  if (n3 !== 1) throw new Error(`nombreTachesEnCoursDepuisAssignations : échéance null doit qualifier "en cours", obtenu ${n3}`);

  // Toutes les assignations d'une tâche en retard -> ne compte pas.
  const n4 = nombreTachesEnCoursDepuisAssignations(
    [
      { tache_id: "t1", date_echeance: passe },
      { tache_id: "t2", date_echeance: passe },
    ],
    maintenant,
  );
  if (n4 !== 0) throw new Error(`nombreTachesEnCoursDepuisAssignations : toutes échéances passées -> 0, obtenu ${n4}`);

  // Dédoublonnage : 3 assignations qualifiantes pour la même tâche ne comptent qu'une fois.
  const n5 = nombreTachesEnCoursDepuisAssignations(
    [
      { tache_id: "t1", date_echeance: futur },
      { tache_id: "t1", date_echeance: null },
      { tache_id: "t1", date_echeance: futur },
    ],
    maintenant,
  );
  if (n5 !== 1) throw new Error(`nombreTachesEnCoursDepuisAssignations : 3 assignations qualifiantes de la même tâche -> 1 seule fois, obtenu ${n5}`);

  console.log(
    "OK: nombreTachesEnCoursDepuisAssignations (échéance mixte passée/future -> en cours, tâche jamais assignée absente, échéance null, toutes en retard, dédoublonnage par tâche)",
  );

  // reponsesAvecBug : compte uniquement bug_detecte !== null.
  const b1 = compterBugsDepuisReponses([{ bug_detecte: "C04" }, { bug_detecte: null }, { bug_detecte: "FC_CE_FANTOME" }, { bug_detecte: null }]);
  if (b1 !== 2) throw new Error(`compterBugsDepuisReponses : 2 bug_detecte non nuls attendus, obtenu ${b1}`);
  const b2 = compterBugsDepuisReponses([{ bug_detecte: null }, { bug_detecte: null }]);
  if (b2 !== 0) throw new Error(`compterBugsDepuisReponses : aucun bug_detecte non nul -> 0, obtenu ${b2}`);
  const b3 = compterBugsDepuisReponses([]);
  if (b3 !== 0) throw new Error(`compterBugsDepuisReponses : liste vide -> 0, obtenu ${b3}`);
  console.log("OK: compterBugsDepuisReponses (bug_detecte non nuls comptés, nuls ignorés, liste vide -> 0)");
}

{
  // Prompt "Tableau de bord élève" (3/5), Étape 3 : "calcul repondus/attendus vérifié sur un cas
  // construit à la main (plusieurs exercices, champs partiellement répondus)".
  const r1 = resumeExercice(["reconnaissance", "isolement", "champ1"], new Set(["reconnaissance", "isolement"]));
  if (r1.repondus !== 2 || r1.attendus !== 3) throw new Error(`resumeExercice : 2/3 attendu, obtenu ${JSON.stringify(r1)}`);

  const r2 = resumeExercice(["reconnaissance", "champ1"], new Set());
  if (r2.repondus !== 0 || r2.attendus !== 2) throw new Error(`resumeExercice : 0/2 attendu (rien répondu), obtenu ${JSON.stringify(r2)}`);

  const r3 = resumeExercice(["ce", "simplifierFraction"], new Set(["ce", "simplifierFraction"]));
  if (r3.repondus !== 2 || r3.attendus !== 2) throw new Error(`resumeExercice : 2/2 attendu (tout répondu), obtenu ${JSON.stringify(r3)}`);

  const r4 = resumeExercice([], new Set());
  if (r4.repondus !== 0 || r4.attendus !== 0) throw new Error(`resumeExercice : 0/0 attendu (aucun champ), obtenu ${JSON.stringify(r4)}`);

  // Réponse à un champ hors champs_attendus (ne devrait pas arriver en pratique, mais ne doit
  // jamais gonfler `repondus` au-delà de `attendus`).
  const r5 = resumeExercice(["reconnaissance"], new Set(["reconnaissance", "un_champ_qui_n_existe_pas"]));
  if (r5.repondus !== 1 || r5.attendus !== 1) throw new Error(`resumeExercice : 1/1 attendu (champ hors liste ignoré), obtenu ${JSON.stringify(r5)}`);

  // Plusieurs exercices d'une même tâche (cas explicite : "plusieurs exercices, champs
  // partiellement répondus") -> somme, pas déduplication des noms de champs.
  const tache = resumeTache([r1, r2]);
  if (tache.repondus !== 2 || tache.attendus !== 5) throw new Error(`resumeTache : 2/5 attendu (2+0 répondus, 3+2 attendus), obtenu ${JSON.stringify(tache)}`);

  const tacheVide = resumeTache([]);
  if (tacheVide.repondus !== 0 || tacheVide.attendus !== 0) throw new Error(`resumeTache : 0/0 attendu (aucun exercice), obtenu ${JSON.stringify(tacheVide)}`);

  console.log("OK: resumeExercice/resumeTache (champs partiellement répondus, tout répondu, aucun champ, champ hors liste ignoré, somme sur plusieurs exercices)");
}

{
  // Prompt "Badge de série" (5/5), Étape 4 : "séquence entièrement correcte, une erreur au milieu,
  // une erreur tout au bout (série = 0), une seule réponse au total, aucune réponse au total".
  // Entrées déjà triées par horodatage décroissant (le plus récent en premier), comme le fait la
  // requête `reponses` du tableau de bord élève.

  const s1 = calculerSerieActuelle(["correct", "correct", "correct", "correct"]);
  if (s1 !== 4) throw new Error(`calculerSerieActuelle : séquence entièrement correcte -> 4, obtenu ${s1}`);

  const s2 = calculerSerieActuelle(["correct", "correct", "not_equivalent", "correct", "correct"]);
  if (s2 !== 2) throw new Error(`calculerSerieActuelle : erreur au milieu -> série arrêtée à 2 (les 2 plus récentes), obtenu ${s2}`);

  // "Erreur tout au bout" = la réponse la PLUS RÉCENTE (1er élément du tri décroissant) est en
  // erreur -> casse la série immédiatement, série = 0 (demande exacte du prompt).
  const s3 = calculerSerieActuelle(["parse_error", "correct", "correct"]);
  if (s3 !== 0) throw new Error(`calculerSerieActuelle : erreur la plus récente -> 0, obtenu ${s3}`);

  const s4 = calculerSerieActuelle(["correct"]);
  if (s4 !== 1) throw new Error(`calculerSerieActuelle : une seule réponse correcte -> 1, obtenu ${s4}`);

  const s5 = calculerSerieActuelle(["not_equivalent"]);
  if (s5 !== 0) throw new Error(`calculerSerieActuelle : une seule réponse incorrecte -> 0, obtenu ${s5}`);

  const s6 = calculerSerieActuelle([]);
  if (s6 !== 0) throw new Error(`calculerSerieActuelle : aucune réponse -> 0, obtenu ${s6}`);

  console.log("OK: calculerSerieActuelle (séquence entièrement correcte, erreur au milieu, erreur la plus récente, une seule réponse, aucune réponse)");
}
{
  // Prompt "Profil de compétences élève", Étape 5 : "1 occurrence -> en_observation, 2 ->
  // non_maitrisee, mélange de plusieurs codes différents classés indépendamment, code inconnu du
  // dictionnaire géré sans planter".

  const p1 = calculerProfilCompetences(["C04"]);
  if (p1.length !== 1 || p1[0].statut !== "en_observation" || p1[0].occurrences !== 1) {
    throw new Error(`calculerProfilCompetences : 1 occurrence -> en_observation attendu, obtenu ${JSON.stringify(p1)}`);
  }

  const p2 = calculerProfilCompetences(["C04", "C04"]);
  if (p2.length !== 1 || p2[0].statut !== "non_maitrisee" || p2[0].occurrences !== 2) {
    throw new Error(`calculerProfilCompetences : 2 occurrences -> non_maitrisee attendu, obtenu ${JSON.stringify(p2)}`);
  }

  // Mélange : C04 vu 1 fois (en_observation), FC_CE_FANTOME vu 3 fois (non_maitrisee),
  // RECOPIE_NON_REDUITE vu 2 fois (non_maitrisee) — chaque code classé indépendamment des autres,
  // des réponses sans bug (null) intercalées (ne doivent jamais compter).
  const p3 = calculerProfilCompetences([
    "C04",
    null,
    "FC_CE_FANTOME",
    "RECOPIE_NON_REDUITE",
    null,
    "FC_CE_FANTOME",
    "RECOPIE_NON_REDUITE",
    "FC_CE_FANTOME",
  ]);
  if (p3.length !== 3) throw new Error(`calculerProfilCompetences : 3 codes distincts attendus, obtenu ${JSON.stringify(p3)}`);
  const parCode = Object.fromEntries(p3.map((c) => [c.code, c]));
  if (parCode.C04.statut !== "en_observation" || parCode.C04.occurrences !== 1) throw new Error(`calculerProfilCompetences : C04 -> en_observation/1 attendu, obtenu ${JSON.stringify(parCode.C04)}`);
  if (parCode.FC_CE_FANTOME.statut !== "non_maitrisee" || parCode.FC_CE_FANTOME.occurrences !== 3) throw new Error(`calculerProfilCompetences : FC_CE_FANTOME -> non_maitrisee/3 attendu, obtenu ${JSON.stringify(parCode.FC_CE_FANTOME)}`);
  if (parCode.RECOPIE_NON_REDUITE.statut !== "non_maitrisee" || parCode.RECOPIE_NON_REDUITE.occurrences !== 2) throw new Error(`calculerProfilCompetences : RECOPIE_NON_REDUITE -> non_maitrisee/2 attendu, obtenu ${JSON.stringify(parCode.RECOPIE_NON_REDUITE)}`);
  // Triée non_maitrisee en premier (Étape 3) : les 2 premiers de la liste doivent être les 2
  // non_maitrisee, jamais l'en_observation en tête.
  if (p3[0].statut !== "non_maitrisee" || p3[1].statut !== "non_maitrisee" || p3[2].statut !== "en_observation") {
    throw new Error(`calculerProfilCompetences : ordre non_maitrisee-en-premier non respecté, obtenu ${JSON.stringify(p3.map((c) => c.statut))}`);
  }

  // Code totalement inconnu du dictionnaire (ex. dictionnaire pas encore mis à jour pour un futur
  // détecteur) : géré sans planter, inclus avec son code brut comme libellé de repli.
  const p4 = calculerProfilCompetences(["CODE_INCONNU_JAMAIS_VU", "CODE_INCONNU_JAMAIS_VU"]);
  if (p4.length !== 1 || p4[0].libelle !== "CODE_INCONNU_JAMAIS_VU" || p4[0].description !== "" || p4[0].statut !== "non_maitrisee") {
    throw new Error(`calculerProfilCompetences : code inconnu mal géré, obtenu ${JSON.stringify(p4)}`);
  }

  console.log("OK: calculerProfilCompetences (1 occurrence -> en_observation, 2 -> non_maitrisee, plusieurs codes classés indépendamment, code inconnu du dictionnaire géré sans planter)");

  // Prompt "Détecteurs C05/C06 (Diagnostic, 3/3)", Étape 4 : confirme — en réutilisant
  // calculerProfilCompetences/DICTIONNAIRE_COMPETENCES tels quels, sans dupliquer l'endpoint
  // GET /api/profs/eleves/:id/profil (déjà générique sur `bug_detecte`, testé par
  // scripts/test-profil-competences.ts) — que ces 2 nouveaux codes résolvent bien un libellé réel
  // du dictionnaire une fois rencontrés, pas seulement le comptage générique déjà vérifié ci-dessus.
  // Retour utilisateur ("je peux enlever FC_RACINE_FANTOME, FORME_CANONIQUE_SIGNE_P,
  // C05_SIGNE_REPETE ... aucun intérêt à être divulgué") : C05_SIGNE_REPETE est désormais masqué
  // au niveau de `separerBugsDetectes` (lib/profilCompetences.ts, CODES_MASQUES_PROF), donc appelé
  // ici pour prouver son ABSENCE totale du profil malgré une occurrence réelle — C06_SIGNE_OPPOSE,
  // lui, n'est pas masqué et reste vérifié comme avant (libellé/description réels).
  const p5 = calculerProfilCompetences(["C05_SIGNE_REPETE", "C06_SIGNE_OPPOSE", "C06_SIGNE_OPPOSE"]);
  const parCode5 = Object.fromEntries(p5.map((c) => [c.code, c]));
  if (parCode5.C05_SIGNE_REPETE !== undefined) {
    throw new Error(`calculerProfilCompetences : C05_SIGNE_REPETE attendu ABSENT (code masqué), obtenu ${JSON.stringify(parCode5.C05_SIGNE_REPETE)}`);
  }
  if (!parCode5.C06_SIGNE_OPPOSE || parCode5.C06_SIGNE_OPPOSE.statut !== "non_maitrisee" || parCode5.C06_SIGNE_OPPOSE.occurrences !== 2 || parCode5.C06_SIGNE_OPPOSE.description === "") {
    throw new Error(`calculerProfilCompetences : C06_SIGNE_OPPOSE -> non_maitrisee/2 occurrences + description réelle attendus, obtenu ${JSON.stringify(parCode5.C06_SIGNE_OPPOSE)}`);
  }
  console.log("OK: profil de compétences masque C05_SIGNE_REPETE (retour utilisateur) et résout C06_SIGNE_OPPOSE avec un libellé/description réels");
}

// --- Prompt "Tentatives, aide, récapitulatif" (3/3) : moteur de tentatives/score ---
{
  if (tentativesMaxDepuisReglages(0) !== 1) throw new Error("tentativesMaxDepuisReglages(0) devrait valoir 1 (0 = pas de seconde chance)");
  if (tentativesMaxDepuisReglages(2) !== 3) throw new Error("tentativesMaxDepuisReglages(2) devrait valoir 3");

  // 0 tentative supplémentaire (tentativesMax=1) : le premier échec verrouille immédiatement.
  const echecImmediat = calculerEtatChampTentatives(["not_equivalent"], 1, false, 0);
  if (!echecImmediat.terminee || !echecImmediat.revelee || echecImmediat.reussie || echecImmediat.score !== 0) {
    throw new Error(`calculerEtatChampTentatives : tentativesMax=1, 1er échec -> révélé immédiatement, score 0, obtenu ${JSON.stringify(echecImmediat)}`);
  }
  const reussiteDuPremierCoup = calculerEtatChampTentatives(["correct"], 1, false, 0);
  if (!reussiteDuPremierCoup.terminee || !reussiteDuPremierCoup.reussie || reussiteDuPremierCoup.score !== 100) {
    throw new Error(`calculerEtatChampTentatives : tentativesMax=1, correct du premier coup -> score 100, obtenu ${JSON.stringify(reussiteDuPremierCoup)}`);
  }

  // tentativesMax=4 (3 tentatives supplémentaires) : pénalité par tentative ratée = 100/4 = 25.
  const pasEncoreTerminee = calculerEtatChampTentatives(["not_equivalent", "parse_error"], 4, false, 0);
  if (pasEncoreTerminee.terminee || pasEncoreTerminee.score !== null) {
    throw new Error(`calculerEtatChampTentatives : 2 échecs sur 4 tentatives -> pas encore terminé, score null, obtenu ${JSON.stringify(pasEncoreTerminee)}`);
  }
  const reussiteApres2Echecs = calculerEtatChampTentatives(["not_equivalent", "parse_error", "correct"], 4, false, 0);
  if (!reussiteApres2Echecs.reussie || reussiteApres2Echecs.tentativesUtilisees !== 2 || reussiteApres2Echecs.score !== 50) {
    throw new Error(`calculerEtatChampTentatives : correct après 2 échecs sur 4 -> score 100-2*25=50, obtenu ${JSON.stringify(reussiteApres2Echecs)}`);
  }
  const revelationApres4Echecs = calculerEtatChampTentatives(["not_equivalent", "not_equivalent", "parse_error", "not_equivalent"], 4, false, 0);
  if (!revelationApres4Echecs.revelee || revelationApres4Echecs.reussie || revelationApres4Echecs.score !== 0 || revelationApres4Echecs.tentativesUtilisees !== 4) {
    throw new Error(`calculerEtatChampTentatives : 4 échecs sur tentativesMax=4 -> révélé, score 0, obtenu ${JSON.stringify(revelationApres4Echecs)}`);
  }

  // Pénalité d'aide : appliquée en plus de la pénalité de tentatives, jamais à la place.
  const aideSansEchec = calculerEtatChampTentatives(["correct"], 4, true, 20);
  if (aideSansEchec.score !== 80) throw new Error(`calculerEtatChampTentatives : aide 20% sans échec préalable -> score 100*0.8=80, obtenu ${aideSansEchec.score}`);
  const aideApres1Echec = calculerEtatChampTentatives(["not_equivalent", "correct"], 4, true, 20);
  if (aideApres1Echec.score !== 60) throw new Error(`calculerEtatChampTentatives : 1 échec (score 75) × aide 20% -> 75*0.8=60, obtenu ${aideApres1Echec.score}`);
  const revelationJamaisReduiteParAide = calculerEtatChampTentatives(["not_equivalent"], 1, true, 50);
  if (revelationJamaisReduiteParAide.score !== 0) throw new Error("calculerEtatChampTentatives : une révélation reste à score 0 même avec aide utilisée");

  console.log("OK: calculerEtatChampTentatives (tentativesMax=1 verrouille au 1er échec, pénalité par tentative ratée, révélation à tentativesMax échecs, pénalité d'aide cumulée jamais substituée)");
}

// --- statutRecap/libelleStatutRecap (Étape 4) ---
{
  if (statutRecap(true, false, false) !== "rouge") throw new Error("statutRecap : révélé -> rouge, quel que soit le reste");
  if (statutRecap(true, true, true) !== "rouge") throw new Error("statutRecap : révélé -> rouge même si aide utilisée et 'correcte' (ne devrait pas arriver ensemble, mais rouge prime)");
  if (statutRecap(false, true, true) !== "orange") throw new Error("statutRecap : aide utilisée + correcte -> orange");
  if (statutRecap(false, true, false) !== "verte") throw new Error("statutRecap : aide utilisée mais PAS correcte -> verte (la consigne exige les 2 conditions)");
  if (statutRecap(false, false, true) !== "verte") throw new Error("statutRecap : correcte sans aide -> verte");
  if (libelleStatutRecap("rouge") !== "Réponse révélée") throw new Error("libelleStatutRecap('rouge') incorrect");
  if (libelleStatutRecap("orange") !== "Correct (aide utilisée)") throw new Error("libelleStatutRecap('orange') incorrect");
  if (libelleStatutRecap("verte") !== "Correct") throw new Error("libelleStatutRecap('verte') incorrect");
  console.log("OK: statutRecap/libelleStatutRecap (3 statuts, révélé prioritaire, aide+correcte seule combinaison orange)");

  const ligneReussieAvecAide = construireLigneRecap("champ1", { tentativesUtilisees: 0, terminee: true, reussie: true, revelee: false, score: 80 }, true);
  if (ligneReussieAvecAide.statut_recap !== "orange" || ligneReussieAvecAide.score !== 80 || ligneReussieAvecAide.champ !== "champ1") {
    throw new Error(`construireLigneRecap : réussie+aide -> orange, score conservé, obtenu ${JSON.stringify(ligneReussieAvecAide)}`);
  }
  const ligneRevelee = construireLigneRecap("champ1", { tentativesUtilisees: 3, terminee: true, reussie: false, revelee: true, score: 0 }, false);
  if (ligneRevelee.statut_recap !== "rouge" || ligneRevelee.score !== 0) {
    throw new Error(`construireLigneRecap : révélée -> rouge, score 0, obtenu ${JSON.stringify(ligneRevelee)}`);
  }
  console.log("OK: construireLigneRecap (statut + libellé + score assemblés depuis l'état de tentatives)");
}

console.log("TOUS LES TESTS DE FUMEE PASSENT");
