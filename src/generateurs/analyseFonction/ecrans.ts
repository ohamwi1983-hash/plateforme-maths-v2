import type { AideTypee, SegmentFormule } from "../../../lib/aideTypee";
import type { EcranDeclare } from "../../../lib/contratGenerateur";
import { SOUS_CHAMPS_ALLURE } from "./allure";
import { SOUS_CHAMPS_AXE_SOMMET } from "./axeSommet";
import { SOUS_CHAMPS_COEFFICIENTS } from "./coefficients";
import type { ExerciceAnalyseFonction } from "./exercice";
import { COEFFICIENT_MAX } from "../../../lib/aideTypee";
import { equationCanonique, latexNombre, latexPolynome, latexRacine, termesNonNuls } from "./formatage";
import { CHOIX_RECONNAISSANCE } from "./reconnaissance";
import { ecransRacines } from "./racines";
import { CHAMP_RACINES_FACTORISATION, CHAMP_RACINES_ZEROS } from "./racines/types";
import { ecranTableauSignes } from "./tableauSignes";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE, CHAMP_RECONNAISSANCE, CHAMP_TABLEAU_SIGNES, fonctionEffective, type FonctionSecondDegre } from "./types";

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

/**
 * Dépendances DÉCLARÉES entre écrans de gen7 (RAPPORT §38) : `allure` et `axeSommet` sont jugés sur les coefficients CONFIRMÉS,
 * `domaineImage` sur eux et sur l'ordonnée du sommet confirmée à `axeSommet`. Un écran dépendant n'est servi qu'une fois ses
 * prédécesseurs terminés (filtrage serveur) ; seul point où ces listes existent (`ligneFaits` les relit).
 */
const DEPENDANCES_FONCTION: Readonly<Record<string, readonly string[]>> = {
  [CHAMP_ALLURE]: [CHAMP_COEFFICIENTS],
  [CHAMP_AXE_SOMMET]: [CHAMP_COEFFICIENTS],
  [CHAMP_DOMAINE_IMAGE]: [CHAMP_COEFFICIENTS, CHAMP_AXE_SOMMET],
};

const arrondi6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Les trois coefficients sont-ils des entiers acceptables par l'aide `croquis_parabole` ? (Sinon : pas d'aide sur cet écran, jamais une aide invalide.) */
const aideParaboleAdmissible = (e: { a: number; b: number; c: number }): boolean => [e.a, e.b, e.c].every((v) => Number.isInteger(v) && Math.abs(v) <= COEFFICIENT_MAX) && e.a !== 0;

