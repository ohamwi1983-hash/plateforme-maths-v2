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
 *  - `tableau_signes`   : objet JSON `{ [ligneId]: { [colonneId]: signe } }` ; en tableau structuré, une case
 *                         FUSIONNÉE (ligne `variation`) a pour clé la PREMIÈRE colonne de son groupe
 *                         (`lib/structureTableau.ts`). Toutes les cases doivent être renseignées : aucun `?` ne
 *                         voyage, « Valider » reste désactivé tant qu'il en reste un (comme `champs_multiples`).
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
   * Nom COURT de l'écran (« Coefficients », « Allure »…), texte d'auteur : libellé de sa ligne dans le « Ce qu'on sait déjà » de l'enveloppe
   * d'exercice (RAPPORT §43). Absent : « Question n ». Aucune information sur la réponse : identique pour tous les élèves.
   */
  nom?: string;
  /**
   * Aide (indice) : texte d'auteur OU aide typée (`AideTypee`, exactement 2 formes). Jamais envoyée
   * avec l'écran : servie seulement par `POST /api/reponses/aide`, qui la valide puis enregistre
   * l'usage côté serveur (pénalité calculée serveur, jamais déclarée par le client).
   */
  aide?: string | AideTypee;
  /**
   * Poids de CET écran dans le score de l'exercice (RAPPORT §17) : entier ≥ 1 ; absent = 1. Sert
   * uniquement à pondérer l'agrégation « champs corrects / champs comptés » (lib/poidsEcran.ts, seule
   * lecture) ; n'a aucun effet sur le verdict, les tentatives ni `fractionCorrecte` (score d'UN champ).
   * Statique : ne dépend jamais des réponses de l'élève. Changer un poids réécrit rétroactivement les
   * pourcentages déjà calculés — voir le risque documenté au RAPPORT §17 (règle `_v2` non tranchée).
   */
  poids?: number;
  /**
   * Cascade (RAPPORT §18) : champs dont la valeur CONFIRMÉE par l'élève alimente cet écran (énoncé, aide,
   * solution, vérification). Chaque champ cité précède cet écran dans `ecrans()` (pas de cycle, pas
   * d'auto-référence). Un écran dépendant n'est servi (`GET /api/exercices/:id`) et son aide n'est
   * délivrée qu'une fois TOUS ces champs terminés : avant, son texte (bâti sur la vraie valeur) ne doit
   * jamais quitter le serveur. Absent = écran indépendant (comportement inchangé). Exige `projeter`.
   */
  dependDe?: string[];
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

/**
 * Nature d'une ligne d'un tableau STRUCTURÉ (RAPPORT §30) : elle décide, avec le genre de la colonne, de
 * l'alphabet de chaque case (`lib/structureTableau.ts`, SEULE dérivation — le navigateur ne la recalcule pas).
 *  - `signe`     : signe d'un facteur / de `f` ; `quotient` : ligne finale d'un quotient (un pôle y offre `∅`) ;
 *  - `variation` : cases FUSIONNÉES par groupes délimités par les colonnes `sommet` (`↗ ↘` sur un groupe, `⌢ ⌣` au sommet).
 */
export type NatureLigne = "signe" | "quotient" | "variation";

export interface LigneTableauSignes {
  id: string;
  /** Texte d'auteur affiché AU-DESSUS de la ligne (tableau structuré) ou à gauche (tableau hérité). */
  libelle: string;
  /** Tableau HÉRITÉ seulement : alphabet de CETTE ligne ; défaut : `signesAutorises` de l'écran. */
  signesAutorises?: string[];
  /** Tableau HÉRITÉ seulement (en structuré, une ligne `variation` dessine toujours ses symboles). */
  rendu?: RenduLigneTableau;
  /** Tableau STRUCTURÉ seulement ; défaut `"signe"`. */
  nature?: NatureLigne;
}

/** `intervalle` : le `<` entre deux valeurs (case de signe à 2 valeurs) ; `valeur` : un point remarquable de la ligne des x. */
export type GenreColonne = "intervalle" | "valeur";

export interface ColonneTableauSignes {
  id: string;
  /** Nom lisible de la colonne (étiquette d'accessibilité) ; en-tête visible du tableau HÉRITÉ seulement. */
  libelle: string;
  /**
   * Tableau STRUCTURÉ : déclarer `genre` sur TOUTES les colonnes ou sur aucune. Les colonnes alternent
   * `intervalle, valeur, intervalle, …, intervalle` (2N+1, jamais de colonne −∞/+∞), 3 ≤ 2N+1 ≤ 9.
   */
  genre?: GenreColonne;
  /** Colonne `valeur` : texte d'auteur de la valeur de x (ligne des x), obligatoire. */
  valeur?: string;
  /** Colonne `valeur` : symbole (`$x_1$`, `$x_S$`…) de la bande au-dessus de la ligne des x. */
  symbole?: string;
  /** Colonne `valeur` : `0` est une réponse possible sur les lignes de signe (vraie racine). Défaut : non. */
  racine?: boolean;
  /** Colonne `valeur` : racine du DÉNOMINATEUR — la ligne `quotient` y offre `∅` (indéfini, distinct de `0`). */
  pole?: boolean;
  /** Colonne `valeur` : point où la variation change (sommet) — délimite les groupes fusionnés des lignes `variation`. */
  sommet?: boolean;
}

