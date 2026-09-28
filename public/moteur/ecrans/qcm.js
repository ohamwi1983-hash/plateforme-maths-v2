/** Composant d'écran « qcm » : choix fermé, un seul retenu. `reponseBrute` = `id` du choix. */
export default {
  type: "qcm",

  creer(ecran, { surChangement }) {
    const element = document.createElement("div");
    element.className = "moteur-qcm";
    element.setAttribute("role", "radiogroup");
    element.setAttribute("aria-label", "Choisis une réponse");
    const nom = "qcm-" + ecran.champ;
    const boutons = [];
    for (const choix of ecran.choix) {
      const etiquette = document.createElement("label");
      etiquette.className = "moteur-choix";
      const bouton = document.createElement("input");
      bouton.type = "radio";
      bouton.name = nom;
      bouton.value = choix.id;
      bouton.addEventListener("change", () => surChangement());
      const texte = document.createElement("span");
      texte.textContent = choix.libelle;
      etiquette.append(bouton, texte);
      element.appendChild(etiquette);
      boutons.push(bouton);
    }
    return {
      element,
      lireReponse() {
        const retenu = boutons.find((b) => b.checked);
        return retenu ? retenu.value : null;
      },
      desactiver(actif) {
        for (const b of boutons) b.disabled = actif;
      },
      focus() {
        (boutons.find((b) => b.checked) || boutons[0]).focus();
      },
    };
  },

  resumer(ecran, valeurSaisie) {
    const choix = ecran.choix.find((c) => c.id === valeurSaisie);
    return choix ? choix.libelle : valeurSaisie;
  },
};
