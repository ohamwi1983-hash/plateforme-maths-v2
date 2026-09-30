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
 * Enveloppe de l'exercice (RAPPORT §43) : marque d'une ligne du « Ce qu'on sait déjà » et couleur d'un segment de la progression, selon le
 * `statut` que le SERVEUR a décidé de montrer (`info.statut`). Sous correction coupée il est `null` jusqu'à la fin de la tâche : toutes les
 * lignes portent alors la MÊME marque neutre (jamais une coche : un élève juste et un élève faux voient la même chose).
 */
const MARQUES_RAPPEL = {
  correct: { etat: "correct", glyphe: "✓" },
  not_equivalent: { etat: "not_equivalent", glyphe: "✕" },
  parse_error: { etat: "parse_error", glyphe: "!" },
  neutre: { etat: "neutre", glyphe: "•" },
};
const LIBELLE_NEUTRE = "Réponse enregistrée";

/** Nom court d'un écran (`ecran.nom`, texte d'auteur) ; à défaut « Question n ». */
function nomDe(ecran, rang) {
  return ecran && typeof ecran.nom === "string" && ecran.nom !== "" ? ecran.nom : `Question ${rang}`;
}

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
 * `options.surSortie()` : lien « Mes tâches ».
 * `options.rang` / `options.total` (optionnels, entiers) : « Exercice rang sur total » dans le surtitre ; absents, seul le nom de la tâche est affiché.
 * Renvoie une fonction `detruire()` (arrête le compte à rebours).
 */
