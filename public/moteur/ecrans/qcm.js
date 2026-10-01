import { rendreTexte } from "../rendreTexte.js";
import { aDesParties, creerMarquage, fausse } from "./marquage.js";

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
    const etiquettes = new Map(); // id du choix -> son <label>
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
      etiquettes.set(choix.id, etiquette);
    }
    // Partie fausse (RAPPORT §52) : l'identifiant est celui du choix COCHÉ ; choisir une autre option retire la marque.
    const marquage = creerMarquage((id) => {
      const etiquette = etiquettes.get(id);
      const bouton = boutons.find((b) => b.value === id);
      return etiquette && bouton ? { elements: [etiquette], controles: [bouton], declencheurs: boutons.map((b) => [b, "change"]) } : null;
    });
    return {
      element,
      marquer: (ids) => marquage.marquer(ids),
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

  resumer(ecran, valeurSaisie, partiesFausses) {
    const choix = ecran.choix.find((c) => c.id === valeurSaisie);
    // Le libellé du choix est un texte d'AUTEUR (rendu avec le balisage) ; repli sur l'`id` brut = texte d'élève.
    if (!choix) return valeurSaisie;
    const piece = { texte: choix.libelle, auteur: true };
    return [aDesParties(partiesFausses) && partiesFausses.includes(valeurSaisie) ? fausse(piece) : piece];
  },
};
