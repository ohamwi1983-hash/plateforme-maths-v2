import type { StatutVerification } from "../src/moteur/statutVerification";

export interface ReglagesCorrection {
  feedback_immediat: boolean;
  reponse_visible: boolean;
}

/**
 * SEULE définition de « la solution d'un champ peut être montrée à l'élève PENDANT la résolution » (RAPPORT §42) : correction immédiate
 * ET « Afficher la réponse attendue » cochée. Avec 1 essai (défaut) un premier échec épuise le champ ; sans cette case, l'élève voit alors
 * son verdict et le champ se verrouille, mais jamais la solution. Tout site qui suppose « la vraie valeur a été montrée » (repli de la
 * cascade, tableau aux valeurs vraies) doit suivre CETTE règle, pas `feedback_immediat` seul. Les révélations forcées (tâche antérieure,
 * fin d'une tâche sous correction coupée) sont un autre mécanisme (`REGLAGES_FORCEES_ANTERIEURES`) et ne passent pas par ici.
 */
export function solutionMontreeEnCours(reglages: ReglagesCorrection): boolean {
  return reglages.feedback_immediat && reglages.reponse_visible;
}

export interface ReponseHttpReponses {
  statut?: StatutVerification;
  solution_attendue?: string;
  message_erreur?: string;
}

/**
 * Conditionne ce qui est RENVOYÉ à l'élève (prompt "Authentification élève et réglages de
 * correction", Étape 4) — ne touche jamais à ce qui est calculé/stocké en base (`statut`,
 * `bug_detecte` restent toujours calculés et insérés dans `reponses`, quel que soit le réglage).
 *
 * - `feedback_immediat = false` : rien (l'élève sait juste que sa réponse a été enregistrée).
 * - `feedback_immediat = true`, `reponse_visible = false` : `statut` seul.
 * - `feedback_immediat = true`, `reponse_visible = true` : `statut` + `solution_attendue`.
 *
 * `bug_detecte` n'est délibérément PAS un paramètre de cette fonction — règle déjà actée (jamais
 * renvoyé au client, sous aucun réglage), pas revisitée ici.
 *
 * Correctif "messages pédagogiques pour parse_error" : `messageErreurSyntaxe` (optionnel — absent
 * pour les 2 réponses HISTORIQUES déjà figées, `lib/routes/reponses.ts`/`lib/tableauDeBord.ts`, qui
 * n'ont pas d'exception fraîche à traduire) n'est attaché QUE si `statut === "parse_error"` ET
 * `feedback_immediat`, sous `reponse_visible` comme sous `!reponse_visible` — ce champ décrit une
 * erreur de SYNTAXE, jamais la bonne réponse elle-même, donc jamais soumis à la même règle de
 * confidentialité que `solution_attendue`.
 */
export function construireReponseHttpReponses(
  reglages: ReglagesCorrection,
  statut: StatutVerification,
  solutionAttendue: string,
  messageErreurSyntaxe?: string | null,
): ReponseHttpReponses {
  if (!reglages.feedback_immediat) return {};
  const messageErreur = statut === "parse_error" && messageErreurSyntaxe ? { message_erreur: messageErreurSyntaxe } : {};
  if (!reglages.reponse_visible) return { statut, ...messageErreur };
  return { statut, solution_attendue: solutionAttendue, ...messageErreur };
}
