import type { EcranDeclare } from "../../../lib/contratGenerateur";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE, CHAMP_TABLEAU_SIGNES } from "../analyseFonction/types";
import { AIDE_ALLURE, AIDE_AXE_SOMMET, aideFormuleColoreeMD } from "./aides";
import { SOUS_CHAMPS_ALLURE_MD } from "./allure";
import { SOUS_CHAMPS_AXE_SOMMET_MD } from "./axeSommet";
import { SOUS_CHAMPS_COEFFICIENTS_MD } from "./coefficients";
import { latexExact } from "./exact/nombreExact";
import { chercherFamille } from "./familles";
import { ecranRacinesMD } from "./racinesEcran";
import { latexPolynomeMD, ordreAffichage } from "./formatage";
import { rat, versNombreR } from "./exact/rationnel";
import { CHAMP_RACINES, coefVersExact, fonctionEffective, type ExerciceMotifDelta } from "./types";

/**
 * Les écrans de gen7 « motif / delta » (RAPPORT §49), dans l'ordre, IDENTIQUES pour les dix sous-variantes :
 * coefficients, allure, axeSommet, domaineImage, racines, tableauSignes. Chaque écran répète « Étudie la fonction suivante : f(x) = … » (consigne persistante). `ecrans(exercice)`
 * ne dépend que de l'exercice (donc de sa famille) : jamais d'un réglage de tâche.
 */
const enonceFonction = (ex: ExerciceMotifDelta): string => `Étudie la fonction suivante : $f(x) = ${latexPolynomeMD(ex, ex.ordreTermes)}$.`;

/**
 * Énoncé de la fonction EFFECTIVE (RAPPORT §38) : dès que les coefficients CONFIRMÉS sont exploitables, les écrans qui en dépendent affichent SA fonction et le disent, avec le MÊME libellé
 * qu'ils soient justes ou faux (un libellé propre à l'erreur serait un verdict visible sous correction coupée).
 */
export function enonceEffectif(ex: ExerciceMotifDelta): string {
  const e = ex.effectif;
  if (!e.coefficientsAffiches) return enonceFonction(ex);
  return `Étudie la fonction suivante, d'après les coefficients que tu as donnés : $f(x) = ${latexPolynomeMD(e, ordreAffichage(ex.ordreTermes, e))}$.`;
}

/** Nom court de chaque écran (RAPPORT §43). Table de constantes du code, jamais une clé venue de l'élève. */
export const NOMS_ECRANS_MD: Readonly<Record<string, string>> = {
  [CHAMP_COEFFICIENTS]: "Coefficients",
  [CHAMP_ALLURE]: "Allure",
  [CHAMP_AXE_SOMMET]: "Sommet",
  [CHAMP_DOMAINE_IMAGE]: "Domaine / Image",
  [CHAMP_RACINES]: "Racines",
  [CHAMP_TABLEAU_SIGNES]: "Tableau de signes",
};

/** Poids statiques (RAPPORT §17, §49) : coefficients 1, allure 1, sommet 2, ensemble-image 1, racines 2 (« motif ») ou 3 (« delta »), tableau 3. */
export function poidsDe(champ: string, poidsRacines: 2 | 3): number {
  switch (champ) {
    case CHAMP_AXE_SOMMET:
      return 2;
    case CHAMP_RACINES:
      return poidsRacines;
    case CHAMP_TABLEAU_SIGNES:
      return 3;
    default:
      return 1;
  }
}

/** Champs de la variante, dans l'ordre (sert à `etatActuel` et à `champs_attendus`). Identiques pour les dix familles. */
export function champsMotifDelta(): string[] {
  return [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_DOMAINE_IMAGE, CHAMP_RACINES, CHAMP_TABLEAU_SIGNES];
}