export function ecransAnalyseFonction(ex: ExerciceAnalyseFonction): EcranDeclare[] {
  const f = ex.fonction;
  const e = ex.effectif;
  const enonce = enonceFonction(ex);
  // Cascade des coefficients (RAPPORT §38) : dès que les coefficients CONFIRMÉS sont exploitables, les écrans qui en dépendent affichent SA
  // fonction (jamais celle de l'énoncé, que l'élève ne jugerait pas) et le disent — avec le MÊME libellé qu'ils soient justes ou faux : un libellé
  // propre à l'erreur serait un verdict visible sous correction coupée.
  const effAffiche = { a: arrondi6(e.a), b: arrondi6(e.b), c: arrondi6(e.c) };
  const enonceEffectif = e.coefficientsAffiches ? `Étudie la fonction suivante, d'après les coefficients que tu as donnés : $f(x) = ${latexPolynome(effAffiche, termesNonNuls(effAffiche))}$.` : enonce;
  /** Énoncé + panneau de faits (une ligne, si des écrans précédents sont réussis) + question, chacun sur sa ligne. */
  const composer = (champ: string, question: string, enonceUtilise: string = enonce): string => {
    const faits = ligneFaits(ex, champ);
    return faits === null ? `${enonceUtilise} ${question}` : `${enonceUtilise}\n${faits}\n${question}`;
  };
  /**
   * Aide `croquis_parabole` sur la parabole EFFECTIVE (celle dont l'écran est jugé). Si ses coefficients ne s'y prêtent pas (non entiers, démesurés :
   * l'aide exige des entiers), repli sur la vraie parabole — publique dans l'énoncé — plutôt que de retirer l'aide : `aide_disponible` ne doit jamais
   * dépendre de la justesse d'une réponse (une saisie non entière est forcément fausse : le bouton d'aide qui disparaît serait un verdict visible).
   */
  const aideParabole = (options: { surlignageImf?: boolean; marquesOx?: boolean }): Pick<EcranDeclare, "aide"> => {
    const p = aideParaboleAdmissible(e) ? e : f;
    return { aide: { type: "croquis_parabole", a: p.a, b: p.b, c: p.c, marqueS: true, ...options } };
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
      dependDe: [...DEPENDANCES_FONCTION[CHAMP_ALLURE]!],
      consigne: composer(CHAMP_ALLURE, "Quelle est l'allure de sa parabole ?", enonceEffectif),
      champs: SOUS_CHAMPS_ALLURE,
      illustration: { type: "croquis_allure", c: effAffiche.c, champSigneA: "signeA", champSigneAB: "signeAB" },
    },
    {
      champ: CHAMP_AXE_SOMMET,
      type: "champs_multiples",
      dependDe: [...DEPENDANCES_FONCTION[CHAMP_AXE_SOMMET]!],
      consigne: composer(CHAMP_AXE_SOMMET, "Donne l'axe de symétrie et les coordonnées du sommet (arrondi au centième accepté si besoin).", enonceEffectif),
      ...aideParabole({}),
      champs: SOUS_CHAMPS_AXE_SOMMET,
    },
    {
      champ: CHAMP_DOMAINE_IMAGE,
      type: "intervalle",
      dependDe: [...DEPENDANCES_FONCTION[CHAMP_DOMAINE_IMAGE]!],
      consigne: composer(
        CHAMP_DOMAINE_IMAGE,
        e.ordonneeAffichee
          ? `On rappelle que $\\mathrm{dom}\\,f = \\mathbb{R}$. Avec $y_S = ${latexRacine(e.yImage)}$ pour ordonnée du sommet, quel est l'ensemble-image $\\mathrm{im}\\,f$ de cette fonction ?`
          : "On rappelle que $\\mathrm{dom}\\,f = \\mathbb{R}$. Quel est l'ensemble-image $\\mathrm{im}\\,f$ de cette fonction ?",
        enonceEffectif,
      ),
      ...aideParabole({ surlignageImf: true }),
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
    // RAPPORT §41 : le tableau est jugé sur la fonction EFFECTIVE (coefficients confirmés) ; ses racines et son sommet en sont dérivés.
    ...ecranTableauSignes(fonctionEffective(ex), ex.affichageTableau, composer(CHAMP_TABLEAU_SIGNES, "Complète le tableau de signe et de variation de $f$.", enonceEffectif)),
    ...aideParabole({ marquesOx: true }),
    dependDe: [CHAMP_COEFFICIENTS, ...dependancesTableau],
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
  // Un écran jugé sur une donnée de l'élève n'établit un FAIT que si cette donnée est la vraie : « axe juste pour SES coefficients » n'établit
  // pas l'axe de la vraie fonction (RAPPORT §38). Sans donnée fausse, l'écran a été jugé sur la vraie fonction : c'est un fait.
  const e = ex.effectif;
  const donneesVraies = (champ: string): boolean =>
    champ === CHAMP_ALLURE || champ === CHAMP_AXE_SOMMET ? !e.coefficientsEleve : champ === CHAMP_DOMAINE_IMAGE ? !e.coefficientsEleve && !e.ordonneeEleve : true;
  const etabli = (champ: string): boolean => ex.corrects.includes(champ) && donneesVraies(champ);
  const precedents = new Set(ordre.slice(0, ordre.indexOf(avantChamp)).filter(etabli));
  const faits: string[] = [];
  if (precedents.has(CHAMP_COEFFICIENTS)) faits.push(`$a = ${f.a}$, $b = ${f.b}$, $c = ${f.c}$`);
  if (precedents.has(CHAMP_ALLURE)) faits.push(`parabole tournée vers le ${f.a > 0 ? "haut" : "bas"}`);
  if (precedents.has(CHAMP_AXE_SOMMET)) faits.push(`axe de symétrie $x = ${latexNombre(f.xS)}$, sommet $S(${latexNombre(f.xS)}\\,;\\,${latexNombre(f.yS)})$`);
  if (precedents.has(CHAMP_DOMAINE_IMAGE)) faits.push(`$\\mathrm{dom}\\,f = \\mathbb{R}$ et $\\mathrm{im}\\,f = ${f.a > 0 ? `[${latexNombre(f.yS)}\\,;\\,+\\infty[` : `]-\\infty\\,;\\,${latexNombre(f.yS)}]`}$`);
  // Les écrans « racines » portent sur l'équation VRAIE (non cascadée) : avec des coefficients faux, leurs racines ne sont pas celles de la fonction que le tableau
  // affiche (la sienne) — les rappeler comme un fait la contredirait (RAPPORT §41).
  if (precedents.has(CHAMP_RACINES_FACTORISATION) && precedents.has(CHAMP_RACINES_ZEROS) && ex.zeros !== null && !e.coefficientsEleve) {
    const [r1, r2] = ex.zeros.racines;
    faits.push(r1 === r2 ? `racine double $x_1 = ${latexRacine(r1)}$` : `racines $x_1 = ${latexRacine(r1)}$ et $x_2 = ${latexRacine(r2)}$`);
  }
  return faits.length === 0 ? null : `Ce que tu sais déjà : ${faits.join(" ; ")}.`;
}
