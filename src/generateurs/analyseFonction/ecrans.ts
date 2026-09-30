import type { AideTypee, SegmentFormule } from "../../../lib/aideTypee";
import type { EcranDeclare } from "../../../lib/contratGenerateur";
import { SOUS_CHAMPS_ALLURE } from "./allure";
import { SOUS_CHAMPS_AXE_SOMMET } from "./axeSommet";
import { SOUS_CHAMPS_COEFFICIENTS } from "./coefficients";
import type { ExerciceAnalyseFonction } from "./exercice";
import { equationCanonique, latexPolynome } from "./formatage";
import { CHOIX_RECONNAISSANCE } from "./reconnaissance";
import { ecransRacines } from "./racines";
import { CHAMP_RACINES_FACTORISATION, CHAMP_RACINES_ZEROS } from "./racines/types";
import { ecranTableauSignes } from "./tableauSignes";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE, CHAMP_RECONNAISSANCE, CHAMP_TABLEAU_SIGNES, type FonctionSecondDegre } from "./types";

/**
 * Les écrans de gen7, dans l'ordre : coefficients, allure, axeSommet, domaineImage, racinesReconnaissance, [racinesChamp1, racinesChamp2],
 * tableauSignes. **`af_irreductible` a 6 écrans, jamais 8** : les deux écrans « racines » n'existent pas pour Δ < 0
 * (`ecransRacines("irreductible")` est vide) — ils ne sont pas « présents mais toujours corrects ». `ecrans(exercice)` ne dépend que de la
 * variante (RAPPORT §33 : `etapesActives` hors périmètre, la séquence est celle de la catégorie, jamais d'un réglage de tâche).
 *
 * Énoncé par écran et consigne persistante (D5, D14) : les cinq écrans « fonction » répètent « Étudie la fonction suivante : f(x) = … »
 * (ordre des termes mélangé par la graine) ; les écrans « racines » parlent de l'équation `ax² + bx + c = 0` (ordre canonique). Ce
 * sont de simples textes de `consigne`, sans aucune logique de gen7 côté navigateur.
 */

const enonceFonction = (ex: ExerciceAnalyseFonction): string => `Étudie la fonction suivante : $f(x) = ${latexPolynome(ex.fonction, ex.ordreTermes)}$.`;

/** Aide « formule colorée » de `coefficients` : TOUJOURS les trois termes (un coefficient nul s'écrit `0`), seul le coefficient est coloré. */
export function aideFormuleColoree(f: Pick<FonctionSecondDegre, "a" | "b" | "c">): AideTypee {
  const segments: SegmentFormule[] = [{ latex: "f(x) = " }];
  if (Math.abs(f.a) === 1) {
    if (f.a < 0) segments.push({ latex: "-" });
  } else {
    segments.push({ latex: String(f.a), role: "a" });
  }
  segments.push({ latex: `x^2 ${f.b >= 0 ? "+" : "-"} ` });
  if (Math.abs(f.b) !== 1) segments.push({ latex: String(Math.abs(f.b)), role: "b" });
  segments.push({ latex: `x ${f.c >= 0 ? "+" : "-"} ` });
  segments.push({ latex: String(Math.abs(f.c)), role: "c" });
  return { type: "formule_coloree", segments };
}

function ligneFactorisation(z: NonNullable<ExerciceAnalyseFonction["zeros"]>): string {
  const corps = `$${z.factorisationLatex} = 0$`;
  if (z.origine === "eleve") return `D'après ta factorisation, l'équation s'écrit ${corps}.`;
  if (z.origine === "solution") return `La factorisation est ${corps}.`;
  return `L'équation à résoudre est ${corps}.`;
}

export function ecransAnalyseFonction(ex: ExerciceAnalyseFonction): EcranDeclare[] {
  const f = ex.fonction;
  const enonce = enonceFonction(ex);
  const equation = `$${equationCanonique(f)} = 0$`;
  const racines = ecransRacines(f.categorie);
  const champ1 = racines.find((e) => e.champ === CHAMP_RACINES_FACTORISATION);
  const champ2 = racines.find((e) => e.champ === CHAMP_RACINES_ZEROS);
  const dependancesTableau = f.categorie === "irreductible" ? [CHAMP_AXE_SOMMET] : [CHAMP_AXE_SOMMET, CHAMP_RACINES_ZEROS];

  const ecrans: EcranDeclare[] = [
    {
      champ: CHAMP_COEFFICIENTS,
      type: "champs_multiples",
      consigne: `${enonce} Identifie les coefficients $a$, $b$ et $c$.`,
      aide: aideFormuleColoree(f),
      champs: SOUS_CHAMPS_COEFFICIENTS,
    },
    {
      champ: CHAMP_ALLURE,
      type: "champs_multiples",
      consigne: `${enonce} Quelle est l'allure de sa parabole ?`,
      champs: SOUS_CHAMPS_ALLURE,
      illustration: { type: "croquis_allure", c: f.c, champSigneA: "signeA", champSigneAB: "signeAB" },
    },
    {
      champ: CHAMP_AXE_SOMMET,
      type: "champs_multiples",
      consigne: `${enonce} Donne l'axe de symétrie et les coordonnées du sommet (arrondi au centième accepté si besoin).`,
      aide: { type: "croquis_parabole", a: f.a, b: f.b, c: f.c, marqueS: true },
      champs: SOUS_CHAMPS_AXE_SOMMET,
    },
    {
      champ: CHAMP_DOMAINE_IMAGE,
      type: "intervalle",
      consigne: `${enonce} On rappelle que $\\mathrm{dom}\\,f = \\mathbb{R}$. Quel est l'ensemble-image $\\mathrm{im}\\,f$ de cette fonction ?`,
      aide: { type: "croquis_parabole", a: f.a, b: f.b, c: f.c, marqueS: true, surlignageImf: true },
    },
    {
      champ: CHAMP_RECONNAISSANCE,
      type: "qcm",
      consigne: `Pour trouver les racines de $f$, on considère l'équation ${equation}. Quelle est la méthode la plus rapide ?`,
      choix: CHOIX_RECONNAISSANCE.map((c) => ({ id: c.id, libelle: c.libelle })),
    },
  ];
  if (champ1 && champ2 && ex.zeros) {
    ecrans.push({ ...champ1, consigne: `L'équation à résoudre est ${equation}. ${champ1.consigne}` });
    ecrans.push({ ...champ2, dependDe: [CHAMP_RACINES_FACTORISATION], consigne: `${ligneFactorisation(ex.zeros)} ${champ2.consigne}` });
  }
  ecrans.push({
    ...ecranTableauSignes(f, ex.affichageTableau, `${enonce} Complète le tableau de signe et de variation de $f$.`),
    aide: { type: "croquis_parabole", a: f.a, b: f.b, c: f.c, marqueS: true, marquesOx: true },
    dependDe: dependancesTableau,
  });
  return ecrans;
}

/** Liste des champs de la variante, dans l'ordre (sert à `etatActuel` et à `champs_attendus`). */
export function champsAnalyseFonction(categorie: FonctionSecondDegre["categorie"]): string[] {
  const racines = ecransRacines(categorie).map((e) => e.champ);
  return [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_DOMAINE_IMAGE, CHAMP_RECONNAISSANCE, ...racines, CHAMP_TABLEAU_SIGNES];
}
