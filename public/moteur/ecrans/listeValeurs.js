import { rendreTexte } from "../rendreTexte.js";
import { aDesParties, creerMarquage, fausse } from "./marquage.js";

/**
 * Composant d'écran « liste_valeurs » : liste à taille variable (ajout/retrait de lignes). Les lignes
 * en cours de composition sont l'ÉTAT D'ÉDITION, privé à ce composant ; `reponseBrute` = tableau JSON
 * des valeurs non vides, produit uniquement par `lireReponse()` à la confirmation. L'ordre de saisie
 * est conservé ; la comparaison (en ensemble) appartient au générateur, jamais à ce composant.
 *
 * Option `permetAucune` : l'écran propose d'abord « aucune valeur » / « au moins une valeur ». Tant que
 * le choix n'est pas fait, il n'y a rien à confirmer (`lireReponse()` = `null`) ; « aucune valeur »
 * produit `"[]"`. Sans l'option, la liste vide n'est jamais confirmable (comportement inchangé).
 */
export default {
  type: "liste_valeurs",

  creer(ecran, { surSoumission, surChangement, valeurInitiale }) {
    const element = document.createElement("div");
    element.className = "moteur-liste-valeurs";

    // Mode (seulement avec `permetAucune`) : null = pas encore choisi, "aucune" ou "valeurs".
    let mode = ecran.permetAucune ? null : "valeurs";
    const choixMode = document.createElement("div");
    choixMode.className = "moteur-choix-mode";
    choixMode.setAttribute("role", "radiogroup");
    choixMode.setAttribute("aria-label", "Y a-t-il des valeurs ?");
    const boutonsMode = new Map();
    const zoneListe = document.createElement("div");
    zoneListe.className = "moteur-liste-zone";

    const lignes = document.createElement("ul");
    lignes.className = "moteur-liste-lignes";
    const ajout = document.createElement("button");
    ajout.type = "button";
    ajout.className = "moteur-bouton moteur-bouton-secondaire";
    rendreTexte(ajout, ecran.etiquetteAjout || "Ajouter une valeur", { math: true });
    zoneListe.append(lignes, ajout);

    const majMode = () => {
      zoneListe.hidden = mode !== "valeurs";
      for (const [cle, bouton] of boutonsMode) {
        bouton.setAttribute("aria-checked", String(mode === cle));
        bouton.classList.toggle("moteur-mode-retenu", mode === cle);
      }
    };
    if (ecran.permetAucune) {
      const definitions = [
        ["aucune", ecran.etiquetteAucune || "Aucune valeur"],
        ["valeurs", ecran.etiquetteAuMoinsUne || "Au moins une valeur"],
      ];
      for (const [cle, libelle] of definitions) {
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "moteur-bouton moteur-bouton-secondaire moteur-bouton-mode";
        bouton.setAttribute("role", "radio");
        rendreTexte(bouton, libelle, { math: true });
        bouton.addEventListener("click", () => {
          mode = cle;
          majMode();
          if (cle === "valeurs" && entrees.length > 0) entrees[0].focus();
          surChangement();
        });
        boutonsMode.set(cle, bouton);
        choixMode.appendChild(bouton);
      }
      element.appendChild(choixMode);
    }
    element.appendChild(zoneListe);

    const entrees = [];
    function ajouterLigne() {
      const li = document.createElement("li");
      li.className = "moteur-liste-ligne";
      const entree = document.createElement("input");
      entree.type = "text";
      entree.className = "moteur-champ";
      entree.autocomplete = "off";
      entree.setAttribute("aria-label", `Valeur ${entrees.length + 1}`);
      entree.addEventListener("input", () => surChangement());
      entree.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          surSoumission();
        }
      });
      const retirer = document.createElement("button");
      retirer.type = "button";
      retirer.className = "moteur-bouton moteur-bouton-secondaire moteur-bouton-retirer";
      retirer.textContent = "\u{1F5D1}"; // 🗑 (référence) ; le contrôle reste un vrai bouton de 44px avec son aria-label
      retirer.setAttribute("aria-label", "Retirer cette valeur");
      retirer.addEventListener("click", () => {
        if (entrees.length === 1) {
          entree.value = "";
        } else {
          entrees.splice(entrees.indexOf(entree), 1);
          li.remove();
        }
        surChangement();
      });
      li.append(entree, retirer);
      lignes.appendChild(li);
      entrees.push(entree);
      return entree;
    }
    ajout.addEventListener("click", () => {
      ajouterLigne().focus();
      surChangement();
    });
    ajouterLigne();
    // Réponse déjà confirmée (retour en arrière) : tableau JSON de valeurs ; tout autre contenu est ignoré (écran vierge).
    if (typeof valeurInitiale === "string") {
      try {
        const valeurs = JSON.parse(valeurInitiale);
        if (Array.isArray(valeurs) && valeurs.every((v) => typeof v === "string")) {
          if (valeurs.length === 0) {
            if (ecran.permetAucune) mode = "aucune";
          } else {
            mode = "valeurs";
            valeurs.forEach((v, i) => {
              (i === 0 ? entrees[0] : ajouterLigne()).value = v;
            });
          }
        }
      } catch {
        /* réponse illisible : écran vierge */
      }
    }
    majMode();

    // Parties fausses (RAPPORT §52) : `ligne:<i>` = i-ième valeur NON VIDE de la liste soumise ; `mode:aucune` = le bouton « pas de valeur » (aucune ligne n'a été proposée). Modifier la ligne
    // (ou changer de mode) retire la marque.
    const marquage = creerMarquage((id) => {
      if (id === "mode:aucune") {
        const bouton = boutonsMode.get("aucune");
        return bouton ? { elements: [bouton], declencheurs: [...boutonsMode.values()].map((b) => [b, "click"]) } : null;
      }
      const m = /^ligne:(\d+)$/.exec(id);
      if (!m) return null;
      const entree = entrees.filter((e) => e.value.trim() !== "")[Number(m[1])];
      return entree ? { elements: [entree], declencheurs: [[entree, "input"]] } : null;
    });

    return {
      element,
      marquer: (ids) => marquage.marquer(ids),
      lireReponse() {
        if (mode === null) return null;
        if (mode === "aucune") return "[]";
        const valeurs = entrees.map((e) => e.value.trim()).filter((v) => v !== "");
        return valeurs.length === 0 ? null : JSON.stringify(valeurs);
      },
      desactiver(actif) {
        ajout.disabled = actif;
        for (const b of boutonsMode.values()) b.disabled = actif;
        for (const e of entrees) e.disabled = actif;
        for (const b of lignes.querySelectorAll("button")) b.disabled = actif;
      },
      focus() {
        if (mode === null) boutonsMode.values().next().value.focus();
        else entrees[0].focus();
      },
    };
  },

  resumer(ecran, valeurSaisie, partiesFausses) {
    try {
      const valeurs = JSON.parse(valeurSaisie);
      if (!Array.isArray(valeurs)) return valeurSaisie;
      // « aucune valeur » est un choix d'AUTEUR (étiquette déclarée), les valeurs sont du texte d'élève.
      if (valeurs.length === 0 && ecran.permetAucune) {
        const piece = { texte: ecran.etiquetteAucune || "Aucune valeur", auteur: true };
        return [aDesParties(partiesFausses) && partiesFausses.includes("mode:aucune") ? fausse(piece) : piece];
      }
      if (aDesParties(partiesFausses)) {
        // Une pièce par valeur : seules les lignes désignées sont surlignées.
        return valeurs.flatMap((v, i) => [...(i > 0 ? [{ texte: ", " }] : []), partiesFausses.includes(`ligne:${i}`) ? fausse({ texte: String(v) }) : { texte: String(v) }]);
      }
      return valeurs.join(", ");
    } catch {
      return valeurSaisie;
    }
  },
};