export async function ouvrirExercice(conteneur, exerciceId, { api, surExerciceTermine, surSortie, rang, total }) {
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

  /**
   * `contexte` (retour en arrière) : `{ notice }` = message à afficher en tête du prochain rendu ; `{ edition }` = champ en cours de
   * modification. Tout ce que le client garde ici est de l'AFFICHAGE : les réponses, leur validité et leur ordre sont au serveur.
   */
  async function recharger(contexte = {}) {
    arreterMinuterie();
    let exercice;
    try {
      exercice = await api.chargerExercice(exerciceId);
    } catch (e) {
      conteneur.replaceChildren(creer("p", "moteur-message moteur-message-erreur", e.message));
      return;
    }
    if (detruit) return;
    await afficher(exercice, contexte);
  }

  async function afficher(exercice, contexte = {}) {
    const racine = creer("div", "moteur-exercice");
    const infosParChamp = new Map(exercice.champs.map((c) => [c.champ, c]));
    const ecransParChamp = new Map(exercice.ecrans.map((e) => [e.champ, e]));
    const retour = exercice.tache.retour_arriere === true && exercice.saisie_possible;
    const edition = retour && typeof contexte.edition === "string" && infosParChamp.get(contexte.edition)?.modifiable === true ? contexte.edition : null;
    // Un seul écran à la fois (RAPPORT §43) : l'écran courant, ou l'écran en cours de modification (retour en arrière : un seul formulaire à la fois).
    const champCourant = edition !== null ? edition : exercice.saisie_possible && exercice.champ_courant !== null ? exercice.champ_courant : null;
    const ecranCourant = champCourant !== null ? ecransParChamp.get(champCourant) : undefined;
    const indexCourant = ecranCourant ? exercice.champs.findIndex((c) => c.champ === ecranCourant.champ) : -1;

    racine.appendChild(construireEntete(exercice, indexCourant));

    if (contexte.notice) {
      const notice = creer("p", "moteur-message moteur-message-succes", contexte.notice);
      notice.setAttribute("role", "status");
      racine.appendChild(notice);
    }

    let carteCourante = null;
    if (ecranCourant) {
      // Pendant la résolution : UNE carte (l'écran courant, qui porte la couleur du verdict) ; les écrans déjà répondus sont les lignes du rappel.
      const carte = creer("section", "moteur-ecran moteur-ecran-courant");
      carte.appendChild(construireRappel(exercice, { infosParChamp, ecransParChamp, indexCourant, retour }));
      carte.appendChild(creer("p", "moteur-consigne", ecranCourant.consigne, { math: true }));
      carteCourante = { carte, ecran: ecranCourant, info: infosParChamp.get(ecranCourant.champ), modification: edition !== null };
      racine.appendChild(carte);
    } else {
      // Exercice terminé, relecture d'une tâche antérieure, ou remise à venir (retour en arrière) : la RELECTURE de chaque écran — énoncé,
      // ta réponse, verdict et solution quand le serveur les montre — reste celle d'avant (RAPPORT §43 : le rappel compact ne porte pas l'énoncé).
      for (const ecran of exercice.ecrans) {
        const info = infosParChamp.get(ecran.champ);
        if (!info.verrouille && info.modifiable !== true) continue; // écrans à venir : pas encore affichés
        const carte = creer("section", "moteur-ecran moteur-ecran-termine");
        carte.appendChild(creer("p", "moteur-consigne", ecran.consigne, { math: true }));
        carte.appendChild(resumeTermine(ecran, info));
        if (info.modifiable === true) {
          // Écran déjà répondu mais encore modifiable : « Modifier » rouvre l'écran.
          const modifier = creer("button", "moteur-bouton moteur-bouton-secondaire moteur-bouton-modifier", "Modifier ma réponse");
          modifier.type = "button";
          modifier.setAttribute("aria-label", "Modifier ma réponse à cet écran");
          modifier.addEventListener("click", () => afficher(exercice, { edition: ecran.champ }));
          carte.appendChild(modifier);
        }
        racine.appendChild(carte);
      }
    }

    if (retour && exercice.pret_a_rendre === true && edition === null) racine.appendChild(panneauRemise(exercice));

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

  /** Lien « Mes tâches », surtitre « Exercice i sur m · tâche » et titre « Question k sur N » (RAPPORT §43). */
  function construireEntete(exercice, indexCourant) {
    const bloc = creer("div", "moteur-suivi");
    const sortie = creer("button", "moteur-lien-retour");
    sortie.type = "button";
    sortie.setAttribute("aria-label", "Retour à mes tâches");
    const puce = creer("span", "moteur-lien-retour-puce", "←");
    puce.setAttribute("aria-hidden", "true");
    sortie.append(puce, creer("span", undefined, "Mes tâches"));
    sortie.addEventListener("click", () => {
      detruire();
      surSortie();
    });
    const titres = creer("div", "moteur-titres");
    const morceaux = [];
    // Majuscules ÉCRITES (jamais `text-transform`, RAPPORT §30 : il déformerait un nom de tâche contenant « f(x) ») ; le nom de la tâche reste tel que saisi.
    if (Number.isInteger(rang) && Number.isInteger(total)) morceaux.push(`EXERCICE ${rang} SUR ${total}`);
    if (exercice.tache.nom) morceaux.push(exercice.tache.nom);
    if (morceaux.length > 0) titres.appendChild(creer("p", "moteur-surtitre", morceaux.join(" · ")));
    const n = exercice.champs.length;
    const titre = indexCourant >= 0 ? `Question ${indexCourant + 1} sur ${n}` : exercice.saisie_possible ? "Exercice terminé" : "Consultation";
    titres.appendChild(creer("h2", "moteur-question-titre", titre));
    bloc.append(sortie, titres);
    return bloc;
  }

  /**
   * Bloc « Progression » + « Ce qu'on sait déjà » : dérivé UNIQUEMENT de l'état que le serveur a choisi d'exposer (`exercice.champs` : `verrouille`,
   * `statut`, `valeur_saisie`, `solution_attendue`). Aucun verdict n'est inventé ici : `statut === null` (correction coupée) donne une marque neutre.
   * Une ligne = un écran déjà répondu (sa réponse d'ÉLÈVE, jamais interprétée comme du balisage) ; l'écran courant porte son numéro ; les écrans à venir
   * ne sont pas listés (leur nom reste au serveur jusqu'à ce qu'ils soient servis).
   */
  function construireRappel(exercice, { infosParChamp, ecransParChamp, indexCourant, retour }) {
    const bloc = creer("div", "moteur-rappel");
    const champs = exercice.champs;
    const n = champs.length;
    // « Répondu » = verrouillé, ou (retour en arrière) répondu mais encore modifiable.
    const repondu = (c) => c.verrouille === true || c.modifiable === true;
    const faits = champs.filter((c, i) => i !== indexCourant && repondu(c)).length;
    const pourcent = n === 0 ? 0 : Math.round((faits / n) * 100);

    const etiquette = creer("div", "moteur-progression-etiquette");
    etiquette.append(creer("span", undefined, "Progression"), creer("span", undefined, `${pourcent} %`));
    const piste = creer("div", "moteur-piste");
    piste.setAttribute("role", "progressbar");
    piste.setAttribute("aria-label", "Progression dans l'exercice");
    piste.setAttribute("aria-valuemin", "0");
    piste.setAttribute("aria-valuemax", "100");
    piste.setAttribute("aria-valuenow", String(pourcent));
    champs.forEach((c, i) => {
      const etat = i === indexCourant ? "courant" : repondu(c) ? "fait-" + (MARQUES_RAPPEL[c.statut]?.etat ?? MARQUES_RAPPEL.neutre.etat) : "avenir";
      piste.appendChild(creer("span", "moteur-segment moteur-segment-" + etat));
    });
    bloc.append(etiquette, piste, creer("p", "moteur-rappel-titre", "CE QU'ON SAIT DÉJÀ"));

    const liste = creer("ol", "moteur-rappel-liste");
    champs.forEach((c, i) => {
      const ecran = ecransParChamp.get(c.champ);
      const nom = nomDe(ecran, i + 1);
      if (i === indexCourant) {
        const ligne = creer("li", "moteur-rappel-ligne moteur-rappel-ligne-courant");
        ligne.appendChild(creer("span", "moteur-rappel-marque moteur-rappel-marque-courant", String(i + 1)));
        const libelle = creer("span", "moteur-rappel-en-cours");
        rendreTexte(libelle, nom, { math: true });
        libelle.append(" — en cours");
        ligne.appendChild(libelle);
        liste.appendChild(ligne);
        return;
      }
      if (!repondu(c)) return;
      liste.appendChild(ligneFaite(exercice, c, ecran, nom, retour));
    });
    bloc.appendChild(liste);
    return bloc;
  }

  function ligneFaite(exercice, info, ecran, nom, retour) {
    const marque = MARQUES_RAPPEL[info.statut] ?? MARQUES_RAPPEL.neutre;
    const ligne = creer("li", "moteur-rappel-ligne moteur-rappel-ligne-" + marque.etat);
    const pastille = creer("span", "moteur-rappel-marque moteur-rappel-marque-" + marque.etat, marque.glyphe);
    pastille.setAttribute("role", "img");
    pastille.setAttribute("aria-label", LIBELLES_STATUT[info.statut] ?? LIBELLE_NEUTRE);
    const corps = creer("div", "moteur-rappel-corps");
    const libelle = creer("span", "moteur-rappel-nom");
    rendreTexte(libelle, nom, { math: true });
    libelle.append(" :");
    corps.appendChild(libelle);
    const valeur = creer("span", "moteur-rappel-valeur moteur-valeur");
    if (info.valeur_saisie !== null && ecran) rendrePieces(valeur, composantPour(ecran).resumer(ecran, info.valeur_saisie));
    else rendreTexte(valeur, "pas de réponse");
    corps.appendChild(valeur);
    // Une réponse juste n'a pas besoin de « Réponse attendue » (elle lui est identique) : la solution n'est rappelée que pour un écran non réussi.
    if (info.solution_attendue !== null && info.statut !== "correct") corps.appendChild(creer("p", "moteur-rappel-solution moteur-solution", "Réponse attendue : " + info.solution_attendue, { math: true }));
    if (retour && info.modifiable === true) {
      // Retour en arrière : la réponse actuelle (dernière réponse valide) est affichée, « Modifier » rouvre l'écran.
      const modifier = creer("button", "moteur-bouton moteur-bouton-secondaire moteur-bouton-modifier", "Modifier ma réponse");
      modifier.type = "button";
      modifier.setAttribute("aria-label", `Modifier ma réponse à l'écran « ${nom} »`);
      modifier.addEventListener("click", () => afficher(exercice, { edition: info.champ }));
      corps.appendChild(modifier);
    }
    ligne.append(pastille, corps);
    return ligne;
  }

  /**
   * Retour en arrière : tous les écrans ont une réponse. L'exercice n'est TERMINÉ (et rien n'est corrigé) qu'une fois « rendu » : étape
   * explicite, confirmée par un second clic, après laquelle plus rien ne se modifie.
   */
  function panneauRemise(exercice) {
    const bloc = creer("section", "moteur-fin moteur-remise");
    bloc.appendChild(creer("p", "moteur-message", "Tu as répondu à tous les écrans. Relis tes réponses : « Modifier ma réponse » rouvre n'importe quel écran. Quand tu es prêt·e, rends l'exercice."));
    const retour = creer("div", "moteur-retour");
    retour.setAttribute("role", "status");
    retour.setAttribute("aria-live", "polite");
    const rendre = creer("button", "moteur-bouton moteur-bouton-principal", "Rendre cet exercice");
    rendre.type = "button";
    let confirmation = true;
    rendre.addEventListener("click", async () => {
      if (confirmation) {
        confirmation = false;
        rendreTexte(rendre, "Confirmer : après avoir rendu l'exercice, plus rien ne se modifie");
        return;
      }
      rendre.disabled = true;
      try {
        await api.rendreExercice(exercice.id);
      } catch (e) {
        rendre.disabled = false;
        retour.replaceChildren(creer("p", "moteur-message moteur-message-erreur", e.message));
        if (e.statut === 409 || e.statut === 403) await recharger();
        return;
      }
      await recharger();
    });
    bloc.append(rendre, retour);
    if (exercice.tache.chrono_mode === "global" && exercice.champs.length > 0) {
      // Le chrono global court aussi pendant la relecture : compte à rebours affiché (à zéro, l'état est relu — l'exercice est alors clos).
      const zone = creer("p", "moteur-chrono");
      bloc.appendChild(zone);
      api.signalerDebutEcran(exercice.id, exercice.champs[0].champ).then((debut) => {
        if (debut.secondes_restantes !== null && !detruit) demarrerCompteARebours(zone, debut.secondes_restantes);
      }, () => undefined);
    }
    return bloc;
  }

  /** Relecture d'un écran terminé (RAPPORT §43 : seulement sans écran courant) : ta réponse, le verdict et la solution tels que le serveur les montre. */
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

  async function activerEcranCourant(exercice, { carte, ecran, info, modification }) {
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
    // Modification d'un écran déjà répondu : l'état d'édition part de la dernière réponse confirmée (`valeur_saisie`, texte d'élève).
    const vue = composant.creer(ecran, { surSoumission: confirmer, surChangement: majBouton, valeurInitiale: modification ? info.valeur_saisie : undefined });
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
      if (resultat.modifiable !== undefined) {
        // Retour en arrière : la réponse est enregistrée mais l'écran reste modifiable ; rien n'est corrigé avant la remise.
        arreterMinuterie();
        const notes = [];
        if (resultat.inchangee) notes.push("Réponse inchangée.");
        else if (modification) notes.push("Réponse modifiée.");
        const aRefaire = resultat.champs_invalides ?? [];
        if (aRefaire.length > 0) notes.push(`Des écrans qui en dépendent sont à refaire (${aRefaire.length}).`);
        retourServeur.replaceChildren(creer("p", "moteur-statut moteur-statut-neutre", resultat.inchangee || modification ? notes.join(" ") : "Réponse enregistrée."));
        const suite = creer("button", "moteur-bouton moteur-bouton-principal", resultat.pret_a_rendre ? "Revoir mes réponses" : modification ? "Continuer" : "Écran suivant");
        suite.type = "button";
        suite.addEventListener("click", () => recharger({ notice: modification && aRefaire.length > 0 ? `Tu as modifié une réponse : ${aRefaire.length} écran${aRefaire.length > 1 ? "s" : ""} qui en dépend${aRefaire.length > 1 ? "ent" : ""} ${aRefaire.length > 1 ? "sont" : "est"} à refaire.` : undefined }));
        retourServeur.appendChild(suite);
        valider.hidden = true;
        vue.desactiver(true);
        return;
      }
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
    if (modification) {
      const annuler = creer("button", "moteur-bouton moteur-bouton-secondaire", "Annuler");
      annuler.type = "button";
      annuler.addEventListener("click", () => recharger());
      actions.appendChild(annuler);
    }
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
    const position = tache.exercices.findIndex((e) => e.id === id);
    detruire = await ouvrirExercice(conteneur, id, { api: options.api, surSortie: options.surSortie, surExerciceTermine: suivant, rang: position + 1, total: tache.exercices.length });
  }
  await suivant();
  return () => detruire();
}
