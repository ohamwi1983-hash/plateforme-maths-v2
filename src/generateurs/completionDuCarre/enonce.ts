import { signeR, type Rat } from "../analyseFonctionMotifDelta/exact/rationnel";
import { latexRatAbsolu } from "../_noyauQuadratique/formatage";
import { coefficientsDeveloppes, parametres, type ExerciceCc } from "./types";

/**
 * Énoncé de gen9 : `f(x) = ax² + bx + c` DÉVELOPPÉ, termes dans l'ordre mélangé de l'exercice (`ex.ordre`, jamais l'ordre canonique). Texte d'AUTEUR (LaTeX sans `$` externe). Un coefficient de
 * valeur absolue 1 ne s'écrit pas (`x²`, `-x`), un terme nul est absent, le signe du premier terme est collé (`-3x`), les suivants séparés par ` + ` ou ` - `.
 */
const PUISSANCES = ["x^2", "x", ""] as const;

/** Un terme sans son signe : `2x^2`, `\dfrac{3}{2}x`, `x`, `5`. */
function termeSansSigne(coefficient: Rat, indice: number): string {
  const unite = coefficient.d === 1 && Math.abs(coefficient.n) === 1;
  const puissance = PUISSANCES[indice] as string;
  if (puissance === "") return latexRatAbsolu(coefficient); // le terme constant s'écrit toujours (1 compris)
  return `${unite ? "" : latexRatAbsolu(coefficient)}${puissance}`;
}

/** Les termes affichés, dans l'ordre de l'exercice : `{ indice, coefficient }`. */
export function termesAffiches(ex: ExerciceCc): { indice: number; coefficient: Rat }[] {
  const { a, b, c } = coefficientsDeveloppes(parametres(ex));
  const parIndice = [a, b, c];
  return ex.ordre.map((indice) => ({ indice, coefficient: parIndice[indice] as Rat }));
}

/** `ax^2 + bx + c` (sans `f(x) =`), dans l'ordre de l'exercice. */
export function latexDeveloppe(ex: ExerciceCc): string {
  return termesAffiches(ex)
    .map(({ indice, coefficient }, rang) => {
      const signe = signeR(coefficient) < 0 ? "-" : "+";
      const corps = termeSansSigne(coefficient, indice);
      return rang === 0 ? `${signe === "-" ? "-" : ""}${corps}` : ` ${signe} ${corps}`;
    })
    .join("");
}

export const latexFonctionDeveloppee = (ex: ExerciceCc): string => `f(x) = ${latexDeveloppe(ex)}`;
