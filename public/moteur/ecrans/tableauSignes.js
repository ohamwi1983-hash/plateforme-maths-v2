import { rendreTexte } from "../rendreTexte.js";
import { versTexteBrut } from "../texteMath.js";

/**
 * Composant d'écran « tableau_signes » : une case par cellule résolue, chacune parcourant SES valeurs au toucher.
 * L'état des cases est l'ÉTAT D'ÉDITION, privé à ce composant ; `reponseBrute` = objet JSON
 * `{ [ligneId]: { [ancre]: valeur } }`, produit uniquement par `lireReponse()`, et seulement quand TOUTES les
 * cases sont renseignées (sinon `null` : « Valider » reste désactivé, comme sur `champs_multiples` — RAPPORT §30).
 *
 * Ce composant ne DÉRIVE RIEN : les cellules (qui existe, quelles fusions, quel alphabet, quelle clé de réponse)
 * viennent de `ecran.rangees`, résolues côté serveur par `lib/structureTableau.ts` (seule règle). Il ne fait que
 * dessiner, et faire tourner le cycle : `?` → première valeur → … → dernière → PREMIÈRE (jamais de retour à `?`).
 *
 * Deux dispositions, choisies par la déclaration de l'écran :
 *  - STRUCTURÉE (`colonnes[*].genre`) : 2N+1 colonnes `<, x₁, <, …, <` sans colonne −∞/+∞, bande de symboles puis ligne
 *    des x, libellé de chaque ligne AU-DESSUS de ses cases, colonnes de valeur en `--violet-clair` sur toutes les lignes,
 *    cases fusionnées sur la ligne des variations. Pas de défilement : le tableau tient dans la largeur (plein-bord).
 *  - HÉRITÉE (aucun `genre`) : la disposition d'origine (en-têtes de colonne, libellé de ligne à gauche, défilement).
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

function nomValeur(valeur) {
  return typeof valeur === "string" && Object.hasOwn(NOMS_SYMBOLES, valeur) ? NOMS_SYMBOLES[valeur] : valeur;
}

const element = (tag, classe) => {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  return el;
};

/**
 * Flèche de variation DESSINÉE (référence visuelle validée, `docs/design-system.md`) : jamais un glyphe `↗`/`↘` à taille de
 * police fixe (aucun angle correct possible). On mesure la vraie boîte du bouton, on en tire l'angle réel
 * (`atan2(hauteur, largeur)` : presque horizontal sur une case large et basse), on trace un trait droit de la bonne
 * longueur, on colle à son extrémité une petite pointe FIXE (jamais étirée) et on pivote le bloc d'un seul coup.
 * La géométrie est calculée ici, comme un dessin : seules ces constantes (mesures du tracé) sont numériques.
 */
const FLECHE = { largeur: 0.68, hauteur: 0.42, epaisseur: 2, pointe: 11, decalageX: -3, decalageY: -5.5 };

function dessinerFleche(bouton, montante) {
  const boite = bouton.getBoundingClientRect();
  if (boite.width === 0 || boite.height === 0) return; // pas encore affiché : redessinée au premier redimensionnement observé
  const w = boite.width * FLECHE.largeur;
  const h = boite.height * FLECHE.hauteur;
  const angle = (Math.atan2(h, w) * 180) / Math.PI;
  const bloc = element("span", "moteur-fleche");
  bloc.style.width = `${Math.sqrt(w * w + h * h)}px`;
  bloc.style.transform = `translate(-50%, -50%) rotate(${montante ? -angle : angle}deg)`;
  bloc.appendChild(element("span", "moteur-fleche-trait"));
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 10 10");
  svg.setAttribute("class", "moteur-fleche-pointe");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.style.width = svg.style.height = `${FLECHE.pointe}px`;
  svg.style.right = `${FLECHE.decalageX}px`;
  svg.style.top = `${FLECHE.decalageY}px`;
  const chemin = document.createElementNS(NS, "path");
  chemin.setAttribute("d", "M0,0 L9,5 L0,10");
  svg.appendChild(chemin);
  bloc.appendChild(svg);
  bouton.replaceChildren(bloc);
}

/**
 * Une case-bouton à cycle. `rendu` : "texte" (la valeur telle quelle), "symboles" (tableau HÉRITÉ : `⌢ ⌣ ↗ ↘` dessinés
 * en SVG) ou "fleches" (tableau structuré, case d'intervalle des variations : flèche tracée et pivotée). `plate` : case
 * d'un tableau structuré — une simple cellule, sans bordure ni bulle individuelle.
 */
