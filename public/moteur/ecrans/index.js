/**
 * Bibliothèque de composants d'écran : table type d'écran -> composant. Le moteur (`../moteur.js`)
 * répartit sur cette table, jamais par une chaîne de tests sur le type ni sur le générateur. Ajouter
 * un type d'écran = ajouter un fichier dans ce dossier et une ligne ici (voir aussi
 * lib/contratGenerateur.ts et le témoin technique, qui doit alors couvrir le nouveau type).
 *
 * Interface d'un composant :
 *   creer(ecran, { surSoumission, surChangement }) -> { element, lireReponse(), desactiver(bool), focus() }
 *   resumer(ecran, valeurSaisie) -> texte lisible d'une réponse déjà enregistrée
 * `lireReponse()` renvoie la `reponseBrute` (chaîne) de l'état d'édition courant, ou `null` s'il n'y a
 * rien à confirmer. Le composant n'appelle JAMAIS le réseau et ne signale jamais une réponse de
 * lui-même : `surSoumission` (touche Entrée) demande seulement au moteur de confirmer, `surChangement`
 * l'informe qu'il peut réévaluer si « Valider » est actif.
 */
import champExpression from "./champExpression.js";
import qcm from "./qcm.js";
import listeValeurs from "./listeValeurs.js";
import tableauSignes from "./tableauSignes.js";

export const COMPOSANTS_ECRAN = Object.freeze({
  [champExpression.type]: champExpression,
  [qcm.type]: qcm,
  [listeValeurs.type]: listeValeurs,
  [tableauSignes.type]: tableauSignes,
});
