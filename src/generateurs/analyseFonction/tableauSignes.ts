import type { ColonneTableauSignes, EcranTableauSignes, LigneTableauSignes, ResultatVerification } from "../../../lib/contratGenerateur";
import { decoderTableauSignes } from "../../../lib/reponsesEcran";
import { comparerCasesTableau, resoudreRangees, type RangeeResolue } from "../../../lib/structureTableau";
import { latexRacine } from "./formatage";
import { CHAMP_TABLEAU_SIGNES, CODE_SIGNE_VARIATION_PARTIEL, type FonctionSecondDegre } from "./types";

/**
 * Écran `tableauSignes` : signe de `f` puis variations, UNE tentative pour les deux lignes
 * (`pilote:src/moteur/analyseFonction.ts:119-128`, `pilote:src/generateurs/analyseFonction/grille.ts` @ 6acc102), sur le
 * contrat de tableau STRUCTURÉ de la révision (RAPPORT §30 : `lib/structureTableau.ts`, seule dérivation des cases).
 *
 * Colonnes : `[xS]` (3 colonnes) si la racine est double ou fictive (`produit_remarquable`, `irreductible`), sinon
 * `[r₁, xS, r₂]` (7 colonnes). Les trois configurations réelles :
 *  - aucune racine réelle (`irreductible`)  : `xS` n'est PAS une racine → 2 valeurs partout, jamais de « 0 » ;
 *  - racine double (`produit_remarquable`)  : `xS` est LA racine → 3 valeurs au centre ;
 *  - deux racines                           : `x₁` et `x₂` à 3 valeurs, `xS` et les intervalles à 2.
 * Variations : cases FUSIONNÉES par groupes délimités par `xS` (le sommet) — une case avant, une au sommet, une après ;
 * `↗ ↘` sur un intervalle, `⌢ ⌣` au sommet. Attendu par évaluation DIRECTE de `f` en une valeur représentative de
 * chaque colonne (jamais par propagation de signe).
 *
 * `SIGNE_VARIATION_PARTIEL` : `not_equivalent` et ligne des signes juste XOR ligne des variations juste.
 * Divergences DÉLIBÉRÉES (RAPPORT §33) : une case dont la valeur n'appartient pas à SES choix (« 0 » sur un intervalle, ⌢ sur
 * une flèche…) est un `parse_error` (l'ancien : cycle unique de 4 symboles sur toutes les cases, donc `not_equivalent`) ;
 * les variations d'une case fusionnée sont UNE réponse (l'ancien : une par colonne, toutes contraintes d'être égales).
 */
export type AffichageColonnes = "vraies" | "symboliques";

export interface ColonneCalculee {
  colonne: ColonneTableauSignes;
  /** Valeur de x représentative de la colonne (la valeur elle-même, ou un point strictement à l'intérieur de l'intervalle). */
  x: number;
}

const ID_LIGNE_SIGNE = "signe";
const ID_LIGNE_VARIATION = "variation";

function points(f: FonctionSecondDegre): { x: number; symbole: string; racine: boolean; sommet: boolean }[] {
  const { racines, xS } = f;
  if (racines === null) return [{ x: xS, symbole: "$x_S$", racine: false, sommet: true }];
  if (racines[0] === racines[1]) return [{ x: xS, symbole: "$x_S$", racine: true, sommet: true }];
  return [
    { x: racines[0], symbole: "$x_1$", racine: true, sommet: false },
    { x: xS, symbole: "$x_S$", racine: false, sommet: true },
    { x: racines[1], symbole: "$x_2$", racine: true, sommet: false },
  ];
}

/**
 * Colonnes `2N+1` du tableau. `affichage` décide de ce qui est MONTRÉ, jamais de ce qui est attendu :
 *  - `vraies` (correction immédiate) : la valeur de x dans la ligne des x, le symbole dans la bande au-dessus ;
 *  - `symboliques` (correction coupée) : seulement `x₁`, `xS`, `x₂` — les vraies valeurs sont la solution des écrans
 *    `axeSommet` et `racinesChamp2` et ne doivent pas être révélées avant la fin de la tâche (règle de révélation).
 * Le nom accessible de chaque colonne suit la même règle (aucune valeur numérique en mode symbolique).
 */
