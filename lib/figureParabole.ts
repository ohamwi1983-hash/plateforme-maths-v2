import type { FigureGrapheParabole } from "./contratGenerateur";

/**
 * Construction de la FIGURE d'une parabole `y = a(x − p)² + q` (RAPPORT §56) : fenêtre ajustée aux points à montrer, graduations entières, arc de Bézier quadratique EXACT.
 * Partagée par gen8 et le témoin technique (jamais deux constructeurs). Pure : mêmes entrées, même figure. Les coordonnées de `S = (p ; q)` et de `A = (xA ; yA)` ne sont PAS dans la
 * figure (elles ne sortent que par l'aide `annotations_figure`) ; elles sont renvoyées à part au générateur, qui les met dans ses paliers.
 */
export interface EntreeFigureParabole {
  a: number;
  p: number;
  q: number;
  /** Abscisse (entière) du second point `A`. */
  xA: number;
  description: string;
}

export interface FigureEtPoints {
  figure: FigureGrapheParabole;
  sommet: { x: number; y: number };
  pointA: { x: number; y: number };
}

const arrondir = (v: number): number => Math.round(v * 1e9) / 1e9;
const f = (a: number, p: number, q: number, x: number): number => a * (x - p) * (x - p) + q;

/** Pas de graduation (1, 2, 5, 10, 20, 50…) tel qu'il y en ait au plus `maxGraduations` sur l'étendue. */
export function pasDeGraduation(etendue: number, maxGraduations = 12): number {
  for (const echelle of [1, 10, 100, 1000]) for (const base of [1, 2, 5]) if (etendue / (base * echelle) <= maxGraduations) return base * echelle;
  return 5000;
}

function graduations(min: number, max: number): number[] {
  const pas = pasDeGraduation(max - min);
  const liste: number[] = [];
  for (let v = Math.ceil(min / pas) * pas; v <= max; v += pas) liste.push(arrondir(v));
  return liste;
}

export function figureParabole(e: EntreeFigureParabole): FigureEtPoints {
  const yA = f(e.a, e.p, e.q, e.xA);
  const yAEntier = Math.abs(yA - Math.round(yA)) < 1e-9 ? Math.round(yA) : yA;
  const [xLo, xHi] = [Math.min(e.p, e.xA), Math.max(e.p, e.xA)];
  const [yLo, yHi] = [Math.min(e.q, yAEntier), Math.max(e.q, yAEntier)];
  // Marge « visuelle, sans excès » : la moitié de l'écart horizontal (au moins 1), le quart de l'écart vertical (au moins 1).
  const mx = Math.max(1, Math.ceil((xHi - xLo) * 0.5));
  const my = Math.max(1, Math.ceil((yHi - yLo) * 0.25));
  const fenetre = { xMin: xLo - mx, xMax: xHi + mx, yMin: yLo - my, yMax: yHi + my };
  const x0 = fenetre.xMin;
  const x1 = fenetre.xMax;
  const y0 = f(e.a, e.p, e.q, x0);
  const xc = (x0 + x1) / 2;
  const yc = y0 + 2 * e.a * (x0 - e.p) * (xc - x0); // intersection des tangentes aux extrémités (arc de parabole exact)
  return {
    figure: {
      type: "graphe_parabole",
      fenetre,
      graduations: { x: graduations(fenetre.xMin, fenetre.xMax), y: graduations(fenetre.yMin, fenetre.yMax) },
      courbe: { x0: arrondir(x0), y0: arrondir(y0), xc: arrondir(xc), yc: arrondir(yc), x1: arrondir(x1), y1: arrondir(f(e.a, e.p, e.q, x1)) },
      description: e.description,
    },
    sommet: { x: e.p, y: e.q },
    pointA: { x: e.xA, y: yAEntier },
  };
}

/** Ordonnée de la courbe de la figure à l'abscisse `x` (évalue l'arc de Bézier, pas la fonction d'origine) : sert aux tests « les marques sont sur la courbe ». */
export function ordonneeSurLaCourbe(figure: FigureGrapheParabole, x: number): number {
  const { x0, y0, xc, yc, x1, y1 } = figure.courbe;
  const t = (x - x0) / (x1 - x0); // x(t) est linéaire (contrôle au milieu)
  void xc;
  return (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * yc + t * t * y1;
}
