import type { Generateur } from "./contratGenerateur";

/**
 * Forme DESSINABLE de la solution d'un champ (RAPPORT §53) : une `reponse_brute` valide de l'écran, que le composant d'écran affiche en lecture seule (le tableau de signes rempli,
 * « semblable au tableau à compléter »). C'est une information de la MÊME nature que `solution_attendue` (la même solution, autrement écrite) : elle est donc servie sous la MÊME porte,
 * jamais une porte à part. `solutionAttendue === null` (verdict seul, correction coupée, champ pas encore révélé) → `null`, quel que soit le générateur. Les deux routes qui servent
 * `solution_attendue` (POST /api/reponses, GET /api/exercices/:id) passent ICI ; ne jamais appeler `Generateur.solutionStructuree` ailleurs.
 */
export function solutionStructureeSiMontree<TExercice>(
  generateur: Pick<Generateur<TExercice>, "solutionStructuree">,
  exercice: TExercice,
  champ: string,
  solutionAttendue: string | null,
): string | null {
  if (solutionAttendue === null) return null;
  return generateur.solutionStructuree?.(exercice, champ) ?? null;
}
