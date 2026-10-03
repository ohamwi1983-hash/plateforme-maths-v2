/**
 * Enveloppe TYPÉE, pour les TESTS uniquement, du module client `public/moteur/texteMath.js` (ES natif,
 * hors `include` de tsconfig : un import statique sans types échoue à `tsc -b`, un `require` non). La
 * production (`lib/`, `api/`, `src/`) n'importe JAMAIS depuis `public/` : le serveur n'a besoin que de
 * `lib/balisageMath.ts`. Aucune logique ici : la segmentation reste écrite une seule fois, dans le
 * fichier client ; `verifierBalisageMath` la COMPOSE avec la liste unique de lib/balisageMath.ts.
 */
import { commandesInterditesDans } from "../../lib/balisageMath";

export interface SegmentTexteMath {
  type: "texte" | "math";
  valeur: string;
}

interface ModuleTexteMath {
  decouperTexteMath(texte: string): { valide: boolean; segments: SegmentTexteMath[] };
  versTexteBrut(texte: string): string;
  assemblerFormuleColoree(segments: { latex: string; role?: string; emphase?: boolean }[]): string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const module_: ModuleTexteMath = require("../../public/moteur/texteMath.js");

export const decouperTexteMath = module_.decouperTexteMath;
export const versTexteBrut = module_.versTexteBrut;
export const assemblerFormuleColoree = module_.assemblerFormuleColoree;

/**
 * Problèmes de balisage d'un texte d'auteur (vide = sain) : `$` non fermé, `$$`, contenu vide, et
 * commandes interdites (lib/balisageMath.ts) dans un segment mathématique. Destiné aux tests des
 * générateurs : chaque texte servi par chaque exercice de test doit passer.
 */
export function verifierBalisageMath(texte: string): string[] {
  const problemes: string[] = [];
  const { valide, segments } = decouperTexteMath(texte);
  if (!valide) {
    problemes.push(texte.includes("$$") ? "« $$ » interdit (pas de mode display)" : "balisage `$…$` invalide (non fermé ou contenu vide)");
    return problemes;
  }
  for (const s of segments) {
    if (s.type !== "math") continue;
    for (const c of commandesInterditesDans(s.valeur)) problemes.push(`commande interdite \\${c} dans « $${s.valeur}$ »`);
  }
  return problemes;
}
