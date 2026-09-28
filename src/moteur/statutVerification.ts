/**
 * Statut à 3 valeurs pour toute vérification de réponse élève en champ libre (expression
 * mathématique) — convention du projet depuis AUDIT-comparaison-reponses.md (addendum "statut à 3
 * valeurs") : un échec de parsing (syntaxe non reconnue) ne doit jamais être silencieusement
 * confondu avec une réponse mathématiquement fausse, même si les deux restent notées de façon
 * identique (le contrat booléen `verifier: (reponse) => boolean` consommé par
 * `etapeTentatives.ts` reste, lui, strictement inchangé — ce statut est un canal de diagnostic
 * supplémentaire, pour l'affichage, jamais pour le score).
 *
 * - "correct" : la réponse est juste.
 * - "not_equivalent" : l'expression a été interprétée avec succès (structurellement et/ou
 *   algébriquement), mais jugée mathématiquement non équivalente à la réponse attendue — inclut
 *   aussi bien un vrai mismatch numérique qu'un rejet structurel délibéré (ex. une forme
 *   développée refusée par un vérificateur qui exige une forme factorisée) : dans les deux cas,
 *   l'expression saisie a bel et bien pu être lue, ce n'est donc jamais un "parse_error".
 * - "parse_error" : l'expression n'a pas pu être interprétée du tout (exception de tokenisation/
 *   parsing — parenthèse manquante, caractère inconnu, fonction mal orthographiée, etc.).
 *
 * Voir CLAUDE.md, section "Statut de vérification à 3 valeurs (convention permanente)" pour la
 * règle à appliquer à toute nouvelle fonction de vérification de ce type.
 */
export type StatutVerification = "correct" | "not_equivalent" | "parse_error";
