import type { SegmentFormule, AideFormuleColoree } from "../../../lib/aideTypee";
import { latexRatAbsolu } from "../_noyauQuadratique/formatage";
import { signeR } from "../analyseFonctionMotifDelta/exact/rationnel";
import { parametres, coefficientsDeveloppes, type ExerciceCc } from "./types";

/**
 * Aide de l'écran 1 de gen9 (RAPPORT §59) : une `formule_coloree` à DEUX paliers (le serveur ne sert que le palier demandé, état dans `aides_utilisees.palier`, pénalité binaire).
 *   - Palier 1 : le coefficient `a` mis en facteur sur les deux premiers termes, `f(x) = a(x² ± (b/a)x) ± c` — numérique, ÉQUIVALENT à `f` (il ne montre rien de plus que l'énoncé) ; rôles `a` et `c`.
 *   - Palier 2 : le schéma GÉNÉRAL `a[(x + b/2a)² − (b/2a)²] + c`, SYMBOLIQUE et donc identique pour tous les exercices (la valeur numérique de `(b/2a)²` donnerait `p²`) ; la quantité ajoutée puis
 *     retranchée est en EMPHASE neutre (jamais une couleur de verdict ni un rôle de coefficient).
 */
export const LEGENDE_PALIER_1 = "On met le coefficient $a$ de $x^2$ en facteur sur les deux premiers termes ; la constante $c$ reste à part.";
export const LEGENDE_PALIER_2 = "Pour compléter le carré, on ajoute puis on retranche la quantité en évidence ; le facteur $a$ multiplie tout le crochet, donc aussi ce qu'on retranche.";

/** Schéma du palier 2 : aucune valeur numérique propre à l'exercice (les `2` sont ceux de la formule). */
export const SEGMENTS_PALIER_2: SegmentFormule[] = [
  { latex: "f(x) = " },
  { latex: "a", role: "a" },
  { latex: "\\left[\\left(x + \\dfrac{b}{2a}\\right)^2 - " },
  { latex: "\\left(\\dfrac{b}{2a}\\right)^2", emphase: true },
  { latex: "\\right] + " },
  { latex: "c", role: "c" },
];

export function aideFormeCanonique(ex: ExerciceCc): AideFormuleColoree {
  const v = parametres(ex);
  const { a, c } = coefficientsDeveloppes(v);
  const facteur: SegmentFormule[] = a.n === 1 && a.d === 1 ? [] : a.n === -1 && a.d === 1 ? [{ latex: "-" }] : [{ latex: `${signeR(a) < 0 ? "-" : ""}${latexRatAbsolu(a)}`, role: "a" }];
  // b / a = −2p : un entier (p est entier), jamais nul (TH toujours active).
  const bSurA = -2 * v.p.n;
  const terme = `${bSurA < 0 ? "-" : "+"} ${Math.abs(bSurA) === 1 ? "" : Math.abs(bSurA)}x`;
  const premiersTermes: SegmentFormule = { latex: `\\left(x^2 ${terme}\\right)` };
  const constante: SegmentFormule[] = signeR(c) === 0 ? [] : [{ latex: ` ${signeR(c) < 0 ? "-" : "+"} ` }, { latex: latexRatAbsolu(c), role: "c" }];
  return {
    type: "formule_coloree",
    paliers: [
      { legende: LEGENDE_PALIER_1, segments: [{ latex: "f(x) = " }, ...facteur, premiersTermes, ...constante] },
      { legende: LEGENDE_PALIER_2, segments: SEGMENTS_PALIER_2 },
    ],
  };
}
