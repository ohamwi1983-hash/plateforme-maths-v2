import { versTexteBrut } from "../texteMath.js";
import { aDesParties, creerMarquage, fausse } from "./marquage.js";

/**
 * Composant d'écran « champ_expression » : un champ de saisie libre. État d'édition = la valeur du
 * `<input>`, privée à ce composant ; le moteur n'en obtient une copie (`lireReponse`) qu'au moment de
 * la confirmation. Aucun marquage pendant la frappe.
 */
export default {
  type: "champ_expression",

  creer(ecran, { surSoumission, surChangement, valeurInitiale }) {
    const element = document.createElement("div");
    element.className = "moteur-champ-expression";
    const entree = document.createElement("input");
    entree.type = "text";
    entree.className = "moteur-champ";
    entree.autocomplete = "off";
    entree.autocapitalize = "off";
    entree.spellcheck = false;
    entree.placeholder = versTexteBrut(ecran.placeholder || ""); // attribut : texte brut, jamais de balisage
    entree.setAttribute("aria-label", "Ta réponse");
    if (typeof valeurInitiale === "string") entree.value = valeurInitiale; // réponse déjà confirmée (retour en arrière) : texte d'élève, jamais interprété
    entree.addEventListener("input", () => surChangement());
    entree.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        surSoumission();
      }
    });
    element.appendChild(entree);
    // Partie fausse (RAPPORT §52) : l'identifiant `champ` désigne le champ ; modifier le texte retire la marque.
    const marquage = creerMarquage((id) => (id === "champ" ? { elements: [entree], declencheurs: [[entree, "input"]] } : null));
    return {
      element,
      marquer: (ids) => marquage.marquer(ids),
      lireReponse() {
        const valeur = entree.value.trim();
        return valeur === "" ? null : valeur;
      },
      desactiver(actif) {
        entree.disabled = actif;
      },
      focus() {
        entree.focus();
      },
    };
  },

  resumer(_ecran, valeurSaisie, partiesFausses) {
    return aDesParties(partiesFausses) && partiesFausses.includes("champ") ? [fausse({ texte: valeurSaisie })] : valeurSaisie;
  },
};
