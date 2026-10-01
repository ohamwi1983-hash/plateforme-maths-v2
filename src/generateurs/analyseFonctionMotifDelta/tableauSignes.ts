import type { ColonneTableauSignes, EcranTableauSignes, LigneTableauSignes, ResultatVerification } from "../../../lib/contratGenerateur";
import { decoderTableauSignes, type CasesTableauSignes } from "../../../lib/reponsesEcran";
import { comparerCasesTableau, resoudreRangees, SIGNE_MOINS, SIGNE_PLUS, SIGNE_ZERO, type RangeeResolue } from "../../../lib/structureTableau";
import { CODE_TABLEAU_CONCAVITE_INCORRECTE, CODE_TABLEAU_SIGNE_INVERSE, CODE_TABLEAU_SIGNE_PARTIEL, CODE_TABLEAU_VARIATION_PARTIEL } from "./codes";
import { comparer, evaluerPolynome, exactDepuisRat, foisRat, latexExact, plus, exactDepuisEntier, signe, type Exact } from "./exact/nombreExact";
import { rat } from "./exact/rationnel";
import { CHAMP_TABLEAU_SIGNES, type AffichageColonnes, type FonctionExacte } from "./types";

/**
 * Écran `tableauSignes` de gen7 « motif / delta » (RAPPORT §49) : signe de `f` puis variations, UNE tentative pour les deux lignes, sur le contrat de tableau STRUCTURÉ (RAPPORT §30 :
 * `lib/structureTableau.ts`, seule dérivation des cases). Colonnes : `[xS]` (3 colonnes) si aucune racine réelle (xS n'est PAS une racine : jamais de « 0 ») ou racine double (xS est LA
 * racine) ; `[x₁, xS, x₂]` (7 colonnes) sinon. Variations : cases FUSIONNÉES par groupes délimités par `xS` ; `↗ ↘` sur un intervalle, `⌢ ⌣` au sommet.
 *
 * Attendu par évaluation EXACTE de `f` en une valeur représentative de chaque colonne (`evaluerPolynome` sur des nombres exacts) : aucune tolérance flottante, `f` vaut EXACTEMENT 0 aux
 * racines même irrationnelles. Les colonnes affichent leurs valeurs en LaTeX exact (`1-\sqrt{5}`) ou, sous correction coupée / sans « Afficher la réponse attendue », les symboles `x₁`, `x_S`, `x₂`.
 *
 * QUATRE détecteurs (remplacent `SIGNE_VARIATION_PARTIEL` pour ces variantes ; chaque ligne est classée indépendamment, `not_equivalent` seulement) :
 *   ligne de signe      : INVERSE = chaque `+` à la place d'un `−` et inversement (les `0` justes)  → `TABLEAU_SIGNE_INVERSE` ;
 *                         PARTIELLE = au moins une case juste ET une fausse, hors inverse           → `TABLEAU_SIGNE_PARTIEL` ;
 *   ligne de variations : INVERSE = `↗ ↘` échangés et `⌢ ⌣` échangés (sens de la parabole inversé)    → `TABLEAU_CONCAVITE_INCORRECTE` ;
 *                         PARTIELLE = au moins une case juste ET une fausse, hors inverse           → `TABLEAU_VARIATION_PARTIEL`.
 * Une ligne entièrement fausse sans être l'inverse de la bonne ne donne aucun code.
 */
interface Point {
  x: Exact;
  symbole: string;
  racine: boolean;
  sommet: boolean;
}

const ID_LIGNE_SIGNE = "signe";
const ID_LIGNE_VARIATION = "variation";

/** Les deux lignes du tableau : signes de f(x), puis variations. */
const LIGNES_TABLEAU: LigneTableauSignes[] = [
  { id: ID_LIGNE_SIGNE, libelle: "SIGNE DE $f(x)$" },
  { id: ID_LIGNE_VARIATION, libelle: "VARIATIONS", nature: "variation" },
];

