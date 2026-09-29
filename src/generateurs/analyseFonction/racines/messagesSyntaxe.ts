import { ErreurSyntaxe } from "./erreurSyntaxe";

/**
 * Messages pédagogiques d'une saisie ILLISIBLE (`parse_error`, décision D6) : texte d'AUTEUR — balisage
 * `$…$` admis, donc tout texte d'élève qui y est recopié doit être échappé (`\$`, règle « un `$` tapé reste
 * un `$` »). Chaque message est vérifié par `verifierBalisageMath` dans `scripts/test-verification-racines.ts`.
 */

const MESSAGE_PAR_DEFAUT = "La réponse n'a pas pu être lue. Vérifie l'écriture de ton expression.";

/** Recopie sûre d'un caractère saisi par l'élève dans un texte d'auteur. */
export function echapperTexteEleve(texte: string): string {
  return texte.replace(/\$/g, "\\$");
}

/**
 * `racinesChamp2` (zéros) — traduction PORTÉE de `pilote:src/moteur/messagesErreurParsing.ts` : mêmes textes,
 * sauf le caractère recopié, échappé (F7). Le message du cas « valeur non réelle » n'existe pas : une valeur
 * hors domaine n'est pas illisible (voir `verifierRacinesChamp2`).
 */
export function messageSyntaxeZeros(erreur: unknown): string {
  if (!(erreur instanceof ErreurSyntaxe)) return MESSAGE_PAR_DEFAUT;
  switch (erreur.nature) {
    case "identifiant_inconnu":
      return `« ${echapperTexteEleve(erreur.detail)} » n'est pas reconnu ici. Vérifie l'orthographe, ou utilise uniquement les fonctions autorisées (racine carrée, racine cubique, valeur absolue).`;
    case "caractere_inattendu":
      return `Le caractère « ${echapperTexteEleve(erreur.detail)} » n'est pas reconnu. S'il vient d'un copier-coller (calculatrice, document), retape-le directement au clavier — certains symboles se ressemblent mais ne sont pas identiques.`;
    case "expression_mal_formee":
      return "L'expression contient un symbole en trop ou n'est pas complète. Relis-la depuis le début.";
    case "expression_incomplete":
      return "Il manque quelque chose après un opérateur (+, −, ×, ÷). Vérifie que ton expression est complète.";
    case "parenthese_fermante_manquante":
      return "Il manque une parenthèse fermante « ) ». Vérifie que chaque parenthèse ouverte est bien refermée.";
    case "barre_fermante_manquante":
      return "Il manque une barre de valeur absolue « | » pour refermer. Vérifie que chaque « | » ouverte est bien refermée.";
    case "parenthese_ouvrante_attendue":
      return "Une fonction (comme la racine carrée) doit toujours être suivie d'une parenthèse — par exemple √(4), jamais √4.";
    case "expression_vide":
      return "Le champ est vide. Écris une expression avant de valider.";
  }
}

/**
 * `racinesChamp1` (factorisation) — messages RÉDIGÉS pour ce chantier : l'ancien pilote ne renvoyait AUCUN
 * message sur ce champ (ses `catch` rendaient `parse_error` sans le traduire ; voir RAPPORT.md §19). Adaptés
 * à la grammaire de cet écran (seule la lettre x est une variable, aucune fonction) plutôt que copiés :
 * le texte d'origine parle de fonctions autorisées et de copier-coller.
 */
export function messageSyntaxeFactorisation(erreur: unknown): string {
  if (!(erreur instanceof ErreurSyntaxe)) return MESSAGE_PAR_DEFAUT;
  switch (erreur.nature) {
    case "caractere_inattendu": {
      const c = erreur.detail;
      if (c === "=") return "Le signe « = » ne peut apparaître qu'à la fin, sous la forme « = 0 » : écris seulement la factorisation, par exemple « 2x(x − 4) ».";
      if (/^[a-zA-Z]$/.test(c)) return `La lettre « ${c} » n'est pas utilisable ici : dans cette factorisation, seule la lettre x est admise.`;
      return `Le caractère « ${echapperTexteEleve(c)} » n'est pas reconnu. Utilise des chiffres, la lettre x, les signes + − × ÷ et ^, et des parenthèses.`;
    }
    case "expression_mal_formee":
      return "L'expression contient un symbole en trop ou n'est pas complète. Relis-la depuis le début.";
    case "expression_incomplete":
      return "L'expression est incomplète : il manque quelque chose (par exemple un nombre ou un facteur après un signe). Relis-la depuis le début.";
    case "parenthese_fermante_manquante":
      return "Il manque une parenthèse fermante « ) ». Vérifie que chaque parenthèse ouverte est bien refermée.";
    case "identifiant_inconnu":
    case "barre_fermante_manquante":
    case "parenthese_ouvrante_attendue":
    case "expression_vide":
      return MESSAGE_PAR_DEFAUT; // non émis par la grammaire de cet écran
  }
}