/** Dépendances DÉCLARÉES (RAPPORT §38) : seul point où ces listes existent. */
export const DEPENDANCES_MD: Readonly<Record<string, readonly string[]>> = {
  [CHAMP_ALLURE]: [CHAMP_COEFFICIENTS],
  [CHAMP_AXE_SOMMET]: [CHAMP_COEFFICIENTS],
  [CHAMP_DOMAINE_IMAGE]: [CHAMP_COEFFICIENTS, CHAMP_AXE_SOMMET],
  [CHAMP_RACINES]: [CHAMP_COEFFICIENTS],
  [CHAMP_TABLEAU_SIGNES]: [CHAMP_COEFFICIENTS, CHAMP_AXE_SOMMET, CHAMP_RACINES],
};

/** Écrans 1 à 5 (l'écran 6, le tableau, est ajouté par `ecransMotifDelta`). */
export function ecransUnACinq(ex: ExerciceMotifDelta): EcranDeclare[] {
  const e = ex.effectif;
  const eff = enonceEffectif(ex);
  const fe = fonctionEffective(ex);
  const yImage = e.yImage === null ? fe.yS : coefVersExact(e.yImage);
  const cEff = versNombreR(rat(e.c.n, e.c.d));
  return [
    {
      champ: CHAMP_COEFFICIENTS,
      type: "champs_multiples",
      consigne: `${enonceFonction(ex)} Identifie les coefficients $a$, $b$ et $c$. Une racine carrée s'écrit sqrt(2).`,
      aide: aideFormuleColoreeMD(ex),
      champs: SOUS_CHAMPS_COEFFICIENTS_MD,
    },
    {
      champ: CHAMP_ALLURE,
      type: "champs_multiples",
      dependDe: [...(DEPENDANCES_MD[CHAMP_ALLURE] as string[])],
      consigne: `${eff} Quelle est l'allure de sa parabole ? Choisis le sens de la parabole et la position de son sommet par rapport à l'axe $Oy$.`,
      aide: AIDE_ALLURE,
      champs: SOUS_CHAMPS_ALLURE_MD,
      illustration: { type: "croquis_allure", c: cEff, champSigneA: "concavite", champPositionSommet: "positionSommet" },
    },
    {
      champ: CHAMP_AXE_SOMMET,
      type: "champs_multiples",
      dependDe: [...(DEPENDANCES_MD[CHAMP_AXE_SOMMET] as string[])],
      consigne: `${eff} Donne l'axe de symétrie et les coordonnées du sommet. Une valeur rationnelle peut être arrondie au centième ; une valeur avec une racine carrée s'écrit exactement, par exemple sqrt(3).`,
      aide: AIDE_AXE_SOMMET,
      champs: SOUS_CHAMPS_AXE_SOMMET_MD,
    },
    {
      champ: CHAMP_DOMAINE_IMAGE,
      type: "intervalle",
      dependDe: [...(DEPENDANCES_MD[CHAMP_DOMAINE_IMAGE] as string[])],
      consigne: `${eff} On rappelle que $\\mathrm{dom}\\,f = \\mathbb{R}$. ${
        e.ordonneeAffichee ? `Avec $y_S = ${latexExact(yImage)}$ pour ordonnée du sommet, quel` : "Quel"
      } est l'ensemble-image $\\mathrm{im}\\,f$ de cette fonction ?`,
      apercu: { libelle: "$\\mathrm{im}\\,f =$", auDessus: true },
    },
    {
      ...ecranRacinesMD(`${eff} Quelles sont les racines éventuelles de $f$ ? Une racine carrée s'écrit sqrt(2).`),
      dependDe: [...(DEPENDANCES_MD[CHAMP_RACINES] as string[])],
    },
  ];
}

/** Assemble les écrans d'un exercice ; poids et noms posés ici, une seule fois. */
export function ecransMotifDelta(ex: ExerciceMotifDelta, ecransSuivants: readonly EcranDeclare[] = []): EcranDeclare[] {
  const famille = chercherFamille(ex.famille);
  if (famille === undefined) throw new Error(`ecransMotifDelta : famille inconnue « ${ex.famille} »`);
  return [...ecransUnACinq(ex), ...ecransSuivants].map((e) => ({ ...e, nom: NOMS_ECRANS_MD[e.champ], poids: poidsDe(e.champ, famille.poidsRacines) }));
}
