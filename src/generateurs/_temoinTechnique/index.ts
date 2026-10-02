import { creerPrng, type Prng } from "../../../lib/prng";
import { decoderChaineTransformations, decoderChampsMultiples, decoderIntervalle, decoderListeValeurs, decoderListeValeursOuAucune, decoderTableauSignes, lireNombreOuFraction } from "../../../lib/reponsesEcran";
import { etatActuelSequentiel, type ColonneTableauSignes, type EcranDeclare, type EcranTableauSignes, type Generateur, type ReponseConfirmee, type ResultatVerification, type SousChamp } from "../../../lib/contratGenerateur";
import { comparerCasesTableau, resoudreRangees } from "../../../lib/structureTableau";
import type { AideTypee } from "../../../lib/aideTypee";
import { figureParabole } from "../../../lib/figureParabole";

/**
 * Générateur TÉMOIN TECHNIQUE (UNIQUE) — non curriculaire, jetable dans son contenu mais permanent dans
 * son rôle : il couvre chaque type d'écran de la bibliothèque, chaque extension et chaque forme d'aide,
 * pour valider le contrat, le moteur client et le dispatcher serveur de bout en bout, et pour valider
 * tout futur ajout de type d'écran. Ne couvre AUCUN cas réel de gen7 (voir RAPPORT.md §10, risque
 * connu ; il en reprend seulement les FORMES : fonction du second degré, 3 ou 7 colonnes de tableau).
 * Jamais dans `CATALOGUE_GENERATEURS` ni dans `public/catalogue-generateurs-complet.json` : le registre
 * refuse de démarrer sinon.
 *
 * Deux PROFILS d'exercice, tirés de la graine (le profil est le DERNIER tirage utile après les cinq de
 * l'origine, donc les paramètres d'origine — `a`, `b`, `n`, `r1`, `r2` — sont, pour une graine donnée,
 * exactement ceux qu'elle produisait avant la fusion) :
 *  - `base`   : les 4 écrans d'origine (`champ_expression`, `qcm`, `liste_valeurs`, `tableau_signes`).
 *               C'est la SECTION D'ORIGINE, dont les assertions chiffrées (scripts/test-temoin-technique.ts,
 *               « Section A ») restent inchangées et sont comptées : elles ne doivent jamais être affaiblies.
 *  - `etendu` : les 7 écrans de la phase 3b-1 (`champs_multiples` avec et sans illustration, `qcm`,
 *               `intervalle`, `liste_valeurs` avec `permetAucune`, `tableau_signes` étendu à 3 OU 7
 *               colonnes, aides typées, balisage mathématique dans chaque nature de texte d'auteur).
 * Les champs d'origine restent vérifiables sur tout exercice (les paramètres d'origine existent toujours).
 * Le témoin n'est jamais assigné par l'application (hors catalogue : `validerComposition` le refuse) :
 * modifier ce que `generer` produit pour une graine ne contrevient donc pas à la règle `_v2` (CLAUDE.md).
 */

export const VARIANTE_TEMOIN = "_temoin_technique_v1";
export const GENERATEUR_TEMOIN = "_temoin_technique";

export const CODE_ERREUR_CALCUL = "TEMOIN_ERREUR_CALCUL";
export const CODE_MAUVAIS_CHOIX = "TEMOIN_MAUVAIS_CHOIX";
export const CODE_AXE_NOTATION = "TEMOIN_AXE_NOTATION";

// ── Champs du profil `base` (origine) ──
export const CHAMP_SOMME = "somme";
export const CHAMP_PARITE = "parite";
export const CHAMP_DIVISEURS = "diviseurs";
export const CHAMP_SIGNES = "signes";

// ── Champs du profil `etendu` (phase 3b-1) ──
export const CHAMP_COEFFICIENTS = "coefficients";
export const CHAMP_ALLURE = "allure";
export const CHAMP_EXTREMUM = "extremum";
export const CHAMP_AXE = "axe";
export const CHAMP_IMAGE = "image";
export const CHAMP_RACINES = "racines";
export const CHAMP_SIGNES_VARIATION = "signes_variation";
export const CHAMP_QUOTIENT = "quotient_signes";

export const CHAMPS_BASE = [CHAMP_SOMME, CHAMP_PARITE, CHAMP_DIVISEURS, CHAMP_SIGNES];
export const CHAMPS_ETENDUS = [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_EXTREMUM, CHAMP_AXE, CHAMP_IMAGE, CHAMP_RACINES, CHAMP_SIGNES_VARIATION, CHAMP_QUOTIENT];

// ── Champ du profil `graphe` (RAPPORT §56) : une FIGURE d'écran + l'aide par paliers `annotations_figure` (et, avec C4, la chaîne d'étapes) ──
export const CHAMP_COURBE = "courbe";
export const CHAMP_CHAINE = "chaine";

/**
 * Le profil `graphe` couvre la figure d'écran et l'aide par paliers. Il n'est tiré que pour les graines >= `GRAINE_PROFIL_GRAPHE` (jamais en pratique : une graine aléatoire y tombe avec
 * une probabilité de ~1e-7) : les tirages des profils `base` et `etendu` — donc tous les exercices déjà assignés ou épinglés par les tests — restent EXACTEMENT les mêmes.
 */
export const GRAINE_PROFIL_GRAPHE = 4_294_967_000;

export type ProfilTemoin = "base" | "etendu" | "graphe";

/** f(x) = a(x − p)² + q ; A = (xA ; f(xA)) à coordonnées entières. */
export interface ExerciceGraphe {
  a: number;
  p: number;
  q: number;
  xA: number;
}

/** f(x) = a(x − r1)(x − r2) si `large` (deux racines : 7 colonnes) ; sinon a(x − r1)² (racine double : 3 colonnes). */
export interface ExerciceEtendu {
  a: number;
  b: number;
  c: number;
  large: boolean;
  r1: number;
  r2: number;
  /** g(x) = (x − racines[0])(x − racines[1]) / (x − pole) : tableau de signes à 4 lignes empilées, `∅` au pôle (RAPPORT §30). Entiers distincts de [−4 ; 4]. */
  quotient: { racines: [number, number]; pole: number };
}

