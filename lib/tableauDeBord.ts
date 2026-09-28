import type { StatutVerification } from "../src/moteur/statutVerification";
import { construireReponseHttpReponses, type ReglagesCorrection } from "./reglagesCorrection";
import type { EtatChampTentatives } from "./moteurTentatives";

export type CategorieTableauDeBord = "en_cours" | "effectuees" | "anterieures";

/**
 * Prompt "Date de début de tâche" (2/3), Étape 3 : "pas une nouvelle catégorie visible, une
 * absence complète" — `"pas_commencee"` n'est donc PAS ajoutée à `CategorieTableauDeBord` (les 3
 * catégories réellement affichées, inchangées) mais à ce type élargi, uniquement pour que
 * `classifierTache` puisse le signaler à ses 2 appelants (le tableau de bord élève, qui doit alors
 * omettre entièrement la tâche des 3 listes ; `categorieTachePourEleve`, qui doit alors refuser la
 * soumission — voir lib/verrouillageTache.ts) sans qu'aucun des deux n'ait à redériver la
 * comparaison de dates lui-même.
 */
export type CategorieOuNonCommencee = CategorieTableauDeBord | "pas_commencee";

export interface DerniereReponse {
  valeur_saisie: string;
  statut: StatutVerification;
}

export interface ChampVue {
  champ: string;
  valeur_saisie: string | null;
  statut: StatutVerification | null;
  solution_attendue: string | null;
  /**
   * Prompt "Tentatives, aide, récapitulatif" (3/3), Étape 2/3 : vrai si `tentativesMax` tentatives
   * ont été ratées sans succès sur ce champ — le champ est alors verrouillé côté client (même
   * mécanisme que `statut === "correct"`, jamais une 2e logique de verrouillage). Ce booléen seul
   * ne révèle rien de plus que ce que la réponse HTTP en direct a déjà révélé au moment de
   * l'épuisement (lib/routes/reponses.ts force alors `statut`/`solution_attendue`) — jamais gated
   * par `reglagesEffectifs` : un client a besoin de savoir qu'un champ est verrouillé quels que
   * soient feedback_immediat/reponse_visible, pour décider d'afficher "Question suivante" plutôt
   * que de rester bloqué sur un champ qui ne pourra jamais devenir correct.
   */
  revele: boolean;
}

/**
 * Réglages forcés pour la catégorie "antérieures" (prompt "Tableau de bord élève", Étape 3) :
 * "ces deux réglages [feedback_immediat/reponse_visible] ne s'appliquent qu'avant l'échéance,
 * jamais après (décision déjà actée, pas à revisiter)" — donc toujours révélé après l'échéance,
 * indépendamment des réglages réels stockés sur la tâche.
 */
export const REGLAGES_FORCEES_ANTERIEURES: ReglagesCorrection = { feedback_immediat: true, reponse_visible: true };

/** Un exercice est complet si TOUS ses champs_attendus ont reçu au moins une soumission — peu importe si correcte (Étape 3). */
export function exerciceEstComplet(champsAttendus: string[], champsRepondus: Set<string>): boolean {
  return champsAttendus.every((champ) => champsRepondus.has(champ));
}

/** Une tâche assignée est complète si tous ses exercices (pour cet élève) le sont (Étape 3). Une tâche sans aucun exercice n'est jamais complète (cas dégénéré, ne devrait pas survenir en pratique). */
export function tacheEstComplete(exercicesComplets: boolean[]): boolean {
  return exercicesComplets.length > 0 && exercicesComplets.every(Boolean);
}

export interface ResumeProgression {
  repondus: number;
  attendus: number;
}

/**
 * Prompt "Tableau de bord élève" (3/5), Étape 1 — résumé agrégé pour l'anneau de progression :
 * `attendus` = `champsAttendus.length`, `repondus` = nombre de ces champs présents dans
 * `champsRepondus`. Même paire d'entrées que `exerciceEstComplet` ci-dessus (même prédicat
 * `champsRepondus.has(champ)`, juste compté plutôt que réduit en booléen par `.every()`) —
 * réutilise la même donnée, pas une 2e logique de complétion parallèle.
 */
