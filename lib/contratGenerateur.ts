import type { StatutVerification } from "../src/moteur/statutVerification";

/**
 * Contrat de générateur (phase 2) — le SEUL point d'extension pour ajouter un exercice à la
 * plateforme. Un générateur ne contient ni HTML, ni CSS, ni appel réseau : il déclare des écrans
 * (données), sait tirer un exercice depuis une graine, et vérifier une réponse. L'affichage est
 * entièrement pris en charge par la bibliothèque de composants partagée (`public/moteur/`), la
 * vérification a lieu UNIQUEMENT côté serveur (`POST /api/reponses`) — aucune logique de
 * vérification n'existe côté client, et aucun marquage d'erreur en direct pendant la frappe.
 *
 * ── Règle « état local d'édition ≠ réponse » ────────────────────────────────────────────────
 * Ce qu'un élève est en train de composer dans un écran (texte tapé mais pas validé, valeurs
 * ajoutées/retirées d'une liste, cases d'un tableau de signes en cours de remplissage, choix de QCM
 * pas encore confirmé) est un ÉTAT LOCAL D'ÉDITION : il vit uniquement dans le composant, n'est
 * jamais envoyé au serveur, jamais stocké, jamais vérifié, jamais compté comme tentative. Une
 * RÉPONSE n'existe qu'à l'instant où l'élève confirme explicitement (bouton « Valider ») : le
 * composant produit alors UNE chaîne (`reponseBrute`, format par type d'écran ci-dessous) et c'est
 * seulement elle qui traverse le réseau. Cette règle est appliquée, pas seulement convenue :
 *  - côté serveur, `POST /api/reponses` n'accepte que `{ exercice_assigne_id, champ, reponse_brute }`
 *    (`reponse_brute` : chaîne) et rejette (400) toute autre clé — un brouillon ou un état
 *    d'édition ne peut pas être transmis par ce canal ;
 *  - `verifier` ne reçoit qu'une `reponseBrute` ; `etatActuel` ne reçoit que des `ReponseConfirmee`
 *    (jamais une saisie en cours) ;
 *  - côté client, un composant n'appelle son rappel `surConfirmation` qu'au clic sur « Valider »
 *    (vérifié en Chromium : aucune requête `/api/reponses` pendant l'édition).
 *
 * ── Formats de `reponseBrute` par type d'écran (chaîne unique, décodée par le générateur) ─────
 *  - `champ_expression` : le texte saisi, tel quel.
 *  - `qcm`              : l'`id` du choix retenu.
 *  - `liste_valeurs`    : tableau JSON de chaînes (valeurs non vides, ordre de saisie) — la
 *                         comparaison est faite en ENSEMBLE par le générateur (ordre et doublons
 *                         sans importance, sauf décision contraire du générateur).
 *  - `tableau_signes`   : objet JSON `{ [ligneId]: { [colonneId]: signe } }`.
 * Décodeurs partagés : lib/reponsesEcran.ts.
 *
 * ── Ajouter un type d'écran ─────────────────────────────────────────────────────────────────
 * Ajouter (1) une interface dans `EcranDeclare` ci-dessous, (2) un composant dans
 * `public/moteur/ecrans/` enregistré dans `public/moteur/ecrans/index.js`, (3) un écran
 * correspondant dans le générateur témoin technique (`src/generateurs/_temoinTechnique/`). Ni le
 * contrat `Generateur`, ni le moteur, ni les routes serveur ne changent.
 */

export type TypeEcran = "champ_expression" | "qcm" | "liste_valeurs" | "tableau_signes";

interface EcranCommun {
  /** Identifiant du champ = `reponses.champ` en base. Unique dans un exercice. */
  champ: string;
  /** Texte de l'énoncé de CET écran (texte brut ; le rendu passe par `public/moteur/rendreTexte.js`). */
  consigne: string;
  /**
   * Texte d'aide (indice). Jamais envoyé avec l'écran : servi seulement par `POST /api/reponses/aide`,
   * qui enregistre l'usage côté serveur (pénalité calculée serveur, jamais déclarée par le client).
   */
  aide?: string;
}

export interface EcranChampExpression extends EcranCommun {
  type: "champ_expression";
  placeholder?: string;
}