function creerCase({ nomCellule, rendu, alphabet, surChangement, plate }) {
  const bouton = element("button", plate ? "moteur-case-signe moteur-case-plate" : "moteur-case-signe");
  bouton.type = "button";
  const etat = { bouton, valeur: null };
  const nomme = rendu !== "texte" || (plate && alphabet.some((v) => Object.hasOwn(NOMS_SYMBOLES, v)));
  const visible = (v) => (plate && v === "-" ? "\u2212" : v); // moins typographique À L'ÉCRAN ; la valeur envoyée reste « - »
  const rafraichir = () => {
    if (etat.valeur === null) {
      bouton.replaceChildren(document.createTextNode("?"));
    } else if (rendu === "fleches") {
      dessinerFleche(bouton, etat.valeur === "\u2197");
    } else if (rendu === "symboles" && estSymbole(etat.valeur)) {
      bouton.replaceChildren(symboleSvg(etat.valeur));
    } else {
      bouton.replaceChildren(document.createTextNode(visible(etat.valeur)));
    }
    const dit = etat.valeur === null ? "vide" : nomme && Object.hasOwn(NOMS_SYMBOLES, etat.valeur) ? NOMS_SYMBOLES[etat.valeur] : etat.valeur;
    bouton.setAttribute("aria-label", `${nomCellule} : ${dit}. Toucher pour changer.`);
    bouton.classList.toggle("moteur-case-renseignee", etat.valeur !== null);
  };
  bouton.addEventListener("click", () => {
    // Le cycle NE REVIENT JAMAIS à « ? » : après la dernière valeur, on repart de la première.
    etat.valeur = etat.valeur === null ? alphabet[0] : alphabet[(alphabet.indexOf(etat.valeur) + 1) % alphabet.length];
    rafraichir();
    surChangement();
  });
  if (rendu === "fleches" && typeof ResizeObserver !== "undefined") {
    // La flèche dépend de la vraie taille du bouton : redessinée si la case change de taille (rotation de l'écran, redimensionnement).
    new ResizeObserver(() => {
      if (etat.valeur !== null) rafraichir();
    }).observe(bouton);
  }
  rafraichir();
  return etat;
}

const texteAuteur = (parent, texte) => rendreTexte(parent, texte, { math: true });

function nomCellule(ligne, colonnes) {
  const noms = colonnes.map((c) => versTexteBrut(c.libelle));
  return `${versTexteBrut(ligne.libelle)}, ${noms.length > 1 ? `${noms[0]} à ${noms[noms.length - 1]}` : noms[0]}`;
}

function construireStructure(ecran, cases, surChangement) {
  const table = element("table", "moteur-table-signes moteur-table-structure");
  if (ecran.titre) {
    const legende = element("caption", "moteur-titre-tableau");
    texteAuteur(legende, ecran.titre);
    table.appendChild(legende);
  }
  const groupe = element("colgroup");
  for (const colonne of ecran.colonnes) groupe.appendChild(element("col", colonne.genre === "valeur" ? "moteur-col-valeur" : "moteur-col-intervalle"));
  table.appendChild(groupe);

  const cellulesDe = (classe, remplir) => {
    const tr = element("tr", classe);
    for (const colonne of ecran.colonnes) {
      const td = element("td", colonne.genre === "valeur" ? "moteur-cellule-valeur" : "moteur-cellule-intervalle");
      remplir(td, colonne);
      tr.appendChild(td);
    }
    return tr;
  };

  const entete = element("tbody", "moteur-entete-x");
  if (ecran.colonnes.some((c) => c.symbole)) {
    entete.appendChild(cellulesDe("moteur-rangee-symboles", (td, c) => { if (c.symbole) texteAuteur(td, c.symbole); }));
  }
  entete.appendChild(cellulesDe("moteur-rangee-x", (td, c) => {
    if (c.genre === "valeur") texteAuteur(td, c.valeur); // les colonnes d'intervalle restent vides (référence validée)
  }));
  table.appendChild(entete);

  const ligneParId = new Map(ecran.lignes.map((l) => [l.id, l]));
  const colonneParId = new Map(ecran.colonnes.map((c) => [c.id, c]));
  for (const rangee of ecran.rangees) {
    const ligne = ligneParId.get(rangee.ligne);
    const corps = element("tbody", "moteur-ligne-tableau");
    const titre = element("tr", "moteur-rangee-titre");
    const th = element("th", "moteur-titre-ligne");
    th.colSpan = ecran.colonnes.length; // ligne de TITRE (texte), pas une ligne de cases : aucune fusion de cases de signe
    th.scope = "colgroup";
    texteAuteur(th, ligne.libelle);
    titre.appendChild(th);
    corps.appendChild(titre);

    const tr = element("tr", ligne.nature === "variation" ? "moteur-rangee-variation" : "moteur-rangee-signe");
    for (const cellule of rangee.cellules) {
      const couvertes = cellule.couvre.map((id) => colonneParId.get(id));
      const valeur = couvertes.some((c) => c.genre === "valeur");
      const td = element("td", valeur ? "moteur-cellule-valeur" : "moteur-cellule-intervalle");
      td.colSpan = couvertes.length; // > 1 UNIQUEMENT sur une ligne de variations (groupes délimités par les sommets)
      const fleches = ligne.nature === "variation" && cellule.alphabet.includes("\u2197");
      const etat = creerCase({ nomCellule: nomCellule(ligne, couvertes), rendu: fleches ? "fleches" : "texte", alphabet: cellule.alphabet, surChangement, plate: true });
      cases.set(rangee.ligne + "|" + cellule.ancre, etat);
      td.appendChild(etat.bouton);
      tr.appendChild(td);
    }
    corps.appendChild(tr);
    table.appendChild(corps);
  }
  return table;
}

