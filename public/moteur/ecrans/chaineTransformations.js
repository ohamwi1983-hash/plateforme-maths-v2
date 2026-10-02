import { rendreTexte } from "../rendreTexte.js";
import { versTexteBrut } from "../texteMath.js";
import { aDesParties, creerMarquage, fausse } from "./marquage.js";

/**
 * Composant d'écran « chaine_transformations » (RAPPORT §56) : une chaîne d'étapes répétables, de `etapesMin` à `etapesMax`, chacune une paire (expression libre, transformation choisie
 * parmi `choix`). L'état des étapes (lignes ajoutées ou retirées, texte tapé, choix non confirmé) est l'ÉTAT D'ÉDITION, privé à ce composant ; `reponseBrute` =
 * `{"etapes":[{"expression","transformation"}, …]}`, produite uniquement par `lireReponse()` et seulement quand TOUTES les étapes sont complètes (sinon `null` : « Valider » reste
 * désactivé). Aucune requête, aucun marquage pendant la frappe : la vérification est celle du serveur. L'expression est du texte d'ÉLÈVE : jamais interprétée comme du balisage.
 *
 * Parties fausses : `etape:<i>` (0-indexé) marque l'expression ET la transformation choisie de l'étape ; modifier l'étape retire sa marque.
 */
const PREFIXE_PARTIE = "etape:";