export interface ExerciceTemoin {
  a: number;
  b: number;
  /** Entier dont on cherche les diviseurs positifs. */
  n: number;
  /** Racines r1 < r2 de (x − r1)(x − r2). */
  r1: number;
  r2: number;
  profil: ProfilTemoin;
  /** Présent ssi `profil === "etendu"`. */
  etendu?: ExerciceEtendu;
  /** Présent ssi `profil === "graphe"`. */
  graphe?: ExerciceGraphe;
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// PROFIL « base » (origine)
// ════════════════════════════════════════════════════════════════════════════════════════════

const CHOIX_PARITE = [
  { id: "pair", libelle: "Pair" },
  { id: "impair", libelle: "Impair" },
  { id: "ni", libelle: "Ni pair ni impair" },
];

const COLONNES_SIGNES = ["c0", "c1", "c2", "c3", "c4"];

function signeEn(valeur: number): string {
  return valeur > 0 ? "+" : valeur < 0 ? "-" : "0";
}

/** Signe de (x − r) sur chacune des 5 colonnes : x < r1, x = r1, r1 < x < r2, x = r2, x > r2. */
function signesDuFacteur(r: number, r1: number, r2: number): Record<string, string> {
  const pointsDeTest = [r1 - 1, r1, (r1 + r2) / 2, r2, r2 + 1];
  return Object.fromEntries(COLONNES_SIGNES.map((colonne, i) => [colonne, signeEn(pointsDeTest[i] - r)]));
}

function signesDuProduit(r1: number, r2: number): Record<string, string> {
  const pointsDeTest = [r1 - 1, r1, (r1 + r2) / 2, r2, r2 + 1];
  return Object.fromEntries(COLONNES_SIGNES.map((colonne, i) => [colonne, signeEn((pointsDeTest[i] - r1) * (pointsDeTest[i] - r2))]));
}

function solutionSigneParLigne(ex: ExerciceTemoin): Record<string, Record<string, string>> {
  return {
    facteur1: signesDuFacteur(ex.r1, ex.r1, ex.r2),
    facteur2: signesDuFacteur(ex.r2, ex.r1, ex.r2),
    produit: signesDuProduit(ex.r1, ex.r2),
  };
}

function diviseursPositifs(n: number): number[] {
  const resultat: number[] = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) resultat.push(d);
  return resultat;
}

/**
 * Évaluateur arithmétique minimal (entiers/décimaux, + − × ÷, parenthèses, moins unaire) — écrit
 * pour ce témoin uniquement, sans `eval`. Renvoie un message pédagogique en cas d'échec de lecture.
 */
function evaluerExpression(texte: string): { ok: true; valeur: number } | { ok: false; message: string } {
  const source = texte.replace(/,/g, ".").replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
  if (source === "") return { ok: false, message: "Écris une expression avant de valider." };
  let i = 0;
  const erreur = (message: string): never => {
    throw new Error(message);
  };
  function facteur(): number {
    if (source[i] === "-") {
      i++;
      return -facteur();
    }
    if (source[i] === "+") {
      i++;
      return facteur();
    }
    if (source[i] === "(") {
      i++;
      const v = somme();
      if (source[i] !== ")") erreur("Il manque une parenthèse fermante.");
      i++;
      return v;
    }
    const debut = i;
    while (i < source.length && /[0-9.]/.test(source[i])) i++;
    if (i === debut) return erreur(source[i] === undefined ? "L'expression semble incomplète : il manque un nombre à la fin." : `Le caractère « ${source[i]} » n'est pas reconnu ici.`);
    const nombre = Number(source.slice(debut, i));
    if (Number.isNaN(nombre)) return erreur("Un nombre est mal écrit (trop de points ou de virgules).");
    return nombre;
  }
  function produit(): number {
    let v = facteur();
    while (source[i] === "*" || source[i] === "/") {
      const op = source[i++];
      const droite = facteur();
      if (op === "/" && droite === 0) erreur("Division par zéro impossible.");
      v = op === "*" ? v * droite : v / droite;
    }
    return v;
  }
  function somme(): number {
    let v = produit();
    while (source[i] === "+" || source[i] === "-") {
      const op = source[i++];
      const droite = produit();
      v = op === "+" ? v + droite : v - droite;
    }
    return v;
  }
  try {
    const valeur = somme();
    if (i < source.length) return { ok: false, message: `Le caractère « ${source[i]} » n'est pas reconnu ici.` };
    return { ok: true, valeur };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Expression illisible." };
  }
}

