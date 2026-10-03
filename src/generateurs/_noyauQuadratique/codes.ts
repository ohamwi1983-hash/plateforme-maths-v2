/**
 * Codes de compétence de l'écran « chaîne de transformations », communs à gen8 et gen9 (RAPPORT §57, §58, §59). Signaux purs : n'affectent jamais la note. Déclarés aussi dans
 * `lib/dictionnaireCompetences.ts` et les trois fichiers d'explication.
 */
/**
 * `p` écrit avec le signe CONTRAIRE (`a` et `q` justes) : confusion sur le sens du décalage horizontal. Émis par gen8 (écran 1, lecture graphique) ET gen9 (écran 1, complétion du carré :
 * `p' = b/(2a)` au lieu de `−b/(2a)`) — la même confusion, donc UN code (RAPPORT §59) : le profil de compétences agrège par code.
 */
export const CODE_SIGNE_P_INVERSE = "SIGNE_P_INVERSE";

/** Une étape bien formée mais avec une transformation que ni la ligne du professeur ni la fonction de l'élève n'autorisent. */
export const CODE_TRANSFORMATION_HORS_SUJET = "TRANSFORMATION_HORS_SUJET";

/**
 * La règle de l'étape est VRAIE pour la transformation choisie, mais la valeur que l'élève a déclarée (TH `h`, TV `k`, EV | CV facteur) n'est pas celle de la règle. Signal PUR : n'affecte ni
 * le verdict ni `fractionCorrecte` (l'étape est fausse, avec ou sans ce code). N'existe que sur `not_equivalent` ; une valeur hors domaine est un `parse_error`, jamais ce code.
 */
export const CODE_VALEUR_DECLAREE_INCORRECTE = "VALEUR_DECLAREE_INCORRECTE";

/** Les codes que `verifierChaineSur` peut renvoyer. */
export const CODES_CHAINE: readonly string[] = [CODE_TRANSFORMATION_HORS_SUJET, CODE_VALEUR_DECLAREE_INCORRECTE];