function points(f: FonctionExacte): Point[] {
  if (f.racines.length === 0) return [{ x: f.xS, symbole: "$x_S$", racine: false, sommet: true }];
  if (f.double) return [{ x: f.xS, symbole: "$x_S$", racine: true, sommet: true }];
  return [
    { x: f.racines[0] as Exact, symbole: "$x_1$", racine: true, sommet: false },
    { x: f.xS, symbole: "$x_S$", racine: false, sommet: true },
    { x: f.racines[1] as Exact, symbole: "$x_2$", racine: true, sommet: false },
  ];
}

export interface ColonneCalculee {
  colonne: ColonneTableauSignes;
  /** Valeur de x (EXACTE) représentative de la colonne : la valeur elle-même, ou un point strictement à l'intérieur de l'intervalle. */
  x: Exact;
}

const milieu = (x: Exact, y: Exact): Exact => foisRat(plus(x, y), rat(1, 2));

/** Colonnes `2N+1`. `affichage` décide de ce qui est MONTRÉ, jamais de ce qui est attendu (règle de révélation, RAPPORT §42). */
export function colonnesTableauMD(f: FonctionExacte, affichage: AffichageColonnes): ColonneCalculee[] {
  const pts = points(f);
  const nom = (i: number): string => (affichage === "vraies" ? latexExact((pts[i] as Point).x) : (pts[i] as Point).symbole.slice(1, -1));
  const colonnes: ColonneCalculee[] = [];
  const un = exactDepuisEntier(1);
  pts.forEach((p, i) => {
    const gauche = i === 0 ? `x < ${nom(0)}` : `${nom(i - 1)} < x < ${nom(i)}`;
    colonnes.push({ colonne: { id: `c${2 * i}`, libelle: `$${gauche}$`, genre: "intervalle" }, x: i === 0 ? plus(p.x, foisRat(un, rat(-1))) : milieu((pts[i - 1] as Point).x, p.x) });
    colonnes.push({
      colonne: {
        id: `c${2 * i + 1}`,
        libelle: `$x = ${nom(i)}$`,
        genre: "valeur",
        valeur: affichage === "vraies" ? `$${latexExact(p.x)}$` : p.symbole,
        ...(affichage === "vraies" ? { symbole: p.symbole } : {}),
        ...(p.racine ? { racine: true } : {}),
        ...(p.sommet ? { sommet: true } : {}),
      },
      x: p.x,
    });
  });
  const dernier = pts[pts.length - 1] as Point;
  colonnes.push({ colonne: { id: `c${2 * pts.length}`, libelle: `$x > ${nom(pts.length - 1)}$`, genre: "intervalle" }, x: plus(dernier.x, un) });
  return colonnes;
}

export function ecranTableauMD(f: FonctionExacte, affichage: AffichageColonnes, consigne: string): EcranTableauSignes {
  return { champ: CHAMP_TABLEAU_SIGNES, type: "tableau_signes", consigne, colonnes: colonnesTableauMD(f, affichage).map((c) => c.colonne), lignes: LIGNES_TABLEAU };
}

/** Structure résolue (cases, fusions, alphabets, clés d'ancrage) : indépendante de `affichage`. */
export function rangeesTableauMD(f: FonctionExacte): RangeeResolue[] {
  return resoudreRangees(ecranTableauMD(f, "symboliques", ""));
}

const signeDe = (s: -1 | 0 | 1): string => (s > 0 ? SIGNE_PLUS : s < 0 ? SIGNE_MOINS : SIGNE_ZERO);

/** Réponse attendue `{ signe: { c0… }, variation: { c0, c3, c4 } }` (clés d'ancrage). Exacte. */
export function solutionTableauMD(f: FonctionExacte): Record<string, Record<string, string>> {
  const colonnes = colonnesTableauMD(f, "symboliques");
  const x = new Map(colonnes.map((c) => [c.colonne.id, c.x]));
  const sommets = new Set(colonnes.filter((c) => c.colonne.sommet).map((c) => c.colonne.id));
  const [A, B, C] = [exactDepuisRat(f.a), f.b, exactDepuisRat(f.c)];
  const signes: Record<string, string> = {};
  const variation: Record<string, string> = {};
  for (const rangee of rangeesTableauMD(f)) {
    for (const cellule of rangee.cellules) {
      const abscisse = x.get(cellule.ancre) as Exact;
      if (rangee.ligne === ID_LIGNE_SIGNE) signes[cellule.ancre] = signeDe(signe(evaluerPolynome(A, B, C, abscisse)));
      else if (cellule.couvre.some((id) => sommets.has(id))) variation[cellule.ancre] = f.a.n > 0 ? "⌣" : "⌢";
      else variation[cellule.ancre] = comparer(abscisse, f.xS) < 0 ? (f.a.n > 0 ? "↘" : "↗") : f.a.n > 0 ? "↗" : "↘";
    }
  }
  return { [ID_LIGNE_SIGNE]: signes, [ID_LIGNE_VARIATION]: variation };
}

