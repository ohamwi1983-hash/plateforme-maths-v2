import { lirePropre } from "./tablePropre";
import { DICTIONNAIRE_COMPETENCES } from "./dictionnaireCompetences";
import { EXPLICATIONS_COMPETENCES } from "./explicationsCompetences";
import { EXPLICATIONS_COMPETENCES_ELEVE } from "./explicationsCompetencesEleve";
import { categoriserCompetence } from "./categoriesCompetences";
import { moyenne } from "./tempsExercice";

export type StatutCompetence = "non_maitrisee" | "en_observation";

export interface CompetenceProfil {
  code: string;
  libelle: string;
  description: string;
  statut: StatutCompetence;
  occurrences: number;
  /**
   * Prompt "Catégorisation des compétences + regroupement du profil élève (Option B)" — résolus ici
   * (`categoriserCompetence`, `lib/categoriesCompetences.ts`) pour la même raison que
   * `explication`/`exemple` ci-dessous : un seul appelant HTTP suffit, jamais de 2e table de
   * correspondance à dupliquer dans `public/prof.html`. `sousCategorie` absente (`undefined`) pour
   * une catégorie qui n'en définit pas, jamais une chaîne vide.
   */
  categorie: string;
  sousCategorie?: string;
  /**
   * Prompt "Bouton d'explication pédagogique par compétence" — contenu détaillé résolu ici
   * (`EXPLICATIONS_COMPETENCES`, `lib/explicationsCompetences.ts`) plutôt que côté client : même
   * convention que `libelle`/`description` (résolus depuis `DICTIONNAIRE_COMPETENCES`), un seul
   * appelant HTTP suffit, jamais de 2e dictionnaire à dupliquer dans `public/prof.html`. Absents
   * (`undefined`, jamais une chaîne vide ni une erreur) pour un code sans entrée dans
   * `EXPLICATIONS_COMPETENCES` — le client s'en sert pour décider d'afficher ou non le bouton "?".
   */
  explication?: string;
  exemple?: string;
  /**
   * Tâche "Résultats élève — tutoiement" (retour utilisateur : "emploie le tutoiement et un ton
   * plus familier. Tu parles à un jeune élève") — équivalent en tutoiement d'`explication`
   * ci-dessus, résolu depuis `EXPLICATIONS_COMPETENCES_ELEVE` (`lib/explicationsCompetencesEleve.ts`),
   * MÊME convention (absent, jamais une chaîne vide, pour un code sans entrée). Jamais utilisé côté
   * prof (public/prof.html continue de lire `explication`, jamais ce champ) — les deux textes
   * coexistent dans le même `CompetenceProfil` sans jamais se substituer l'un à l'autre.
   */
  explicationEleve?: string;
  /**
   * Tâche "Résultats élève — barre de progression segmentée" — résolu par l'APPELANT HTTP (jamais
   * par `calculerProfilCompetences` ci-dessous, qui ne porte que sur `bug_detecte` sans contexte
   * tâche/exercice) via `calculerSegmentsCompetence` (voir plus bas dans ce fichier), et attaché
   * uniquement aux compétences `non_maitrisee`. Absent (`undefined`) partout ailleurs — notamment
   * jamais posé par `GET /api/profs/eleves/:id/profil`, qui n'en a pas besoin.
   */
  segments?: SegmentCompetenceTache[];
  /**
   * Prompt "Temps moyen par compétence — profil élève (renfort factuel, pas un nouveau diagnostic)"
   * — même convention que `segments` ci-dessus : résolu par l'APPELANT HTTP (`tempsMoyenParCompetence`
   * plus bas dans ce fichier, jamais par `calculerProfilCompetences`, qui ne porte que sur
   * `bug_detecte` sans la durée associée). `undefined` (jamais `0` ni un placeholder) si aucune
   * occurrence de ce code n'a de `duree_ecoulee_secondes` exploitable (occurrences antérieures à la
   * mesure fiable, §165) — même silence déjà choisi pour la tendance de temps élève.
   */
  tempsMoyenSecondes?: number;
}

