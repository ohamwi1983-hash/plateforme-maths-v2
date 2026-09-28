/**
 * Composant d'écran « champ_expression » : un champ de saisie libre. État d'édition = la valeur du
 * `<input>`, privée à ce composant ; le moteur n'en obtient une copie (`lireReponse`) qu'au moment de
 * la confirmation. Aucun marquage pendant la frappe.
 */
export default {
  type: "champ_expression",

  creer(ecran, { surSoumission, surChangement }) {
    const element = document.createElement("div");
    element.className = "moteur-champ-expression";
    const entree = document.createElement("input");
    entree.type = "text";
    entree.className = "moteur-champ";
    entree.autocomplete = "off";
    entree.autocapitalize = "off";
    entree.spellcheck = false;
    entree.placeholder = ecran.placeholder || "";
    entree.setAttribute("aria-label", "Ta réponse");
    entree.addEventListener("input", () => surChangement());
    entree.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        surSoumission();
      }
    });
    element.appendChild(entree);
    return {
      element,
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

  resumer(_ecran, valeurSaisie) {
    return valeurSaisie;
  },
};
