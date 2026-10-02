import { chaineCanonique, transformationsAdmises } from "./chaine";
import { fonctionEffective } from "./cascade";
import { CHAMP_CHAINE, CHAMP_EXPRESSION } from "./ecrans";
import { latexFonction, texteFonction } from "./formatage";
import { parametres, type ExerciceFx } from "./types";

/**
 * Solution lisible d'un champ. Écran 1 : la forme canonique SANS terme neutre. Écran 2 : une chaîne valide pour la fonction EFFECTIVE (ordre TH, EV | CV, SOX, TV), chaque étape avec la
 * fonction obtenue ; ce texte reprend la fonction visée, donc n'est servi que par les portes habituelles de la solution (RAPPORT §42).
 */
export function solutionAttendueFx(ex: ExerciceFx, champ: string): string {
  if (champ === CHAMP_EXPRESSION) return texteFonction(parametres(ex));
  if (champ === CHAMP_CHAINE) {
    const g = fonctionEffective(ex);
    const chaine = chaineCanonique(g, transformationsAdmises(ex.actives, g));
    if (chaine === null) throw new Error("fx_depuis_graphe : aucune chaîne n'atteint la fonction effective (bug de transformationsAdmises)");
    return `Une chaîne possible, à partir de $x^2$ : ${chaine.map((e, i) => `étape ${i + 1}, ${e.transformation} : $${latexFonction(e.apres)}$`).join(" ; ")}.`;
  }
  throw new Error(`fx_depuis_graphe : champ inconnu « ${champ} »`);
}
