/**
 * Aide typée « annotations_figure » (RAPPORT §56) : des annotations posées SUR la figure de l'écran (le graphique principal), pas une illustration à part. Ce composant pose les
 * annotations CUMULÉES du palier servi sur la figure (`figure.annoter`) et ne rend dans la zone d'aide que la LÉGENDE du palier (texte d'auteur). Sans figure (défaut du générateur),
 * la légende s'affiche seule : jamais une exception.
 */
import { rendreTexte } from "../rendreTexte.js";

export default {
  type: "annotations_figure",

  creer(aide, { figure } = {}) {
    if (figure && typeof figure.annoter === "function") figure.annoter(aide.annotations);
    const element = document.createElement("p");
    element.className = "moteur-aide-legende";
    rendreTexte(element, typeof aide.legende === "string" ? aide.legende : "", { math: true });
    return element;
  },
};
