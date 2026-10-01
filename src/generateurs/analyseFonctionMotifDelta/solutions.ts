import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE } from "../analyseFonction/types";
import { allureAttendue } from "./allure";
import { latexExact, texteSaisieExact, type Exact } from "./exact/nombreExact";
import { coefVersExact, fonctionEffective, type ExerciceMotifDelta } from "./types";

/**
 * Solution lisible d'un champ (texte d'AUTEUR, balisage `$…$`, racines en KaTeX `\sqrt{}` — jamais `sqrt(…)` en clair) et réponse brute qui VALIDE le champ (tests, Chromium). Les entrées
 * sont celles de l'exercice EFFECTIF passé en argument (RAPPORT §38).
 */
const yImage = (ex: ExerciceMotifDelta): Exact => (ex.effectif.yImage === null ? fonctionEffective(ex).yS : coefVersExact(ex.effectif.yImage));

export function solutionAttendueMotifDelta(ex: ExerciceMotifDelta, champ: string): string {
  const f = fonctionEffective(ex);
  switch (champ) {
    case CHAMP_COEFFICIENTS:
      return `$a = ${latexExact(coefVersExact(ex.a))}$ ; $b = ${latexExact(coefVersExact(ex.b))}$ ; $c = ${latexExact(coefVersExact(ex.c))}$`;
    case CHAMP_ALLURE: {
      const { concavite, position } = allureAttendue(f);
      return `${concavite === "+" ? "vers le haut" : "vers le bas"} ; $x_S ${position === "gauche" ? "<" : position === "axe" ? "=" : ">"} 0$`;
    }
    case CHAMP_AXE_SOMMET:
      return `$x = ${latexExact(f.xS)}$ ; $x_S = ${latexExact(f.xS)}$ ; $y_S = ${latexExact(f.yS)}$`;
    case CHAMP_DOMAINE_IMAGE:
      return f.a.n > 0 ? `$[${latexExact(yImage(ex))}\\,;\\,+\\infty[$` : `$]-\\infty\\,;\\,${latexExact(yImage(ex))}]$`;
    default:
      throw new Error(`gen7 motif/delta : champ inconnu ou non encore câblé « ${champ} »`);
  }
}

export function reponseBruteCorrecteMotifDelta(ex: ExerciceMotifDelta, champ: string): string {
  const f = fonctionEffective(ex);
  switch (champ) {
    case CHAMP_COEFFICIENTS:
      return JSON.stringify({ a: texteSaisieExact(coefVersExact(ex.a)), b: texteSaisieExact(coefVersExact(ex.b)), c: texteSaisieExact(coefVersExact(ex.c)) });
    case CHAMP_ALLURE: {
      const { concavite, position } = allureAttendue(f);
      return JSON.stringify({ concavite, positionSommet: position });
    }
    case CHAMP_AXE_SOMMET:
      return JSON.stringify({ axeTexte: `x = ${texteSaisieExact(f.xS)}`, xS: texteSaisieExact(f.xS), yS: texteSaisieExact(f.yS) });
    case CHAMP_DOMAINE_IMAGE: {
      const y = texteSaisieExact(yImage(ex));
      return JSON.stringify(f.a.n > 0 ? { crochetGauche: "[", borneGauche: y, crochetDroit: "[", borneDroite: "+inf" } : { crochetGauche: "]", borneGauche: "-inf", crochetDroit: "]", borneDroite: y });
    }
    default:
      throw new Error(`gen7 motif/delta : champ inconnu ou non encore câblé « ${champ} »`);
  }
}

