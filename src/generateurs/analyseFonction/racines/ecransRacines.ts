import type { EcranDeclare } from "../../../../lib/contratGenerateur";
import { CHAMP_RACINES_FACTORISATION, CHAMP_RACINES_ZEROS, type CategorieAnalyseFonction } from "./types";

/**
 * Déclaration des DEUX écrans « racines » (`racinesChamp1`, `racinesChamp2`) — aucune aide sur ces écrans
 * (spec de gen7 §4, confirmée sur l'ancien client). Libellés repris de l'ancien client
 * (`pilote:public/eleve.html:1414-1448`) : « Factorise l'équation f(x) = 0 » et « Quelles sont les racines
 * éventuelles de cette fonction ? », boutons « Pas de racine » / « Au moins une racine ».
 *
 * **`af_irreductible` (Δ < 0) SAUTE ces deux écrans ENTIÈREMENT** : la liste renvoyée est VIDE — les écrans
 * n'existent pas (ni dans `ecrans()`, ni donc dans `champs_attendus`, figé à l'assignation), ils ne sont pas
 * « présents mais toujours corrects ». Le futur `Generateur` gen7 (3b-3) place ce résultat dans son `ecrans()`.
 */
export function ecransRacines(categorie: CategorieAnalyseFonction): EcranDeclare[] {
  if (categorie === "irreductible") return [];
  return [
    {
      type: "champ_expression",
      champ: CHAMP_RACINES_FACTORISATION,
      consigne: "Factorise l'équation $f(x) = 0$.",
    },
    {
      type: "liste_valeurs",
      champ: CHAMP_RACINES_ZEROS,
      consigne: "Quelles sont les racines éventuelles de cette fonction ?",
      etiquetteAjout: "Ajouter une racine",
      permetAucune: true,
      etiquetteAucune: "Pas de racine",
      etiquetteAuMoinsUne: "Au moins une racine",
    },
  ];
}
