/**
 * Aide typée « formule_coloree » : une formule découpée en segments LaTeX ; un segment avec `role`
 * (a, b ou c) prend la couleur de surbrillance du coefficient (classe `moteur-coef-a|b|c`, tokens de
 * design). Le contenu est une DONNÉE validée par le serveur (`validerAide`, lib/aideTypee.ts) : le client
 * assemble, il ne compose rien.
 *
 * Les segments sont assemblés en UNE SEULE chaîne LaTeX (`assemblerFormuleColoree`, texteMath.js) rendue en
 * un seul appel : des fragments rendus séparément perdraient l'espacement des opérateurs. C'est le seul
 * appel de `rendreMath` qui active la confiance restreinte (`roles: true`), limitée aux trois classes
 * de coefficient.
 */
import { rendreMath } from "../rendreTexte.js";
import { assemblerFormuleColoree } from "../texteMath.js";

export default {
  type: "formule_coloree",

  creer(aide) {
    const element = document.createElement("div");
    element.className = "moteur-aide-visuelle moteur-formule";
    element.setAttribute("role", "group");
    // Alternative textuelle : la formule complète, sans couleur (l'ordre a, b, c la porte déjà).
    element.setAttribute("aria-label", "Formule : " + aide.segments.map((s) => s.latex).join(""));
    const formule = document.createElement("span");
    rendreMath(formule, assemblerFormuleColoree(aide.segments), { roles: true });
    element.appendChild(formule);
    return element;
  },
};