function ecransBase(ex: ExerciceTemoin): EcranDeclare[] {
  return [
    {
      champ: CHAMP_SOMME,
      type: "champ_expression",
      consigne: `Calcule ${ex.a} + ${ex.b}.`,
      aide: "Additionne les deux nombres.",
      placeholder: "Ta réponse",
    },
    {
      champ: CHAMP_PARITE,
      type: "qcm",
      consigne: `Le nombre ${ex.a} + ${ex.b} est-il pair ou impair ?`,
      aide: "Un nombre pair se termine par 0, 2, 4, 6 ou 8.",
      choix: CHOIX_PARITE,
    },
    {
      champ: CHAMP_DIVISEURS,
      type: "liste_valeurs",
      consigne: `Liste tous les diviseurs positifs de ${ex.n}.`,
      aide: "Cherche les entiers d tels que le reste de la division de n par d vaut 0.",
      etiquetteAjout: "Ajouter un diviseur",
    },
    {
      champ: CHAMP_SIGNES,
      type: "tableau_signes",
      consigne: `Complète le tableau de signes de (x − ${ex.r1})(x − ${ex.r2}).`,
      aide: "Le produit est positif quand les deux facteurs ont le même signe.",
      colonnes: [
        { id: "c0", libelle: `x < ${ex.r1}` },
        { id: "c1", libelle: `x = ${ex.r1}` },
        { id: "c2", libelle: `${ex.r1} < x < ${ex.r2}` },
        { id: "c3", libelle: `x = ${ex.r2}` },
        { id: "c4", libelle: `x > ${ex.r2}` },
      ],
      lignes: [
        { id: "facteur1", libelle: `x − ${ex.r1}` },
        { id: "facteur2", libelle: `x − ${ex.r2}` },
        { id: "produit", libelle: "Produit" },
      ],
      signesAutorises: ["+", "-", "0"],
    },
  ];
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// PROFIL « etendu » (phase 3b-1)
// ════════════════════════════════════════════════════════════════════════════════════════════

function signe(v: number): string {
  return v > 0 ? "+" : v < 0 ? "-" : "0";
}

function fraction(numerateur: number, denominateur: number): string {
  let [n, d] = [numerateur, denominateur];
  if (d < 0) [n, d] = [-n, -d];
  const pgcd = (x: number, y: number): number => (y === 0 ? Math.abs(x) || 1 : pgcd(y, x % y));
  const g = pgcd(n, d);
  n /= g;
  d /= g;
  return d === 1 ? String(n) : `${n}/${d}`;
}

/** Nombre de ¼ℤ en LaTeX (fraction irréductible) — les valeurs de ce témoin sont toujours dans ¼ℤ. */
function latexNombre(v: number): string {
  const f = fraction(Math.round(v * 4), 4);
  if (!f.includes("/")) return f;
  const [n, d] = f.split("/").map(Number);
  return `${n < 0 ? "-" : ""}\\frac{${Math.abs(n)}}{${d}}`;
}

function formeF(ex: ExerciceEtendu): string {
  const terme = (coef: number, suite: string, premier: boolean): string => {
    if (coef === 0) return "";
    const signeTexte = coef < 0 ? (premier ? "-" : " - ") : premier ? "" : " + ";
    const valeur = Math.abs(coef) === 1 && suite !== "" ? "" : String(Math.abs(coef));
    return `${signeTexte}${valeur}${suite}`;
  };
  return terme(ex.a, "x^2", true) + terme(ex.b, "x", ex.a === 0) + terme(ex.c, "", false);
}

function sommet(ex: ExerciceEtendu): { xS: number; yS: number } {
  const xS = -ex.b / (2 * ex.a);
  return { xS, yS: ex.a * xS * xS + ex.b * xS + ex.c };
}

const f = (ex: ExerciceEtendu, x: number): number => ex.a * x * x + ex.b * x + ex.c;

interface ColonneCalculee {
  colonne: ColonneTableauSignes;
  /** Valeur de x représentative de la colonne (la valeur elle-même, ou un point strictement à l'intérieur de l'intervalle). */
  x: number;
}

const colonneIntervalle = (id: string, libelle: string, x: number): ColonneCalculee => ({ colonne: { id, libelle, genre: "intervalle" }, x });
const colonneValeur = (id: string, x: number, symbole: string, options: { racine?: boolean; pole?: boolean; sommet?: boolean }): ColonneCalculee => ({
  colonne: { id, libelle: `$x = ${latexNombre(x)}$`, genre: "valeur", valeur: `$${latexNombre(x)}$`, symbole, ...options },
  x,
});

/** Colonnes du tableau structuré (RAPPORT §30) : 2N+1 colonnes `<, x₁, <, …, <` (7 colonnes à deux racines, 3 à racine double). */
function colonnesTableau(ex: ExerciceEtendu): ColonneCalculee[] {
  const { xS } = sommet(ex);
  const n = latexNombre;
  if (!ex.large) {
    return [colonneIntervalle("c0", `$x < ${n(xS)}$`, xS - 1), colonneValeur("c1", xS, "$x_S$", { racine: true, sommet: true }), colonneIntervalle("c2", `$x > ${n(xS)}$`, xS + 1)];
  }
  const [g, d] = [ex.r1, ex.r2];
  return [
    colonneIntervalle("c0", `$x < ${g}$`, g - 1),
    colonneValeur("c1", g, "$x_1$", { racine: true }),
    colonneIntervalle("c2", `$${g} < x < ${n(xS)}$`, (g + xS) / 2),
    colonneValeur("c3", xS, "$x_S$", { sommet: true }), // le sommet n'est PAS une racine ici : jamais de « 0 » (2 valeurs)
    colonneIntervalle("c4", `$${n(xS)} < x < ${d}$`, (xS + d) / 2),
    colonneValeur("c5", d, "$x_2$", { racine: true }),
    colonneIntervalle("c6", `$x > ${d}$`, d + 1),
  ];
}

function ecranSignesVariation(ex: ExerciceEtendu): EcranTableauSignes {
  return {
    champ: CHAMP_SIGNES_VARIATION,
    type: "tableau_signes",
    consigne: `Complète le tableau de signe et de variation de $f(x) = ${formeF(ex)}$.`,
    aide: { type: "croquis_parabole", a: ex.a, b: ex.b, c: ex.c, marqueS: true, surlignageImf: true, marquesOx: true },
    colonnes: colonnesTableau(ex).map((c) => c.colonne),
    lignes: [
      { id: "signe", libelle: "SIGNE DE $f(x)$" },
      { id: "variation", libelle: "VARIATIONS", nature: "variation" },
    ],
  };
}

function solutionTableau(ex: ExerciceEtendu): Record<string, Record<string, string>> {
  const { xS } = sommet(ex);
  const colonnes = colonnesTableau(ex);
  const x = new Map(colonnes.map((c) => [c.colonne.id, c.x]));
  const sommets = new Set(colonnes.filter((c) => c.colonne.sommet).map((c) => c.colonne.id));
  const signes: Record<string, string> = {};
  const variation: Record<string, string> = {};
  for (const rangee of resoudreRangees(ecranSignesVariation(ex))) {
    for (const cellule of rangee.cellules) {
      const abscisse = x.get(cellule.ancre)!;
      if (rangee.ligne === "signe") signes[cellule.ancre] = signe(f(ex, abscisse));
      else variation[cellule.ancre] = cellule.couvre.some((id) => sommets.has(id)) ? (ex.a > 0 ? "⌣" : "⌢") : abscisse < xS ? (ex.a > 0 ? "↘" : "↗") : ex.a > 0 ? "↗" : "↘";
    }
  }
  return { signe: signes, variation };
}

// ── Tableau de signes d'un QUOTIENT : facteurs empilés + ligne finale, `∅` au pôle (RAPPORT §30) ──

function facteur(p: number): string {
  return p === 0 ? "x" : p > 0 ? `x - ${p}` : `x + ${-p}`;
}

/** Les 3 points remarquables triés (2 racines du numérateur, 1 pôle), avec leur rôle. */
function pointsQuotient(ex: ExerciceEtendu): { valeur: number; role: "racine" | "pole" }[] {
  const { racines, pole } = ex.quotient;
  return [...racines.map((valeur) => ({ valeur, role: "racine" as const })), { valeur: pole, role: "pole" as const }].sort((u, v) => u.valeur - v.valeur);
}

function ecranQuotient(ex: ExerciceEtendu): EcranTableauSignes {
  const points = pointsQuotient(ex);
  const [r1, r2] = ex.quotient.racines;
  const colonnes: ColonneTableauSignes[] = [];
  points.forEach((p, i) => {
    colonnes.push({ id: `c${2 * i}`, libelle: i === 0 ? `$x < ${p.valeur}$` : `$${points[i - 1].valeur} < x < ${p.valeur}$`, genre: "intervalle" });
    colonnes.push({ id: `c${2 * i + 1}`, libelle: `$x = ${p.valeur}$`, genre: "valeur", valeur: `$${p.valeur}$`, symbole: `$x_${i + 1}$`, racine: true, ...(p.role === "pole" ? { pole: true } : {}) });
  });
  colonnes.push({ id: "c6", libelle: `$x > ${points[2].valeur}$`, genre: "intervalle" });
  return {
    champ: CHAMP_QUOTIENT,
    type: "tableau_signes",
    consigne: `Complète le tableau de signe de $g(x) = \\dfrac{(${facteur(r1)})(${facteur(r2)})}{${facteur(ex.quotient.pole)}}$.`,
    colonnes,
    lignes: [
      { id: "facteur1", libelle: `SIGNE DE $${facteur(r1)}$` },
      { id: "facteur2", libelle: `SIGNE DE $${facteur(r2)}$` },
      { id: "facteur3", libelle: `SIGNE DE $${facteur(ex.quotient.pole)}$` },
      { id: "quotient", libelle: "SIGNE DE $g(x)$", nature: "quotient" },
    ],
  };
}

function solutionQuotient(ex: ExerciceEtendu): Record<string, Record<string, string>> {
  const points = pointsQuotient(ex);
  const [r1, r2] = ex.quotient.racines;
  const { pole } = ex.quotient;
  // Abscisse représentative de chaque colonne c0..c6 (valeur du point, ou milieu / point extérieur).
  const abscisses = [points[0].valeur - 1, points[0].valeur, (points[0].valeur + points[1].valeur) / 2, points[1].valeur, (points[1].valeur + points[2].valeur) / 2, points[2].valeur, points[2].valeur + 1];
  const resultat: Record<string, Record<string, string>> = { facteur1: {}, facteur2: {}, facteur3: {}, quotient: {} };
  abscisses.forEach((x, i) => {
    const id = `c${i}`;
    resultat.facteur1[id] = signe(x - r1);
    resultat.facteur2[id] = signe(x - r2);
    resultat.facteur3[id] = signe(x - pole);
    resultat.quotient[id] = x === pole ? "∅" : signe((x - r1) * (x - r2) * (x - pole)); // même signe que le quotient hors du pôle
  });
  return resultat;
}

function ecransEtendus(ex: ExerciceEtendu): EcranDeclare[] {
  const F = formeF(ex);
  // Un coefficient de valeur absolue 1 s'écrit sans chiffre (« x² », pas « 1x² ») : il n'y a rien à
  // colorer, le segment est OMIS (le serveur refuse un segment vide) ; son signe reste hors couleur.
  const segments: { latex: string; role?: "a" | "b" | "c" }[] = [{ latex: "f(x) = " }];
  const coloree = (latex: string, role: "a" | "b" | "c") => {
    if (latex !== "") segments.push({ latex, role });
  };
  if (ex.a < 0 && Math.abs(ex.a) === 1) segments.push({ latex: "-" });
  coloree(Math.abs(ex.a) === 1 ? "" : String(ex.a), "a");
  segments.push({ latex: "x^2 " + (ex.b >= 0 ? "+ " : "- ") });
  coloree(Math.abs(ex.b) === 1 ? "" : String(Math.abs(ex.b)), "b");
  segments.push({ latex: "x " + (ex.c >= 0 ? "+ " : "- ") });
  coloree(String(Math.abs(ex.c)), "c");
  const aideCoefficients: AideTypee = { type: "formule_coloree", segments };
  return [
    {
      champ: CHAMP_COEFFICIENTS,
      type: "champs_multiples",
      consigne: `Étudie la fonction $f(x) = ${F}$. Identifie les coefficients $a$, $b$ et $c$.`,
      aide: aideCoefficients,
      champs: [
        { id: "a", libelle: "$a =$", genre: "texte", placeholder: "$-3$" },
        { id: "b", libelle: "$b =$", genre: "texte" },
        { id: "c", libelle: "$c =$", genre: "texte" },
      ],
    },
    {
      champ: CHAMP_ALLURE,
      type: "champs_multiples",
      consigne: `Quelle est l'allure de la parabole $y = ${F}$ ?`,
      illustration: { type: "croquis_allure", c: ex.c, champSigneA: "signeA", champSigneAB: "signeAB" },
      champs: [
        { id: "signeA", libelle: "Signe de $a$", genre: "choix", choix: [{ id: "+", libelle: "$a > 0$" }, { id: "-", libelle: "$a < 0$" }] },
        { id: "signeAB", libelle: "Signe de $a \\cdot b$", genre: "choix", choix: [{ id: "+", libelle: "$ab > 0$" }, { id: "-", libelle: "$ab < 0$" }, { id: "0", libelle: "$ab = 0$" }] },
      ],
    },
    {
      champ: CHAMP_EXTREMUM,
      type: "qcm",
      consigne: `Le sommet de la parabole $y = ${F}$ est-il un minimum ou un maximum ?`,
      choix: [
        { id: "min", libelle: "Un minimum, comme $\\min f$" },
        { id: "max", libelle: "Un maximum, comme $\\max f$" },
      ],
    },
    {
      champ: CHAMP_AXE,
      type: "champs_multiples",
      consigne: "Donne l'axe de symétrie et les coordonnées du sommet (arrondi au centième accepté si besoin).",
      aide: { type: "croquis_parabole", a: ex.a, b: ex.b, c: ex.c, marqueS: true },
      champs: [
        { id: "axeTexte", libelle: "Axe de symétrie $AS \\equiv$", genre: "texte", placeholder: "$x = \\dots$ (fraction $p/q$ acceptée)" },
        { id: "xS", libelle: "$x_S =$", genre: "texte" },
        { id: "yS", libelle: "$y_S =$", genre: "texte" },
      ],
    },
    {
      champ: CHAMP_IMAGE,
      type: "intervalle",
      consigne: `Quel est l'ensemble-image $\\mathrm{Im}\\,f$ de $f(x) = ${F}$ ? On rappelle que $\\mathrm{Dom}\\,f = \\mathbb{R}$.`,
      aide: { type: "croquis_parabole", a: ex.a, b: ex.b, c: ex.c, marqueS: true, surlignageImf: true },
    },
    {
      champ: CHAMP_RACINES,
      type: "liste_valeurs",
      consigne: `Résous $${F} = 0$.`,
      aide: "Cherche les $x$ tels que $f(x) = 0$, par exemple en factorisant.",
      etiquetteAjout: "Ajouter une racine $x_i$",
      permetAucune: true,
      etiquetteAucune: "Pas de racine",
      etiquetteAuMoinsUne: "Au moins une racine",
    },
    ecranSignesVariation(ex),
    ecranQuotient(ex),
  ];
}

/** Paramètres du profil étendu, tirés APRÈS ceux de l'origine et le tirage du profil (ordre du PRNG documenté). */
function genererEtendu(prng: Prng): ExerciceEtendu {
  const a = prng.entierEntre(1, 3);
  const large = prng.entierEntre(0, 1) === 1;
  let f: Omit<ExerciceEtendu, "quotient">;
  if (large) {
    const r1 = prng.entierEntre(-4, 0);
    const r2 = r1 + prng.entierEntre(2, 5);
    f = { a, b: -a * (r1 + r2), c: a * r1 * r2, large, r1, r2 };
  } else {
    const r = prng.choisir([-4, -3, -2, -1, 1, 2, 3, 4]);
    f = { a, b: -2 * a * r, c: a * r * r, large, r1: r, r2: r };
  }
  // Tirés APRÈS tout le reste (l'ordre des tirages d'origine ne bouge pas) : 2 racines et 1 pôle DISTINCTS du tableau de quotient.
  const pool = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
  const tirer = (): number => pool.splice(pool.indexOf(prng.choisir(pool)), 1)[0];
  const [u, v] = [tirer(), tirer()];
  return { ...f, quotient: { racines: u < v ? [u, v] : [v, u], pole: tirer() } };
}

/** Sous-champs déclarés de l'écran `champs_multiples` d'un champ : les décodeurs valident contre la DÉCLARATION. */
function sousChampsDe(ex: ExerciceEtendu, champ: string): SousChamp[] {
  const ecran = ecransEtendus(ex).find((e) => e.champ === champ);
  if (!ecran || ecran.type !== "champs_multiples") throw new Error(`${champ} n'est pas un écran champs_multiples`);
  return ecran.champs;
}

function parseError(message: string, codesCompetence: string[] = []): ResultatVerification {
  return { statut: "parse_error", codesCompetence, messageErreur: message };
}

const TOLERANCE = 0.005;

function verifierEtendu(ex: ExerciceEtendu, champ: string, reponseBrute: string): ResultatVerification {
  const { xS, yS } = sommet(ex);
  if (champ === CHAMP_COEFFICIENTS) {
    const d = decoderChampsMultiples(reponseBrute, { champs: sousChampsDe(ex, CHAMP_COEFFICIENTS) });
    if (!d.ok) return parseError(d.message);
    const lus = ["a", "b", "c"].map((k) => lireNombreOuFraction(d.valeur[k]));
    if (lus.some((v) => v === null)) return parseError("Chaque coefficient doit être un nombre, par exemple $-3$.");
    return lus[0] === ex.a && lus[1] === ex.b && lus[2] === ex.c ? resultat("correct") : resultat("not_equivalent");
  }
  if (champ === CHAMP_ALLURE) {
    const d = decoderChampsMultiples(reponseBrute, { champs: sousChampsDe(ex, CHAMP_ALLURE) });
    if (!d.ok) return parseError(d.message);
    const bonA = d.valeur.signeA === (ex.a > 0 ? "+" : "-");
    const bonAB = d.valeur.signeAB === signe(ex.a * ex.b);
    return bonA && bonAB ? resultat("correct") : resultat("not_equivalent");
  }
  if (champ === CHAMP_EXTREMUM) {
    if (reponseBrute !== "min" && reponseBrute !== "max") return parseError("Ce choix n'existe pas : sélectionne l'une des propositions.");
    return reponseBrute === (ex.a > 0 ? "min" : "max") ? resultat("correct") : resultat("not_equivalent");
  }
  if (champ === CHAMP_AXE) {
    const d = decoderChampsMultiples(reponseBrute, { champs: sousChampsDe(ex, CHAMP_AXE) });
    if (!d.ok) return parseError(d.message);
    const correspondance = /^x\s*=\s*(.+)$/.exec(d.valeur.axeTexte);
    if (!correspondance) {
      const seul = lireNombreOuFraction(d.valeur.axeTexte);
      if (seul !== null && Math.abs(seul - xS) <= TOLERANCE) return parseError("Écris l'axe de symétrie sous la forme $x = \\dots$ (par exemple $x = 2$).", [CODE_AXE_NOTATION]);
      return parseError("Écris l'axe de symétrie sous la forme $x = \\dots$.");
    }
    const axe = lireNombreOuFraction(correspondance[1]);
    const lx = lireNombreOuFraction(d.valeur.xS);
    const ly = lireNombreOuFraction(d.valeur.yS);
    if (axe === null || lx === null || ly === null) return parseError("Une valeur n'est pas un nombre lisible (entier, décimal ou fraction $p/q$).");
    return Math.abs(axe - xS) <= TOLERANCE && Math.abs(lx - xS) <= TOLERANCE && Math.abs(ly - yS) <= TOLERANCE ? resultat("correct") : resultat("not_equivalent");
  }
  if (champ === CHAMP_IMAGE) {
    const d = decoderIntervalle(reponseBrute);
    if (!d.ok) return parseError(d.message);
    const { crochetGauche, borneGauche, crochetDroit, borneDroite } = d.valeur;
    if (borneDroite !== "+inf" && borneDroite !== "-inf" && lireNombreOuFraction(borneDroite) === null) return parseError("La borne de droite doit être un nombre ou l'infini.");
    if (borneGauche !== "-inf" && borneGauche !== "+inf" && lireNombreOuFraction(borneGauche) === null) return parseError("La borne de gauche doit être un nombre ou l'infini.");
    // a > 0 toujours ici : Im f = [yS ; +∞[
    const borne = borneGauche === "-inf" || borneGauche === "+inf" ? null : lireNombreOuFraction(borneGauche);
    const bon = crochetGauche === "[" && borne !== null && Math.abs(borne - yS) <= TOLERANCE && crochetDroit === "[" && borneDroite === "+inf";
    return bon ? resultat("correct") : resultat("not_equivalent");
  }
  if (champ === CHAMP_RACINES) {
    const d = decoderListeValeursOuAucune(reponseBrute);
    if (!d.ok) return parseError(d.message);
    if (d.valeur.aucune) return resultat("not_equivalent"); // f a toujours au moins une racine réelle
    const nombres = d.valeur.valeurs.map((v) => lireNombreOuFraction(v));
    if (nombres.some((v) => v === null)) return parseError("Chaque racine doit être un nombre lisible.");
    const saisis = new Set(nombres as number[]);
    const attendues = new Set(ex.large ? [ex.r1, ex.r2] : [ex.r1]);
    return saisis.size === attendues.size && [...attendues].every((r) => saisis.has(r)) ? resultat("correct") : resultat("not_equivalent");
  }
  if (champ === CHAMP_SIGNES_VARIATION || champ === CHAMP_QUOTIENT) {
    const d = decoderTableauSignes(reponseBrute);
    if (!d.ok) return parseError(d.message);
    const quotient = champ === CHAMP_QUOTIENT;
    const comparaison = comparerCasesTableau(resoudreRangees(quotient ? ecranQuotient(ex) : ecranSignesVariation(ex)), d.valeur, quotient ? solutionQuotient(ex) : solutionTableau(ex));
    if (!comparaison.ok) return parseError(comparaison.message);
    return comparaison.tousJustes ? resultat("correct") : resultat("not_equivalent");
  }
  throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
}

function solutionAttendueEtendue(ex: ExerciceEtendu, champ: string): string {
  const { xS, yS } = sommet(ex);
  if (champ === CHAMP_COEFFICIENTS) return `$a = ${ex.a}$ ; $b = ${ex.b}$ ; $c = ${ex.c}$`;
  if (champ === CHAMP_ALLURE) return `$a ${ex.a > 0 ? ">" : "<"} 0$ ; $ab ${signe(ex.a * ex.b) === "0" ? "=" : signe(ex.a * ex.b) === "+" ? ">" : "<"} 0$`;
  if (champ === CHAMP_EXTREMUM) return ex.a > 0 ? "Un minimum, comme $\\min f$" : "Un maximum, comme $\\max f$";
  if (champ === CHAMP_AXE) return `$x = ${latexNombre(xS)}$ ; $x_S = ${latexNombre(xS)}$ ; $y_S = ${latexNombre(yS)}$`;
  if (champ === CHAMP_IMAGE) return `$[${latexNombre(yS)}\\,;\\,+\\infty[$`;
  if (champ === CHAMP_RACINES) return (ex.large ? [ex.r1, ex.r2] : [ex.r1]).map((r) => `$${r}$`).join(" ; ");
  if (champ === CHAMP_SIGNES_VARIATION || champ === CHAMP_QUOTIENT) {
    const quotient = champ === CHAMP_QUOTIENT;
    const solution = quotient ? solutionQuotient(ex) : solutionTableau(ex);
    return resoudreRangees(quotient ? ecranQuotient(ex) : ecranSignesVariation(ex))
      .map((rangee) => `${rangee.ligne} : ${rangee.cellules.map((c) => solution[rangee.ligne][c.ancre]).join(" ")}`)
      .join(" ; ");
  }
  throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
}

function reponseBruteCorrecteEtendue(ex: ExerciceEtendu, champ: string): string {
  const { xS, yS } = sommet(ex);
  if (champ === CHAMP_COEFFICIENTS) return JSON.stringify({ a: String(ex.a), b: String(ex.b), c: String(ex.c) });
  if (champ === CHAMP_ALLURE) return JSON.stringify({ signeA: ex.a > 0 ? "+" : "-", signeAB: signe(ex.a * ex.b) });
  if (champ === CHAMP_EXTREMUM) return ex.a > 0 ? "min" : "max";
  if (champ === CHAMP_AXE) return JSON.stringify({ axeTexte: `x = ${fraction(Math.round(xS * 2), 2)}`, xS: fraction(Math.round(xS * 2), 2), yS: fraction(Math.round(yS * 4), 4) });
  if (champ === CHAMP_IMAGE) return JSON.stringify({ crochetGauche: "[", borneGauche: fraction(Math.round(yS * 4), 4), crochetDroit: "[", borneDroite: "+inf" });
  if (champ === CHAMP_RACINES) return JSON.stringify((ex.large ? [ex.r1, ex.r2] : [ex.r1]).map(String));
  if (champ === CHAMP_SIGNES_VARIATION) return JSON.stringify(solutionTableau(ex));
  if (champ === CHAMP_QUOTIENT) return JSON.stringify(solutionQuotient(ex));
  throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Le générateur (un seul objet, un seul `variante_id`)
// ════════════════════════════════════════════════════════════════════════════════════════════

/** Nom court de chaque écran (RAPPORT §43) : libellé de sa ligne dans le « Ce qu'on sait déjà » du moteur. */
const NOMS_ECRANS: Readonly<Record<string, string>> = {
  [CHAMP_SOMME]: "Somme",
  [CHAMP_COURBE]: "Courbe",
  [CHAMP_CHAINE]: "Chaîne",
  [CHAMP_PARITE]: "Parité",
  [CHAMP_DIVISEURS]: "Diviseurs",
  [CHAMP_SIGNES]: "Signes",
  [CHAMP_COEFFICIENTS]: "Coefficients",
  [CHAMP_ALLURE]: "Allure",
  [CHAMP_EXTREMUM]: "Extremum",
  [CHAMP_AXE]: "Axe",
  [CHAMP_IMAGE]: "Image",
  [CHAMP_RACINES]: "Racines",
  [CHAMP_SIGNES_VARIATION]: "Signes et variation",
  [CHAMP_QUOTIENT]: "Quotient",
};

/** Les cinq transformations de la chaîne (toujours les cinq : le menu ne trahit rien). Le témoin ne juge que la STRUCTURE de la chaîne attendue, jamais ses expressions. */
const CHOIX_CHAINE = [
  { id: "TH", libelle: "TH", valeur: { placeholder: "h (+ : vers la droite)" } },
  { id: "TV", libelle: "TV", valeur: { placeholder: "k (+ : vers le haut)" } },
  { id: "EV", libelle: "EV", valeur: { placeholder: "facteur > 1" } },
  { id: "CV", libelle: "CV", valeur: { placeholder: "facteur entre 0 et 1" } },
  { id: "SOX", libelle: "SOX" },
];
/** Légende des abréviations, dévoilée par le « ? » de chaque étape. */
const LEGENDE_CHAINE = "TH : translation horizontale · TV : translation verticale · EV : étirement vertical · CV : compression verticale · SOX : symétrie d'axe Ox.";
const CHAINE_ATTENDUE = ["TH", "TV"];
const ECRAN_CHAINE_BORNES = { etapesMin: 1, etapesMax: 5 };

/** Profil `graphe` : un écran `champ_expression` portant une FIGURE et une aide à DEUX paliers d'annotations (palier 1 : le sommet S ; palier 2 : le point A et les deux écarts). */
function ecransGraphe(g: ExerciceGraphe): EcranDeclare[] {
  const { figure, sommet, pointA } = figureParabole({ a: g.a, p: g.p, q: g.q, xA: g.xA, description: "Graphique d'une parabole dans un repère gradué." });
  return [
    {
      type: "champ_expression",
      champ: CHAMP_COURBE,
      consigne: "On a tracé la parabole d'équation $y = a(x - p)^2 + q$.",
      figure,
      question: "Quelle est la valeur de $a$ ?", // la question est SOUS le graphique (RAPPORT §58)
      apercu: { libelle: "a =" }, // aperçu LaTeX de la saisie, au-dessus du champ
      aide: {
        type: "annotations_figure",
        paliers: [
          { legende: "Le sommet $S$ de la parabole est marqué sur le graphique.", annotations: [{ genre: "point", x: sommet.x, y: sommet.y, etiquette: `S(${sommet.x} ; ${sommet.y})` }] },
          {
            legende: "Le point $A$ est marqué, avec ses écarts horizontal et vertical depuis $S$.",
            annotations: [
              { genre: "point", x: pointA.x, y: pointA.y, etiquette: `A(${pointA.x} ; ${pointA.y})` },
              { genre: "vecteur", de: [sommet.x, sommet.y], vers: [pointA.x, sommet.y], etiquette: `${Math.abs(pointA.x - sommet.x)}` },
              { genre: "vecteur", de: [pointA.x, sommet.y], vers: [pointA.x, pointA.y], etiquette: `${Math.abs(pointA.y - sommet.y)}` },
            ],
          },
        ],
      },
      poids: 2,
    },
    {
      type: "chaine_transformations",
      champ: CHAMP_CHAINE,
      consigne: "Écris une chaîne de deux étapes : une translation horizontale (TH), puis une translation verticale (TV). Le témoin ne vérifie que l'ordre des transformations.",
      question: "Quelles transformations conduisent de $x^2$ à $(x-1)^2 + 1$ ?",
      legende: LEGENDE_CHAINE,
      depart: "$f_0(x) = x^2$",
      choix: CHOIX_CHAINE,
      ...ECRAN_CHAINE_BORNES,
      placeholder: "ex. (x-2)^2",
      figure, // la MÊME figure sur les deux écrans
      poids: 3,
    },
  ];
}

function ecransDe(ex: ExerciceTemoin): EcranDeclare[] {
  const ecrans = ex.profil === "graphe" && ex.graphe ? ecransGraphe(ex.graphe) : ex.profil === "etendu" && ex.etendu ? ecransEtendus(ex.etendu) : ecransBase(ex);
  return ecrans.map((e) => ({ ...e, nom: NOMS_ECRANS[e.champ] }));
}

function grapheDe(ex: ExerciceTemoin): ExerciceGraphe {
  if (!ex.graphe) throw new Error(`Champ ${CHAMP_COURBE} inconnu pour un exercice de profil « ${ex.profil} » (${VARIANTE_TEMOIN})`);
  return ex.graphe;
}

function etenduDe(ex: ExerciceTemoin, champ: string): ExerciceEtendu {
  if (!ex.etendu) throw new Error(`Champ ${champ} inconnu pour un exercice de profil « base » (${VARIANTE_TEMOIN})`);
  return ex.etendu;
}

function resultat(statut: "correct" | "not_equivalent", codesCompetence: string[] = []): ResultatVerification {
  return { statut, codesCompetence };
}

export const generateurTemoinTechnique: Generateur<ExerciceTemoin> = {
  variante_id: VARIANTE_TEMOIN,
  generateur_id: GENERATEUR_TEMOIN,
  curriculaire: false,
  codesCompetenceDeclares: [CODE_ERREUR_CALCUL, CODE_MAUVAIS_CHOIX, CODE_AXE_NOTATION],

  /**
   * Ordre des tirages du PRNG (à ne jamais réordonner sans repasser par la règle `_v2`) :
   * a, b, n, r1, r2 (origine, inchangés) → profil → [profil « etendu » : a, large, r1, r2 / r].
   */
  generer(graine: number): ExerciceTemoin {
    const prng = creerPrng(graine);
    const a = prng.entierEntre(11, 49);
    const b = prng.entierEntre(11, 49);
    const n = prng.choisir([12, 18, 20, 24, 30, 36]);
    const r1 = prng.entierEntre(-4, 1);
    const r2 = r1 + prng.entierEntre(2, 5);
    if (graine >= GRAINE_PROFIL_GRAPHE) {
      const ga = prng.choisir([1, 2, 3]);
      const gp = prng.entierEntre(-3, 3);
      const gq = prng.entierEntre(-3, 3);
      return { a, b, n, r1, r2, profil: "graphe", graphe: { a: ga, p: gp, q: gq, xA: gp + prng.choisir([-2, -1, 1, 2]) } };
    }
    if (prng.entierEntre(0, 1) === 0) return { a, b, n, r1, r2, profil: "base" };
    return { a, b, n, r1, r2, profil: "etendu", etendu: genererEtendu(prng) };
  },

  ecrans: ecransDe,

  etatActuel(exercice: ExerciceTemoin, reponsesConfirmees: ReponseConfirmee[]) {
    return etatActuelSequentiel(ecransDe(exercice).map((e) => e.champ), reponsesConfirmees);
  },

  verifier(ex: ExerciceTemoin, champ: string, reponseBrute: string): ResultatVerification {
    if (CHAMPS_ETENDUS.includes(champ)) return verifierEtendu(etenduDe(ex, champ), champ, reponseBrute);
    if (champ === CHAMP_CHAINE) {
      const chaine = decoderChaineTransformations(reponseBrute, { choix: CHOIX_CHAINE, ...ECRAN_CHAINE_BORNES });
      if (!chaine.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: chaine.message };
      const fausses = chaine.valeur.flatMap((e, i) => (e.transformation === CHAINE_ATTENDUE[i] ? [] : [`etape:${i}`]));
      return fausses.length === 0 && chaine.valeur.length === CHAINE_ATTENDUE.length ? resultat("correct") : { statut: "not_equivalent", codesCompetence: [], partiesFausses: fausses };
    }
    if (champ === CHAMP_COURBE) {
      const lu = evaluerExpression(reponseBrute);
      if (!lu.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: lu.message };
      return lu.valeur === grapheDe(ex).a ? resultat("correct") : { statut: "not_equivalent", codesCompetence: [], partiesFausses: ["champ"] };
    }
    if (champ === CHAMP_SOMME) {
      const lu = evaluerExpression(reponseBrute);
      if (!lu.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: lu.message };
      if (lu.valeur === ex.a + ex.b) return resultat("correct");
      const confondOperation = lu.valeur === ex.a - ex.b || lu.valeur === ex.a * ex.b;
      return { statut: "not_equivalent", codesCompetence: confondOperation ? [CODE_ERREUR_CALCUL] : [], partiesFausses: ["champ"] }; // champ_expression : l'unique champ (RAPPORT §52)
    }
    if (champ === CHAMP_PARITE) {
      if (!CHOIX_PARITE.some((c) => c.id === reponseBrute)) return { statut: "parse_error", codesCompetence: [], messageErreur: "Ce choix n'existe pas : sélectionne l'une des propositions." };
      const attendu = (ex.a + ex.b) % 2 === 0 ? "pair" : "impair";
      if (reponseBrute === attendu) return resultat("correct");
      return { statut: "not_equivalent", codesCompetence: reponseBrute === "ni" ? [CODE_MAUVAIS_CHOIX] : [], partiesFausses: [reponseBrute] }; // qcm : le choix COCHÉ (RAPPORT §52)
    }
    if (champ === CHAMP_DIVISEURS) {
      const liste = decoderListeValeurs(reponseBrute);
      if (!liste.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: liste.message };
      const nombres = liste.valeur.map((v) => Number(v.replace(",", ".")));
      if (nombres.some((v) => !Number.isInteger(v))) return { statut: "parse_error", codesCompetence: [], messageErreur: "Chaque valeur doit être un nombre entier (par exemple 6)." };
      const saisis = new Set(nombres);
      const attendus = new Set(diviseursPositifs(ex.n));
      const identiques = saisis.size === attendus.size && [...attendus].every((d) => saisis.has(d));
      return resultat(identiques ? "correct" : "not_equivalent");
    }
    if (champ === CHAMP_SIGNES) {
      const tableau = decoderTableauSignes(reponseBrute);
      if (!tableau.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: tableau.message };
      const attendu = solutionSigneParLigne(ex);
      for (const ligne of Object.keys(attendu)) {
        for (const colonne of COLONNES_SIGNES) {
          if (typeof tableau.valeur[ligne]?.[colonne] !== "string") return { statut: "parse_error", codesCompetence: [], messageErreur: "Complète toutes les cases du tableau avant de valider." };
          if (!["+", "-", "0"].includes(tableau.valeur[ligne][colonne])) return { statut: "parse_error", codesCompetence: [], messageErreur: "Un signe du tableau n'est pas reconnu (attendu : +, - ou 0)." };
        }
      }
      const tousJustes = Object.entries(attendu).every(([ligne, colonnes]) => COLONNES_SIGNES.every((c) => tableau.valeur[ligne][c] === colonnes[c]));
      return resultat(tousJustes ? "correct" : "not_equivalent");
    }
    throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
  },

  solutionAttendue(ex: ExerciceTemoin, champ: string): string {
    if (CHAMPS_ETENDUS.includes(champ)) return solutionAttendueEtendue(etenduDe(ex, champ), champ);
    if (champ === CHAMP_COURBE) return `$a = ${grapheDe(ex).a}$`;
    if (champ === CHAMP_CHAINE) return CHAINE_ATTENDUE.join(", puis ");
    if (champ === CHAMP_SOMME) return String(ex.a + ex.b);
    if (champ === CHAMP_PARITE) return (ex.a + ex.b) % 2 === 0 ? "Pair" : "Impair";
    if (champ === CHAMP_DIVISEURS) return diviseursPositifs(ex.n).join(", ");
    if (champ === CHAMP_SIGNES) {
      const sol = solutionSigneParLigne(ex);
      return Object.entries(sol)
        .map(([ligne, colonnes]) => `${ligne} : ${COLONNES_SIGNES.map((c) => colonnes[c]).join(" ")}`)
        .join(" ; ");
    }
    throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
  },

  /** RAPPORT §53 : les deux tableaux STRUCTURÉS du profil `etendu` ont une forme dessinable (le tableau rempli) ; le tableau hérité de la Section A reste une phrase. */
  solutionStructuree(ex: ExerciceTemoin, champ: string): string | null {
    return champ === CHAMP_SIGNES_VARIATION || champ === CHAMP_QUOTIENT ? reponseBruteCorrecte(ex, champ) : null;
  },
};

/**
 * Outil de TEST uniquement (jamais utilisé par le serveur ni le client) : `reponseBrute` correcte
 * d'un champ, dans le format documenté par type d'écran (lib/contratGenerateur.ts). Permet aux tests
 * et à la validation Chromium de jouer un exercice sans dupliquer la logique de solution.
 */
export function reponseBruteCorrecte(ex: ExerciceTemoin, champ: string): string {
  if (CHAMPS_ETENDUS.includes(champ)) return reponseBruteCorrecteEtendue(etenduDe(ex, champ), champ);
  if (champ === CHAMP_COURBE) return String(grapheDe(ex).a);
  if (champ === CHAMP_CHAINE) return JSON.stringify({ etapes: CHAINE_ATTENDUE.map((transformation, i) => ({ expression: i === 0 ? "(x-1)^2" : "(x-1)^2+1", transformation, valeur: "1" })) });
  if (champ === CHAMP_SOMME) return String(ex.a + ex.b);
  if (champ === CHAMP_PARITE) return (ex.a + ex.b) % 2 === 0 ? "pair" : "impair";
  if (champ === CHAMP_DIVISEURS) return JSON.stringify(diviseursPositifs(ex.n).map(String));
  if (champ === CHAMP_SIGNES) return JSON.stringify(solutionSigneParLigne(ex));
  throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
}

/**
 * Outil de TEST uniquement : `indice`-ième graine (0, 1, 2…, distinctes) dont l'exercice a le profil
 * demandé — et, pour `etendu`, la forme demandée (`large` : 7 colonnes ; sinon 3). Permet aux tests de
 * choisir la section (d'origine ou étendue) sans hasard (voir `imposerProfilAssignation`, harnais).
 */
export function graineDeProfil(profil: ProfilTemoin, indice: number, forme?: { large: boolean }): number {
  let trouvees = 0;
  // Profil `graphe` : graines réservées >= GRAINE_PROFIL_GRAPHE (les autres profils se cherchent depuis 0, comme avant).
  for (let graine = profil === "graphe" ? GRAINE_PROFIL_GRAPHE : 0; graine < (profil === "graphe" ? 4_294_967_295 : 1_000_000); graine++) {
    const ex = generateurTemoinTechnique.generer(graine);
    if (ex.profil !== profil) continue;
    if (profil === "etendu" && forme && ex.etendu?.large !== forme.large) continue;
    if (trouvees === indice) return graine;
    trouvees++;
  }
  throw new Error(`Aucune graine de profil « ${profil} » (indice ${indice})`);
}
