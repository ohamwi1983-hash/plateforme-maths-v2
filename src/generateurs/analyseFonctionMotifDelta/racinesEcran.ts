import type { EcranListeValeurs, ResultatVerification } from "../../../lib/contratGenerateur";
import { decoderListeValeursOuAucune } from "../../../lib/reponsesEcran";
import { comparerValeur, lireValeur, type ValeurLue } from "./comparaison";
import { CODE_RACINE_NON_SIMPLIFIEE, CODE_RACINE_PARTIELLE, CODE_RACINES_NOMBRE_INCORRECT } from "./codes";
import { egaux, latexExact, texteSaisieExact, type Exact } from "./exact/nombreExact";
import { CHAMP_RACINES, type FonctionExacte } from "./types";

/**
 * Écran `racines` (RAPPORT §49) : UN seul écran, le RÉSULTAT final uniquement (aucune étape de factorisation ni de discriminant : cette compétence est testée par un autre générateur).
 * `liste_valeurs` avec `permetAucune` : `[]` = « Pas de racine », sinon une valeur par ligne, chacune une expression EXACTE (`sqrt` ; décimaux exacts : `0,5` = 1/2). Jugé sur la fonction
 * EFFECTIVE (coefficients confirmés, même faux : cascade §38) ; comparaison EXACTE-symbolique, jamais de tolérance flottante.
 *
 *  - `RACINES_NOMBRE_INCORRECT` : le NOMBRE de racines proposé (valeurs DISTINCTES) n'est pas celui de la fonction effective (0, 1 si double, 2), ou plus de deux lignes ;
 *  - `RACINE_PARTIELLE` : bon nombre (2), UNE seule valeur juste ;
 *  - `RACINE_NON_SIMPLIFIEE` : toutes les valeurs justes, au moins une racine non simplifiée (`sqrt(8)` pour `2sqrt(2)`) ;
 *  - une racine double s'accepte écrite UNE fois ou DEUX fois ; un `sqrt` d'un négatif ou une saisie illisible → `parse_error` avec message.
 */
export function ecranRacinesMD(consigne: string): EcranListeValeurs {
  return {
    type: "liste_valeurs",
    champ: CHAMP_RACINES,
    consigne,
    etiquetteAjout: "Ajouter une racine",
    permetAucune: true,
    etiquetteAucune: "Pas de racine",
    etiquetteAuMoinsUne: "Au moins une racine",
  };
}

const distinctes = (valeurs: readonly Exact[]): Exact[] => {
  const sortie: Exact[] = [];
  for (const v of valeurs) if (!sortie.some((s) => egaux(s, v))) sortie.push(v);
  return sortie;
};

export function verifierRacinesMD(f: Pick<FonctionExacte, "racines">, reponseBrute: string): ResultatVerification {
  const d = decoderListeValeursOuAucune(reponseBrute);
  if (!d.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: d.message };
  const attendues = f.racines;
  const incorrect = (codes: string[], partiesFausses: string[]): ResultatVerification => ({ statut: "not_equivalent", codesCompetence: codes, partiesFausses });
  // « Pas de racine » alors qu'il y en a : c'est le CHOIX de mode qui est faux (aucune ligne n'a été proposée).
  if (d.valeur.aucune) return attendues.length === 0 ? { statut: "correct", codesCompetence: [] } : incorrect([CODE_RACINES_NOMBRE_INCORRECT], ["mode:aucune"]);

  const lues: ValeurLue[] = [];
  for (const [i, texte] of d.valeur.valeurs.entries()) {
    const l = lireValeur(texte);
    if (!l.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: `Racine n°${i + 1} : ${l.message}` };
    lues.push(l.lu);
  }
  // Lignes fausses (RAPPORT §52) : une valeur qui n'est aucune racine, une racine RÉPÉTÉE (à partir de la 2e occurrence), ou une valeur juste mais non simplifiée.
  const dejaVues: Exact[] = [];
  const partiesFausses: string[] = [];
  for (const [i, l] of lues.entries()) {
    const racine = attendues.find((r) => comparerValeur(r, l) !== "faux");
    const repetee = racine !== undefined && dejaVues.some((v) => egaux(v, racine));
    if (racine === undefined || repetee || l.nonSimplifie) partiesFausses.push(`ligne:${i}`);
    if (racine !== undefined) dejaVues.push(racine);
  }
  const propose = distinctes(lues.map((l) => l.valeur));
  if (lues.length > 2 || propose.length !== attendues.length) return incorrect([CODE_RACINES_NOMBRE_INCORRECT], partiesFausses);
  const justes = attendues.filter((r) => propose.some((p) => egaux(p, r))).length;
  if (justes === attendues.length) return lues.some((l) => l.nonSimplifie) ? incorrect([CODE_RACINE_NON_SIMPLIFIEE], partiesFausses) : { statut: "correct", codesCompetence: [] };
  return incorrect(attendues.length === 2 && justes === 1 ? [CODE_RACINE_PARTIELLE] : [], partiesFausses);
}

/** Solution lisible : texte d'auteur, racines en KaTeX. */
export function solutionRacines(f: Pick<FonctionExacte, "racines">): string {
  return f.racines.length === 0 ? "Pas de racine" : f.racines.map((r) => `$${latexExact(r)}$`).join(" ; ");
}

/** Réponse brute qui VALIDE l'écran (liste vide = « pas de racine »). */
export function reponseBruteRacines(f: Pick<FonctionExacte, "racines">): string {
  return JSON.stringify(f.racines.map((r) => texteSaisieExact(r)));
}
