import { rendreTexte } from "../rendreTexte.js";

/**
 * Composant d'écran « qcm » : choix fermé, un seul retenu. `reponseBrute` = `id` du choix. Le libellé
 * d'un choix est un texte d'AUTEUR (balisage `$…$` admis) : rendu par `rendreTexte(…, { math: true })`.
 */
export default {
  type: "qcm",

  creer(ecran, { surChangement, valeurInitiale }) {
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
      bouton.checked = valeurInitiale === choix.id; // réponse déjà confirmée (retour en arrière)
      bouton.addEventListener("change", () => surChangement());
      const texte = document.createElement("span");
      rendreTexte(texte, choix.libelle, { math: true });
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
    // Le libellé du choix est un texte d'AUTEUR (rendu avec le balisage) ; repli sur l'`id` brut = texte d'élève.
    return choix ? [{ texte: choix.libelle, auteur: true }] : valeurSaisie;
  },
};
