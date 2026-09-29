import { creerPrng, type Prng } from "../../../lib/prng";
import { decoderChampsMultiples, decoderIntervalle, decoderListeValeurs, decoderListeValeursOuAucune, decoderTableauSignes, lireNombreOuFraction } from "../../../lib/reponsesEcran";
import { etatActuelSequentiel, type EcranDeclare, type Generateur, type ReponseConfirmee, type ResultatVerification, type SousChamp } from "../../../lib/contratGenerateur";
import type { AideTypee } from "../../../lib/aideTypee";

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

export const CHAMPS_BASE = [CHAMP_SOMME, CHAMP_PARITE, CHAMP_DIVISEURS, CHAMP_SIGNES];
export const CHAMPS_ETENDUS = [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_EXTREMUM, CHAMP_AXE, CHAMP_IMAGE, CHAMP_RACINES, CHAMP_SIGNES_VARIATION];

export type ProfilTemoin = "base" | "etendu";

/** f(x) = a(x − r1)(x − r2) si `large` (deux racines : 7 colonnes) ; sinon a(x − r1)² (racine double : 3 colonnes). */
export interface ExerciceEtendu {
  a: number;
  b: number;
  c: number;
  large: boolean;
  r1: number;
  r2: number;
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

const ALPHABET_SIGNE = ["+", "-", "0"];
const ALPHABET_VARIATION = ["⌢", "⌣", "↗", "↘"];

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

/** Colonnes du tableau : [zone, point, zone, …] autour des valeurs remarquables (7 ou 3 colonnes). */
function colonnesTableau(ex: ExerciceEtendu): { id: string; libelle: string; sousLibelle?: string; x: number; estPoint: boolean; estSommet: boolean }[] {
  const { xS } = sommet(ex);
  if (!ex.large) {
    return [
      { id: "c0", libelle: `$x < ${xS}$`, x: xS - 1, estPoint: false, estSommet: false },
      { id: "c1", libelle: `$x = ${xS}$`, sousLibelle: "$x_S$", x: xS, estPoint: true, estSommet: true },
      { id: "c2", libelle: `$x > ${xS}$`, x: xS + 1, estPoint: false, estSommet: false },
    ];
  }
  const [g, d] = [ex.r1, ex.r2];
  return [
    { id: "c0", libelle: `$x < ${g}$`, x: g - 1, estPoint: false, estSommet: false },
    { id: "c1", libelle: `$x = ${g}$`, x: g, estPoint: true, estSommet: false },
    { id: "c2", libelle: `$${g} < x < ${xS}$`, x: (g + xS) / 2, estPoint: false, estSommet: false },
    { id: "c3", libelle: `$x = ${xS}$`, sousLibelle: "$x_S$", x: xS, estPoint: true, estSommet: true },
    { id: "c4", libelle: `$${xS} < x < ${d}$`, x: (xS + d) / 2, estPoint: false, estSommet: false },
    { id: "c5", libelle: `$x = ${d}$`, x: d, estPoint: true, estSommet: false },
    { id: "c6", libelle: `$x > ${d}$`, x: d + 1, estPoint: false, estSommet: false },
  ];
}

function solutionTableau(ex: ExerciceEtendu): Record<string, Record<string, string>> {
  const { xS } = sommet(ex);
  const signes: Record<string, string> = {};
  const variation: Record<string, string> = {};
  for (const col of colonnesTableau(ex)) {
    signes[col.id] = signe(f(ex, col.x));
    variation[col.id] = col.estSommet ? (ex.a > 0 ? "⌣" : "⌢") : col.x < xS ? (ex.a > 0 ? "↘" : "↗") : ex.a > 0 ? "↗" : "↘";
  }
  return { signe: signes, variation };
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
    {
      champ: CHAMP_SIGNES_VARIATION,
      type: "tableau_signes",
      consigne: `Complète le tableau de signe et de variation de $f(x) = ${F}$.`,
      aide: { type: "croquis_parabole", a: ex.a, b: ex.b, c: ex.c, marqueS: true, surlignageImf: true, marquesOx: true },
      colonnes: colonnesTableau(ex).map(({ id, libelle, sousLibelle }) => (sousLibelle ? { id, libelle, sousLibelle } : { id, libelle })),
      lignes: [
        { id: "signe", libelle: "Signe de $f(x)$", signesAutorises: ALPHABET_SIGNE },
        { id: "variation", libelle: "Variation", signesAutorises: ALPHABET_VARIATION, rendu: "symboles_variation" },
      ],
      signesAutorises: ALPHABET_SIGNE,
      bornes: { gauche: "$-\\infty$", droite: "$+\\infty$" },
    },
  ];
}

