import { moyenne } from "./tempsExercice";
import { labelPourVariante } from "./catalogueGenerateurs";

/**
 * Prompt "Tendance du temps de réponse — onglet Résultats (côté élève)". Fichier séparé de
 * `lib/historiqueTaches.ts` (qui porte `calculerTendanceScore`) plutôt qu'ajouté à ses côtés :
 * `historiqueTaches.ts` raisonne au niveau TÂCHE (un score par tâche notée), alors que ce calcul
 * raisonne au niveau EXERCICE, groupé par `variante_id` — domaine différent, même s'il en reprend
 * la méthode (voir ci-dessous).
 */
export interface ExerciceTempsPourTendance {
  varianteId: string;
  /** `exercices_assignes.date_creation` — ordre chronologique de génération de l'exercice, pas de
   * résolution (aucun horodatage de "fin d'exercice" n'existe ; cohérent avec le tri déjà utilisé
   * ailleurs dans ce fichier de calcul pur, qui ne connaît que ce qu'on lui donne). */
  dateCreation: string;
  /** Résultat de `tempsTotalExerciceDepuisReponses` (lib/tempsExercice.ts) — `null` si aucune
   * donnée de temps exploitable pour cet exercice ; ces lignes sont ignorées ci-dessous. */
  tempsTotal: number | null;
}

export interface TendanceTempsVariante {
  varianteId: string;
  label: string;
}

/**
 * Même fenêtre que `calculerTendanceScore` (lib/historiqueTaches.ts, `fenetre = 3` par défaut) :
 * moyenne des `fenetre` derniers exercices d'une variante comparée à la moyenne de tous les
 * précédents. Une variante avec `avecTemps.length <= fenetre` n'a pas de groupe "ancien" non vide
 * (même garde que `calculerTendanceScore` : `anciennes.length === 0` -> ignorée), donc pas de
 * tendance calculable — reproduit à l'identique la condition de taille minimale de
 * `calculerTendanceScore`, pas un seuil inventé séparément.
 */
const FENETRE = 3;

/**
 * Seuil réutilisé de `calculerTendanceScore` (`SEUIL_BRUIT_POINTS = 5`, lib/historiqueTaches.ts) —
 * MÊME valeur numérique (5), mais nécessairement réinterprétée : `calculerTendanceScore` compare
 * des fractions correct/total (déjà un ratio dans [0, 1], donc "5 points" = "5% de réussite en
 * plus"). Un temps de réponse n'a pas d'échelle bornée comparable (un exercice peut durer 10s ou
 * 300s selon la variante) — un écart de "5 secondes" n'aurait aucune signification commune d'une
 * variante à l'autre, ce que "5 points de pourcentage" a pour un score. Diverge donc du calcul de
 * score sur CE point précis (documenté ici, comme demandé) : au lieu d'un écart de points bruts,
 * on calcule un pourcentage RELATIF d'amélioration ((ancien - récent) / ancien * 100), et on
 * compare ce pourcentage au même seuil numérique 5 — donc "récent au moins 5% plus rapide que
 * l'ancien", même notion de seuil de bruit minimal que le score, exprimée dans l'unité qui a un
 * sens pour un temps (une proportion relative, pas un écart absolu).
 */
const SEUIL_AMELIORATION_POURCENT = 5;

/**
 * Retourne la variante avec la tendance de temps la plus nettement positive (amélioration relative
 * la plus forte parmi celles qui dépassent le seuil), ou `null` s'il n'y en a aucune — jamais de
 * régression ni de "stable" signalés ici (contrairement à `calculerTendanceScore`, à 3 états) :
 * "jamais de message négatif ou neutre [...] si la tendance n'est pas positive, ou s'il n'y a pas
 * assez de données, ne rien afficher du tout" (prompt, principe non négociable).
 */
export function calculerTendanceTemps(exercices: ExerciceTempsPourTendance[], fenetre = FENETRE): TendanceTempsVariante | null {
  const parVariante = new Map<string, ExerciceTempsPourTendance[]>();
  for (const ex of exercices) {
    if (ex.tempsTotal === null) continue;
    if (!parVariante.has(ex.varianteId)) parVariante.set(ex.varianteId, []);
    parVariante.get(ex.varianteId)!.push(ex);
  }

  let meilleure: { varianteId: string; ameliorationPourcent: number } | null = null;

  for (const [varianteId, avecTemps] of parVariante) {
    if (avecTemps.length <= fenetre) continue; // pas de groupe "ancien" non vide, même garde que calculerTendanceScore

    const triees = [...avecTemps].sort((a, b) => (a.dateCreation < b.dateCreation ? -1 : a.dateCreation > b.dateCreation ? 1 : 0));
    const recentes = triees.slice(-fenetre);
    const anciennes = triees.slice(0, -fenetre);

    const moyenneRecente = moyenne(recentes.map((e) => e.tempsTotal as number));
    const moyenneAncienne = moyenne(anciennes.map((e) => e.tempsTotal as number));
    if (moyenneRecente === null || moyenneAncienne === null || moyenneAncienne <= 0) continue;

    const ameliorationPourcent = ((moyenneAncienne - moyenneRecente) / moyenneAncienne) * 100;
    if (ameliorationPourcent <= SEUIL_AMELIORATION_POURCENT) continue;

    if (meilleure === null || ameliorationPourcent > meilleure.ameliorationPourcent) {
      meilleure = { varianteId, ameliorationPourcent };
    }
  }

  if (meilleure === null) return null;
  return { varianteId: meilleure.varianteId, label: labelPourVariante(meilleure.varianteId) ?? meilleure.varianteId };
}
