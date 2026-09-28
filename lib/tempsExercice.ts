/**
 * Prompt "Temps de réponse par type d'exercice — profil élève" : temps total d'un exercice à
 * partir de ses lignes `reponses.duree_ecoulee_secondes` (`supabase/schema.sql:210-217` — mesure
 * passive, calculée CÔTÉ SERVEUR à la soumission depuis `debuts_ecran.horodatage_debut`, jamais
 * une valeur envoyée par le client).
 *
 * **Piège évité** : plusieurs tentatives sur un même `champ` partagent le même `debuts_ecran`
 * (`supabase/schema.sql:226-231` — PK composite `(exercice_assigne_id, champ)`, insert `on
 * conflict do nothing`, `lib/routes/reponses-debut-ecran.ts` — la première écriture gagne, jamais
 * mise à jour ensuite). La `duree_ecoulee_secondes` d'une 2e tentative sur ce même champ mesure
 * donc déjà tout le temps écoulé depuis CE MÊME début, pas seulement le temps de cette
 * tentative-là — sommer `duree_ecoulee_secondes` sur toutes les lignes `reponses` d'un champ
 * compterait ce temps plusieurs fois. Seule la ligne la plus RÉCENTE par champ (celle dont la
 * durée reflète le temps réel jusqu'à la résolution — correcte ou non — de ce champ) doit être
 * retenue.
 */
export interface LigneReponseTemps {
  champ: string;
  duree_ecoulee_secondes: number | null;
  horodatage: string;
}

/** `null` si aucune ligne n'a de durée exploitable (ex. `debuts_ecran` jamais reçu pour aucun
 * champ) — jamais `0`, qui se confondrait avec un exercice réellement instantané. */
export function tempsTotalExerciceDepuisReponses(reponses: LigneReponseTemps[]): number | null {
  // Horodatages ISO-8601 (timestamptz Postgres via supabase-js) : comparaison lexicographique
  // fiable, même principe que `resumeBugs`/tri par horodatage ailleurs dans ce dépôt.
  const triees = [...reponses].sort((a, b) => (a.horodatage < b.horodatage ? 1 : a.horodatage > b.horodatage ? -1 : 0));
  const dernierParChamp = new Map<string, number>();
  for (const ligne of triees) {
    if (!dernierParChamp.has(ligne.champ) && ligne.duree_ecoulee_secondes !== null) {
      dernierParChamp.set(ligne.champ, ligne.duree_ecoulee_secondes);
    }
  }
  const valeurs = [...dernierParChamp.values()];
  return valeurs.length > 0 ? valeurs.reduce((a, b) => a + b, 0) : null;
}

/** `null` sur un tableau vide — jamais `0`, ni `NaN`. */
export function moyenne(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  return valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
}

/** Médiane classique (moyenne des 2 valeurs centrales si effectif pair) — plus robuste qu'une
 * moyenne à un élève isolé avec un temps aberrant (ex. onglet laissé ouvert), voir volet B du
 * prompt. `null` sur un tableau vide. */
export function mediane(valeurs: number[]): number | null {
  if (valeurs.length === 0) return null;
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 0 ? (triees[milieu - 1] + triees[milieu]) / 2 : triees[milieu];
}
