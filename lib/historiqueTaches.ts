/**
 * Prompt "Onglets Tableau de bord/Résultats élève" — historique des tâches notées côté élève
 * ("ses scores et sa progression/évolution dans ses scores", demande explicite de l'utilisateur).
 */
export interface ScoreTache {
  tacheId: string;
  nomTache: string;
  /** Horodatage ISO de la dernière réponse de cette tâche — jamais `date_echeance` (date limite,
   * pas date réelle de travail) ni `date_creation` de l'exercice (pas quand l'élève l'a fait). */
  date: string;
  correct: number;
  total: number;
}

export type TendanceScore = "en_progression" | "stable" | "en_baisse";

const SEUIL_BRUIT_POINTS = 5;

/**
 * Compare la moyenne de réussite des `fenetre` dernières tâches notées (chronologiquement) à celle
 * des `fenetre` précédentes (ou de tout ce qui est disponible si moins de `fenetre`) — jamais un
 * point à point (trop bruité sur un score isolé). Un écart inférieur à `SEUIL_BRUIT_POINTS` points de
 * pourcentage est lu comme `stable`, pas comme un progrès/une baisse marginale. Moins de 2 tâches
 * notées au total (une seule moyenne calculable) : pas de tendance significative, `stable` par défaut.
 */
export function calculerTendanceScore(scoresChronologiques: ScoreTache[], fenetre = 3): TendanceScore {
  const avecTotal = scoresChronologiques.filter((s) => s.total > 0);
  if (avecTotal.length < 2) return "stable";

  const recentes = avecTotal.slice(-fenetre);
  const anciennes = avecTotal.slice(0, -fenetre);
  if (anciennes.length === 0) return "stable";

  const moyenne = (scores: ScoreTache[]): number => scores.reduce((s, t) => s + t.correct / t.total, 0) / scores.length;
  const ecartPoints = (moyenne(recentes) - moyenne(anciennes)) * 100;

  if (ecartPoints > SEUIL_BRUIT_POINTS) return "en_progression";
  if (ecartPoints < -SEUIL_BRUIT_POINTS) return "en_baisse";
  return "stable";
}
