/**
 * Table type d'aide typée -> composant. Le moteur (`../moteur.js`) répartit sur cette table, jamais par
 * une chaîne de tests sur le type. EXACTEMENT deux formes (lib/aideTypee.ts) : en ajouter une est une
 * décision de contrat, pas un simple fichier de plus.
 *
 * Interface d'un composant : `creer(aide) -> Element`. Un type inconnu n'est jamais fatal : le moteur
 * affiche un message neutre.
 */
import formuleColoree from "./formuleColoree.js";
import croquisParabole from "./croquisParabole.js";

export const AIDES_TYPEES = Object.freeze({
  [formuleColoree.type]: formuleColoree,
  [croquisParabole.type]: croquisParabole,
});
