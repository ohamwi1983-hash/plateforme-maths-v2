import { factorisationVersLatex } from "./cascade";
import type { ExerciceAnalyseFonction } from "./exercice";
import { latexNombre, texteNombre } from "./formatage";
import { latexRacine } from "./formatage";
import { reponseBruteZerosCorrecte } from "./racines";
import { CHAMP_RACINES_FACTORISATION, CHAMP_RACINES_ZEROS } from "./racines/types";
import { CHOIX_RECONNAISSANCE } from "./reconnaissance";
import { rangeesTableau, solutionTableau } from "./tableauSignes";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE, CHAMP_RECONNAISSANCE, CHAMP_TABLEAU_SIGNES } from "./types";
import { signeDe } from "./allure";

/** Solution lisible d'un champ (texte d'auteur, balisage `$…$`) : `axeSommet` écrit `x = …` (l'ancien pilote l'omettait, D8). */
export function solutionAttendueAnalyseFonction(ex: ExerciceAnalyseFonction, champ: string): string {
  const f = ex.fonction;
  switch (champ) {
    case CHAMP_COEFFICIENTS:
      return `$a = ${f.a}$ ; $b = ${f.b}$ ; $c = ${f.c}$`;
    case CHAMP_ALLURE:
      return `$a ${f.a > 0 ? ">" : "<"} 0$ ; $ab ${signeDe(f.a * f.b) === "0" ? "=" : signeDe(f.a * f.b) === "+" ? ">" : "<"} 0$`;
    case CHAMP_AXE_SOMMET:
      return `$x = ${latexNombre(f.xS)}$ ; $x_S = ${latexNombre(f.xS)}$ ; $y_S = ${latexNombre(f.yS)}$`;
    case CHAMP_DOMAINE_IMAGE:
      return f.a > 0 ? `$[${latexNombre(f.yS)}\\,;\\,+\\infty[$` : `$]-\\infty\\,;\\,${latexNombre(f.yS)}]$`;
    case CHAMP_RECONNAISSANCE:
      return (CHOIX_RECONNAISSANCE.find((c) => c.id === f.categorie) as { libelle: string }).libelle;
    case CHAMP_RACINES_FACTORISATION: {
      const latex = ex.formeFactorisee === null ? null : factorisationVersLatex(ex.formeFactorisee);
      if (latex === null) throw new Error("gen7 : racinesChamp1 n'existe pas pour af_irreductible");
      return `$${latex}$`;
    }
    case CHAMP_RACINES_ZEROS: {
      if (ex.zeros === null) throw new Error("gen7 : racinesChamp2 n'existe pas pour af_irreductible");
      const [r1, r2] = ex.zeros.racines;
      return r1 === r2 ? `$${latexRacine(r1)}$` : `$${latexRacine(r1)}$ ; $${latexRacine(r2)}$`;
    }
    case CHAMP_TABLEAU_SIGNES: {
      const sol = solutionTableau(f);
      return rangeesTableau(f)
        .map((rangee) => `${rangee.ligne === "signe" ? "Signe" : "Variations"} : ${rangee.cellules.map((c) => (sol[rangee.ligne] as Record<string, string>)[c.ancre]).join(" ")}`)
        .join(" ; ");
    }
    default:
      throw new Error(`gen7 : champ inconnu « ${champ} »`);
  }
}

/** Réponse brute qui VALIDE le champ (tests, Chromium). Les entrées sont celles de l'exercice EFFECTIF passé en argument. */
export function reponseBruteCorrecteAnalyseFonction(ex: ExerciceAnalyseFonction, champ: string): string {
  const f = ex.fonction;
  switch (champ) {
    case CHAMP_COEFFICIENTS:
      return JSON.stringify({ a: String(f.a), b: String(f.b), c: String(f.c) });
    case CHAMP_ALLURE:
      return JSON.stringify({ signeA: signeDe(f.a), signeAB: signeDe(f.a * f.b) });
    case CHAMP_AXE_SOMMET:
      return JSON.stringify({ axeTexte: `x = ${texteNombre(f.xS)}`, xS: texteNombre(f.xS), yS: texteNombre(f.yS) });
    case CHAMP_DOMAINE_IMAGE:
      return JSON.stringify(f.a > 0 ? { crochetGauche: "[", borneGauche: texteNombre(f.yS), crochetDroit: "[", borneDroite: "+inf" } : { crochetGauche: "]", borneGauche: "-inf", crochetDroit: "]", borneDroite: texteNombre(f.yS) });
    case CHAMP_RECONNAISSANCE:
      return f.categorie;
    case CHAMP_RACINES_FACTORISATION:
      if (ex.formeFactorisee === null) throw new Error("gen7 : racinesChamp1 n'existe pas pour af_irreductible");
      return ex.formeFactorisee;
    case CHAMP_RACINES_ZEROS:
      if (ex.zeros === null || f.categorie === "irreductible") throw new Error("gen7 : racinesChamp2 n'existe pas pour af_irreductible");
      return reponseBruteZerosCorrecte({ categorie: f.categorie, a: f.a, b: f.b, c: f.c, racines: ex.zeros.racines, formeFactorisee: ex.formeFactorisee ?? "" });
    case CHAMP_TABLEAU_SIGNES:
      return JSON.stringify(solutionTableau(f));
    default:
      throw new Error(`gen7 : champ inconnu « ${champ} »`);
  }
}
