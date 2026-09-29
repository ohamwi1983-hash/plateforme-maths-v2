import type { StatutVerification } from "../src/moteur/statutVerification";
import type { AideTypee } from "./aideTypee";

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
 *                         Avec `permetAucune`, le tableau vide `[]` est la réponse explicite « aucune
 *                         valeur » (décodeur : `decoderListeValeursOuAucune`).
 *  - `tableau_signes`   : objet JSON `{ [ligneId]: { [colonneId]: signe } }`.
 *  - `champs_multiples` : objet JSON `{ [sousChampId]: string }` — texte tapé, ou `id` du choix retenu ;
 *                         TOUS les sous-champs déclarés présents, aucun en trop, aucun vide
 *                         (`decoderChampsMultiples`). Une seule tentative pour l'ensemble.
 *  - `intervalle`       : objet JSON `{ crochetGauche, borneGauche, crochetDroit, borneDroite }`,
 *                         crochets `"["` ou `"]"`, bornes = texte tapé ou sentinelles `"-inf"`/`"+inf"`
 *                         (`decoderIntervalle` ne juge ni le sens ni la valeur numérique).
 * Décodeurs partagés : lib/reponsesEcran.ts (dont `lireNombreOuFraction`, le SEUL lecteur de nombre :
 * un champ vide, des espaces seuls ou un texte non numérique donnent `null`, jamais 0).
 *
 * ── Texte servi et balisage mathématique ────────────────────────────────────────────────────
 * Tout texte D'AUTEUR (consigne, libellés de choix/colonnes/lignes/sous-champs, étiquettes, aide en
 * chaîne, solution attendue, message d'erreur) peut contenir du balisage `$…$` (LaTeX inline) ; le
 * texte D'ÉLÈVE n'est jamais interprété. Grammaire, échappement (`\$`), invalidité (texte brut) et
 * commandes interdites : CLAUDE.md « Balisage mathématique ». `public/moteur/rendreTexte.js` est le
 * SEUL point d'écriture d'un texte dans le DOM.
 *
 * ── Aide ────────────────────────────────────────────────────────────────────────────────────
 * `aide` est une chaîne (texte d'auteur) OU une `AideTypee` (lib/aideTypee.ts : exactement deux
 * formes, `formule_coloree` et `croquis_parabole`). Jamais envoyée avec l'écran ; validée par le
 * serveur avant d'être servie.
 *
 * ── Ajouter un type d'écran ─────────────────────────────────────────────────────────────────
 * Ajouter (1) une interface dans `EcranDeclare` ci-dessous, (2) un décodeur dans
 * lib/reponsesEcran.ts, (3) un composant dans `public/moteur/ecrans/` enregistré dans
 * `public/moteur/ecrans/index.js` (tout texte d'auteur via `rendreTexte(…, { math: true })`),
 * (4) un écran correspondant dans le générateur témoin UNIQUE (`src/generateurs/_temoinTechnique/`,
 * hors catalogue ; profil d'exercice « base » = écrans d'origine, « etendu » = écrans ajoutés depuis),
 * (5) `npm run chromium-temoin` doit passer. Ni le contrat `Generateur`, ni le moteur, ni les routes
 * serveur ne changent.
 */

export type TypeEcran = "champ_expression" | "qcm" | "liste_valeurs" | "tableau_signes" | "champs_multiples" | "intervalle";

interface EcranCommun {
  /** Identifiant du champ = `reponses.champ` en base. Unique dans un exercice. */
  champ: string;
  /** Texte de l'énoncé de CET écran (texte d'auteur, balisage `$…$` admis ; le rendu passe par `public/moteur/rendreTexte.js`). */
  consigne: string;
  /**
   * Aide (indice) : texte d'auteur OU aide typée (`AideTypee`, exactement 2 formes). Jamais envoyée
   * avec l'écran : servie seulement par `POST /api/reponses/aide`, qui la valide puis enregistre
   * l'usage côté serveur (pénalité calculée serveur, jamais déclarée par le client).
   */
  aide?: string | AideTypee;
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
  /**
   * Propose d'abord le choix « aucune valeur » / « au moins une valeur » ; « aucune valeur » produit
   * `reponseBrute = "[]"`. Sans cette option, la liste vide n'est jamais confirmable.
   */
  permetAucune?: boolean;
  /** Libellés des deux choix (texte d'auteur). Défauts : « Aucune valeur » / « Au moins une valeur ». */
  etiquetteAucune?: string;
  etiquetteAuMoinsUne?: string;
}

/** `rendu: "symboles_variation"` : les valeurs `⌢ ⌣ ↗ ↘` sont dessinées (et nommées pour l'accessibilité). */
export type RenduLigneTableau = "texte" | "symboles_variation";

export interface LigneTableauSignes {
  id: string;
  libelle: string;
  /** Alphabet de CETTE ligne ; défaut : `signesAutorises` de l'écran. */
  signesAutorises?: string[];
  rendu?: RenduLigneTableau;
}

export interface ColonneTableauSignes {
  id: string;
  libelle: string;
  /** Second niveau de l'en-tête (ex. `$x_S$` sous la valeur du sommet). */
  sousLibelle?: string;
}

export interface EcranTableauSignes extends EcranCommun {
  type: "tableau_signes";
  colonnes: ColonneTableauSignes[];
  lignes: LigneTableauSignes[];
  /** Signes proposés dans chaque case (ex. `["+", "-", "0"]`) : alphabet par défaut des lignes. */
  signesAutorises: string[];
  /**
   * Colonnes de BORNES d'affichage (ex. `$-\infty$` / `$+\infty$`) aux deux extrémités : ce ne sont
   * pas des cases de réponse, elles n'apparaissent jamais dans `reponseBrute`.
   */
  bornes?: { gauche: string; droite: string };
}

export interface SousChampTexte {
  id: string;
  /** Texte d'auteur (balisage `$…$` admis), ex. `$a =$`. */
  libelle: string;
  genre: "texte";
  /** Texte brut (attribut) : aucun balisage. */
  placeholder?: string;
}

export interface SousChampChoix {
  id: string;
  libelle: string;
  genre: "choix";
  choix: { id: string; libelle: string }[];
}

export type SousChamp = SousChampTexte | SousChampChoix;

/**
 * Croquis de l'axe Oy qui SUIT EN DIRECT les choix locaux de deux sous-champs (état d'édition : jamais
 * envoyé). Ce n'est PAS une aide (aucune pénalité) : il n'affiche que ces choix et `c`.
 */
export interface IllustrationAllure {
  type: "croquis_allure";
  /** Ordonnée à l'origine (publique dans l'énoncé). */
  c: number;
  /** Id du sous-champ dont le choix (`"+"` | `"-"`) alimente le croquis (signe de a). */
  champSigneA: string;
  /** Id du sous-champ dont le choix (`"+"` | `"-"` | `"0"`) alimente le croquis (signe de a·b). */
  champSigneAB: string;
}

export interface EcranChampsMultiples extends EcranCommun {
  type: "champs_multiples";
  champs: SousChamp[];
  illustration?: IllustrationAllure;
}

export interface EcranIntervalle extends EcranCommun {
  type: "intervalle";
}

export type EcranDeclare =
  | EcranChampExpression
  | EcranQcm
  | EcranListeValeurs
  | EcranTableauSignes
  | EcranChampsMultiples
  | EcranIntervalle;

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