/**
 * Prompts "Câblage taxonomie compétences — gen8/gen9" — jusqu'ici `bug_detecte` ne portait jamais
 * plus d'UN code par ligne `reponses` (17 codes existants, jamais de virgule dans aucun d'eux).
 * gen8 introduit le premier cas où PLUSIEURS codes sont réellement indépendants pour une seule
 * soumission (4 curseurs TH/TV/EV·CV/SOX, "Option B" actée par le prompt : chaque sous-échec compte
 * comme sa propre occurrence, jamais un seul code priorisé comme pour la grille) — plutôt que
 * d'ajouter une ligne `reponses` par code (changerait la sémantique d'"une ligne = une soumission"
 * partout ailleurs dans ce dépôt) ou une 2e colonne (jamais rétrocompatible avec les lecteurs
 * existants qui traitent `bug_detecte` en `string | null` opaque), les codes déclenchés ensemble
 * sont joints dans LA MÊME valeur `bug_detecte`, séparés par une virgule. Un code isolé ne contient
 * jamais de virgule (tous en `MAJUSCULE_SNAKE_CASE`) : `.split(",")` sur une valeur à un seul code
 * est un no-op qui renvoie `[code]`, donc rétrocompatible à 100% avec les 17 codes déjà en base.
 */
const SEPARATEUR_BUGS_MULTIPLES = ",";

/**
 * Retour utilisateur ("aucun intérêt à être divulgué") — codes jamais montrés au prof, sur AUCUN
 * écran (profil complet élève/classe, arbre, vue radiale, puces vert/rouge "Résultats", résumé
 * agrégé). Filtré ici, au SEUL point de lecture par lequel tout `bug_detecte` stocké transite avant
 * d'être compté ou affiché (`calculerProfilCompetences` l'appelle en interne, et `resultats.ts`
 * l'appelle directement pour `resume_bugs`) — un filtre central, jamais un par écran. Ne touche
 * JAMAIS l'écriture (`joindreBugsDetectes`, `lib/routes/reponses.ts`) : la valeur réelle reste
 * stockée en base telle quelle, seule sa RESTITUTION au prof est filtrée ici.
 */
const CODES_MASQUES_PROF = new Set(["FC_RACINE_FANTOME", "FORME_CANONIQUE_SIGNE_P", "C05_SIGNE_REPETE"]);

/** Assemble plusieurs codes déclenchés par la MÊME soumission en une seule valeur `bug_detecte` ; `[]` -> `null` (aucun bug, même convention que l'ancien `bugDetecte: string | null` à un seul code). */
export function joindreBugsDetectes(codes: string[]): string | null {
  return codes.length > 0 ? codes.join(SEPARATEUR_BUGS_MULTIPLES) : null;
}

/** Inverse de `joindreBugsDetectes` : `null` -> `[]`, un code isolé -> `[code]` (no-op), plusieurs codes joints -> chacun séparément ; `CODES_MASQUES_PROF` retirés ici (voir son commentaire). */
export function separerBugsDetectes(brut: string | null): string[] {
  if (brut === null) return [];
  return brut.split(SEPARATEUR_BUGS_MULTIPLES).filter((code) => !CODES_MASQUES_PROF.has(code));
}

/**
 * Prompt "Profil de compétences élève", Étape 2 — fonction pure. Entrée : `bug_detecte` de TOUTES
 * les réponses de l'élève, une entrée par ligne `reponses` (voir `lib/routes/profs/eleves/profil.ts`)
 * — chaque entrée peut désormais porter plusieurs codes joints (`separerBugsDetectes` ci-dessus),
 * chacun compté comme sa propre occurrence.
 *
 * **Correctif (signalé par l'utilisateur, cas réel "Nathan"/FC_CE_FANTOME)** : l'appelant dédupliquait
 * auparavant à "la dernière soumission par champ" avant d'appeler cette fonction — un même bug
 * déclenché 2 fois sur 2 champs distincts, chacun ensuite corrigé, disparaissait alors entièrement
 * (aucune des 2 occurrences n'étant la dernière soumission de son champ), alors que l'élève a bien
 * manifesté la lacune 2 fois. Décision explicite : compter TOUTES les occurrences historiques,
 * jamais dédupliquées par champ — "un élève qui s'est trompé deux fois avant de réussir a bien
 * manifesté cette lacune deux fois, peu importe qu'il ait fini par se corriger". Même règle
 * appliquée à `resumeBugs` de `gererProfsResultats` (`lib/routes/profs/resultats.ts`).
 *
 * Regroupe par code non nul, compte les occurrences, classe `non_maitrisee` (>= 2) ou
 * `en_observation` (= 1). Un code absent du dictionnaire (Étape 0 incomplète, ou nouveau détecteur
 * ajouté sans mise à jour du dictionnaire) n'est jamais éliminé silencieusement : `libelle`/
 * `description` retombent sur le code brut / une chaîne vide plutôt que de faire disparaître la
 * compétence.
 */