const SYMETRIQUE: Readonly<Record<string, string>> = { [SIGNE_PLUS]: SIGNE_MOINS, [SIGNE_MOINS]: SIGNE_PLUS, [SIGNE_ZERO]: SIGNE_ZERO, "↗": "↘", "↘": "↗", "⌢": "⌣", "⌣": "⌢" };

type ClasseLigne = "juste" | "inverse" | "partielle" | "fausse";

/** Classe une ligne : toutes les clés d'ancrage de `attendu` sont présentes dans `saisi` (déjà contrôlé par `comparerCasesTableau`). */
function classerLigne(saisi: Readonly<Record<string, string>>, attendu: Readonly<Record<string, string>>): ClasseLigne {
  const ancres = Object.keys(attendu);
  const justes = ancres.filter((a) => saisi[a] === attendu[a]).length;
  if (justes === ancres.length) return "juste";
  if (ancres.every((a) => saisi[a] === SYMETRIQUE[attendu[a] as string])) return "inverse";
  return justes > 0 ? "partielle" : "fausse";
}

export function verifierTableauMD(f: FonctionExacte, reponseBrute: string): ResultatVerification {
  const d = decoderTableauSignes(reponseBrute);
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const solution = solutionTableauMD(f);
  const comparaison = comparerCasesTableau(rangeesTableauMD(f), d.valeur, solution);
  if (!comparaison.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: comparaison.message };
  if (comparaison.tousJustes) return { statut: "correct", codesCompetence: [] };
  const saisi: CasesTableauSignes = d.valeur;
  const classes = (ligne: string): ClasseLigne => classerLigne(saisi[ligne] as Record<string, string>, solution[ligne] as Record<string, string>);
  const [cs, cv] = [classes(ID_LIGNE_SIGNE), classes(ID_LIGNE_VARIATION)];
  // Cases fausses (RAPPORT §52) : celles dont la valeur diffère de la solution, désignées par `<ligne>:<ancre>`.
  const partiesFausses = rangeesTableauMD(f).flatMap((rangee) => rangee.cellules.filter((c) => (saisi[rangee.ligne] as Record<string, string>)[c.ancre] !== (solution[rangee.ligne] as Record<string, string>)[c.ancre]).map((c) => `${rangee.ligne}:${c.ancre}`));
  const codes: string[] = [];
  if (cs === "inverse") codes.push(CODE_TABLEAU_SIGNE_INVERSE);
  else if (cs === "partielle") codes.push(CODE_TABLEAU_SIGNE_PARTIEL);
  if (cv === "inverse") codes.push(CODE_TABLEAU_CONCAVITE_INCORRECTE);
  else if (cv === "partielle") codes.push(CODE_TABLEAU_VARIATION_PARTIEL);
  return { statut: "not_equivalent", codesCompetence: codes, partiesFausses };
}

/** Solution lisible (texte d'auteur) : « Signe : + 0 - 0 + ; Variations : ↘ ⌣ ↗ ». */
export function solutionTableauTexte(f: FonctionExacte): string {
  const sol = solutionTableauMD(f);
  return rangeesTableauMD(f)
    .map((rangee) => `${rangee.ligne === ID_LIGNE_SIGNE ? "Signe" : "Variations"} : ${rangee.cellules.map((c) => (sol[rangee.ligne] as Record<string, string>)[c.ancre]).join(" ")}`)
    .join(" ; ");
}
