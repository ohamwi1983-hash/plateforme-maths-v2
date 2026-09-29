import type { ResultatVerification } from "../../../../lib/contratGenerateur";
import { decoderListeValeursOuAucune } from "../../../../lib/reponsesEcran";
import { evaluerReponseNumerique } from "./expressionNumerique";
import { messageSyntaxeZeros } from "./messagesSyntaxe";
import { CODE_RACINE_PARTIELLE, exigerCategorieAvecRacines, type DonneesRacines } from "./types";

/**
 * Vérification de `racinesChamp2` (« Quelles sont les racines éventuelles ? »), réécrite localement d'après
 * `pilote:lib/routes/reponses.ts:475-493, 2075-2091` et `pilote:src/moteur/verification.ts:46-64` @ 6acc102.
 *
 * Réponse (`liste_valeurs` avec `permetAucune`) : `[]` = « Pas de racine », sinon la liste JSON des valeurs
 * saisies, chacune une EXPRESSION numérique (`6/2`, `sqrt(9)`, `|-4|`). Ordre indifférent.
 *  - « Pas de racine » n'est JAMAIS correct pour gen7 (les trois catégories ont des racines) : `not_equivalent`, sans code ;
 *  - 1 valeur : correcte ssi la racine est DOUBLE et la valeur égale ;
 *  - 2 valeurs : comparaison triée ; 3 valeurs ou plus : incorrecte ; tolérance 1e-9 (racines exactes).
 *
 * `RACINE_PARTIELLE` — statut `not_equivalent`, exactement 2 valeurs, et UNE SEULE position égale après tri
 * des deux listes (comptage par POSITION, pas une intersection d'ensembles : [5 ; 7] pour [0 ; 5] n'en émet pas).
 *
 * Divergences DÉLIBÉRÉES avec l'ancien pilote (RAPPORT.md §19, table `divergences` du test) :
 *  1. une valeur NON FINIE (√ d'un négatif, division par 0) ne déclenche jamais `RACINE_PARTIELLE`
 *     (l'ancien code l'émettait sur `sqrt(-1) ; 4`) ; le statut reste `not_equivalent` ;
 *  2. liste ENTIÈREMENT vide : `parse_error` avec message (l'ancien : `not_equivalent`) — décision D6 ;
 *  3. le mot `constructor` était lu comme une fonction (clé du prototype d'objet) : il est ici un identifiant inconnu.
 */

const TOLERANCE = 1e-9;

function ecartsNuls(a: number, b: number): boolean {
  return Math.abs(a - b) <= TOLERANCE;
}

function estCorrecte(valeurs: number[], racines: [number, number]): boolean {
  const [r1, r2] = [...racines].sort((x, y) => x - y) as [number, number];
  if (valeurs.length === 1) {
    if (Math.abs(r1 - r2) > TOLERANCE) return false;
    return ecartsNuls(valeurs[0] as number, r1);
  }
  if (valeurs.length === 2) {
    const [o1, o2] = [...valeurs].sort((x, y) => x - y) as [number, number];
    return ecartsNuls(r1, o1) && ecartsNuls(r2, o2);
  }
  return false;
}

/** Nombre de positions égales entre les deux listes triées (tolérance stricte `<`, comme l'ancien comptage). */
function compterCorrespondancesTriees(saisies: readonly number[], attendu: readonly number[]): number {
  const s = [...saisies].sort((x, y) => x - y);
  const a = [...attendu].sort((x, y) => x - y);
  return s.filter((valeur, index) => Math.abs(valeur - (a[index] as number)) < TOLERANCE).length;
}

export function verifierRacinesChamp2(donnees: DonneesRacines, reponseBrute: string): ResultatVerification {
  exigerCategorieAvecRacines(donnees.categorie); // garde d'exécution : jamais appelée pour af_irreductible
  const liste = decoderListeValeursOuAucune(reponseBrute);
  if (!liste.ok) return { statut: "parse_error", codesCompetence: [], messageErreur: liste.message };
  if (liste.valeur.aucune) return { statut: "not_equivalent", codesCompetence: [] };

  const valeurs: number[] = [];
  for (const texte of liste.valeur.valeurs) {
    try {
      valeurs.push(evaluerReponseNumerique(texte));
    } catch (erreur) {
      return { statut: "parse_error", codesCompetence: [], messageErreur: messageSyntaxeZeros(erreur) };
    }
  }
  if (estCorrecte(valeurs, donnees.racines)) return { statut: "correct", codesCompetence: [] };

  const partielle = valeurs.length === 2 && valeurs.every(Number.isFinite) && compterCorrespondancesTriees(valeurs, donnees.racines) === 1;
  return { statut: "not_equivalent", codesCompetence: partielle ? [CODE_RACINE_PARTIELLE] : [] };
}
