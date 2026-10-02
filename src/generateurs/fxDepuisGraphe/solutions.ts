import { texteFonction } from "./formatage";
import { CHAMP_EXPRESSION } from "./ecrans";
import { parametres, type ExerciceFx } from "./types";

/** Solution lisible d'un champ : la forme canonique SANS terme neutre (`$f(x) = 2(x - 3)^2 + 1$`). */
export function solutionAttendueFx(ex: ExerciceFx, champ: string): string {
  if (champ === CHAMP_EXPRESSION) return texteFonction(parametres(ex));
  throw new Error(`fx_depuis_graphe : champ inconnu « ${champ} »`);
}
