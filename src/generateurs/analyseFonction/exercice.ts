import type { Prng } from "../../../lib/prng";
import { creerPrng } from "../../../lib/prng";
import { termesNonNuls, type Terme } from "./formatage";
import { factorisationVersLatex } from "./cascade";
import { genererRacines } from "./racines";
import { CATEGORIES_AVEC_RACINES, type CategorieRacines } from "./racines/types";
import type { AffichageColonnes } from "./tableauSignes";
import { fonctionDe, type CategorieAnalyseFonction, type FonctionSecondDegre } from "./types";

/**
 * Exercice de gen7 (JSON-sérialisable, sans `undefined`), régénéré à chaque appel depuis `exercices_assignes.graine`.
 *
 * ── ORDRE DES TIRAGES DU PRNG (contractuel pour le `variante_id` `_v1` : toute modification impose `_v2`, CLAUDE.md) ──
 *  1. les tirages propres à la catégorie :
 *     - `mise_en_evidence`, `binome_conjugue`, `produit_remarquable` : ceux de `genererRacines` (3b-2 : `a = entierEntre(1, 4)`, puis
 *       `r` — par rejet de 0 dans [−5, 5] pour la mise en évidence et le produit remarquable, `entierEntre(1, 5)` pour le binôme) ;
 *     - `irreductible` : `a` dans [−4, 4] par rejet de 0 (nombre de tirages VARIABLE), `m = entierEntre(−4, 4)`,
 *       `marge = entierEntre(1, 4)` ; `b = a·m`, `c = ceil(b²/4a) + marge` (a > 0) ou `floor(b²/4a) − marge` (a < 0) : Δ < 0 par
 *       construction (`pilote:src/generateurs/analyseFonction/categories/irreductible.ts` @ 6acc102) ;
 *  2. PUIS l'ordre d'affichage des termes non nuls de `f` : mélange de Fisher-Yates, un tirage `suivant()` par position de
 *     `i = n−1` à `1` (aucun tirage s'il n'y a qu'un terme).
 * `xS = −b/(2a)` ∈ ½ℤ et `yS` ∈ ¼ℤ pour les quatre catégories : jamais de flottant approché.
 */
export interface DonneesZeros {
  /** Racines attendues de `racinesChamp2` (`[r, r]` pour une racine double). */
  racines: [number, number];
  /** Corps LaTeX (sans `$`, sans « = 0 ») de l'équation affichée à l'écran `racinesChamp2`. */
  factorisationLatex: string;
  /**
   * D'où vient l'équation affichée (RAPPORT §18) : `solution` = la vraie factorisation (exercice BRUT, ou repli sous correction
   * immédiate : elle vient d'être révélée) ; `eleve` = la factorisation CONFIRMÉE par l'élève, ré-écrite (jamais sa chaîne brute) ;
   * `enonce` = repli sous correction coupée : l'équation développée, publique, qui ne révèle rien.
   */
  origine: "solution" | "eleve" | "enonce";
}

export interface ExerciceAnalyseFonction {
  fonction: FonctionSecondDegre;
  ordreTermes: Terme[];
  /** Solution de `racinesChamp1` (texte d'auteur), `null` pour `af_irreductible`. */
  formeFactorisee: string | null;
  /** Donnée EFFECTIVE de `racinesChamp2` (vraie dans l'exercice brut, issue de la réponse confirmée après projection), `null` si irréductible. */
  zeros: DonneesZeros | null;
  /** Ce que le tableau montre de ses valeurs de x : vraies (correction immédiate) ou symboliques (correction coupée). */
  affichageTableau: AffichageColonnes;
  /** Écrans RÉUSSIS que le panneau « Ce que tu sais déjà » peut rappeler : toujours vide dans l'exercice brut et sous correction coupée. */
  corrects: readonly string[];
}

function melanger<T>(valeurs: readonly T[], prng: Prng): T[] {
  const copie = [...valeurs];
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(prng.suivant() * (i + 1));
    [copie[i], copie[j]] = [copie[j] as T, copie[i] as T];
  }
  return copie;
}

export function construireIrreductible(a: number, m: number, marge: number): { a: number; b: number; c: number } {
  if (!Number.isInteger(a) || a === 0 || Math.abs(a) > 4) throw new Error(`construireIrreductible : a entier non nul de [−4, 4] attendu (reçu ${a})`);
  const b = a * m;
  const seuil = (b * b) / (4 * a);
  return { a, b, c: a > 0 ? Math.ceil(seuil) + marge : Math.floor(seuil) - marge };
}

export function genererExercice(categorie: CategorieAnalyseFonction, graine: number): ExerciceAnalyseFonction {
  const prng = creerPrng(graine);
  let fonction: FonctionSecondDegre;
  let formeFactorisee: string | null = null;
  if (categorie === "irreductible") {
    let a = 0;
    while (a === 0) a = prng.entierEntre(-4, 4);
    const m = prng.entierEntre(-4, 4);
    const marge = prng.entierEntre(1, 4);
    const { b, c } = construireIrreductible(a, m, marge);
    fonction = fonctionDe("irreductible", a, b, c);
  } else {
    if (!(CATEGORIES_AVEC_RACINES as readonly string[]).includes(categorie)) throw new Error(`genererExercice : catégorie inconnue « ${String(categorie)} »`);
    const d = genererRacines(categorie as CategorieRacines, prng);
    fonction = fonctionDe(categorie, d.a, d.b, d.c);
    formeFactorisee = d.formeFactorisee;
    if (fonction.racines === null || fonction.racines[0] !== d.racines[0] || fonction.racines[1] !== d.racines[1]) throw new Error(`genererExercice : racines incohérentes pour ${categorie} (${String(fonction.racines)} contre ${d.racines.join()})`);
  }
  const ordreTermes = melanger(termesNonNuls(fonction), prng);
  const latex = formeFactorisee === null ? null : factorisationVersLatex(formeFactorisee);
  return {
    fonction,
    ordreTermes,
    formeFactorisee,
    zeros: fonction.racines === null || latex === null ? null : { racines: fonction.racines, factorisationLatex: latex, origine: "solution" },
    affichageTableau: "vraies",
    corrects: [],
  };
}