export function calculerProfilCompetences(bugsDetectes: (string | null)[]): CompetenceProfil[] {
  const occurrencesParCode = new Map<string, number>();
  for (const bug of bugsDetectes) {
    for (const code of separerBugsDetectes(bug)) {
      occurrencesParCode.set(code, (occurrencesParCode.get(code) ?? 0) + 1);
    }
  }

  const profil: CompetenceProfil[] = [...occurrencesParCode.entries()].map(([code, occurrences]) => {
    // `lirePropre` : jamais la chaîne de prototypes (un code « constructor » ne doit pas lire une fonction), RAPPORT.md §20.
    const entree = lirePropre(DICTIONNAIRE_COMPETENCES, code);
    const explication = lirePropre(EXPLICATIONS_COMPETENCES, code);
    const { categorie, sousCategorie } = categoriserCompetence(code);
    return {
      code,
      libelle: entree?.libelle ?? code,
      description: entree?.description ?? "",
      statut: occurrences >= 2 ? "non_maitrisee" : "en_observation",
      occurrences,
      explication: explication?.explication,
      exemple: explication?.exemple,
      explicationEleve: lirePropre(EXPLICATIONS_COMPETENCES_ELEVE, code),
      categorie,
      sousCategorie,
    };
  });

  // "Triée non_maitrisee en premier" (Étape 3 du prompt) ; ordre secondaire par occurrences
  // décroissantes non demandé explicitement mais nécessaire pour un ordre déterministe au sein de
  // chaque statut (sinon dépendant de l'ordre d'itération de la Map, non garanti stable).
  return profil.sort((a, b) => {
    if (a.statut !== b.statut) return a.statut === "non_maitrisee" ? -1 : 1;
    return b.occurrences - a.occurrences;
  });
}

export type TendanceCompetence = "en_progres" | "stable" | "toujours_difficile";

export interface EvolutionCompetence {
  code: string;
  tendance: TendanceCompetence;
  occurrencesRecentes: number;
  occurrencesAnciennes: number;
}

/**
 * Prompt "Onglets Tableau de bord/Résultats élève" — évolution d'une compétence non maîtrisée dans
 * le temps ("le fait qu'il arrive ou non à les combler", demande explicite de l'utilisateur).
 * Entrée : `bug_detecte` de TOUTES les réponses de l'élève, dans l'ordre CHRONOLOGIQUE CROISSANT
 * (ancien -> récent, à la charge de l'appelant — contrairement à `calculerProfilCompetences`
 * ci-dessus, l'ordre compte ici). Découpe la liste en 2 moitiés PAR NOMBRE DE RÉPONSES (jamais par
 * date calendaire fixe : reste pertinent aussi bien pour un élève actif depuis 2 semaines que depuis
 * 6 mois), compte les occurrences de chaque code dans chaque moitié, et n'émet une tendance QUE pour
 * les codes déjà `non_maitrisee` au sens de `calculerProfilCompetences` (>= 2 occurrences au total) —
 * un code vu une seule fois (`en_observation`) n'a pas encore de tendance à afficher.
 *
 * Règle symétrique, sans zone morte arbitraire : moins d'occurrences récentes que d'anciennes ->
 * `en_progres` ; plus -> `toujours_difficile` (inclut le cas d'un code absent de la moitié ancienne
 * et apparu dans la récente : une lacune qui s'aggrave n'est jamais lue comme un progrès) ; égal ->
 * `stable`.
 */
