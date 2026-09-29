/**
 * Point UNIQUE d'écriture d'un texte dans le DOM (consigne, libellé, aide, résultat, message) : aucun
 * composant d'écran n'écrit directement dans le DOM un texte qu'un générateur fournit. Jamais
 * interprété comme HTML (`textContent`, nœuds texte : aucune injection possible depuis un générateur
 * ni depuis un élève).
 *
 * Trois sortes de texte (CLAUDE.md « Balisage mathématique ») :
 *  - texte d'AUTEUR (généré par un générateur ou par le moteur pour l'élève) : `{ math: true }`, le
 *    balisage `$…$` est segmenté (`texteMath.js`) et chaque segment mathématique passe par `rendreMath` ;
 *  - texte d'ÉLÈVE (ce qu'il a tapé) et texte d'INTERFACE : sans option, texte brut — un `$` tapé par un
 *    élève reste un `$` ;
 *  - attribut (`placeholder`, `aria-label`) : `versTexteBrut` (texteMath.js).
 */
import { decouperTexteMath } from "./texteMath.js";

/**
 * Rendu d'UN segment mathématique. Phase 3b-1 : repli lisible (la source LaTeX en texte). La phase 3c
 * remplace CETTE fonction, et elle seule, par le rendu KaTeX ; l'appelant ne change pas.
 */
export function rendreMath(element, latex) {
  element.classList.add("moteur-math");
  element.textContent = latex;
}

/**
 * @param {Element} element
 * @param {string} texte
 * @param {{ math?: boolean }} [options] `math: true` pour un texte d'auteur ; sans option : texte brut.
 */
export function rendreTexte(element, texte, options = {}) {
  if (!options.math) {
    element.textContent = texte;
    return;
  }
  const { segments } = decouperTexteMath(texte);
  element.replaceChildren();
  for (const segment of segments) {
    if (segment.type === "texte") {
      element.append(document.createTextNode(segment.valeur));
    } else {
      const span = document.createElement("span");
      rendreMath(span, segment.valeur);
      element.append(span);
    }
  }
}
