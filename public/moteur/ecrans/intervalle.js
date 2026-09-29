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

  creer(_ecran, { surSoumission, surChangement }) {
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
    element.append(ligne, apercu);

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
      apercu.textContent = `${etat.crochetG ?? "?"}${texteBorne(etat.infG, borneG, "−∞")} ; ${texteBorne(etat.infD, borneD, "+∞")}${etat.crochetD ?? "?"}`;
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
    rafraichir();

    return {
      element,
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
  resumer(_ecran, valeurSaisie) {
    try {
      const v = JSON.parse(valeurSaisie);
      const borne = (b) => (b === "-inf" ? "−∞" : b === "+inf" ? "+∞" : b);
      return `${v.crochetGauche}${borne(v.borneGauche)} ; ${borne(v.borneDroite)}${v.crochetDroit}`;
    } catch {
      return valeurSaisie;
    }
  },
};
