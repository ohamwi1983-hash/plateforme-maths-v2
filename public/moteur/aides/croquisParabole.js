/**
 * Aide typée « croquis_parabole » : croquis de y = ax² + bx + c (module partagé `../croquis.js`).
 * Les options (`marqueS`, `surlignageImf`, `marquesOx`) sont les surcouches ; ce composant ne
 * calcule rien d'autre qu'un affichage.
 */
import { construireCroquisParabole } from "../croquis.js";

export default {
  type: "croquis_parabole",

  creer(aide) {
    const element = document.createElement("div");
    element.className = "moteur-aide-visuelle moteur-aide-croquis";
    element.appendChild(construireCroquisParabole(aide));
    return element;
  },
};