export function colonnesTableau(f: FonctionSecondDegre, affichage: AffichageColonnes): ColonneCalculee[] {
  const pts = points(f);
  const nom = (i: number): string => (affichage === "vraies" ? latexRacine((pts[i] as { x: number }).x) : (pts[i] as { symbole: string }).symbole.slice(1, -1));
  const colonnes: ColonneCalculee[] = [];
  pts.forEach((p, i) => {
    const gauche = i === 0 ? `x < ${nom(0)}` : `${nom(i - 1)} < x < ${nom(i)}`;
    colonnes.push({ colonne: { id: `c${2 * i}`, libelle: `$${gauche}$`, genre: "intervalle" }, x: i === 0 ? p.x - 1 : ((pts[i - 1] as { x: number }).x + p.x) / 2 });
    colonnes.push({
      colonne: {
        id: `c${2 * i + 1}`,
        libelle: `$x = ${nom(i)}$`,
        genre: "valeur",
        valeur: affichage === "vraies" ? `$${latexRacine(p.x)}$` : p.symbole,
        ...(affichage === "vraies" ? { symbole: p.symbole } : {}),
        ...(p.racine ? { racine: true } : {}),
        ...(p.sommet ? { sommet: true } : {}),
      },
      x: p.x,
    });
  });
  const dernier = pts[pts.length - 1] as { x: number };
  colonnes.push({ colonne: { id: `c${2 * pts.length}`, libelle: `$x > ${nom(pts.length - 1)}$`, genre: "intervalle" }, x: dernier.x + 1 });
  return colonnes;
}

export const LIGNES_TABLEAU: LigneTableauSignes[] = [
  { id: ID_LIGNE_SIGNE, libelle: "SIGNE DE $f(x)$" },
  { id: ID_LIGNE_VARIATION, libelle: "VARIATIONS", nature: "variation" },
];

/** Écran complet (sans aide ni dépendance : ajoutées par l'assemblage). */
export function ecranTableauSignes(f: FonctionSecondDegre, affichage: AffichageColonnes, consigne: string): EcranTableauSignes {
  return { champ: CHAMP_TABLEAU_SIGNES, type: "tableau_signes", consigne, colonnes: colonnesTableau(f, affichage).map((c) => c.colonne), lignes: LIGNES_TABLEAU };
}

/** Structure résolue (cases, fusions, alphabets, clés d'ancrage) : indépendante de `affichage`. */
export function rangeesTableau(f: FonctionSecondDegre): RangeeResolue[] {
  return resoudreRangees(ecranTableauSignes(f, "symboliques", ""));
}

const f_ = (f: FonctionSecondDegre, x: number): number => f.a * x * x + f.b * x + f.c;
/** Signe d'une valeur de f ; « 0 » à la tolérance flottante près (une racine irrationnelle d'une fonction effective donne f(r) ≈ 1e-15, pas 0). */
const signeReel = (v: number, echelle: number): string => (Math.abs(v) <= 1e-9 * Math.max(1, echelle) ? "0" : v > 0 ? "+" : "-");

/** Réponse attendue `{ signe: { c0… }, variation: { c0, c3, c4 } }` (clés d'ancrage). */
export function solutionTableau(f: FonctionSecondDegre): Record<string, Record<string, string>> {
  const colonnes = colonnesTableau(f, "symboliques");
  const x = new Map(colonnes.map((c) => [c.colonne.id, c.x]));
  const sommets = new Set(colonnes.filter((c) => c.colonne.sommet).map((c) => c.colonne.id));
  const signes: Record<string, string> = {};
  const variation: Record<string, string> = {};
  for (const rangee of rangeesTableau(f)) {
    for (const cellule of rangee.cellules) {
      const abscisse = x.get(cellule.ancre) as number;
      if (rangee.ligne === ID_LIGNE_SIGNE) signes[cellule.ancre] = signeReel(f_(f, abscisse), Math.abs(f.a) * abscisse * abscisse + Math.abs(f.b) * Math.abs(abscisse) + Math.abs(f.c));
      else if (cellule.couvre.some((id) => sommets.has(id))) variation[cellule.ancre] = f.a > 0 ? "⌣" : "⌢";
      else variation[cellule.ancre] = abscisse < f.xS ? (f.a > 0 ? "↘" : "↗") : f.a > 0 ? "↗" : "↘";
    }
  }
  return { [ID_LIGNE_SIGNE]: signes, [ID_LIGNE_VARIATION]: variation };
}

export function verifierTableauSignes(f: FonctionSecondDegre, reponseBrute: string): ResultatVerification {
  const d = decoderTableauSignes(reponseBrute);
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const comparaison = comparerCasesTableau(rangeesTableau(f), d.valeur, solutionTableau(f));
  if (!comparaison.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: comparaison.message };
  if (comparaison.tousJustes) return { statut: "correct", codesCompetence: [] };
  const signeOk = comparaison.lignesJustes.get(ID_LIGNE_SIGNE) === true;
  const variationOk = comparaison.lignesJustes.get(ID_LIGNE_VARIATION) === true;
  return { statut: "not_equivalent", codesCompetence: signeOk !== variationOk ? [CODE_SIGNE_VARIATION_PARTIEL] : [] };
}
