/**
 * Point UNIQUE de rendu d'un texte d'énoncé/d'aide/de résultat (consigne, libellé, message). Phase 2 :
 * texte brut, jamais interprété comme HTML (`textContent`, pas d'injection possible depuis un
 * générateur). Un rendu mathématique (KaTeX) se branchera ici, et seulement ici, en phase 3 — aucun
 * composant d'écran n'écrit directement dans le DOM le texte qu'un générateur fournit.
 */
export function rendreTexte(element, texte) {
  element.textContent = texte;
}
