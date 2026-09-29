import { creerPrng } from "../../../lib/prng";
import { decoderChampsMultiples, decoderIntervalle, decoderListeValeursOuAucune, decoderTableauSignes, lireNombreOuFraction } from "../../../lib/reponsesEcran";
import { etatActuelSequentiel, type EcranDeclare, type Generateur, type ReponseConfirmee, type ResultatVerification, type SousChamp } from "../../../lib/contratGenerateur";
import type { AideTypee } from "../../../lib/aideTypee";

/**
 * Générateur TÉMOIN TECHNIQUE ÉTENDU — non curriculaire, hors catalogue, permanent dans son rôle : il
 * couvre les types d'écran, extensions et aides ajoutés en phase 3b-1 (`champs_multiples` avec et sans
 * illustration, `intervalle`, `liste_valeurs` avec `permetAucune`, `tableau_signes` étendu, les deux aides
 * typées, le balisage mathématique dans chaque champ de texte d'auteur). Il complète — sans le modifier —
 * le témoin d'origine (`../_temoinTechnique`, dont les assertions chiffrées restent identiques : signal
 * de non-régression). Ne couvre AUCUN cas réel de gen7 ; il en reprend seulement les FORMES (3 ou 7
 * colonnes de tableau, fonction du second degré, coefficients entiers), pas la pédagogie.
 *
 * Jamais dans `CATALOGUE_GENERATEURS` ni dans `public/catalogue-generateurs-complet.json` : le registre
 * refuse de démarrer sinon. `generateur_id` partagé avec le témoin d'origine (même famille).
 */

export const VARIANTE_TEMOIN_ETENDU = "_temoin_technique_etendu_v1";
export const GENERATEUR_TEMOIN_ETENDU = "_temoin_technique";

export const CODE_AXE_NOTATION = "TEMOIN_AXE_NOTATION";

export const CHAMP_COEFFICIENTS = "coefficients";
export const CHAMP_ALLURE = "allure";
export const CHAMP_EXTREMUM = "extremum";
export const CHAMP_AXE = "axe";
export const CHAMP_IMAGE = "image";
export const CHAMP_RACINES = "racines";
export const CHAMP_SIGNES_VARIATION = "signes_variation";

/** f(x) = a(x − r1)(x − r2) si `large` (deux racines : 7 colonnes) ; sinon a(x − r1)² (racine double : 3 colonnes). */
export interface ExerciceEtendu {
  a: number;
  b: number;
  c: number;
  large: boolean;
  r1: number;
  r2: number;
}

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

function ecransDe(ex: ExerciceEtendu): EcranDeclare[] {
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

/** Sous-champs déclarés de l'écran `champs_multiples` d'un champ : les décodeurs valident contre la DÉCLARATION. */
function sousChampsDe(ex: ExerciceEtendu, champ: string): SousChamp[] {
  const ecran = ecransDe(ex).find((e) => e.champ === champ);
  if (!ecran || ecran.type !== "champs_multiples") throw new Error(`${champ} n'est pas un écran champs_multiples`);
  return ecran.champs;
}

function resultat(statut: "correct" | "not_equivalent", codesCompetence: string[] = []): ResultatVerification {
  return { statut, codesCompetence };
}

function parseError(message: string, codesCompetence: string[] = []): ResultatVerification {
  return { statut: "parse_error", codesCompetence, messageErreur: message };
}

const TOLERANCE = 0.005;

export const generateurTemoinTechniqueEtendu: Generateur<ExerciceEtendu> = {
  variante_id: VARIANTE_TEMOIN_ETENDU,
  generateur_id: GENERATEUR_TEMOIN_ETENDU,
  curriculaire: false,
  codesCompetenceDeclares: [CODE_AXE_NOTATION],

  generer(graine: number): ExerciceEtendu {
    const prng = creerPrng(graine);
    const a = prng.entierEntre(1, 3);
    const large = prng.entierEntre(0, 1) === 1;
    if (large) {
      const r1 = prng.entierEntre(-4, 0);
      const r2 = r1 + prng.entierEntre(2, 5);
      return { a, b: -a * (r1 + r2), c: a * r1 * r2, large, r1, r2 };
    }
    const r = prng.choisir([-4, -3, -2, -1, 1, 2, 3, 4]);
    return { a, b: -2 * a * r, c: a * r * r, large, r1: r, r2: r };
  },

  ecrans: ecransDe,

  etatActuel(exercice: ExerciceEtendu, reponsesConfirmees: ReponseConfirmee[]) {
    return etatActuelSequentiel(ecransDe(exercice).map((e) => e.champ), reponsesConfirmees);
  },

  verifier(ex: ExerciceEtendu, champ: string, reponseBrute: string): ResultatVerification {
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
    throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN_ETENDU} : ${champ}`);
  },

  solutionAttendue(ex: ExerciceEtendu, champ: string): string {
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
    throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN_ETENDU} : ${champ}`);
  },
};

/**
 * Outil de TEST uniquement (jamais utilisé par le serveur ni le client) : `reponseBrute` correcte d'un
 * champ, dans le format documenté (lib/contratGenerateur.ts).
 */
export function reponseBruteCorrecteEtendue(ex: ExerciceEtendu, champ: string): string {
  const { xS, yS } = sommet(ex);
  if (champ === CHAMP_COEFFICIENTS) return JSON.stringify({ a: String(ex.a), b: String(ex.b), c: String(ex.c) });
  if (champ === CHAMP_ALLURE) return JSON.stringify({ signeA: ex.a > 0 ? "+" : "-", signeAB: signe(ex.a * ex.b) });
  if (champ === CHAMP_EXTREMUM) return ex.a > 0 ? "min" : "max";
  if (champ === CHAMP_AXE) return JSON.stringify({ axeTexte: `x = ${fraction(Math.round(xS * 2), 2)}`, xS: fraction(Math.round(xS * 2), 2), yS: fraction(Math.round(yS * 4), 4) });
  if (champ === CHAMP_IMAGE) return JSON.stringify({ crochetGauche: "[", borneGauche: fraction(Math.round(yS * 4), 4), crochetDroit: "[", borneDroite: "+inf" });
  if (champ === CHAMP_RACINES) return JSON.stringify((ex.large ? [ex.r1, ex.r2] : [ex.r1]).map(String));
  if (champ === CHAMP_SIGNES_VARIATION) return JSON.stringify(solutionTableau(ex));
  throw new Error(`Champ inconnu pour ${VARIANTE_TEMOIN_ETENDU} : ${champ}`);
}