export function calculerEvolutionCompetences(bugsChronologiques: (string | null)[]): EvolutionCompetence[] {
  const profilGlobal = calculerProfilCompetences(bugsChronologiques);
  const codesNonMaitrises = new Set(profilGlobal.filter((c) => c.statut === "non_maitrisee").map((c) => c.code));
  if (codesNonMaitrises.size === 0) return [];

  const milieu = Math.floor(bugsChronologiques.length / 2);
  const compterParCode = (bugs: (string | null)[]): Map<string, number> => {
    const compte = new Map<string, number>();
    for (const bug of bugs) {
      for (const code of separerBugsDetectes(bug)) {
        if (!codesNonMaitrises.has(code)) continue;
        compte.set(code, (compte.get(code) ?? 0) + 1);
      }
    }
    return compte;
  };
  const anciennes = compterParCode(bugsChronologiques.slice(0, milieu));
  const recentes = compterParCode(bugsChronologiques.slice(milieu));

  return [...codesNonMaitrises].map((code) => {
    const occurrencesAnciennes = anciennes.get(code) ?? 0;
    const occurrencesRecentes = recentes.get(code) ?? 0;
    const tendance: TendanceCompetence =
      occurrencesRecentes < occurrencesAnciennes ? "en_progres" : occurrencesRecentes > occurrencesAnciennes ? "toujours_difficile" : "stable";
    return { code, tendance, occurrencesRecentes, occurrencesAnciennes };
  });
}

/**
 * Prompt "Résultats élève — barre de progression segmentée" — retour utilisateur explicite : "Rouge
 * = 0%, Vert = 100% [...] S'il y a eu 2 tâches qui ont expérimenté la compétence visée, la barre
 * sera en 2 couleurs dont la largeur sera égale à l'importance de la compétence visée par la tâche
 * (nombre d'exercices concernant la compétence visée)."
 *
 * **Correctif d'une 1re version dégénérée** (signalée par l'utilisateur via une capture d'écran :
 * toutes les tâches rouges malgré un badge "Tu progresses !") : la 1re définition du score était
 * "taux de correction finale DANS la même tâche" (parmi les exercices ayant manifesté le code,
 * combien ont une réponse finale correcte sur ce champ) — mais `tentatives_supplementaires` vaut `0`
 * par défaut sur une tâche (`lib/routes/taches.ts`) et `tentativesMaxDepuisReglages(0) === 1`
 * (`lib/moteurTentatives.ts`) : UNE SEULE tentative par champ par défaut, jamais de "correction" du
 * même champ dans la même tâche. Ce score valait donc quasi toujours 0 (rouge pur), pour n'importe
 * quel élève, y compris un élève qui progresse réellement — décorrélé du badge de tendance (lui basé
 * sur le nombre d'occurrences dans le temps, toutes tâches confondues, jamais une correction
 * intra-tâche).
 *
 * **Score actuel (2e version, DONNÉES-honnête)** : sévérité RELATIVE de la tâche, parmi les tâches de
 * l'élève ayant manifesté ce code — `score = 1 - (exercicesConcernes de cette tâche / exercicesConcernes
 * de la PIRE tâche de l'élève pour ce code)`. La pire tâche (le plus d'exercices concernés) est
 * toujours rouge pur (0) ; une tâche avec moins d'exercices concernés est plus verte. Raconte la même
 * histoire que le badge de tendance (moins d'occurrences = mieux), mais tâche par tâche plutôt
 * qu'un seul verdict global — et repose sur une donnée qui existe réellement (un compte
 * d'occurrences), jamais sur une correction qui n'arrive quasiment jamais par défaut.
 */
export interface ReponsePourSegmentsCompetence {
  tacheId: string;
  nomTache: string;
  exerciceAssigneId: string;
  champ: string;
  bugDetecte: string | null;
}

export interface SegmentCompetenceTache {
  tacheId: string;
  nomTache: string;
  /** "Importance" de la compétence dans cette tâche (pilote la LARGEUR du segment) : nombre
   * d'exercices distincts où ce code est apparu au moins une fois. */
  exercicesConcernes: number;
  /** `1 - exercicesConcernes / (exercicesConcernes de la pire tâche de l'élève pour ce code)`, dans
   * [0, 1] — pilote la COULEUR du segment (interpolation rouge à 0 -> vert à 1, jamais un dégradé de
   * fond fixe indépendant du score réel). Toujours 0 pour LA pire tâche (ou l'unique tâche s'il n'y
   * en a qu'une) — comparaison relative, jamais un seuil absolu. */
  score: number;
}

