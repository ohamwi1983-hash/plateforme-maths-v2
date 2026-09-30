import { rendreTexte } from "../rendreTexte.js";
import { versTexteBrut } from "../texteMath.js";
import { construireCroquisAllure } from "../croquis.js";

/**
 * Composant d'écran « champs_multiples » : plusieurs sous-champs (texte libre ou choix fermé) validés
 * ENSEMBLE, en UNE tentative. Ce que l'élève compose est l'ÉTAT D'ÉDITION, privé à ce composant ;
 * `reponseBrute` = objet JSON `{ [sousChampId]: string }` (texte tapé, ou `id` du choix retenu),
 * produit uniquement par `lireReponse()`, et seulement quand TOUS les sous-champs sont renseignés (sinon
 * `null` : complétude de la saisie, jamais justesse — un champ vide n'est donc jamais envoyé, encore
 * moins lu comme 0). Aucune requête pendant l'édition.
 *
 * `illustration` (optionnelle) : croquis qui SUIT EN DIRECT les choix locaux de deux sous-champs. Ce
 * n'est PAS une aide (aucune pénalité) : il n'affiche que ces choix et `c` (public), jamais un verdict.
 * Les libellés sont des textes d'AUTEUR (balisage `$…$` admis), rendus par `rendreTexte`.
 */
export default {
  type: "champs_multiples",

  creer(ecran, { surSoumission, surChangement, valeurInitiale }) {
    const element = document.createElement("div");
    element.className = "moteur-champs-multiples";
    const lecteurs = new Map(); // id -> () => string | null (valeur courante, rognée ; null si vide)
    const poseurs = new Map(); // id -> (valeur: string) => void (restaure une réponse déjà confirmée)
    const desactivables = [];
    let premier = null;

    const illustration = ecran.illustration && ecran.illustration.type === "croquis_allure" ? ecran.illustration : null;
    const zoneIllustration = document.createElement("div");
    zoneIllustration.className = "moteur-illustration";
    const majIllustration = () => {
      if (!illustration) return;
      const lireChoix = (id) => (lecteurs.has(id) ? lecteurs.get(id)() : null);
      zoneIllustration.replaceChildren(construireCroquisAllure({ signeA: lireChoix(illustration.champSigneA), signeAB: lireChoix(illustration.champSigneAB), c: illustration.c }));
    };
    const changement = () => {
      majIllustration();
      surChangement();
    };

    for (const sous of ecran.champs) {
      const identifiant = `mc-${ecran.champ}-${sous.id}`;
      if (sous.genre === "choix") {
        const groupe = document.createElement("fieldset");
        groupe.className = "moteur-sous-champ moteur-sous-champ-choix";
        const legende = document.createElement("legend");
        legende.className = "moteur-sous-champ-libelle";
        rendreTexte(legende, sous.libelle, { math: true });
        const boutons = document.createElement("div");
        boutons.className = "moteur-qcm";
        boutons.setAttribute("role", "radiogroup");
        boutons.setAttribute("aria-label", versTexteBrut(sous.libelle));
        const radios = [];
        for (const choix of sous.choix) {
          const etiquette = document.createElement("label");
          etiquette.className = "moteur-choix";
          const radio = document.createElement("input");
          radio.type = "radio";
          radio.name = identifiant;
          radio.value = choix.id;
          radio.addEventListener("change", changement);
          const texte = document.createElement("span");
          rendreTexte(texte, choix.libelle, { math: true });
          etiquette.append(radio, texte);
          boutons.appendChild(etiquette);
          radios.push(radio);
        }
        groupe.append(legende, boutons);
        element.appendChild(groupe);
        lecteurs.set(sous.id, () => {
          const retenu = radios.find((r) => r.checked);
          return retenu ? retenu.value : null;
        });
        poseurs.set(sous.id, (valeur) => {
          for (const r of radios) r.checked = r.value === valeur;
        });
        desactivables.push(...radios);
        if (!premier) premier = radios[0];
      } else {
        const ligne = document.createElement("div");
        ligne.className = "moteur-sous-champ moteur-sous-champ-texte";
        const etiquette = document.createElement("label");
        etiquette.className = "moteur-sous-champ-libelle";
        etiquette.htmlFor = identifiant;
        rendreTexte(etiquette, sous.libelle, { math: true });
        const entree = document.createElement("input");
        entree.id = identifiant;
        entree.type = "text";
        entree.className = "moteur-champ";
        entree.autocomplete = "off";
        entree.autocapitalize = "off";
        entree.spellcheck = false;
        entree.placeholder = versTexteBrut(sous.placeholder || ""); // attribut : texte brut
        entree.addEventListener("input", changement);
        entree.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            surSoumission();
          }
        });
        ligne.append(etiquette, entree);
        element.appendChild(ligne);
        lecteurs.set(sous.id, () => {
          const v = entree.value.trim();
          return v === "" ? null : v;
        });
        poseurs.set(sous.id, (valeur) => {
          entree.value = valeur;
        });
        desactivables.push(entree);
        if (!premier) premier = entree;
      }
    }
    // Réponse déjà confirmée (retour en arrière) : objet JSON `{ [sousChampId]: string }` ; toute autre forme est ignorée (écran vierge).
    if (typeof valeurInitiale === "string") {
      try {
        const valeurs = JSON.parse(valeurInitiale);
        if (typeof valeurs === "object" && valeurs !== null && !Array.isArray(valeurs)) {
          for (const [id, poser] of poseurs) if (Object.hasOwn(valeurs, id) && typeof valeurs[id] === "string") poser(valeurs[id]);
        }
      } catch {
        /* réponse illisible : écran vierge */
      }
    }
    if (illustration) {
      element.appendChild(zoneIllustration);
      majIllustration();
    }

    return {
      element,
      lireReponse() {
        const resultat = {};
        for (const sous of ecran.champs) {
          const v = lecteurs.get(sous.id)();
          if (v === null) return null;
          resultat[sous.id] = v;
        }
        return JSON.stringify(resultat);
      },
      desactiver(actif) {
        for (const d of desactivables) d.disabled = actif;
      },
      focus() {
        if (premier) premier.focus();
      },
    };
  },

  /** Pièces : libellé (auteur) · valeur (élève, ou libellé de choix = auteur) ; séparées par « ; ». */
  resumer(ecran, valeurSaisie) {
    let valeurs;
    try {
      valeurs = JSON.parse(valeurSaisie);
    } catch {
      return valeurSaisie;
    }
    if (typeof valeurs !== "object" || valeurs === null || Array.isArray(valeurs)) return valeurSaisie;
    const pieces = [];
    ecran.champs.forEach((sous, i) => {
      if (i > 0) pieces.push({ texte: " ; " });
      const v = typeof valeurs[sous.id] === "string" ? valeurs[sous.id] : "?";
      // « a = 3 » (libellé se terminant par = : ≡) mais « Signe de a : a > 0 » (libellé sans ponctuation finale).
      const separateur = /(=|:|≡|\\equiv)\s*\$?\s*$/.test(sous.libelle) ? " " : " : ";
      pieces.push({ texte: sous.libelle, auteur: true }, { texte: separateur });
      if (sous.genre === "choix") {
        const choix = sous.choix.find((c) => c.id === v);
        pieces.push(choix ? { texte: choix.libelle, auteur: true } : { texte: v });
      } else {
        pieces.push({ texte: v });
      }
    });
    return pieces;
  },
};
