import type { FigureDeclaree } from "./contratGenerateur";

/** Bornes de sûreté d'une figure : un défaut du générateur (jamais de l'élève) doit échouer BRUYAMMENT, avant d'atteindre le navigateur. */
export const COORDONNEE_FIGURE_MAX = 1e6;
export const GRADUATIONS_MAX = 60;
export const DESCRIPTION_FIGURE_MAX = 200;

const fini = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= COORDONNEE_FIGURE_MAX;

/** Problèmes d'une figure déclarée (vide = valide). Ne lève jamais. */
export function validerFigure(figure: unknown): string[] {
  if (typeof figure !== "object" || figure === null || Array.isArray(figure)) return ["figure : objet attendu"];
  const f = figure as Record<string, unknown>;
  const problemes: string[] = [];
  if (f.type !== "graphe_parabole") return [`figure : type inconnu « ${String(f.type)} » (graphe_parabole)`];
  for (const k of Object.keys(f).filter((c) => !["type", "fenetre", "graduations", "courbe", "description"].includes(c))) problemes.push(`figure : clé inconnue « ${k} »`);
  const fen = f.fenetre as Record<string, unknown> | undefined;
  if (typeof fen !== "object" || fen === null || !fini(fen.xMin) || !fini(fen.xMax) || !fini(fen.yMin) || !fini(fen.yMax)) problemes.push("figure : `fenetre` doit porter xMin, xMax, yMin, yMax (nombres finis)");
  else {
    if (!((fen.xMin as number) < (fen.xMax as number)) || !((fen.yMin as number) < (fen.yMax as number))) problemes.push("figure : la fenêtre doit avoir xMin < xMax et yMin < yMax");
    const grad = f.graduations as Record<string, unknown> | undefined;
    for (const axe of ["x", "y"] as const) {
      const liste = typeof grad === "object" && grad !== null ? grad[axe] : undefined;
      if (!Array.isArray(liste) || liste.length > GRADUATIONS_MAX || !liste.every(fini)) problemes.push(`figure : graduations.${axe} doit être une liste d'au plus ${GRADUATIONS_MAX} nombres finis`);
      else {
        const [lo, hi] = axe === "x" ? [fen.xMin as number, fen.xMax as number] : [fen.yMin as number, fen.yMax as number];
        if (liste.some((v) => v < lo || v > hi)) problemes.push(`figure : une graduation ${axe} est hors de la fenêtre`);
      }
    }
  }
  const c = f.courbe as Record<string, unknown> | undefined;
  if (typeof c !== "object" || c === null || !["x0", "y0", "xc", "yc", "x1", "y1"].every((k) => fini(c[k]))) problemes.push("figure : `courbe` doit porter x0, y0, xc, yc, x1, y1 (nombres finis)");
  if (typeof f.description !== "string" || f.description.trim() === "" || f.description.length > DESCRIPTION_FIGURE_MAX || f.description.includes("$")) {
    problemes.push(`figure : \`description\` doit être un texte brut non vide (≤ ${DESCRIPTION_FIGURE_MAX} caractères, sans « $ »)`);
  }
  return problemes;
}

export function figureValide(figure: FigureDeclaree | undefined): boolean {
  return figure === undefined || validerFigure(figure).length === 0;
}