/**
 * Entrée : TOUTES les réponses concernées (n'importe quel ordre — l'ordre des segments RENVOYÉS suit
 * l'ordre d'apparition des tâches dans `reponses`, à la charge de l'appelant de passer un ordre
 * chronologique croissant, même convention que `calculerEvolutionCompetences`). Un segment par tâche
 * ayant manifesté `code` au moins une fois ; aucune tâche ne produisant jamais ce code -> tableau
 * vide (jamais une erreur).
 */
export function calculerSegmentsCompetence(reponses: ReponsePourSegmentsCompetence[], code: string): SegmentCompetenceTache[] {
  const parTache = new Map<string, { nomTache: string; cles: Set<string> }>();
  for (const r of reponses) {
    if (!separerBugsDetectes(r.bugDetecte).includes(code)) continue;
    if (!parTache.has(r.tacheId)) parTache.set(r.tacheId, { nomTache: r.nomTache, cles: new Set() });
    parTache.get(r.tacheId)!.cles.add(`${r.exerciceAssigneId}:${r.champ}`);
  }
  if (parTache.size === 0) return [];

  const pire = Math.max(...[...parTache.values()].map(({ cles }) => cles.size));

  return [...parTache.entries()].map(([tacheId, { nomTache, cles }]) => {
    const exercicesConcernes = cles.size;
    return { tacheId, nomTache, exercicesConcernes, score: 1 - exercicesConcernes / pire };
  });
}

export interface ReponsePourTempsCompetence {
  bugDetecte: string | null;
  dureeEcouleeSecondes: number | null;
}

/**
 * Prompt "Temps moyen par compétence — profil élève (renfort factuel, pas un nouveau diagnostic)" —
 * "un fait de plus à côté d'un autre, jamais une nouvelle interprétation [...] juste le chiffre
 * brut". Entrée : TOUTES les réponses de l'élève (n'importe quel ordre, aucun regroupement
 * chronologique nécessaire ici, contrairement à `calculerEvolutionCompetences`/
 * `calculerSegmentsCompetence`) — `bug_detecte`/`duree_ecoulee_secondes` coexistent déjà sur la
 * même ligne `reponses` (confirmé, `supabase/schema.sql:187-217`), donc aucune jointure séparée
 * nécessaire : l'appelant HTTP passe simplement les lignes déjà chargées pour `bugsDetectes`
 * ci-dessus.
 *
 * Repère `separerBugsDetectes` (pas une simple égalité `bug_detecte === code`, volontairement
 * différente du corps de fonction indicatif du prompt) : une ligne peut porter PLUSIEURS codes
 * joints par une virgule (gen8/gen9, "Option B" — voir `separerBugsDetectes` plus haut) ; un code
 * co-déclenché avec un autre sur la même soumission doit compter cette durée au même titre qu'une
 * occurrence isolée.
 *
 * Moyenne calculée UNIQUEMENT sur les occurrences avec `dureeEcouleeSecondes` non nul ; un code dont
 * TOUTES les occurrences sont `null` (mesure fiable absente, antérieure à §165) n'a AUCUNE entrée
 * dans la Map retournée — jamais `0` ni une entrée pour un calcul sur 0 valeur.
 */
export function tempsMoyenParCompetence(reponses: ReponsePourTempsCompetence[]): Map<string, number> {
  const dureesParCode = new Map<string, number[]>();
  for (const r of reponses) {
    if (r.dureeEcouleeSecondes === null) continue;
    for (const code of separerBugsDetectes(r.bugDetecte)) {
      const liste = dureesParCode.get(code) ?? [];
      liste.push(r.dureeEcouleeSecondes);
      dureesParCode.set(code, liste);
    }
  }
  const resultat = new Map<string, number>();
  for (const [code, durees] of dureesParCode) {
    const moy = moyenne(durees);
    if (moy !== null) resultat.set(code, moy);
  }
  return resultat;
}
