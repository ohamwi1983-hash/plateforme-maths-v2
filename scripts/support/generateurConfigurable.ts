/**
 * Générateur de TEST à configuration par ligne (RAPPORT §55) : sert à éprouver l'architecture « configuration par ligne » de bout en bout (routes, assignation, régénération, poids,
 * chrono par ligne) avant que gen8 existe. Il est INJECTÉ au registre ET au catalogue le temps d'un test — jamais présent en production, jamais dans le catalogue réel.
 * Une case cochée = un écran (`case_<id>`) : la liste d'écrans DÉPEND de la configuration, c'est le cas le plus exigeant pour la percolation (champs_attendus, poids, complétion).
 */
import type { ConfigurationCases, Generateur } from "../../lib/contratGenerateur";
import { etatActuelSequentiel } from "../../lib/contratGenerateur";

export const VARIANTE_CONFIGURABLE = "_test_configurable_v1";

interface ExerciceConfigurable {
  graine: number;
  actives: string[];
}

export function creerGenerateurConfigurable(): Generateur<ExerciceConfigurable> {
  const ecrans = (ex: ExerciceConfigurable) =>
    ex.actives.map((id, i) => ({ type: "champ_expression" as const, champ: `case_${id}`, consigne: `Question ${id} (${ex.graine % 10})`, nom: `Case ${id}`, poids: i + 1 }));
  return {
    variante_id: VARIANTE_CONFIGURABLE,
    generateur_id: "gTest",
    curriculaire: false,
    codesCompetenceDeclares: [],
    configuration: {
      type: "cases",
      libelle: "Cases actives",
      cases: [
        { id: "A", libelle: "Case A" },
        { id: "B", libelle: "Case B" },
        { id: "C", libelle: "Case C" },
      ],
      exclusifs: [["B", "C"]],
    },
    generer: (graine: number, configuration?: ConfigurationCases) => ({ graine, actives: configuration ? [...configuration.actives] : [] }),
    ecrans,
    etatActuel: (ex, reponses) => etatActuelSequentiel(ecrans(ex).map((e) => e.champ), reponses),
    verifier: (ex, _champ, reponseBrute) => (reponseBrute.trim() === String(ex.graine % 10) ? { statut: "correct", codesCompetence: [] } : { statut: "not_equivalent", codesCompetence: [], partiesFausses: ["champ"] }),
    solutionAttendue: (ex) => String(ex.graine % 10),
  };
}

/**
 * Injecte le générateur dans les modules `lib/` ACTUELLEMENT chargés (à appeler APRÈS `installerBase`, qui purge le cache de modules : sinon on injecterait dans une instance
 * que le routeur n'utilisera pas). Renvoie une fonction de retrait. Le registre et le catalogue réels ne sont jamais modifiés sur disque.
 */
export function injecterGenerateurConfigurable(): () => void {
  const registre = require("../../lib/registreGenerateurs") as { REGISTRE_GENERATEURS: Generateur<any>[] };
  const catalogue = require("../../lib/catalogueGenerateurs") as { CATALOGUE_GENERATEURS: { generateur_id: string; variante_id: string; label: string }[] };
  const generateur = creerGenerateurConfigurable();
  const entree = { generateur_id: generateur.generateur_id, variante_id: VARIANTE_CONFIGURABLE, label: "Variante configurable (test)" };
  registre.REGISTRE_GENERATEURS.push(generateur);
  catalogue.CATALOGUE_GENERATEURS.push(entree);
  return () => {
    registre.REGISTRE_GENERATEURS.splice(registre.REGISTRE_GENERATEURS.indexOf(generateur), 1);
    catalogue.CATALOGUE_GENERATEURS.splice(catalogue.CATALOGUE_GENERATEURS.indexOf(entree), 1);
  };
}