export default {
  type: "chaine_transformations",

  creer(ecran, { surSoumission, surChangement, valeurInitiale }) {
    const element = document.createElement("div");
    element.className = "moteur-chaine";

    const depart = document.createElement("p");
    depart.className = "moteur-chaine-depart";
    rendreTexte(depart, ecran.depart, { math: true });
    element.appendChild(depart);

    const liste = document.createElement("ol");
    liste.className = "moteur-chaine-etapes";
    element.appendChild(liste);

    /** Une étape = { li, champ, boutons: [radio], etiquettes: Map id -> label }. */
    const etapes = [];
    let desactive = false;
    let compteur = 0; // noms de groupes radio uniques, même après retrait/ajout

    const ajouter = document.createElement("button");
    ajouter.type = "button";
    ajouter.className = "moteur-bouton moteur-bouton-secondaire";
    ajouter.textContent = "Ajouter une étape";
    const retirer = document.createElement("button");
    retirer.type = "button";
    retirer.className = "moteur-bouton moteur-bouton-secondaire";
    retirer.textContent = "Retirer la dernière étape";
    const actions = document.createElement("div");
    actions.className = "moteur-chaine-actions";
    actions.append(ajouter, retirer);
    element.appendChild(actions);

    const majActions = () => {
      ajouter.disabled = desactive || etapes.length >= ecran.etapesMax;
      retirer.disabled = desactive || etapes.length <= ecran.etapesMin;
    };

    function ajouterEtape(valeur) {
      const numero = etapes.length + 1;
      const groupe = ++compteur;
      const li = document.createElement("li");
      li.className = "moteur-chaine-etape";
      const titre = document.createElement("span");
      titre.className = "moteur-chaine-numero";
      titre.textContent = `Étape ${numero}`;
      const champ = document.createElement("input");
      champ.type = "text";
      champ.className = "moteur-champ";
      champ.autocomplete = "off";
      champ.autocapitalize = "off";
      champ.spellcheck = false;
      champ.placeholder = versTexteBrut(ecran.placeholder || "");
      champ.setAttribute("aria-label", `Expression obtenue à l'étape ${numero}`);
      if (valeur && typeof valeur.expression === "string") champ.value = valeur.expression; // texte d'élève, jamais interprété
      champ.addEventListener("input", () => surChangement());
      champ.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          surSoumission();
        }
      });
      const choix = document.createElement("div");
      choix.className = "moteur-chaine-choix";
      choix.setAttribute("role", "radiogroup");
      choix.setAttribute("aria-label", `Transformation appliquée à l'étape ${numero}`);
      const boutons = [];
      const etiquettes = new Map();
      for (const c of ecran.choix) {
        const etiquette = document.createElement("label");
        etiquette.className = "moteur-choix";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `chaine-${ecran.champ}-${groupe}`;
        radio.value = c.id;
        radio.checked = !!valeur && valeur.transformation === c.id;
        radio.disabled = desactive;
        radio.addEventListener("change", () => surChangement());
        const texte = document.createElement("span");
        rendreTexte(texte, c.libelle, { math: true });
        etiquette.append(radio, texte);
        choix.appendChild(etiquette);
        boutons.push(radio);
        etiquettes.set(c.id, etiquette);
      }
      champ.disabled = desactive;
      li.append(titre, champ, choix);
      liste.appendChild(li);
      etapes.push({ li, champ, boutons, etiquettes });
      majActions();
    }

    // Réponse déjà confirmée (retour en arrière) : restaurée SANS altération ; illisible -> étapes vierges.
    let initiales = [];
    if (typeof valeurInitiale === "string") {
      try {
        const brut = JSON.parse(valeurInitiale);
        if (typeof brut === "object" && brut !== null && !Array.isArray(brut) && Array.isArray(brut.etapes)) initiales = brut.etapes.slice(0, ecran.etapesMax).filter((e) => typeof e === "object" && e !== null);
      } catch {
        /* réponse illisible : chaîne vierge */
      }
    }
    const nombreInitial = Math.max(ecran.etapesMin, Math.min(ecran.etapesMax, initiales.length));
    for (let i = 0; i < nombreInitial; i++) ajouterEtape(initiales[i]);

    ajouter.addEventListener("click", () => {
      if (etapes.length >= ecran.etapesMax) return;
      ajouterEtape(undefined);
      etapes[etapes.length - 1].champ.focus();
      surChangement();
    });
    retirer.addEventListener("click", () => {
      if (etapes.length <= ecran.etapesMin) return;
      etapes.pop().li.remove();
      majActions();
      surChangement();
    });

    // Parties fausses (RAPPORT §52) : `etape:<i>` marque l'expression et la transformation COCHÉE de l'étape ; la modifier retire la marque.
    const marquage = creerMarquage((id) => {
      if (!id.startsWith(PREFIXE_PARTIE)) return null;
      const i = Number(id.slice(PREFIXE_PARTIE.length));
      const etape = Number.isInteger(i) ? etapes[i] : undefined;
      if (!etape) return null;
      const cochee = etape.boutons.find((b) => b.checked);
      return {
        elements: [etape.champ, ...(cochee ? [etape.etiquettes.get(cochee.value)] : [])],
        controles: [etape.champ, ...(cochee ? [cochee] : [])],
        declencheurs: [[etape.champ, "input"], ...etape.boutons.map((b) => [b, "change"])],
      };
    });

    return {
      element,
      marquer: (ids) => marquage.marquer(ids),
      lireReponse() {
        const lues = [];
        for (const e of etapes) {
          const expression = e.champ.value.trim();
          const retenue = e.boutons.find((b) => b.checked);
          if (expression === "" || !retenue) return null;
          lues.push({ expression, transformation: retenue.value });
        }
        return JSON.stringify({ etapes: lues });
      },
      desactiver(actif) {
        desactive = actif;
        for (const e of etapes) {
          e.champ.disabled = actif;
          for (const b of e.boutons) b.disabled = actif;
        }
        majActions();
      },
      focus() {
        etapes[0].champ.focus();
      },
    };
  },

  resumer(ecran, valeurSaisie, partiesFausses) {
    let brut;
    try {
      brut = JSON.parse(valeurSaisie);
    } catch {
      return valeurSaisie;
    }
    if (typeof brut !== "object" || brut === null || !Array.isArray(brut.etapes)) return valeurSaisie;
    const marquees = aDesParties(partiesFausses) ? partiesFausses : [];
    const pieces = [];
    brut.etapes.forEach((e, i) => {
      if (typeof e !== "object" || e === null) return;
      if (i > 0) pieces.push({ texte: " ; " });
      const texte = `${String(e.expression)} (${String(e.transformation)})`; // texte d'élève et identifiant de choix : jamais interprétés
      pieces.push(marquees.includes(`${PREFIXE_PARTIE}${i}`) ? fausse({ texte }) : { texte });
    });
    return pieces;
  },
};
