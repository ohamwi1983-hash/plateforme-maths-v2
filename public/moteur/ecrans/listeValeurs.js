/**
 * Composant d'écran « liste_valeurs » : liste à taille variable (ajout/retrait de lignes). Les lignes
 * en cours de composition sont l'ÉTAT D'ÉDITION, privé à ce composant ; `reponseBrute` = tableau JSON
 * des valeurs non vides, produit uniquement par `lireReponse()` à la confirmation. L'ordre de saisie
 * est conservé ; la comparaison (en ensemble) appartient au générateur, jamais à ce composant.
 */
export default {
  type: "liste_valeurs",

  creer(ecran, { surSoumission, surChangement }) {
    const element = document.createElement("div");
    element.className = "moteur-liste-valeurs";
    const lignes = document.createElement("ul");
    lignes.className = "moteur-liste-lignes";
    const ajout = document.createElement("button");
    ajout.type = "button";
    ajout.className = "moteur-bouton moteur-bouton-secondaire";
    ajout.textContent = ecran.etiquetteAjout || "Ajouter une valeur";
    element.append(lignes, ajout);

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
      retirer.textContent = "×";
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

    return {
      element,
      lireReponse() {
        const valeurs = entrees.map((e) => e.value.trim()).filter((v) => v !== "");
        return valeurs.length === 0 ? null : JSON.stringify(valeurs);
      },
      desactiver(actif) {
        ajout.disabled = actif;
        for (const e of entrees) e.disabled = actif;
        for (const b of lignes.querySelectorAll("button")) b.disabled = actif;
      },
      focus() {
        entrees[0].focus();
      },
    };
  },

  resumer(_ecran, valeurSaisie) {
    try {
      const valeurs = JSON.parse(valeurSaisie);
      return Array.isArray(valeurs) ? valeurs.join(", ") : valeurSaisie;
    } catch {
      return valeurSaisie;
    }
  },
};
