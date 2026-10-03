import { chaineCanonique, parametreEtape, POLYNOME_DEPART, transformationsAdmises } from "./chaine";
import { latexFonction, latexRatAbsolu } from "./formatage";
import { signeR } from "./polynome";
import { polynomeDe, type Parametres, type Transformation } from "./types";

/**
 * Solution lisible de l'écran « chaîne » (commune à gen8 et gen9) : une chaîne valide pour la fonction EFFECTIVE `g` (ordre TH, EV | CV, SOX, TV), chaque étape avec la fonction obtenue et la
 * valeur déclarée (RAPPORT §58) ; ce texte reprend la fonction visée, donc n'est servi que par les portes habituelles de la solution (RAPPORT §42).
 */
export function solutionChaine(g: Parametres, actives: readonly Transformation[]): string {
  const chaine = chaineCanonique(g, transformationsAdmises(actives, g));
  if (chaine === null) throw new Error("chaîne de transformations : aucune chaîne n'atteint la fonction effective (bug de transformationsAdmises)");
  let avant = POLYNOME_DEPART;
  const etapes = chaine.map((e, i) => {
    const apres = polynomeDe(e.apres);
    const valeur = parametreEtape(e.transformation, avant, apres);
    avant = apres;
    // La valeur déclarée à côté de chaque transformation (RAPPORT §58) : signée pour TH et TV, le facteur pour EV et CV, aucune pour SOX.
    const declaree = valeur === null || e.transformation === "SOX" ? "" : ` (valeur $${signeR(valeur) < 0 ? "-" : ""}${latexRatAbsolu(valeur)}$)`;
    return `étape ${i + 1}, ${e.transformation}${declaree} : $f_{${i + 1}}(x) = ${latexFonction(e.apres)}$`;
  });
  return `Une chaîne possible, à partir de $x^2$ : ${etapes.join(" ; ")}.`;
}
