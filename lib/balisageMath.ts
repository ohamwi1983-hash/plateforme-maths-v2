/**
 * Balisage mathématique des textes servis — partie SERVEUR (sûre en production, aucune dépendance à
 * `public/`). Convention complète : CLAUDE.md « Balisage mathématique ». La segmentation d'un texte
 * (`$…$`) vit ailleurs et une seule fois : `public/moteur/texteMath.js` ; ce module ne porte que la
 * LISTE des commandes interdites, à un seul endroit réel, et son détecteur.
 *
 * Pourquoi une liste noire : une couleur, un style, un lien ou une image ne doivent jamais venir d'un
 * texte servi (couleur = token de design ; jamais une valeur dans un texte). La seule couleur admise
 * dans un texte affiché est le RÔLE a/b/c de l'aide typée `formule_coloree` (lib/aideTypee.ts), une
 * énumération fermée que le client assemble lui-même.
 */

/** Noms de commandes LaTeX (sans antislash) refusés dans le contenu d'un segment mathématique. */
export const COMMANDES_MATH_INTERDITES: readonly string[] = [
  "color",
  "textcolor",
  "colorbox",
  "fcolorbox",
  "pagecolor",
  "mathcolor",
  "htmlClass",
  "htmlStyle",
  "htmlId",
  "htmlData",
  "href",
  "url",
  "includegraphics",
];

/** Commandes interdites présentes dans `latex` (chacune une fois, dans l'ordre d'apparition). */
export function commandesInterditesDans(latex: string): string[] {
  const trouvees: string[] = [];
  for (const m of latex.matchAll(/\\([A-Za-z]+)/g)) {
    if (COMMANDES_MATH_INTERDITES.includes(m[1]) && !trouvees.includes(m[1])) trouvees.push(m[1]);
  }
  return trouvees;
}
