/**
 * Enveloppe TYPÉE, pour les TESTS uniquement, du module client `public/moteur/apercuLatex.js` (même idiome que `texteMath.ts` : ES natif, hors `include` de tsconfig). La production
 * (`lib/`, `api/`, `src/`) n'importe JAMAIS depuis `public/`. Aucune logique ici.
 */
interface ModuleApercuLatex {
  versLatexApercu(saisie: string): string;
  apercuComplet(libelle: string, saisie: string): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const module_: ModuleApercuLatex = require("../../public/moteur/apercuLatex.js");

export const versLatexApercu = module_.versLatexApercu;
export const apercuComplet = module_.apercuComplet;