/** Paramètres du profil étendu, tirés APRÈS ceux de l'origine et le tirage du profil (ordre du PRNG documenté). */
function genererEtendu(prng: Prng): ExerciceEtendu {
  const a = prng.entierEntre(1, 3);
  const large = prng.entierEntre(0, 1) === 1;
  if (large) {
    const r1 = prng.entierEntre(-4, 0);
    const r2 = r1 + prng.entierEntre(2, 5);
    return { a, b: -a * (r1 + r2), c: a * r1 * r2, large, r1, r2 };
  }
  const r = prng.choisir([-4, -3, -2, -1, 1, 2, 3, 4]);
  return { a, b: -2 * a * r, c: a * r * r, large, r1: r, r2: r };
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
  if (champ === CHAMP_SIGNES_VARIATION) {
    const d = decoderTableauSignes(reponseBrute);
    if (!d.ok) return parseError(d.message);
    const attendu = solutionTableau(ex);
    for (const ligne of Object.keys(attendu)) {
      for (const id of Object.keys(attendu[ligne])) {
        if (typeof d.valeur[ligne]?.[id] !== "string") return parseError("Complète toutes les cases du tableau avant de valider.");
      }
    }
    const tous = Object.entries(attendu).every(([ligne, cols]) => Object.entries(cols).every(([id, v]) => d.valeur[ligne][id] === v));
    return tous ? resultat("correct") : resultat("not_equivalent");
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
  if (champ === CHAMP_SIGNES_VARIATION) {
    const sol = solutionTableau(ex);
    return Object.entries(sol)
      .map(([ligne, cols]) => `${ligne} : ${colonnesTableau(ex).map((c) => cols[c.id]).join(" ")}`)
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
  throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN} : ${champ}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// Le générateur (un seul objet, un seul `variante_id`)
// ════════════════════════════════════════════════════════════════════════════════════════════

function ecransDe(ex: ExerciceTemoin): EcranDeclare[] {
  return ex.profil === "etendu" && ex.etendu ? ecransEtendus(ex.etendu) : ecransBase(ex);
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
    if (prng.entierEntre(0, 1) === 0) return { a, b, n, r1, r2, profil: "base" };
    return { a, b, n, r1, r2, profil: "etendu", etendu: genererEtendu(prng) };
  },

  ecrans: ecransDe,

  etatActuel(exercice: ExerciceTemoin, reponsesConfirmees: ReponseConfirmee[]) {
    return etatActuelSequentiel(ecransDe(exercice).map((e) => e.champ), reponsesConfirmees);
  },

  verifier(ex: ExerciceTemoin, champ: string, reponseBrute: string): ResultatVerification {
    if (CHAMPS_ETENDUS.includes(champ)) return verifierEtendu(etenduDe(ex, champ), champ, reponseBrute);
    if (champ === CHAMP_SOMME) {
      const lu = evaluerExpression(reponseBrute);
      if (!lu.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: lu.message };
      if (lu.valeur === ex.a + ex.b) return resultat("correct");
      const confondOperation = lu.valeur === ex.a - ex.b || lu.valeur === ex.a * ex.b;
      return resultat("not_equivalent", confondOperation ? [CODE_ERREUR_CALCUL] : []);
    }
    if (champ === CHAMP_PARITE) {
      if (!CHOIX_PARITE.some((c) => c.id === reponseBrute)) return { statut: "parse_error", codesCompetence: [], messageErreur: "Ce choix n'existe pas : sélectionne l'une des propositions." };
      const attendu = (ex.a + ex.b) % 2 === 0 ? "pair" : "impair";
      if (reponseBrute === attendu) return resultat("correct");
      return resultat("not_equivalent", reponseBrute === "ni" ? [CODE_MAUVAIS_CHOIX] : []);
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
};

/**
 * Outil de TEST uniquement (jamais utilisé par le serveur ni le client) : `reponseBrute` correcte
 * d'un champ, dans le format documenté par type d'écran (lib/contratGenerateur.ts). Permet aux tests
 * et à la validation Chromium de jouer un exercice sans dupliquer la logique de solution.
 */
export function reponseBruteCorrecte(ex: ExerciceTemoin, champ: string): string {
  if (CHAMPS_ETENDUS.includes(champ)) return reponseBruteCorrecteEtendue(etenduDe(ex, champ), champ);
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
  for (let graine = 0; graine < 1_000_000; graine++) {
    const ex = generateurTemoinTechnique.generer(graine);
    if (ex.profil !== profil) continue;
    if (profil === "etendu" && forme && ex.etendu?.large !== forme.large) continue;
    if (trouvees === indice) return graine;
    trouvees++;
  }
  throw new Error(`Aucune graine de profil « ${profil} » (indice ${indice})`);
}
