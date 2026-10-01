/**
 * Enveloppe TYPÉE, pour les TESTS uniquement, des fonctions PURES de `public/moteur/croquis.js` (aucune n'utilise le DOM). Aucune logique ici (même principe que
 * `scripts/support/texteMath.ts`) : la production n'importe jamais depuis `public/`.
 */
interface ModuleCroquis {
  etiquetteFraction(numerateur: number, denominateur: number): string;
  racinesParabole(a: number, b: number, c: number): { valeur: number; etiquette: string }[] | null;
  descriptionCroquisParabole(p: { a: number; b: number; c: number }): string;
  positionDuSommet(signeAB: string | null | undefined, positionSommet: string | null | undefined): "gauche" | "axe" | "droite" | null;
  descriptionCroquisAllure(signeA: string | null, signeAB: string | null, positionSommet?: string | null): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const module_: ModuleCroquis = require("../../public/moteur/croquis.js");

export const etiquetteFraction = module_.etiquetteFraction;
export const racinesParabole = module_.racinesParabole;
export const descriptionCroquisParabole = module_.descriptionCroquisParabole;
export const positionDuSommet = module_.positionDuSommet;
export const descriptionCroquisAllure = module_.descriptionCroquisAllure;
