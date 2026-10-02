/**
 * Table type d'aide typée -> composant. Le moteur (`../moteur.js`) répartit sur cette table, jamais par
 * une chaîne de tests sur le type. EXACTEMENT trois formes (lib/aideTypee.ts ; la troisième, `annotations_figure`, RAPPORT §56) : en ajouter une est une
 * décision de contrat, pas un simple fichier de plus.
 *
 * Interface d'un composant : `creer(aide, { figure }) -> Element` (`figure` : la figure de l'écran, ou `null` ; seule `annotations_figure` s'en sert). Un type inconnu n'est jamais fatal : le moteur
 * affiche un message neutre.
 */
import formuleColoree from "./formuleColoree.js";
import croquisParabole from "./croquisParabole.js";
import annotationsFigure from "./annotationsFigure.js";

export const AIDES_TYPEES = Object.freeze({
  [formuleColoree.type]: formuleColoree,
  [croquisParabole.type]: croquisParabole,
  [annotationsFigure.type]: annotationsFigure,
});
