import { rendreTexte } from "../rendreTexte.js";
import { versTexteBrut } from "../texteMath.js";
import { aDesParties, creerMarquage, fausse } from "./marquage.js";

/**
 * Composant d'écran « chaine_transformations » (RAPPORT §56, refait en §58) : une chaîne d'étapes répétables, de `etapesMin` à `etapesMax`. Une étape = (voir
 * `docs/reference/chaine-transformations.html`) :
 *   1. l'en-tête : « Étape k » et, à DROITE, le bouton « ? » qui dévoile en dessous la `legende` des abréviations (un rappel de vocabulaire, jamais une aide pénalisée) ;
 *   2. « f_k(x) » suivi d'une LISTE DÉROULANTE des transformations (`choix`), de « : » et d'un champ libre pour la VALEUR de la transformation (TH, TV, EV, CV) — ni séparateur ni champ
 *      quand la transformation choisie n'en prend pas (SOX : `choix[].valeur` absent) ;
 *   3. « f_k(x) = » suivi du champ libre de la fonction obtenue.
 * L'état des étapes (lignes ajoutées ou retirées, texte tapé, choix non confirmé, légende dévoilée) est l'ÉTAT D'ÉDITION, privé à ce composant ; `reponseBrute` =
 * `{"etapes":[{"expression","transformation","valeur"}, …]}`, produite uniquement par `lireReponse()` et seulement quand TOUTES les étapes sont complètes (sinon `null` : « Valider » reste
 * désactivé). `valeur` vaut `""` pour une transformation sans valeur. Aucune requête, aucun marquage pendant la frappe : la vérification est celle du serveur. L'expression et la valeur sont
 * du texte d'ÉLÈVE : jamais interprétées comme du balisage.
 *
 * Parties fausses : `etape:<i>` (0-indexé) marque l'expression, la transformation choisie et la valeur de l'étape ; modifier l'une d'elles retire la marque.
 */
const PREFIXE_PARTIE = "etape:";

