/**
 * Composant d'écran « tableau_signes » : une case par (ligne, colonne), chacune parcourant les signes
 * autorisés au toucher. L'état des cases est l'ÉTAT D'ÉDITION, privé à ce composant ; `reponseBrute`
 * = objet JSON `{ [ligneId]: { [colonneId]: signe } }`, produit uniquement par `lireReponse()`, et
 * seulement quand TOUTES les cases sont renseignées (sinon `null` : rien à confirmer — ce n'est pas
 * une vérification de justesse, seulement de complétude de la saisie).
 */
export default {
  type: "tableau_signes",

  creer(ecran, { surChangement }) {
    const element = document.createElement("div");
    element.className = "moteur-tableau-signes";
    const defilement = document.createElement("div");
    defilement.className = "moteur-tableau-defilement";
    const table = document.createElement("table");
    table.className = "moteur-table-signes";

    const entete = document.createElement("thead");
    const ligneEntete = document.createElement("tr");
    ligneEntete.appendChild(document.createElement("th"));
    for (const colonne of ecran.colonnes) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = colonne.libelle;
      ligneEntete.appendChild(th);
    }
    entete.appendChild(ligneEntete);
    table.appendChild(entete);

    const corps = document.createElement("tbody");
    const cases = new Map(); // "ligne|colonne" -> { bouton, valeur }
    for (const ligne of ecran.lignes) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = ligne.libelle;
      tr.appendChild(th);
      for (const colonne of ecran.colonnes) {
        const td = document.createElement("td");
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "moteur-case-signe";
        const etat = { bouton, valeur: null };
        const rafraichir = () => {
          bouton.textContent = etat.valeur === null ? "?" : etat.valeur;
          bouton.setAttribute("aria-label", `${ligne.libelle}, ${colonne.libelle} : ${etat.valeur === null ? "vide" : etat.valeur}. Toucher pour changer.`);
          bouton.classList.toggle("moteur-case-renseignee", etat.valeur !== null);
        };
        bouton.addEventListener("click", () => {
          const suivant = etat.valeur === null ? 0 : ecran.signesAutorises.indexOf(etat.valeur) + 1;
          etat.valeur = suivant >= ecran.signesAutorises.length ? null : ecran.signesAutorises[suivant];
          rafraichir();
          surChangement();
        });
        rafraichir();
        cases.set(ligne.id + "|" + colonne.id, etat);
        td.appendChild(bouton);
        tr.appendChild(td);
      }
      corps.appendChild(tr);
    }
    table.appendChild(corps);
    defilement.appendChild(table);
    element.appendChild(defilement);

    return {
      element,
      lireReponse() {
        const resultat = {};
        for (const ligne of ecran.lignes) {
          resultat[ligne.id] = {};
          for (const colonne of ecran.colonnes) {
            const { valeur } = cases.get(ligne.id + "|" + colonne.id);
            if (valeur === null) return null;
            resultat[ligne.id][colonne.id] = valeur;
          }
        }
        return JSON.stringify(resultat);
      },
      desactiver(actif) {
        for (const { bouton } of cases.values()) bouton.disabled = actif;
      },
      focus() {
        cases.values().next().value.bouton.focus();
      },
    };
  },

  resumer(ecran, valeurSaisie) {
    try {
      const tableau = JSON.parse(valeurSaisie);
      return ecran.lignes.map((l) => `${l.libelle} : ${ecran.colonnes.map((c) => (tableau[l.id] && tableau[l.id][c.id]) || "?").join(" ")}`).join(" ; ");
    } catch {
      return valeurSaisie;
    }
  },
};
