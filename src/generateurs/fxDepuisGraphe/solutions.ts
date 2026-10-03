import { texteFonction } from "../_noyauQuadratique/formatage";
import { solutionChaine } from "../_noyauQuadratique/solutionChaine";
import { fonctionEffective } from "./cascade";
import { CHAMP_CHAINE, CHAMP_EXPRESSION } from "./ecrans";
import { parametres, type ExerciceFx } from "./types";

/**
 * Solution lisible d'un champ. Écran 1 : la forme canonique SANS terme neutre. Écran 2 : une chaîne valide pour la fonction EFFECTIVE (noyau partagé, `solutionChaine`) ; ce texte reprend la
 * fonction visée, donc n'est servi que par les portes habituelles de la solution (RAPPORT §42).
 */
export function solutionAttendueFx(ex: ExerciceFx, champ: string): string {
  if (champ === CHAMP_EXPRESSION) return texteFonction(parametres(ex));
  if (champ === CHAMP_CHAINE) return solutionChaine(fonctionEffective(ex), ex.actives);
  throw new Error(`fx_depuis_graphe : champ inconnu « ${champ} »`);
}
