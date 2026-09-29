/**
 * Moteur d'exercice générique (client). Séquence les écrans déclarés par le serveur
 * (`GET /api/exercices/:id`), affiche pour chacun le composant de la bibliothèque correspondant à
 * son TYPE (répartition par table, `ecrans/index.js`), envoie la réponse confirmée à
 * `POST /api/reponses` et affiche ce que le serveur a décidé. Il ne contient aucune logique de
 * vérification, aucune branche par générateur, aucun HTML propre à un exercice : tout ce qui varie
 * d'un exercice à l'autre arrive sous forme de données.
 *
 * Le score, les tentatives restantes, la révélation, l'ordre des écrans et l'expiration du chrono
 * sont des DÉCISIONS DU SERVEUR ; ce module les affiche. Le compte à rebours n'est qu'un affichage :
 * à zéro, l'état est relu au serveur, seul juge.
 */
import { COMPOSANTS_ECRAN } from "./ecrans/index.js";
import { AIDES_TYPEES } from "./aides/index.js";
import { rendreTexte } from "./rendreTexte.js";

const LIBELLES_STATUT = {
  correct: "Bonne réponse",
  not_equivalent: "Ce n'est pas la bonne réponse",
  parse_error: "Ta réponse n'a pas pu être lue",
};

/**
 * `options.math: true` pour un texte d'AUTEUR (consigne, solution, message d'erreur, aide) ; sans option,
 * texte brut (interface, texte d'élève). Voir `rendreTexte.js`.
 */
function creer(balise, classe, texte, options) {
  const element = document.createElement(balise);
  if (classe) element.className = classe;
  if (texte !== undefined) rendreTexte(element, texte, options);
  return element;
}

/** Résumé d'un composant : `string` (texte d'élève) ou pièces `{ texte, auteur? }[]` (voir ecrans/index.js). */
function rendrePieces(element, resume) {
  if (typeof resume === "string") {
    rendreTexte(element, resume);
    return;
  }
  element.replaceChildren();
  for (const piece of resume) {
    const morceau = document.createElement("span");
    rendreTexte(morceau, piece.texte, { math: piece.auteur === true });
    element.appendChild(morceau);
  }
}

function composantPour(ecran) {
  const composant = COMPOSANTS_ECRAN[ecran.type];
  if (!composant) throw new Error(`Type d'écran inconnu : « ${ecran.type} » (aucun composant dans public/moteur/ecrans/)`);
  return composant;
}

/**
 * Affiche l'exercice `exerciceId` dans `conteneur`.
 * `options.surExerciceTermine()` : l'élève a validé le dernier écran et cliqué « Terminer ».
 * `options.surSortie()` : bouton « Retour ».
 * Renvoie une fonction `detruire()` (arrête le compte à rebours).
 */
