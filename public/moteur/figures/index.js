/**
 * Table type de figure -> composant (RAPPORT §56). Le moteur (`../moteur.js`) répartit sur cette table, jamais par une chaîne de tests sur le type. Un type de figure nouveau exige
 * un écran du témoin technique qui le couvre (`CLAUDE.md`). Un type inconnu n'est jamais fatal : le moteur n'affiche simplement pas de figure.
 *
 * Interface d'un composant : `creer(figure) -> { element, annoter(annotations) }`. `annoter` remplace la couche d'annotations posée par une aide (`annotations_figure`) ; l'état de la
 * figure reste local au composant.
 */
import grapheParabole from "./grapheParabole.js";

export const FIGURES = Object.freeze({
  [grapheParabole.type]: grapheParabole,
});