export function resumeExercice(champsAttendus: string[], champsRepondus: Set<string>): ResumeProgression {
  return { repondus: champsAttendus.filter((champ) => champsRepondus.has(champ)).length, attendus: champsAttendus.length };
}

/** Résumé d'une tâche = somme des résumés de ses exercices (Étape 1 : "somme des tailles de champs_attendus sur tous les exercices"). */
export function resumeTache(resumesExercices: ResumeProgression[]): ResumeProgression {
  return resumesExercices.reduce((acc, r) => ({ repondus: acc.repondus + r.repondus, attendus: acc.attendus + r.attendus }), { repondus: 0, attendus: 0 });
}

/**
 * Prompt "Badge de série" (5/5), Étape 1 — nombre de bonnes réponses consécutives les plus
 * récentes, toutes tâches et tous exercices confondus. `statutsTriesDecroissants` doit déjà être
 * trié par `horodatage` décroissant (le plus récent en premier, comme le fait déjà la requête
 * `reponses` du tableau de bord élève pour `derniereReponseParCle`) — chaque élément représente une
 * soumission individuelle, jamais dédupliquée par champ : une tentative ratée puis corrigée sur le
 * même champ compte comme 2 entrées distinctes dans la séquence, et la tentative ratée casse la
 * série à ce moment précis même si l'élève corrige juste après (demande exacte de l'énoncé).
 */
export function calculerSerieActuelle(statutsTriesDecroissants: StatutVerification[]): number {
  let serie = 0;
  for (const statut of statutsTriesDecroissants) {
    if (statut !== "correct") break;
    serie++;
  }
  return serie;
}

/**
 * Classification à chaque appel, jamais stockée (Étape 3 : "Reclassification automatique par
 * comparaison de dates à chaque appel — aucun état de catégorie stocké nulle part").
 * `dateEcheance === null` : assignation sans échéance (créée avant ce correctif — voir
 * supabase/schema.sql, colonne nullable) — jamais "antérieures", rien ne permet de dire qu'elle
 * est en retard ; classée en_cours/effectuees selon sa complétion, comme si l'échéance n'était
 * jamais atteinte.
 *
 * Prompt "Date de début de tâche" (2/3), Étape 3/4 : `dateDebut` vérifiée EN PREMIER, avant même
 * l'échéance — une tâche dont le début n'est pas encore atteint n'a pas de sens à classer parmi les
 * 3 catégories existantes (elle n'a normalement pas non plus d'échéance déjà dépassée, mais même si
 * c'était le cas par une donnée incohérente, "pas encore commencée" doit primer : rien à montrer ni
 * à soumettre tant que la tâche n'a pas débuté). `dateDebut` n'est, contrairement à `dateEcheance`,
 * jamais `null` (colonne `not null default now()`, voir supabase/schema.sql) — toujours comparable.
 */
export function classifierTache(dateDebut: string, dateEcheance: string | null, complete: boolean, maintenant: Date): CategorieOuNonCommencee {
  if (new Date(dateDebut).getTime() > maintenant.getTime()) return "pas_commencee";
  if (dateEcheance !== null && new Date(dateEcheance).getTime() <= maintenant.getTime()) return "anterieures";
  return complete ? "effectuees" : "en_cours";
}