export interface EcranTableauSignes extends EcranCommun {
  type: "tableau_signes";
  colonnes: ColonneTableauSignes[];
  lignes: LigneTableauSignes[];
  /** Tableau HÉRITÉ seulement : signes proposés dans chaque case (ex. `["+", "-", "0"]`), alphabet par défaut des lignes. */
  signesAutorises?: string[];
  /** Titre de section (texte d'auteur, écrit dans la BONNE casse : jamais de `text-transform`, RAPPORT §30). */
  titre?: string;
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

/** Réglages statiques de la tâche transmis à `Generateur.projeter` (RAPPORT §18, §42). */
export interface ContexteProjection {
  /** Correction immédiate : l'élève voit son VERDICT (`statut`) dès la soumission. */
  correctionImmediate: boolean;
  /**
   * La vraie valeur d'un champ a pu être MONTRÉE à l'élève (`solutionMontreeEnCours` : correction immédiate ET « Afficher la réponse
   * attendue »). C'est le seul réglage qui autorise un énoncé ou un tableau à reprendre une vraie valeur que l'élève n'a pas trouvée.
   */
  solutionMontree: boolean;
}

export interface EtatActuel {
  /** Champ à afficher maintenant, ou `null` si la séquence est épuisée. */
  champCourant: string | null;
}

export type ResultatVerification =
  | { statut: "correct"; codesCompetence: string[] }
  | {
      statut: "not_equivalent";
      codesCompetence: string[];
      /**
       * Optionnel : part de la réponse déjà juste, 0 ≤ φ < 1 (jamais 1 : une réponse entièrement juste est
       * `correct`). Le verdict reste binaire — un échec partiel compte pour `tentativesMax`, ne débloque
       * rien —, seul `score` (lib/moteurTentatives.ts, RAPPORT §16) en tient compte. Absent = comportement
       * inchangé. Jamais exposé par une réponse HTTP (règle de révélation). Contrôlé par `verifierAvecControle`.
       */
      fractionCorrecte?: number;
    }
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
  /**
   * Cascade (RAPPORT §18) : « exercice effectif » vu par l'élève. Remplace, dans l'exercice, toute donnée
   * dérivée d'un écran précédent par la valeur que l'élève a CONFIRMÉE (`reponsesConfirmees` = champs
   * terminés, dernière soumission) — JAMAIS par la vraie valeur : une méthode juste appliquée à une donnée
   * de départ fausse doit réussir l'écran. EXCEPTION (RAPPORT §45) : quand `solutionMontree`, les champs non
   * réussis ont été révélés avec leur solution ; `projeterExercice` ne transmet alors que les réponses
   * CORRECTES (`statut === "correct"`) et les écrans suivants repartent de la vraie valeur, jamais de la réponse
   * fausse. `ecrans`, `verifier`, `solutionAttendue` et l'aide reçoivent
   * ensuite cet exercice effectif (jamais l'exercice brut) : point de substitution UNIQUE.
   * Pure et déterministe ; ne dépend que des confirmations des champs de `dependDe` de chaque écran.
   * Valeur inexploitable (non analysable, hors domaine, ou champ terminé sans réponse — chrono) : repli.
   * `solutionMontree` (réglage STATIQUE de la tâche, jamais `revele`) : `true` → repli sur la vraie
   * valeur (elle vient d'être révélée) ; `false` → donnée de repli DÉCLARÉE par le générateur, distincte de
   * la vraie valeur (correction coupée, OU correction immédiate sans « Afficher la réponse attendue » : la
   * vraie valeur n'a pas été montrée et ne doit pas fuiter par l'énoncé suivant). `correctionImmediate`
   * seul ne suffit pas à ce choix (RAPPORT §42). Absente : aucun écran ne peut déclarer `dependDe`.
   */
  projeter?(exercice: TExercice, reponsesConfirmees: ReponseConfirmee[], contexte: ContexteProjection): TExercice;
  /** Solution lisible d'un champ (affichée seulement si le réglage de tâche ou la révélation le permet). */
  solutionAttendue(exercice: TExercice, champ: string): string;
}

/** `etatActuel` par défaut pour un enchaînement séquentiel : premier écran non encore confirmé. */
export function etatActuelSequentiel(champsDansLOrdre: readonly string[], reponsesConfirmees: readonly ReponseConfirmee[]): EtatActuel {
  const confirmes = new Set(reponsesConfirmees.map((r) => r.champ));
  return { champCourant: champsDansLOrdre.find((champ) => !confirmes.has(champ)) ?? null };
}
