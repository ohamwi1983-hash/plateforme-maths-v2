/**
 * Aide typée « formule_coloree » : une formule découpée en segments LaTeX ; un segment avec `role`
 * (a, b ou c) prend la couleur de surbrillance du coefficient (classe `moteur-coef-a|b|c`, tokens de
 * design). Le contenu est une DONNÉE validée par le serveur (`validerAide`, lib/aideTypee.ts) : le client
 * assemble, il ne compose rien.
 *
 * Phase 3b-1 : chaque segment est rendu par `rendreMath` (repli lisible : source LaTeX) dans un `<span>`
 * adjacent. La phase 3c assemblera les segments en UNE seule chaîne LaTeX (des fragments rendus à part
 * perdent l'espacement des opérateurs) ; l'interface de ce composant ne change pas.
 */
import { rendreMath } from "../rendreTexte.js";

export default {
  type: "formule_coloree",

  creer(aide) {
    const element = document.createElement("div");
    element.className = "moteur-aide-visuelle moteur-formule";
    element.setAttribute("role", "group");
    // Alternative textuelle : la formule complète, sans couleur (l'ordre a, b, c la porte déjà).
    element.setAttribute("aria-label", "Formule : " + aide.segments.map((s) => s.latex).join(""));
    for (const segment of aide.segments) {
      const span = document.createElement("span");
      rendreMath(span, segment.latex);
      if (segment.role === "a" || segment.role === "b" || segment.role === "c") span.classList.add("moteur-coef-" + segment.role);
      element.appendChild(span);
    }
    return element;
  },
};
