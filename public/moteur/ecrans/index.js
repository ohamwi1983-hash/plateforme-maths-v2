/**
 * Bibliothèque de composants d'écran : table type d'écran -> composant. Le moteur (`../moteur.js`)
 * répartit sur cette table, jamais par une chaîne de tests sur le type ni sur le générateur. Ajouter
 * un type d'écran = ajouter un fichier dans ce dossier et une ligne ici (voir aussi
 * lib/contratGenerateur.ts et un générateur témoin, qui doit alors couvrir le nouveau type).
 *
 * Interface d'un composant :
 *   creer(ecran, { surSoumission, surChangement, valeurInitiale }) -> { element, lireReponse(), desactiver(bool), focus() }
 *       `valeurInitiale` (optionnelle, retour en arrière) : la `reponseBrute` DÉJÀ CONFIRMÉE de cet écran, à restaurer dans l'état d'édition.
 *       Chaîne d'élève : décodée défensivement (JSON illisible, forme inattendue, valeur hors alphabet -> ignorée, écran vierge) et
 *       jamais interprétée comme du balisage. Absente = écran vierge, comme avant.
 *   marquer(partiesFausses) (OPTIONNEL, RAPPORT §52) : surligne en rouge les parties désignées par le serveur (identifiants de `ResultatVerification.partiesFausses`, voir
 *       lib/contratGenerateur.ts) ; une marque est retirée dès que l'élève modifie SA partie ; un identifiant inconnu est ignoré. Voir `marquage.js` (seule implémentation).
 *   resumer(ecran, valeurSaisie, partiesFausses?) -> résumé d'une réponse déjà enregistrée :
 *       `string` (texte d'ÉLÈVE, jamais interprété)
 *       ou `{ texte: string, auteur?: boolean, fausse?: boolean }[]` (pièces ; `auteur: true` = texte d'AUTEUR, rendu avec
 *       le balisage mathématique `$…$` ; `fausse: true` = partie à surligner). `partiesFausses` absent ou vide : AUCUN changement de forme.
 * `lireReponse()` renvoie la `reponseBrute` (chaîne) de l'état d'édition courant, ou `null` s'il n'y a
 * rien à confirmer. Le composant n'appelle JAMAIS le réseau et ne signale jamais une réponse de
 * lui-même : `surSoumission` (touche Entrée) demande seulement au moteur de confirmer, `surChangement`
 * l'informe qu'il peut réévaluer si « Valider » est actif. Tout texte d'auteur passe par
 * `rendreTexte(…, { math: true })` (`../rendreTexte.js`), jamais par `textContent`.
 */
import champExpression from "./champExpression.js";
import qcm from "./qcm.js";
import listeValeurs from "./listeValeurs.js";
import tableauSignes from "./tableauSignes.js";
import champsMultiples from "./champsMultiples.js";
import intervalle from "./intervalle.js";
import chaineTransformations from "./chaineTransformations.js";

export const COMPOSANTS_ECRAN = Object.freeze({
  [champExpression.type]: champExpression,
  [qcm.type]: qcm,
  [listeValeurs.type]: listeValeurs,
  [tableauSignes.type]: tableauSignes,
  [champsMultiples.type]: champsMultiples,
  [intervalle.type]: intervalle,
  [chaineTransformations.type]: chaineTransformations,
});