function construireHeritee(ecran, cases, surChangement) {
  const defilement = element("div", "moteur-tableau-defilement");
  const table = element("table", "moteur-table-signes");
  const entete = element("thead");
  const ligneEntete = element("tr");
  ligneEntete.appendChild(element("th"));
  for (const colonne of ecran.colonnes) {
    const th = element("th");
    th.scope = "col";
    const principal = element("span");
    texteAuteur(principal, colonne.libelle);
    th.appendChild(principal);
    ligneEntete.appendChild(th);
  }
  entete.appendChild(ligneEntete);
  table.appendChild(entete);

  const corps = element("tbody");
  const ligneParId = new Map(ecran.lignes.map((l) => [l.id, l]));
  const colonneParId = new Map(ecran.colonnes.map((c) => [c.id, c]));
  for (const rangee of ecran.rangees) {
    const ligne = ligneParId.get(rangee.ligne);
    const tr = element("tr");
    const th = element("th");
    th.scope = "row";
    texteAuteur(th, ligne.libelle);
    tr.appendChild(th);
    for (const cellule of rangee.cellules) {
      const colonne = colonneParId.get(cellule.ancre);
      const nomColonne = versTexteBrut(colonne.libelle);
      const td = element("td");
      const etat = creerCase({ nomCellule: `${versTexteBrut(ligne.libelle)}, ${nomColonne}`, rendu: ligne.rendu === "symboles_variation" ? "symboles" : "texte", alphabet: cellule.alphabet, surChangement });
      cases.set(rangee.ligne + "|" + cellule.ancre, etat);
      td.appendChild(etat.bouton);
      tr.appendChild(td);
    }
    corps.appendChild(tr);
  }
  table.appendChild(corps);
  defilement.appendChild(table);
  return defilement;
}

export default {
  type: "tableau_signes",

  creer(ecran, { surChangement }) {
    const racine = element("div", "moteur-tableau-signes");
    const cases = new Map(); // "ligne|ancre" -> { bouton, valeur }
    const structure = ecran.colonnes.some((c) => c.genre !== undefined);
    racine.classList.toggle("moteur-tableau-structure-hote", structure);
    racine.appendChild(structure ? construireStructure(ecran, cases, surChangement) : construireHeritee(ecran, cases, surChangement));

    return {
      element: racine,
      lireReponse() {
        const resultat = {};
        for (const rangee of ecran.rangees) {
          resultat[rangee.ligne] = {};
          for (const cellule of rangee.cellules) {
            const { valeur } = cases.get(rangee.ligne + "|" + cellule.ancre);
            if (valeur === null) return null;
            resultat[rangee.ligne][cellule.ancre] = valeur;
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
      const symboles = (ligne) => ligne.nature === "variation" || ligne.rendu === "symboles_variation";
      return ecran.rangees
        .map((rangee) => {
          const ligne = ecran.lignes.find((l) => l.id === rangee.ligne);
          const saisies = tableau !== null && typeof tableau === "object" && Object.hasOwn(tableau, rangee.ligne) ? tableau[rangee.ligne] : {};
          const valeurs = rangee.cellules.map((c) => {
            const v = saisies !== null && typeof saisies === "object" && Object.hasOwn(saisies, c.ancre) ? saisies[c.ancre] : "?";
            return symboles(ligne) ? nomValeur(v) : v;
          });
          return `${versTexteBrut(ligne.libelle)} : ${valeurs.join(" ")}`;
        })
        .join(" ; ");
    } catch {
      return valeurSaisie;
    }
  },
};
