import type { Generateur, ResultatVerification } from "./contratGenerateur";
import { verifierAvecControle } from "./registreGenerateurs";

/**
 * Parties fausses d'une réponse (RAPPORT §52) : SEULE définition de la porte. Elles ne sont exposées au navigateur que sous correction IMMÉDIATE — le réglage RÉEL de la tâche
 * (`contexte.reglages.feedback_immediat`), jamais la révélation forcée d'une tâche antérieure ou d'une fin de tâche sous correction coupée — et seulement pour un verdict
 * `not_equivalent` dont le générateur a désigné les parties. Avec ou sans « Afficher la réponse attendue », avec ou sans essais supplémentaires : désigner QUELLE partie est fausse
 * ne montre pas la solution, mais c'est une information plus fine que le verdict ; elle suit donc la porte du verdict (immédiat) et jamais une porte plus large.
 * `null` : rien à surligner (verdict juste, illisible, générateur qui ne désigne rien, ou correction coupée).
 */
export function partiesFaussesDe(resultat: ResultatVerification, correctionImmediate: boolean): string[] | null {
  if (!correctionImmediate || resultat.statut !== "not_equivalent" || resultat.partiesFausses === undefined) return null;
  return resultat.partiesFausses;
}

/**
 * Recalcule les parties fausses de la DERNIÈRE réponse d'un champ (relecture : `GET /api/exercices/:id`). On re-vérifie la réponse enregistrée sur l'exercice PROJETÉ courant : sous correction
 * immédiate les écrans amont sont verrouillés, donc la projection est celle qui a servi à la vérification d'origine. Une erreur de vérification ne fait jamais échouer la lecture (c'est
 * un surlignage, pas un verdict) : `null`.
 */
export function recalculerPartiesFausses(generateur: Generateur<any>, exerciceProjete: unknown, champ: string, derniere: { valeur_saisie: string; statut: string } | null, correctionImmediate: boolean): string[] | null {
  if (!correctionImmediate || derniere === null || derniere.statut !== "not_equivalent") return null;
  try {
    return partiesFaussesDe(verifierAvecControle(generateur, exerciceProjete, champ, derniere.valeur_saisie), correctionImmediate);
  } catch {
    return null;
  }
}
