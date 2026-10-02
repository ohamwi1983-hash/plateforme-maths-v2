import { rendreTexte } from "../rendreTexte.js";
import { aDesParties, creerMarquage, fausse } from "./marquage.js";

/**
 * Composant d'écran « intervalle » : un seul intervalle `[borne ; borne]` que l'élève construit — crochet
 * gauche et droit à choisir, bornes tapées (nombre, décimal, fraction) ou infini (−∞ à gauche, +∞ à
 * droite). Les crochets, les bornes et les boutons d'infini sont l'ÉTAT D'ÉDITION, privé à ce composant ;
 * `reponseBrute` = objet JSON `{ crochetGauche, borneGauche, crochetDroit, borneDroite }` (bornes = texte
 * tapé, ou sentinelles `"-inf"` / `"+inf"`), produit uniquement par `lireReponse()` et seulement quand les
 * deux crochets sont choisis et les deux bornes renseignées (complétude de saisie, jamais justesse : le
 * composant ne lit aucun nombre). Aucune requête pendant l'édition.
 *
 * L'aperçu est du TEXTE BRUT (symboles fixes + texte tapé par l'élève) : ce qu'un élève tape n'est jamais
 * interprété comme du LaTeX.
 */
export default {
  type: "intervalle",

  creer(ecran, { surSoumission, surChangement, valeurInitiale }) {
    const element = document.createElement("div");
    element.className = "moteur-intervalle";
    const etat = { crochetG: null, crochetD: null, infG: false, infD: false };
    const desactivables = [];

    const bouton = (classe, contenu, etiquetteAria) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = classe;
      b.textContent = contenu;
      b.setAttribute("aria-label", etiquetteAria);
      desactivables.push(b);
      return b;
    };
    const champ = (etiquetteAria) => {
      const entree = document.createElement("input");
      entree.type = "text";
      entree.className = "moteur-champ moteur-champ-borne";
      entree.autocomplete = "off";
      entree.autocapitalize = "off";
      entree.spellcheck = false;
      entree.inputMode = "text";
      entree.setAttribute("aria-label", etiquetteAria);
      entree.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          surSoumission();
        }
      });
      desactivables.push(entree);
      return entree;
    };

    const ligne = document.createElement("div");
    ligne.className = "moteur-intervalle-ligne";
    const crochetG = bouton("moteur-bouton moteur-bouton-secondaire moteur-bouton-crochet", "?", "Crochet de gauche : à choisir");
    const borneG = champ("Borne de gauche");
    const infG = bouton("moteur-bouton moteur-bouton-secondaire moteur-bouton-infini", "−∞", "Borne de gauche : moins l'infini");
    infG.setAttribute("aria-pressed", "false");
    const separateur = document.createElement("span");
    separateur.className = "moteur-intervalle-separateur";
    separateur.textContent = ";";
    const infD = bouton("moteur-bouton moteur-bouton-secondaire moteur-bouton-infini", "+∞", "Borne de droite : plus l'infini");
    infD.setAttribute("aria-pressed", "false");
    const borneD = champ("Borne de droite");
    const crochetD = bouton("moteur-bouton moteur-bouton-secondaire moteur-bouton-crochet", "?", "Crochet de droite : à choisir");
    ligne.append(crochetG, borneG, infG, separateur, infD, borneD, crochetD);

    const apercu = document.createElement("p");
    apercu.className = "moteur-apercu";
    apercu.setAttribute("aria-hidden", "true");
    // Option `apercu` de l'écran (RAPPORT §49) : libellé d'AUTEUR (« im f = ») + valeur d'ÉLÈVE (texte brut, jamais interprété), éventuellement AU-DESSUS de la saisie.
    const optionApercu = ecran && typeof ecran.apercu === "object" && ecran.apercu !== null ? ecran.apercu : null;
    let apercuValeur = null;
    if (optionApercu) {
      apercu.classList.add("moteur-apercu-libelle");
      const libelle = document.createElement("span");
      libelle.className = "moteur-apercu-nom";
      rendreTexte(libelle, optionApercu.libelle, { math: true });
      apercuValeur = document.createElement("span");
      apercuValeur.className = "moteur-apercu-valeur";
      apercu.append(libelle, " ", apercuValeur);
      if (optionApercu.auDessus) apercu.classList.add("moteur-apercu-dessus");
    }
    if (optionApercu && optionApercu.auDessus) element.append(apercu, ligne);
    else element.append(ligne, apercu);

    // Notation française : `[` à gauche / `]` à droite = borne incluse ; `]` à gauche / `[` à droite = exclue.
    const nomCrochet = (cote, c) => {
      if (c === null) return `Crochet de ${cote} : à choisir`;
      const inclus = (cote === "gauche" && c === "[") || (cote === "droite" && c === "]");
      return `Crochet de ${cote} : ${c}, borne ${inclus ? "incluse" : "exclue"}`;
    };
    const texteBorne = (inf, entree, infini) => (inf ? infini : entree.value.trim() === "" ? "…" : entree.value.trim());
    const rafraichir = () => {
      crochetG.textContent = etat.crochetG ?? "?";
      crochetD.textContent = etat.crochetD ?? "?";
      crochetG.setAttribute("aria-label", nomCrochet("gauche", etat.crochetG));
      crochetD.setAttribute("aria-label", nomCrochet("droite", etat.crochetD));
      borneG.disabled = etat.infG || borneG.dataset.verrou === "1";
      borneD.disabled = etat.infD || borneD.dataset.verrou === "1";
      infG.setAttribute("aria-pressed", String(etat.infG));
      infD.setAttribute("aria-pressed", String(etat.infD));
      infG.classList.toggle("moteur-infini-actif", etat.infG);
      infD.classList.toggle("moteur-infini-actif", etat.infD);
      const texteApercu = `${etat.crochetG ?? "?"}${texteBorne(etat.infG, borneG, "−∞")} ; ${texteBorne(etat.infD, borneD, "+∞")}${etat.crochetD ?? "?"}`;
      if (apercuValeur) apercuValeur.textContent = texteApercu;
      else apercu.textContent = texteApercu;
    };
    const changement = () => {
      rafraichir();
      surChangement();
    };
    crochetG.addEventListener("click", () => {
      etat.crochetG = etat.crochetG === "[" ? "]" : "[";
      changement();
    });
    crochetD.addEventListener("click", () => {
      etat.crochetD = etat.crochetD === "[" ? "]" : "[";
      changement();
    });
    infG.addEventListener("click", () => {
      etat.infG = !etat.infG;
      changement();
      if (!etat.infG) borneG.focus();
    });
    infD.addEventListener("click", () => {
      etat.infD = !etat.infD;
      changement();
      if (!etat.infD) borneD.focus();
    });
    borneG.addEventListener("input", changement);
    borneD.addEventListener("input", changement);
    // Réponse déjà confirmée (retour en arrière) : `{ crochetGauche, borneGauche, crochetDroit, borneDroite }` ; autre forme ignorée.
    if (typeof valeurInitiale === "string") {
      try {
        const v = JSON.parse(valeurInitiale);
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          if (v.crochetGauche === "[" || v.crochetGauche === "]") etat.crochetG = v.crochetGauche;
          if (v.crochetDroit === "[" || v.crochetDroit === "]") etat.crochetD = v.crochetDroit;
          if (v.borneGauche === "-inf") etat.infG = true;
          else if (typeof v.borneGauche === "string") borneG.value = v.borneGauche;
          if (v.borneDroite === "+inf") etat.infD = true;
          else if (typeof v.borneDroite === "string") borneD.value = v.borneDroite;
        }
      } catch {
        /* réponse illisible : écran vierge */
      }
    }
    rafraichir();

    // Parties fausses (RAPPORT §52) : chaque crochet et chaque borne ; une borne « infinie » est surlignée sur son bouton −∞ / +∞. Modifier la partie retire sa marque.
    const marquage = creerMarquage((id) => {
      switch (id) {
        case "crochetGauche":
          return { elements: [crochetG], declencheurs: [[crochetG, "click"]] };
        case "crochetDroit":
          return { elements: [crochetD], declencheurs: [[crochetD, "click"]] };
        case "borneGauche":
          return { elements: [etat.infG ? infG : borneG], declencheurs: [[borneG, "input"], [infG, "click"]] };
        case "borneDroite":
          return { elements: [etat.infD ? infD : borneD], declencheurs: [[borneD, "input"], [infD, "click"]] };
        default:
          return null;
      }
    });

    return {
      element,
      marquer: (ids) => marquage.marquer(ids),
      lireReponse() {
        if (etat.crochetG === null || etat.crochetD === null) return null;
        const g = etat.infG ? "-inf" : borneG.value.trim();
        const d = etat.infD ? "+inf" : borneD.value.trim();
        if (g === "" || d === "") return null;
        return JSON.stringify({ crochetGauche: etat.crochetG, borneGauche: g, crochetDroit: etat.crochetD, borneDroite: d });
      },
      desactiver(actif) {
        for (const d of desactivables) d.disabled = actif;
        // Un champ de borne « couvert » par l'infini reste inactif à la réactivation.
        borneG.dataset.verrou = actif ? "1" : "0";
        borneD.dataset.verrou = actif ? "1" : "0";
        if (!actif) {
          borneG.disabled = etat.infG;
          borneD.disabled = etat.infD;
        }
      },
      focus() {
        crochetG.focus();
      },
    };
  },

  /** Texte d'élève : crochets et bornes qu'il a choisis (les sentinelles deviennent −∞ / +∞). */
  resumer(_ecran, valeurSaisie, partiesFausses) {
    try {
      const v = JSON.parse(valeurSaisie);
      const borne = (b) => (b === "-inf" ? "−∞" : b === "+inf" ? "+∞" : b);
      if (aDesParties(partiesFausses)) {
        // Un morceau par partie : seuls les morceaux désignés sont surlignés.
        const morceau = (id, texte) => (partiesFausses.includes(id) ? fausse({ texte }) : { texte });
        return [morceau("crochetGauche", String(v.crochetGauche)), morceau("borneGauche", borne(v.borneGauche)), { texte: " ; " }, morceau("borneDroite", borne(v.borneDroite)), morceau("crochetDroit", String(v.crochetDroit))];
      }
      return `${v.crochetGauche}${borne(v.borneGauche)} ; ${borne(v.borneDroite)}${v.crochetDroit}`;
    } catch {
      return valeurSaisie;
    }
  },
};