export async function ouvrirExercice(conteneur, exerciceId, { api, surExerciceTermine, surSortie }) {
  let minuterie = null;
  let detruit = false;
  const arreterMinuterie = () => {
    if (minuterie !== null) clearInterval(minuterie);
    minuterie = null;
  };
  const detruire = () => {
    detruit = true;
    arreterMinuterie();
  };

  async function recharger() {
    arreterMinuterie();
    let exercice;
    try {
      exercice = await api.chargerExercice(exerciceId);
    } catch (e) {
      conteneur.replaceChildren(creer("p", "moteur-message moteur-message-erreur", e.message));
      return;
    }
    if (detruit) return;
    await afficher(exercice);
  }

  async function afficher(exercice) {
    const racine = creer("div", "moteur-exercice");
    const entete = creer("div", "moteur-entete");
    const sortie = creer("button", "moteur-bouton moteur-bouton-secondaire", "← Retour");
    sortie.type = "button";
    sortie.addEventListener("click", () => {
      detruire();
      surSortie();
    });
    entete.append(sortie, creer("p", "moteur-titre", exercice.tache.nom));
    racine.appendChild(entete);

    const infosParChamp = new Map(exercice.champs.map((c) => [c.champ, c]));
    let carteCourante = null;
    for (const ecran of exercice.ecrans) {
      const info = infosParChamp.get(ecran.champ);
      const estCourant = exercice.saisie_possible && exercice.champ_courant === ecran.champ;
      if (!estCourant && !info.verrouille) continue; // écrans à venir : pas encore affichés
      const carte = creer("section", "moteur-ecran " + (estCourant ? "moteur-ecran-courant" : "moteur-ecran-termine"));
      carte.appendChild(creer("p", "moteur-consigne", ecran.consigne, { math: true }));
      if (estCourant) {
        carteCourante = { carte, ecran, info };
      } else {
        carte.appendChild(resumeTermine(ecran, info));
      }
      racine.appendChild(carte);
    }

    if (exercice.exercice_termine && exercice.saisie_possible) {
      const fin = creer("div", "moteur-fin");
      fin.appendChild(creer("p", "moteur-message moteur-message-succes", "Exercice terminé."));
      const suite = creer("button", "moteur-bouton moteur-bouton-principal", "Terminer");
      suite.type = "button";
      suite.addEventListener("click", () => {
        detruire();
        surExerciceTermine();
      });
      fin.appendChild(suite);
      racine.appendChild(fin);
    }
    conteneur.replaceChildren(racine);
    if (carteCourante) await activerEcranCourant(exercice, carteCourante);
  }

  function resumeTermine(ecran, info) {
    const bloc = creer("div", "moteur-resume");
    if (info.valeur_saisie !== null) {
      const reponse = creer("p", "moteur-reponse-eleve");
      const valeur = creer("span", "moteur-valeur");
      rendrePieces(valeur, composantPour(ecran).resumer(ecran, info.valeur_saisie));
      reponse.append(creer("span", "moteur-etiquette", "Ta réponse : "), valeur);
      bloc.appendChild(reponse);
    }
    if (info.statut !== null) bloc.appendChild(creer("p", "moteur-statut moteur-statut-" + info.statut, LIBELLES_STATUT[info.statut]));
    if (info.solution_attendue !== null) bloc.appendChild(creer("p", "moteur-solution", "Réponse attendue : " + info.solution_attendue, { math: true }));
    return bloc;
  }

  async function activerEcranCourant(exercice, { carte, ecran, info }) {
    const composant = composantPour(ecran);
    let enCours = false;
    const valider = creer("button", "moteur-bouton moteur-bouton-principal", "Valider");
    valider.type = "button";
    const retourServeur = creer("div", "moteur-retour");
    retourServeur.setAttribute("role", "status");
    retourServeur.setAttribute("aria-live", "polite");
    const majBouton = () => {
      valider.disabled = enCours || vue.lireReponse() === null;
    };
    const confirmer = async () => {
      if (enCours) return;
      const reponseBrute = vue.lireReponse(); // ← seul instant où l'état d'édition devient une réponse
      if (reponseBrute === null) return;
      enCours = true;
      vue.desactiver(true);
      valider.disabled = true;
      retourServeur.replaceChildren();
      let resultat;
      try {
        resultat = await api.envoyerReponse(exercice.id, ecran.champ, reponseBrute);
      } catch (e) {
        enCours = false;
        vue.desactiver(false);
        majBouton();
        retourServeur.replaceChildren(creer("p", "moteur-message moteur-message-erreur", e.message));
        if (e.statut === 409) await recharger(); // l'état serveur a divergé (chrono écoulé, champ terminé) : on le relit
        return;
      }
      afficherResultat(resultat);
    };
    const vue = composant.creer(ecran, { surSoumission: confirmer, surChangement: majBouton });
    valider.addEventListener("click", confirmer);

    function afficherResultat(resultat) {
      retourServeur.replaceChildren();
      if (resultat.statut) {
        const message = creer("p", "moteur-statut moteur-statut-" + resultat.statut, LIBELLES_STATUT[resultat.statut]);
        message.classList.add("moteur-message-statut");
        message.tabIndex = -1;
        retourServeur.appendChild(message);
      } else {
        retourServeur.appendChild(creer("p", "moteur-statut moteur-statut-neutre", "Réponse enregistrée."));
      }
      if (resultat.message_erreur) retourServeur.appendChild(creer("p", "moteur-message-syntaxe", resultat.message_erreur, { math: true }));
      if (resultat.solution_attendue) retourServeur.appendChild(creer("p", "moteur-solution", "Réponse attendue : " + resultat.solution_attendue, { math: true }));
      if (resultat.verrouille) {
        arreterMinuterie();
        const suite = creer("button", "moteur-bouton moteur-bouton-principal", resultat.exercice_termine ? "Voir la fin" : "Question suivante");
        suite.type = "button";
        suite.addEventListener("click", () => recharger());
        retourServeur.appendChild(suite);
        valider.hidden = true;
        vue.desactiver(true);
      } else {
        enCours = false;
        vue.desactiver(false);
        majBouton();
        retourServeur.appendChild(creer("p", "moteur-tentatives", `Il te reste ${resultat.tentatives_restantes} essai${resultat.tentatives_restantes > 1 ? "s" : ""}.`));
        vue.focus();
      }
    }

    carte.append(vue.element);
    if (ecran.aide_disponible) carte.appendChild(construireAide(exercice, ecran, info));
    const zoneChrono = exercice.tache.chrono_mode !== "aucun" ? creer("p", "moteur-chrono") : null;
    if (zoneChrono) carte.appendChild(zoneChrono);
    const actions = creer("div", "moteur-actions");
    actions.appendChild(valider);
    carte.append(actions, retourServeur);
    majBouton();
    vue.focus();

    // Début d'écran : signal serveur (`debuts_ecran`, première écriture gagne) ; le compte à rebours
    // n'est qu'un affichage, l'expiration est relue au serveur.
    try {
      const debut = await api.signalerDebutEcran(exercice.id, ecran.champ);
      if (zoneChrono && debut.secondes_restantes !== null && !detruit) demarrerCompteARebours(zoneChrono, debut.secondes_restantes);
    } catch {
      /* signal non bloquant : jamais empêcher l'élève de répondre */
    }
  }

  function demarrerCompteARebours(zone, secondes) {
    arreterMinuterie();
    const fin = Date.now() + secondes * 1000;
    const maj = () => {
      const restant = Math.max(0, Math.round((fin - Date.now()) / 1000));
      rendreTexte(zone, `Temps restant : ${Math.floor(restant / 60)} min ${String(restant % 60).padStart(2, "0")} s`);
      if (restant === 0) {
        arreterMinuterie();
        recharger();
      }
    };
    maj();
    minuterie = setInterval(maj, 1000);
  }

  function construireAide(exercice, ecran, info) {
    const bloc = creer("div", "moteur-aide");
    const bouton = creer("button", "moteur-bouton moteur-bouton-secondaire", "Besoin d'un indice ?");
    bouton.type = "button";
    // Zone de l'aide : chaîne (texte d'auteur) OU aide typée (composant de `aides/`).
    const texte = creer("div", "moteur-aide-texte");
    texte.hidden = true;
    let confirmation = exercice.tache.aide_penalite_pourcent > 0 && !info.aide_utilisee;
    bouton.addEventListener("click", async () => {
      if (confirmation) {
        confirmation = false;
        rendreTexte(bouton, `Confirmer : l'indice réduit ton score de ${exercice.tache.aide_penalite_pourcent} %`);
        return;
      }
      bouton.disabled = true;
      try {
        const resultat = await api.demanderAide(exercice.id, ecran.champ);
        afficherAide(texte, resultat.aide);
        texte.hidden = false;
        bouton.hidden = true;
      } catch (e) {
        bouton.disabled = false;
        rendreTexte(texte, e.message);
        texte.hidden = false;
      }
    });
    if (info.aide_utilisee) {
      rendreTexte(bouton, "Revoir l'indice");
      confirmation = false;
    }
    bloc.append(bouton, texte);
    return bloc;
  }

  /** Affiche l'aide servie par le serveur : chaîne d'auteur, ou aide typée par la table `AIDES_TYPEES` (type inconnu : message neutre). */
  function afficherAide(zone, aide) {
    zone.classList.remove("moteur-aide-typee");
    if (typeof aide === "string") {
      rendreTexte(zone, aide, { math: true });
      return;
    }
    const composant = aide && typeof aide === "object" ? AIDES_TYPEES[aide.type] : undefined;
    if (!composant) {
      rendreTexte(zone, "Cette aide ne peut pas être affichée.");
      return;
    }
    zone.classList.add("moteur-aide-typee");
    zone.replaceChildren(composant.creer(aide));
  }

  await recharger();
  return detruire;
}

/**
 * Ouvre le premier exercice non terminé d'une tâche (`tache` = entrée du tableau de bord élève),
 * puis enchaîne sur le suivant jusqu'à ce que tous soient terminés.
 */
export async function demarrerTache(conteneur, tache, options) {
  const file = tache.exercices.filter((e) => !e.termine).map((e) => e.id);
  let detruire = () => {};
  async function suivant() {
    const id = file.shift();
    if (id === undefined) {
      options.surSortie();
      return;
    }
    detruire = await ouvrirExercice(conteneur, id, { api: options.api, surSortie: options.surSortie, surExerciceTermine: suivant });
  }
  await suivant();
  return () => detruire();
}
