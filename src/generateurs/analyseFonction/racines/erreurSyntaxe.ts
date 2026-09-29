/**
 * Erreur de LECTURE d'une saisie (jamais de justesse) levée par les deux évaluateurs de ce dossier.
 * Structurée (nature + élément fautif) plutôt qu'un message : l'ancien pilote reconnaissait la nature de
 * l'erreur en comparant des chaînes de message (`messagesErreurParsing.ts`) ; ici la nature est une donnée,
 * et le texte pédagogique est produit à part (`messagesSyntaxe.ts`).
 */
export type NatureErreurSyntaxe =
  | "caractere_inattendu" // détail = le caractère
  | "identifiant_inconnu" // détail = le mot (lettres/chiffres, en minuscules)
  | "expression_vide"
  | "expression_incomplete"
  | "expression_mal_formee"
  | "parenthese_fermante_manquante"
  | "barre_fermante_manquante"
  | "parenthese_ouvrante_attendue";

export class ErreurSyntaxe extends Error {
  constructor(
    readonly nature: NatureErreurSyntaxe,
    readonly detail: string = "",
  ) {
    super(`${nature}${detail ? ` : ${detail}` : ""}`);
    this.name = "ErreurSyntaxe";
  }
}
