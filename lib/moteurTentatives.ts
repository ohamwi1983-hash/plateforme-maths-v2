import type { StatutVerification } from "../src/moteur/statutVerification";

/**
 * Prompt "Tentatives, aide, récapitulatif" (3/3), Étape 2 — port de `soumettreEtapeTentatives`
 * (`src/moteur/etapeTentatives.ts`, `plateforme-maths`) en fonction pure JS classique (ce pilote
 * n'utilise pas React, pas d'état interne à faire évoluer pas à pas) : au lieu de maintenir un
 * `EtatEtapeTentatives` mis à jour à chaque soumission, cette fonction recalcule l'état COMPLET
 * d'un champ à la volée à partir de l'historique chronologique de ses soumissions déjà en base
 * (`reponses`, filtré par `exercice_assigne_id`+`champ`) — "pas de nouvel état à stocker en base"
 * (Étape 2). Un seul écart assumé, déjà acté avant ce prompt : la pénalité d'aide est un
 * pourcentage configurable par le prof (`aidePenalitePourcent`), là où la référence n'a que des
 * constantes fixes par générateur.
 */

export interface EtatChampTentatives {
  /** Tentatives ratées avant le succès (ou avant la révélation) — jamais compté au-delà de `tentativesMax`. */
  tentativesUtilisees: number;
  /** Vrai dès que ce champ a atteint un état final (réussi ou révélé) — sinon une nouvelle tentative reste possible. */
  terminee: boolean;
  reussie: boolean;
  /** Vrai si `tentativesMax` tentatives ont été ratées sans succès — la réponse doit alors être révélée, le champ verrouillé. */
  revelee: boolean;
  /** `null` tant que `terminee` est faux — un champ non terminé n'a pas encore de note. */
  score: number | null;
}

/** Étape 1 : "tentativesMax = tentatives_supplementaires + 1" — "0 = pas de seconde chance" sans jamais diviser par zéro (tentativesMax >= 1 toujours, le moteur l'utilise comme diviseur ci-dessous). */
export function tentativesMaxDepuisReglages(tentativesSupplementaires: number): number {
  return tentativesSupplementaires + 1;
}

/**
 * Correctif "Chrono de réponse" — un seul mode actif par tâche, jamais superposés.
 * `par_ecran` : la limite s'applique au champ courant seul (toutes tentatives cumulées).
 * `global` : la limite s'applique au temps écoulé depuis le PREMIER écran affiché de l'exercice_assigne.
 */
export type ChronoMode = "aucun" | "par_ecran" | "global";

/** Une ligne `debuts_ecran` (voir supabase/schema.sql) — horodatage de départ écrit une seule fois par (exercice_assigne_id, champ). */
export interface LigneDebutEcran {
  champ: string;
  horodatage_debut: string;
}

/**
 * Révision "horodatage de départ côté serveur" (`RAPPORT.md`, révision du §164) : le timestamp de
 * référence pour dériver l'expiration/le temps restant, jamais une durée envoyée par le client.
 * `par_ecran` : le début du champ précis (`null` si jamais enregistré — signal `debut-ecran` jamais
 * reçu pour CE champ). `global` : le plus ancien début parmi TOUS les champs déjà enregistrés pour
 * cet exercice_assigne (`null` si aucun champ n'a encore de ligne). `aucun` : toujours `null`.
 */
export function horodatageDebutPertinent(mode: ChronoMode, champ: string, lignes: readonly LigneDebutEcran[]): Date | null {
  if (mode === "par_ecran") {
    const ligne = lignes.find((l) => l.champ === champ);
    return ligne ? new Date(ligne.horodatage_debut) : null;
  }
  if (mode === "global") {
    if (lignes.length === 0) return null;
    return new Date(Math.min(...lignes.map((l) => new Date(l.horodatage_debut).getTime())));
  }
  return null;
}

/**
 * Dérivation SERVEUR de l'expiration du chrono, désormais depuis le temps RÉEL écoulé
 * (`maintenant - debut`) — plus aucune valeur transmise par le client n'intervient (voir
 * RAPPORT.md, révision "horodatage de départ côté serveur" : la mesure côté client, falsifiable via
 * la console développeur, est entièrement retirée du calcul). Recalculée identiquement à chaque
 * appel de `calculerEtatChampTentatives` (soumission ET `GET /api/eleves/tableau-de-bord`), jamais
 * mise en cache. **`debut === null`** (signal `debut-ecran` jamais reçu, coupure réseau ou blocage
 * délibéré) → `false` systématiquement, décision explicite : ne jamais pénaliser un élève sur
 * l'absence de ce signal (limitation résiduelle documentée dans RAPPORT.md — le signal lui-même
 * reste falsifiable en théorie, mais bien plus difficile qu'éditer une variable locale).
 */
export function calculerChronoExpire(mode: ChronoMode, dureeSecondes: number | null, debut: Date | null, maintenant: Date): boolean {
  if (mode === "aucun" || dureeSecondes === null || debut === null) return false;
  return (maintenant.getTime() - debut.getTime()) / 1000 >= dureeSecondes;
}

/** Secondes restantes avant expiration, bornées à 0 minimum — pour `POST /api/reponses/debut-ecran` (affichage du compte à rebours). */
export function calculerSecondesRestantes(dureeSecondes: number, debut: Date, maintenant: Date): number {
  return Math.max(0, Math.round(dureeSecondes - (maintenant.getTime() - debut.getTime()) / 1000));
}

