/**
 * Client de l'API pour le moteur d'exercice. Aucune logique de vérification ici (ni nulle part côté
 * client) : ces appels transportent des réponses CONFIRMÉES vers le serveur et rapportent ce qu'il a
 * décidé. `POST /api/reponses` n'envoie que `{ exercice_assigne_id, champ, reponse_brute }` — un état
 * local d'édition ne traverse jamais ce module (règle « état local d'édition ≠ réponse »,
 * lib/contratGenerateur.ts).
 */

export class ErreurApi extends Error {
  constructor(message, statut, corps) {
    super(message);
    this.statut = statut;
    this.corps = corps;
  }
}

export function creerClientApi(lireJeton, fetchImpl = (...args) => fetch(...args)) {
  async function appeler(methode, chemin, corps) {
    const reponse = await fetchImpl(chemin, {
      method: methode,
      headers: { Authorization: "Bearer " + lireJeton(), ...(corps ? { "Content-Type": "application/json" } : {}) },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    });
    let donnees = null;
    try {
      donnees = await reponse.json();
    } catch {
      /* corps non JSON : géré ci-dessous via le statut */
    }
    if (!reponse.ok) {
      const detail = donnees && donnees.detail ? ` — ${donnees.detail}` : "";
      throw new ErreurApi((donnees && donnees.erreur ? donnees.erreur : `Erreur ${reponse.status}`) + detail, reponse.status, donnees);
    }
    return donnees;
  }
  return {
    chargerExercice: (id) => appeler("GET", "/api/exercices/" + encodeURIComponent(id)),
    envoyerReponse: (exerciceId, champ, reponseBrute) =>
      appeler("POST", "/api/reponses", { exercice_assigne_id: exerciceId, champ, reponse_brute: reponseBrute }),
    rendreExercice: (exerciceId) => appeler("POST", "/api/exercices/" + encodeURIComponent(exerciceId) + "/remise"),
    demanderAide: (exerciceId, champ) => appeler("POST", "/api/reponses/aide", { exercice_assigne_id: exerciceId, champ }),
    signalerDebutEcran: (exerciceId, champ) => appeler("POST", "/api/reponses/debut-ecran", { exercice_assigne_id: exerciceId, champ }),
  };
}
