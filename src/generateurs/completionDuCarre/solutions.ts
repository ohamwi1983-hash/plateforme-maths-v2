import { texteFonction } from "../_noyauQuadratique/formatage";
import { solutionChaine } from "../_noyauQuadratique/solutionChaine";
import { fonctionEffective } from "./cascade";
import { CHAMP_CHAINE, CHAMP_FORME } from "./ecrans";
import { parametres, type ExerciceCc } from "./types";

/**
 * Solution lisible d'un champ. Écran 1 : la forme canonique SANS terme neutre (`q = 0` s'écrit sans constante : le lecteur l'accepte). Écran 2 : une chaîne valide pour la fonction EFFECTIVE
 * (noyau partagé, `solutionChaine`) ; ces textes reprennent la fonction visée, donc ne sont servis que par les portes habituelles de la solution (RAPPORT §42).
 */
export function solutionAttendueCc(ex: ExerciceCc, champ: string): string {
  if (champ === CHAMP_FORME) return texteFonction(parametres(ex));
  if (champ === CHAMP_CHAINE) return solutionChaine(fonctionEffective(ex), ex.actives);
  throw new Error(`completion_du_carre : champ inconnu « ${champ} »`);
}
