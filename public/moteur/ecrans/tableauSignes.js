import { rendreTexte } from "../rendreTexte.js";
import { versTexteBrut } from "../texteMath.js";

/**
 * Composant d'écran « tableau_signes » : une case par (ligne, colonne), chacune parcourant les valeurs
 * autorisées au toucher. L'état des cases est l'ÉTAT D'ÉDITION, privé à ce composant ; `reponseBrute`
 * = objet JSON `{ [ligneId]: { [colonneId]: valeur } }`, produit uniquement par `lireReponse()`, et
 * seulement quand TOUTES les cases sont renseignées (sinon `null` : rien à confirmer — ce n'est pas
 * une vérification de justesse, seulement de complétude de la saisie).
 *
 * Extensions (rétrocompatibles : un écran qui ne les déclare pas est rendu exactement comme avant) :
 *  - alphabet PAR LIGNE (`ligne.signesAutorises`, défaut : `ecran.signesAutorises`) ;
 *  - `ligne.rendu = "symboles_variation"` : `⌢ ⌣ ↗ ↘` dessinés en SVG et nommés en toutes lettres ;
 *  - en-têtes de colonne à deux niveaux (`colonne.sousLibelle`) ;
 *  - `ecran.bornes` : colonnes d'AFFICHAGE aux deux extrémités (jamais des cases, jamais dans la réponse).
 * Tous les libellés sont des textes d'AUTEUR (balisage `$…$` admis) rendus par `rendreTexte`.
 */

/** Nom lisible (attribut `aria-label`, résumé) des symboles de variation. */
const NOMS_SYMBOLES = {
  "⌣": "minimum (en creux)",
  "⌢": "maximum (en bosse)",
  "↗": "croissante",
  "↘": "décroissante",
};

const TRACES_SYMBOLES = {
  "⌣": ["M2 4 Q8 16 14 4"],
  "⌢": ["M2 12 Q8 0 14 12"],
  "↗": ["M3 13 L13 3", "M7 3 L13 3 L13 9"],
  "↘": ["M3 3 L13 13", "M13 7 L13 13 L7 13"],
};

function symboleSvg(glyphe) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", "moteur-symbole");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const d of Object.hasOwn(TRACES_SYMBOLES, glyphe) ? TRACES_SYMBOLES[glyphe] : []) {
    const chemin = document.createElementNS(NS, "path");
    chemin.setAttribute("d", d);
    svg.appendChild(chemin);
  }
  return svg;
}

// `Object.hasOwn` : `valeur` peut venir d'une réponse STOCKÉE de l'élève (`resumer`) ; `NOMS_SYMBOLES["constructor"]`
// serait une fonction (membre d'Object.prototype). RAPPORT.md §20.
const estSymbole = (valeur) => typeof valeur === "string" && Object.hasOwn(TRACES_SYMBOLES, valeur);

function nomValeur(ligne, valeur) {
  return ligne.rendu === "symboles_variation" && typeof valeur === "string" && Object.hasOwn(NOMS_SYMBOLES, valeur) ? NOMS_SYMBOLES[valeur] : valeur;
}

function alphabetDe(ecran, ligne) {
  return ligne.signesAutorises && ligne.signesAutorises.length > 0 ? ligne.signesAutorises : ecran.signesAutorises;
}

export default {
  type: "tableau_signes",

  creer(ecran, { surChangement }) {
    const element = document.createElement("div");
    element.className = "moteur-tableau-signes";
    const defilement = document.createElement("div");
    defilement.className = "moteur-tableau-defilement";
    const table = document.createElement("table");
    table.className = "moteur-table-signes";

    const cellulesBorne = (tag, texte) => {
      const cellule = document.createElement(tag);
      cellule.className = "moteur-borne";
      if (texte !== undefined) rendreTexte(cellule, texte, { math: true });
      return cellule;
    };

    const entete = document.createElement("thead");
    const ligneEntete = document.createElement("tr");
    ligneEntete.appendChild(document.createElement("th"));
    if (ecran.bornes) ligneEntete.appendChild(cellulesBorne("th", ecran.bornes.gauche));
    for (const colonne of ecran.colonnes) {
      const th = document.createElement("th");
      th.scope = "col";
      const principal = document.createElement("span");
      rendreTexte(principal, colonne.libelle, { math: true });
      th.appendChild(principal);
      if (colonne.sousLibelle) {
        const sous = document.createElement("span");
        sous.className = "moteur-sous-libelle";
        rendreTexte(sous, colonne.sousLibelle, { math: true });
        th.appendChild(sous);
      }
      ligneEntete.appendChild(th);
    }
    if (ecran.bornes) ligneEntete.appendChild(cellulesBorne("th", ecran.bornes.droite));
    entete.appendChild(ligneEntete);
    table.appendChild(entete);

    const corps = document.createElement("tbody");
    const cases = new Map(); // "ligne|colonne" -> { bouton, valeur }
    for (const ligne of ecran.lignes) {
      const alphabet = alphabetDe(ecran, ligne);
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      rendreTexte(th, ligne.libelle, { math: true });
      tr.appendChild(th);
      if (ecran.bornes) tr.appendChild(cellulesBorne("td"));
      for (const colonne of ecran.colonnes) {
        const td = document.createElement("td");
        const bouton = document.createElement("button");
        bouton.type = "button";
        bouton.className = "moteur-case-signe";
        const etat = { bouton, valeur: null };
        const rafraichir = () => {
          if (etat.valeur === null) {
            bouton.replaceChildren(document.createTextNode("?"));
          } else if (ligne.rendu === "symboles_variation" && estSymbole(etat.valeur)) {
            bouton.replaceChildren(symboleSvg(etat.valeur));
          } else {
            bouton.replaceChildren(document.createTextNode(etat.valeur));
          }
          const lignePlate = versTexteBrut(ligne.libelle);
          const colonnePlate = versTexteBrut(colonne.libelle) + (colonne.sousLibelle ? ` (${versTexteBrut(colonne.sousLibelle)})` : "");
          bouton.setAttribute("aria-label", `${lignePlate}, ${colonnePlate} : ${etat.valeur === null ? "vide" : nomValeur(ligne, etat.valeur)}. Toucher pour changer.`);
          bouton.classList.toggle("moteur-case-renseignee", etat.valeur !== null);
        };
        bouton.addEventListener("click", () => {
          const suivant = etat.valeur === null ? 0 : alphabet.indexOf(etat.valeur) + 1;
          etat.valeur = suivant >= alphabet.length ? null : alphabet[suivant];
          rafraichir();
          surChangement();
        });
        rafraichir();
        cases.set(ligne.id + "|" + colonne.id, etat);
        td.appendChild(bouton);
        tr.appendChild(td);
      }
      if (ecran.bornes) tr.appendChild(cellulesBorne("td"));
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
      return ecran.lignes.map((l) => `${versTexteBrut(l.libelle)} : ${ecran.colonnes.map((c) => nomValeur(l, (tableau[l.id] && tableau[l.id][c.id]) || "?")).join(" ")}`).join(" ; ");
    } catch {
      return valeurSaisie;
    }
  },
};