export default {
  type: "chaine_transformations",

  creer(ecran, { surSoumission, surChangement, valeurInitiale }) {
    const element = document.createElement("div");
    element.className = "moteur-chaine";
    const choixParId = new Map(ecran.choix.map((c) => [c.id, c]));

    const depart = document.createElement("p");
    depart.className = "moteur-chaine-depart";
    rendreTexte(depart, ecran.depart, { math: true });
    element.appendChild(depart);

    const liste = document.createElement("ol");
    liste.className = "moteur-chaine-etapes";
    element.appendChild(liste);

    /** Une étape = { li, select, valeur, separateur, expression }. */
    const etapes = [];
    let desactive = false;
    let compteur = 0; // identifiants uniques (aria-controls), même après retrait/ajout

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

    /** Nom de la fonction de l'étape : « f_k(x) » ou « f_k(x) = » (texte d'auteur : composé ici, jamais depuis une saisie). */
    function nomFonction(numero, avecEgal) {
      const nom = document.createElement("span");
      nom.className = "moteur-chaine-nom";
      rendreTexte(nom, `$f_{${numero}}(x)${avecEgal ? " =" : ""}$`, { math: true });
      return nom;
    }

    function champTexte(libelleAria, placeholder, classe) {
      const champ = document.createElement("input");
      champ.type = "text";
      champ.className = `moteur-champ ${classe}`;
      champ.autocomplete = "off";
      champ.autocapitalize = "off";
      champ.spellcheck = false;
      champ.placeholder = versTexteBrut(placeholder || "");
      champ.setAttribute("aria-label", libelleAria);
      champ.addEventListener("input", () => surChangement());
      champ.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          surSoumission();
        }
      });
      return champ;
    }

    function ajouterEtape(initiale) {
      const numero = etapes.length + 1;
      const identifiant = ++compteur;
      const li = document.createElement("li");
      li.className = "moteur-chaine-etape";

      // 1. En-tête : « Étape k » à gauche, « ? » à droite, légende dévoilée en dessous.
      const entete = document.createElement("div");
      entete.className = "moteur-chaine-entete";
      const titre = document.createElement("span");
      titre.className = "moteur-chaine-numero";
      titre.textContent = `Étape ${numero}`;
      entete.appendChild(titre);
      let legende = null;
      if (typeof ecran.legende === "string" && ecran.legende !== "") {
        const aide = document.createElement("button");
        aide.type = "button";
        aide.className = "moteur-chaine-aide";
        aide.textContent = "?";
        aide.title = "Signification des abréviations";
        aide.setAttribute("aria-label", "Signification des abréviations");
        aide.setAttribute("aria-expanded", "false");
        legende = document.createElement("p");
        legende.className = "moteur-chaine-legende";
        legende.id = `chaine-${ecran.champ}-legende-${identifiant}`;
        legende.hidden = true;
        rendreTexte(legende, ecran.legende, { math: true });
        aide.setAttribute("aria-controls", legende.id);
        aide.addEventListener("click", () => {
          legende.hidden = !legende.hidden;
          aide.setAttribute("aria-expanded", String(!legende.hidden));
        });
        entete.appendChild(aide);
      }
      li.appendChild(entete);
      if (legende) li.appendChild(legende);

      // 2. « f_k(x) » [transformation ▾] « : » [valeur]
      const ligneTransformation = document.createElement("div");
      ligneTransformation.className = "moteur-chaine-ligne";
      const select = document.createElement("select");
      select.className = "moteur-select";
      select.setAttribute("aria-label", `Transformation appliquée à l'étape ${numero}`);
      const invite = document.createElement("option");
      invite.value = "";
      invite.textContent = "Choisir…";
      invite.disabled = true;
      select.appendChild(invite);
      for (const c of ecran.choix) {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = versTexteBrut(c.libelle); // une option est du texte brut : jamais de balisage
        select.appendChild(option);
      }
      select.value = initiale && typeof initiale.transformation === "string" && choixParId.has(initiale.transformation) ? initiale.transformation : "";
      const separateur = document.createElement("span");
      separateur.className = "moteur-chaine-separateur";
      separateur.textContent = ":";
      const valeur = champTexte(`Valeur de la transformation de l'étape ${numero}`, "valeur", "moteur-chaine-valeur");
      if (initiale && typeof initiale.valeur === "string") valeur.value = initiale.valeur; // texte d'élève, jamais interprété
      ligneTransformation.append(nomFonction(numero, false), select, separateur, valeur);
      li.appendChild(ligneTransformation);

      // 3. « f_k(x) = » [expression]
      const ligneExpression = document.createElement("div");
      ligneExpression.className = "moteur-chaine-ligne";
      const expression = champTexte(`Fonction obtenue à l'étape ${numero}`, ecran.placeholder, "moteur-chaine-expression");
      if (initiale && typeof initiale.expression === "string") expression.value = initiale.expression;
      ligneExpression.append(nomFonction(numero, true), expression);
      li.appendChild(ligneExpression);

      // La valeur n'existe que pour une transformation qui en prend une (TH, TV, EV, CV) ; tant qu'aucune n'est choisie, le champ est là.
      const prendUneValeur = () => select.value === "" || choixParId.get(select.value)?.valeur !== undefined;
      const majValeur = () => {
        const visible = prendUneValeur();
        separateur.hidden = !visible;
        valeur.hidden = !visible;
        const descripteur = choixParId.get(select.value)?.valeur;
        valeur.placeholder = versTexteBrut(descripteur ? descripteur.placeholder : "valeur");
      };
      majValeur();
      select.addEventListener("change", () => {
        majValeur();
        surChangement();
      });
      select.disabled = desactive;
      valeur.disabled = desactive;
      expression.disabled = desactive;

      liste.appendChild(li);
      etapes.push({ li, select, valeur, separateur, expression, prendUneValeur });
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
      etapes[etapes.length - 1].select.focus();
      surChangement();
    });
    retirer.addEventListener("click", () => {
      if (etapes.length <= ecran.etapesMin) return;
      etapes.pop().li.remove();
      majActions();
      surChangement();
    });

    // Parties fausses (RAPPORT §52) : `etape:<i>` marque la fonction obtenue, la transformation choisie et sa valeur ; modifier l'une d'elles retire la marque.
    const marquage = creerMarquage((id) => {
      if (!id.startsWith(PREFIXE_PARTIE)) return null;
      const i = Number(id.slice(PREFIXE_PARTIE.length));
      const etape = Number.isInteger(i) ? etapes[i] : undefined;
      if (!etape) return null;
      const champs = [etape.select, ...(etape.prendUneValeur() ? [etape.valeur] : []), etape.expression];
      return {
        elements: champs,
        controles: champs,
        declencheurs: [[etape.select, "change"], [etape.valeur, "input"], [etape.expression, "input"]],
      };
    });

    return {
      element,
      marquer: (ids) => marquage.marquer(ids),
      lireReponse() {
        const lues = [];
        for (const e of etapes) {
          const expression = e.expression.value.trim();
          const transformation = e.select.value;
          if (expression === "" || transformation === "") return null;
          const prendUneValeur = choixParId.get(transformation)?.valeur !== undefined;
          const valeur = prendUneValeur ? e.valeur.value.trim() : "";
          if (prendUneValeur && valeur === "") return null;
          lues.push({ expression, transformation, valeur });
        }
        return JSON.stringify({ etapes: lues });
      },
      desactiver(actif) {
        desactive = actif;
        for (const e of etapes) {
          e.select.disabled = actif;
          e.valeur.disabled = actif;
          e.expression.disabled = actif;
        }
        majActions();
      },
      focus() {
        etapes[0].select.focus();
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
      const valeur = typeof e.valeur === "string" && e.valeur !== "" ? ` ${e.valeur}` : "";
      const texte = `${String(e.expression)} (${String(e.transformation)}${valeur})`; // texte d'élève et identifiant de choix : jamais interprétés
      pieces.push(marquees.includes(`${PREFIXE_PARTIE}${i}`) ? fausse({ texte }) : { texte });
    });
    return pieces;
  },
};
