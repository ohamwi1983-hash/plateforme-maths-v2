import type { AideTypee, SegmentFormule } from "../../../lib/aideTypee";
import type { EcranDeclare } from "../../../lib/contratGenerateur";
import { SOUS_CHAMPS_ALLURE } from "./allure";
import { SOUS_CHAMPS_AXE_SOMMET } from "./axeSommet";
import { SOUS_CHAMPS_COEFFICIENTS } from "./coefficients";
import type { ExerciceAnalyseFonction } from "./exercice";
import { equationCanonique, latexNombre, latexPolynome, latexRacine } from "./formatage";
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
  /** Énoncé + panneau de faits (une ligne, si des écrans précédents sont réussis) + question, chacun sur sa ligne. */
  const composer = (champ: string, question: string): string => {
    const faits = ligneFaits(ex, champ);
    return faits === null ? `${enonce} ${question}` : `${enonce}\n${faits}\n${question}`;
  };
  /** Écrans « équation » (sans énoncé de fonction) : le panneau, s'il existe, précède le texte. */
  const avecFaits = (champ: string, texte: string): string => {
    const faits = ligneFaits(ex, champ);
    return faits === null ? texte : `${faits}\n${texte}`;
  };
  const equation = `$${equationCanonique(f)} = 0$`;
  const racines = ecransRacines(f.categorie);
  const champ1 = racines.find((e) => e.champ === CHAMP_RACINES_FACTORISATION);
  const champ2 = racines.find((e) => e.champ === CHAMP_RACINES_ZEROS);
  const dependancesTableau = f.categorie === "irreductible" ? [CHAMP_AXE_SOMMET] : [CHAMP_AXE_SOMMET, CHAMP_RACINES_ZEROS];

  const ecrans: EcranDeclare[] = [
    {
      champ: CHAMP_COEFFICIENTS,
      type: "champs_multiples",
      consigne: composer(CHAMP_COEFFICIENTS, "Identifie les coefficients $a$, $b$ et $c$."),
      aide: aideFormuleColoree(f),
      champs: SOUS_CHAMPS_COEFFICIENTS,
    },
    {
      champ: CHAMP_ALLURE,
      type: "champs_multiples",
      consigne: composer(CHAMP_ALLURE, "Quelle est l'allure de sa parabole ?"),
      champs: SOUS_CHAMPS_ALLURE,
      illustration: { type: "croquis_allure", c: f.c, champSigneA: "signeA", champSigneAB: "signeAB" },
    },
    {
      champ: CHAMP_AXE_SOMMET,
      type: "champs_multiples",
      consigne: composer(CHAMP_AXE_SOMMET, "Donne l'axe de symétrie et les coordonnées du sommet (arrondi au centième accepté si besoin)."),
      aide: { type: "croquis_parabole", a: f.a, b: f.b, c: f.c, marqueS: true },
      champs: SOUS_CHAMPS_AXE_SOMMET,
    },
    {
      champ: CHAMP_DOMAINE_IMAGE,
      type: "intervalle",
      consigne: composer(CHAMP_DOMAINE_IMAGE, "On rappelle que $\\mathrm{dom}\\,f = \\mathbb{R}$. Quel est l'ensemble-image $\\mathrm{im}\\,f$ de cette fonction ?"),
      aide: { type: "croquis_parabole", a: f.a, b: f.b, c: f.c, marqueS: true, surlignageImf: true },
    },
    {
      champ: CHAMP_RECONNAISSANCE,
      type: "qcm",
      consigne: avecFaits(CHAMP_RECONNAISSANCE, `Pour trouver les racines de $f$, on considère l'équation ${equation}. Quelle est la méthode la plus rapide ?`),
      choix: CHOIX_RECONNAISSANCE.map((c) => ({ id: c.id, libelle: c.libelle })),
    },
  ];
  if (champ1 && champ2 && ex.zeros) {
    ecrans.push({ ...champ1, consigne: avecFaits(CHAMP_RACINES_FACTORISATION, `L'équation à résoudre est ${equation}. ${champ1.consigne}`) });
    ecrans.push({ ...champ2, dependDe: [CHAMP_RACINES_FACTORISATION], consigne: avecFaits(CHAMP_RACINES_ZEROS, `${ligneFactorisation(ex.zeros)} ${champ2.consigne}`) });
  }
  ecrans.push({
    ...ecranTableauSignes(f, ex.affichageTableau, composer(CHAMP_TABLEAU_SIGNES, "Complète le tableau de signe et de variation de $f$.")),
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

/**
 * Panneau « Ce que tu sais déjà » (D5/D14, Q5) : une ligne de TEXTE d'auteur (`$…$`) ajoutée à la consigne des écrans qui suivent. Ce n'est
 * pas un canal supplémentaire : le client n'a aucune logique propre à gen7, il rend une consigne. Bâti par `projeterAnalyseFonction`
 * (`ex.corrects`) :
 *  - un fait n'est rappelé qu'aux écrans qui viennent APRÈS l'écran qui l'établit, et seulement si cet écran est RÉUSSI ;
 *  - jamais sous correction coupée (`corrects` est alors vide) : un fait est la bonne valeur, il ne doit pas être connu avant la fin de la tâche ;
 *  - les racines n'y figurent qu'une fois `racinesChamp1` ET `racinesChamp2` réussis (valeurs EFFECTIVES de la cascade), jamais pour `af_irreductible`.
 * Pas de filtre par écran : l'ancien « Ce qu'on sait déjà » n'en avait pas (spec 3a, §2.9 / écart n°8).
 */
export function ligneFaits(ex: ExerciceAnalyseFonction, avantChamp: string): string | null {
  const f = ex.fonction;
  const ordre = champsAnalyseFonction(f.categorie);
  const precedents = new Set(ordre.slice(0, ordre.indexOf(avantChamp)).filter((c) => ex.corrects.includes(c)));
  const faits: string[] = [];
  if (precedents.has(CHAMP_COEFFICIENTS)) faits.push(`$a = ${f.a}$, $b = ${f.b}$, $c = ${f.c}$`);
  if (precedents.has(CHAMP_ALLURE)) faits.push(`parabole tournée vers le ${f.a > 0 ? "haut" : "bas"}`);
  if (precedents.has(CHAMP_AXE_SOMMET)) faits.push(`axe de symétrie $x = ${latexNombre(f.xS)}$, sommet $S(${latexNombre(f.xS)}\\,;\\,${latexNombre(f.yS)})$`);
  if (precedents.has(CHAMP_DOMAINE_IMAGE)) faits.push(`$\\mathrm{dom}\\,f = \\mathbb{R}$ et $\\mathrm{im}\\,f = ${f.a > 0 ? `[${latexNombre(f.yS)}\\,;\\,+\\infty[` : `]-\\infty\\,;\\,${latexNombre(f.yS)}]`}$`);
  if (precedents.has(CHAMP_RACINES_FACTORISATION) && precedents.has(CHAMP_RACINES_ZEROS) && ex.zeros !== null) {
    const [r1, r2] = ex.zeros.racines;
    faits.push(r1 === r2 ? `racine double $x_1 = ${latexRacine(r1)}$` : `racines $x_1 = ${latexRacine(r1)}$ et $x_2 = ${latexRacine(r2)}$`);
  }
  return faits.length === 0 ? null : `Ce que tu sais déjà : ${faits.join(" ; ")}.`;
}
