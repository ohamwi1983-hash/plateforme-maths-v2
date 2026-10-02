import type { ConfigurationCases, Generateur } from "./contratGenerateur";
import { validerConfigurationDeLigne } from "./configurationLigne";

/** Configuration figée d'un exercice absente ou invalide pour un générateur qui l'exige : la ligne n'est pas exécutable (409), jamais exécutée avec un défaut. */
export class ConfigurationDeLigneInvalide extends Error {}

/**
 * SEUL appelant de `Generateur.generer` en production (RAPPORT §55) : transmet la configuration FIGÉE de la ligne d'exercice (`exercices_assignes.configuration`) aux
 * générateurs qui la déclarent, et RIEN aux autres (leur appel reste `generer(graine)`, strictement comme avant). Oublier la configuration à un site d'appel donnerait des
 * écrans et des poids d'une autre configuration, sans erreur : c'est pourquoi aucun site n'appelle `generer` directement (`scripts/test-configuration-ligne.ts` le garde).
 */
export function genererPourLigne(generateur: Generateur<any>, graine: number, configuration: unknown): unknown {
  const lue = validerConfigurationDeLigne(generateur, configuration);
  if (!lue.ok) throw new ConfigurationDeLigneInvalide(`${generateur.variante_id} : ${lue.erreur}`);
  return lue.configuration === null ? generateur.generer(graine) : generateur.generer(graine, lue.configuration as ConfigurationCases);
}