/** Durée écoulée depuis le début d'écran, mesurée CÔTÉ SERVEUR (pour `reponses.duree_ecoulee_secondes`,
 * mesure passive systématique, jamais transmise par le client) — `null` si aucune ligne `debuts_ecran`
 * pour ce champ précis au moment de la soumission (signal jamais reçu, jamais une exception pour autant). */
export function calculerDureeEcouleeSecondes(debut: Date | null, maintenant: Date): number | null {
  return debut === null ? null : Math.max(0, Math.round((maintenant.getTime() - debut.getTime()) / 1000));
}

/**
 * `statutsChronologiques` : TOUS les statuts déjà soumis pour un (exercice_assigne_id, champ)
 * donné, triés du plus ancien au plus récent (inclut la soumission en cours d'évaluation, déjà
 * insérée en base au moment de l'appel — voir lib/routes/reponses.ts). `aideUtilisee` : vrai si
 * `indice_utilise` est vrai sur AU MOINS UNE des lignes de cet historique (peu importe laquelle —
 * l'aide pénalise le champ entier, pas une tentative précise).
 *
 * Formule (Étape 2, verbatim) :
 *   score_si_correct = max(0, 100 - tentatives_ratées_avant × (100 / tentativesMax))
 *   score_final = aide_utilisée_sur_ce_champ ? score_si_correct × (1 - aide_penalite_pourcent/100) : score_si_correct
 * Un statut différent de "correct" ("not_equivalent" ET "parse_error" comptent tous deux comme une
 * tentative ratée — le contrat booléen `verifier` de la référence ne distingue que correct/incorrect,
 * voir src/moteur/statutVerification.ts) incrémente le compteur ; au tentativesMax-ième échec sans
 * succès, le champ est révélé (score 0), sans jamais lire au-delà dans l'historique.
 */
export function calculerEtatChampTentatives(
  statutsChronologiques: readonly StatutVerification[],
  tentativesMax: number,
  aideUtilisee: boolean,
  aidePenalitePourcent: number,
  chronoExpire: boolean = false,
): EtatChampTentatives {
  // Correctif "Chrono de réponse" : expiration = même révélation qu'un épuisement de tentatives
  // ("chrono par écran couvre toutes les tentatives cumulées... l'écran se termine quand même"),
  // vérifiée AVANT la boucle ci-dessous — court-circuite volontairement le calcul normal, y compris
  // quand `statutsChronologiques` est encore vide (champ jamais soumis, chrono expiré quand même).
  if (chronoExpire) {
    return { tentativesUtilisees: statutsChronologiques.length, terminee: true, reussie: false, revelee: true, score: 0 };
  }
  let tentativesRatees = 0;
  for (const statut of statutsChronologiques) {
    if (statut === "correct") {
      const penalitePourTentative = 100 / tentativesMax;
      const scoreSiCorrect = Math.max(0, 100 - tentativesRatees * penalitePourTentative);
      const score = aideUtilisee ? scoreSiCorrect * (1 - aidePenalitePourcent / 100) : scoreSiCorrect;
      return { tentativesUtilisees: tentativesRatees, terminee: true, reussie: true, revelee: false, score };
    }
    tentativesRatees++;
    if (tentativesRatees >= tentativesMax) {
      return { tentativesUtilisees: tentativesRatees, terminee: true, reussie: false, revelee: true, score: 0 };
    }
  }
  return { tentativesUtilisees: tentativesRatees, terminee: false, reussie: false, revelee: false, score: null };
}

/**
 * Prompt Étape 4 — port de `statutRecap`/`libelleStatutRecap` (`src/components/LigneRecap.tsx`,
 * `plateforme-maths`), modèle à 3 statuts reproduit tel quel. `niveauAide` (compteur de palier côté
 * référence) adapté à ce pilote : un seul niveau d'aide, booléen `indice_utilise` — "orange si
 * indice_utilise est vrai ET la réponse correcte, rouge si révélée (tentatives épuisées), verte
 * sinon" (consigne verbatim de l'énoncé).
 */
export type StatutRecap = "verte" | "orange" | "rouge";

export function statutRecap(revele: boolean, indiceUtilise: boolean, correcte: boolean): StatutRecap {
  if (revele) return "rouge";
  if (indiceUtilise && correcte) return "orange";
  return "verte";
}

export function libelleStatutRecap(statut: StatutRecap): string {
  if (statut === "rouge") return "Réponse révélée";
  if (statut === "orange") return "Correct (aide utilisée)";
  return "Correct";
}

export interface LigneRecap {
  champ: string;
  statut_recap: StatutRecap;
  libelle: string;
  score: number;
}

/**
 * Assemble une ligne du récapitulatif (Étape 4) pour un champ TERMINÉ (`etat.terminee === true` —
 * jamais appelée sinon, voir lib/routes/eleves/tableau-de-bord.ts : un champ pas encore résolu n'a
 * simplement pas sa place dans un récapitulatif de tâche complétée). Ne dépend d'aucun réglage de
 * correction (`feedback_immediat`/`reponse_visible`) — le récapitulatif révèle tout, délibérément,
 * une fois la tâche terminée (Étape 4), indépendamment de ce qui a été montré en direct pendant la
 * tâche.
 */
export function construireLigneRecap(champ: string, etat: EtatChampTentatives, aideUtilisee: boolean): LigneRecap {
  const statut = statutRecap(etat.revelee, aideUtilisee, etat.reussie);
  return { champ, statut_recap: statut, libelle: libelleStatutRecap(statut), score: etat.score ?? 0 };
}
