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
 * Nombre d'essais RÉELLEMENT accordés par une tâche (option B, revue de la phase 2) : sans correction
 * immédiate l'élève ne sait jamais si sa réponse était juste, donc une seconde tentative n'a aucun sens
 * (elle ne pourrait que révéler indirectement que la première était fausse) — `feedback_immediat=false`
 * force UN SEUL essai, quelle que soit la valeur stockée de `tentatives_supplementaires` (tâche créée
 * avant le verrou du formulaire, ou hors interface). Seul point de cette règle : tout appelant qui
 * dérive `tentativesMax` d'une ligne `taches` passe par ici, jamais par `tentativesMaxDepuisReglages`
 * directement.
 */
export function tentativesMaxEffectif(feedbackImmediat: boolean, tentativesSupplementaires: number): number {
  return feedbackImmediat ? tentativesMaxDepuisReglages(tentativesSupplementaires) : 1;
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
 *
 * Score partiel (RAPPORT §16) — `fractionsChronologiques` : fraction `fractionCorrecte` de chaque
 * soumission, même ordre et même longueur que `statutsChronologiques` (`null`/`undefined` = pas de
 * fraction). Elle n'est lue QUE sur un `not_equivalent` (jamais sur `correct` ni `parse_error`).
 * Le verdict reste binaire : un échec partiel compte pour `tentativesMax` et ne termine rien ;
 * seuls `score` (jamais `terminee`/`reussie`/`revelee`/`tentativesUtilisees`) en est modifié.
 *   p = 100 / tentativesMax
 *   valeur d'un échec de rang i (échecs_avant = échecs antérieurs) = φ_i × max(0, 100 − échecs_avant × p)
 *   meilleur_partiel = max des valeurs des échecs
 *   réussite au rang r  : score_brut = max(max(0, 100 − (r−1)·p), meilleur_partiel)
 *   épuisement          : score_brut = meilleur_partiel   (0 sans fraction)
 *   chrono expiré       : score_brut = meilleur_partiel sur les soumissions faites (0 sans fraction)
 *   score = aide utilisée ? score_brut × (1 − pct/100) : score_brut   (toute valeur > 0)
 * Sans AUCUNE fraction strictement positive, le chemin d'origine ci-dessous est exécuté tel quel :
 * les scores sont identiques au bit près (`scripts/test-score-partiel.ts`, comparaison exhaustive).
 */
export function calculerEtatChampTentatives(
  statutsChronologiques: readonly StatutVerification[],
  tentativesMax: number,
  aideUtilisee: boolean,
  aidePenalitePourcent: number,
  chronoExpire: boolean = false,
  fractionsChronologiques?: readonly (number | null | undefined)[],
): EtatChampTentatives {
  if (aUneFractionPositive(statutsChronologiques, fractionsChronologiques)) {
    return calculerEtatAvecFractions(statutsChronologiques, tentativesMax, aideUtilisee, aidePenalitePourcent, chronoExpire, fractionsChronologiques!);
  }
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

/** Vrai si au moins une soumission `not_equivalent` porte une fraction strictement positive. */
function aUneFractionPositive(
  statuts: readonly StatutVerification[],
  fractions: readonly (number | null | undefined)[] | undefined,
): boolean {
  if (!fractions) return false;
  return statuts.some((statut, i) => statut === "not_equivalent" && typeof fractions[i] === "number" && (fractions[i] as number) > 0);
}

/** Chemin « score partiel » : mêmes champs de progression que le chemin d'origine, seul `score` diffère. */
function calculerEtatAvecFractions(
  statuts: readonly StatutVerification[],
  tentativesMax: number,
  aideUtilisee: boolean,
  aidePenalitePourcent: number,
  chronoExpire: boolean,
  fractions: readonly (number | null | undefined)[],
): EtatChampTentatives {
  const penalitePourTentative = 100 / tentativesMax;
  const avecAide = (brut: number): number => (aideUtilisee ? brut * (1 - aidePenalitePourcent / 100) : brut);
  const valeurPartielle = (i: number, echecsAvant: number): number => {
    const f = fractions[i];
    return statuts[i] === "not_equivalent" && typeof f === "number" ? f * Math.max(0, 100 - echecsAvant * penalitePourTentative) : 0;
  };
  let meilleurPartiel = 0;
  if (chronoExpire) {
    let echecs = 0;
    for (let i = 0; i < statuts.length; i++) {
      if (statuts[i] === "correct") continue;
      meilleurPartiel = Math.max(meilleurPartiel, valeurPartielle(i, echecs));
      echecs++;
    }
    return { tentativesUtilisees: statuts.length, terminee: true, reussie: false, revelee: true, score: meilleurPartiel === 0 ? 0 : avecAide(meilleurPartiel) };
  }
  let tentativesRatees = 0;
  for (let i = 0; i < statuts.length; i++) {
    if (statuts[i] === "correct") {
      const scoreSiCorrect = Math.max(0, 100 - tentativesRatees * penalitePourTentative);
      return { tentativesUtilisees: tentativesRatees, terminee: true, reussie: true, revelee: false, score: avecAide(Math.max(scoreSiCorrect, meilleurPartiel)) };
    }
    meilleurPartiel = Math.max(meilleurPartiel, valeurPartielle(i, tentativesRatees));
    tentativesRatees++;
    if (tentativesRatees >= tentativesMax) {
      return { tentativesUtilisees: tentativesRatees, terminee: true, reussie: false, revelee: true, score: meilleurPartiel === 0 ? 0 : avecAide(meilleurPartiel) };
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