export interface EcranQcm extends EcranCommun {
  type: "qcm";
  choix: { id: string; libelle: string }[];
}

export interface EcranListeValeurs extends EcranCommun {
  type: "liste_valeurs";
  /** Libellé du bouton d'ajout d'une valeur (ex. « Ajouter un diviseur »). */
  etiquetteAjout: string;
}

export interface EcranTableauSignes extends EcranCommun {
  type: "tableau_signes";
  colonnes: { id: string; libelle: string }[];
  lignes: { id: string; libelle: string }[];
  /** Signes proposés dans chaque case (ex. `["+", "-", "0"]`). */
  signesAutorises: string[];
}

export type EcranDeclare = EcranChampExpression | EcranQcm | EcranListeValeurs | EcranTableauSignes;

/**
 * Réponse d'un champ TERMINÉ (réussi ou révélé, voir `calculerEtatChampTentatives`) : dernière
 * soumission de ce champ. Un champ encore en cours de tentatives n'en fait pas partie — un
 * générateur qui ordonne ses écrans ne doit avancer que sur des champs réellement terminés.
 */
export interface ReponseConfirmee {
  champ: string;
  reponseBrute: string;
  statut: StatutVerification;
}

export interface EtatActuel {
  /** Champ à afficher maintenant, ou `null` si la séquence est épuisée. */
  champCourant: string | null;
}

export type ResultatVerification =
  | { statut: "correct"; codesCompetence: string[] }
  | { statut: "not_equivalent"; codesCompetence: string[] }
  | {
      statut: "parse_error";
      codesCompetence: string[];
      /** Message pédagogique décrivant l'erreur de SYNTAXE (jamais la bonne réponse). */
      messageErreur: string;
    };

export interface Generateur<TExercice = unknown> {
  variante_id: string;
  generateur_id: string;
  /**
   * `false` pour un générateur technique (témoin) : ses codes de compétence ne sont alors pas
   * contrôlés contre `lib/dictionnaireCompetences.ts`, et il ne doit JAMAIS figurer dans
   * `CATALOGUE_GENERATEURS` (exposé au professeur). `true` pour un générateur curriculaire :
   * codes obligatoirement présents dans le dictionnaire, entrée de catalogue obligatoire.
   */
  curriculaire: boolean;
  /** Tous les codes que `verifier` peut renvoyer — contrôlé au chargement du registre ET à chaque vérification (échec bruyant). */
  codesCompetenceDeclares: string[];
  /**
   * Tirage seedé : même graine -> exercice strictement identique (JSON-sérialisable, sans
   * `undefined`), tout l'aléa passant par `creerPrng(graine)` (lib/prng.ts), jamais `Math.random()`.
   * L'exercice n'est PAS stocké : il est régénéré à chaque appel depuis `exercices_assignes.graine`.
   * Conséquence : toute modification qui change ce que `generer` produit pour une graine donnée doit
   * s'accompagner d'un NOUVEAU `variante_id` (suffixe `_v2`…), sans quoi les exercices déjà assignés
   * changeraient sous les pieds des élèves.
   */
  generer(graine: number): TExercice;
  /** Écrans de l'exercice, dans l'ordre. Donnée pure : ne contient jamais la solution. */
  ecrans(exercice: TExercice): EcranDeclare[];
  /** Dérivé uniquement de `exercice` et des réponses confirmées — jamais d'une saisie en cours. */
  etatActuel(exercice: TExercice, reponsesConfirmees: ReponseConfirmee[]): EtatActuel;
  verifier(exercice: TExercice, champ: string, reponseBrute: string): ResultatVerification;
  /** Solution lisible d'un champ (affichée seulement si le réglage de tâche ou la révélation le permet). */
  solutionAttendue(exercice: TExercice, champ: string): string;
}

/** `etatActuel` par défaut pour un enchaînement séquentiel : premier écran non encore confirmé. */
export function etatActuelSequentiel(champsDansLOrdre: readonly string[], reponsesConfirmees: readonly ReponseConfirmee[]): EtatActuel {
  const confirmes = new Set(reponsesConfirmees.map((r) => r.champ));
  return { champCourant: champsDansLOrdre.find((champ) => !confirmes.has(champ)) ?? null };
}