/**
 * Vue d'un champ prête à l'affichage (Étape 3/4). `valeur_saisie` (ce que l'élève a tapé) est
 * toujours montrée si une réponse existe — pas une information nouvelle pour lui, contrairement à
 * `statut`/`solution_attendue`, qui restent gated par `reglagesEffectifs` (les réglages RÉELS de
 * la tâche pour en_cours/effectuees ; `REGLAGES_FORCEES_ANTERIEURES` pour antérieures — voir
 * ci-dessus). Réutilise `construireReponseHttpReponses` (lib/reglagesCorrection.ts) telle quelle :
 * même règle de gating qu'en soumission live, jamais redéfinie ici.
 *
 * Champ jamais répondu (`derniereReponse === null`) : `revelerSansReponse` — un booléen EXPLICITE,
 * PAS déduit de `reglagesEffectifs` — décide seul si la correction est montrée quand même. Bug
 * trouvé en écrivant le test de fumée de cette fonction : dériver ce cas de
 * `reglagesEffectifs.feedback_immediat && reglagesEffectifs.reponse_visible` révélait la correction
 * d'un champ jamais tenté dès qu'une tâche EN COURS avait `reponse_visible=true` — donnant la
 * réponse avant même que l'élève ait essayé, ce que rien dans le prompt ne demande (Étape 3 ne
 * force la révélation "même sans réponse" qu'en antérieures). L'appelant passe
 * `categorie === "anterieures"` explicitement plutôt que de laisser cette fonction le déduire.
 */
/**
 * `etatTentatives` (Étape 2/3 du prompt "Tentatives, aide, récapitulatif") : déjà calculé par
 * l'appelant (`calculerEtatChampTentatives`, lib/moteurTentatives.ts) à partir de l'historique
 * complet des soumissions de ce champ — cette fonction ne fait que consommer `etatTentatives.revelee`
 * pour décider du verrouillage/de la révélation forcée, jamais un 2e calcul de l'historique ici.
 */
export function construireChampVue(
  champ: string,
  derniereReponse: DerniereReponse | null,
  solutionAttendueTexte: string,
  reglagesEffectifs: ReglagesCorrection,
  revelerSansReponse: boolean,
  etatTentatives: EtatChampTentatives,
): ChampVue {
  if (!derniereReponse) {
    // Phase 2 : un champ RÉVÉLÉ sans aucune réponse (chrono écoulé avant toute soumission,
    // `calculerEtatChampTentatives(…, chronoExpire=true)`) est verrouillé exactement comme un champ aux
    // tentatives épuisées : la correction doit être montrée, sans quoi l'élève resterait bloqué sur un
    // écran fermé sans savoir pourquoi ni voir la réponse.
    return {
      champ,
      valeur_saisie: null,
      statut: null,
      solution_attendue: revelerSansReponse || etatTentatives.revelee ? solutionAttendueTexte : null,
      revele: etatTentatives.revelee,
    };
  }
  // Champ révélé (tentatives épuisées, Étape 2) OU tâche antérieure (`revelerSansReponse`, réglages
  // déjà forcés en amont par l'appelant via REGLAGES_FORCEES_ANTERIEURES) : pleine révélation quels
  // que soient les réglages réels de la tâche — même raisonnement que la réponse HTTP déjà forcée en
  // direct au moment de l'épuisement (lib/routes/reponses.ts) : le champ est verrouillé, l'élève ne
  // peut plus recommencer, il doit voir la correction.
  //
  // Bug trouvé après livraison (signalé par l'utilisateur, URGENT), même cause que
  // lib/routes/reponses.ts : hors de ces 2 cas (tâche EN COURS, champ pas encore révélé),
  // `reglagesEffectifs.reponse_visible` ne doit avoir d'effet que sur une réponse CORRECTE — jamais
  // sur un échec intermédiaire alors que des tentatives restent disponibles, sans quoi
  // `reponse_visible` révélait la solution dès le 1er échec et rendait les tentatives sans objet.
  const reglagesReels: ReglagesCorrection =
    etatTentatives.revelee || revelerSansReponse
      ? { feedback_immediat: true, reponse_visible: true }
      : { feedback_immediat: reglagesEffectifs.feedback_immediat, reponse_visible: reglagesEffectifs.reponse_visible && derniereReponse.statut === "correct" };
  const vue = construireReponseHttpReponses(reglagesReels, derniereReponse.statut, solutionAttendueTexte);
  return {
    champ,
    valeur_saisie: derniereReponse.valeur_saisie,
    statut: vue.statut ?? null,
    solution_attendue: vue.solution_attendue ?? null,
    revele: etatTentatives.revelee,
  };
}
