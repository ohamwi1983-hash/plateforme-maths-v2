import type { EcranDeclare } from "./contratGenerateur";

/**
 * Validité d'une réponse sous « retour en arrière » (RAPPORT §37, décision D4) — règles PURES, sans base ni horloge.
 *
 * Une ligne `reponses` n'est jamais supprimée ni marquée : elle est VALIDE si elle est plus récente que la dernière ligne de
 * CHAQUE écran dont son écran dépend, directement ou non (`EcranDeclare.dependDe`, fermeture transitive). Quand l'élève modifie
 * la réponse d'un écran amont (une nouvelle ligne, donc plus récente), toutes les réponses aval enregistrées avant elle cessent
 * d'être valides ; s'il la re-soumet identique, aucune ligne n'est écrite (`lib/routes/reponses.ts`) et rien ne bouge. L'état
 * d'un écran est celui de sa DERNIÈRE ligne si elle est valide (sinon : sans réponse). Rien à défaire, rien à recalculer d'un
 * état stocké : l'ordre d'insertion suffit et la dérivation est la même à chaque lecture.
 *
 * L'ordre est celui des lignes reçues (chronologique croissant, `horodatage` de la base) : jamais un horodatage comparé à un
 * autre. Les statistiques (bugs détectés, durées, série) continuent de compter TOUTES les lignes (D8).
 */

/** Pour chaque écran, l'ensemble des écrans dont il dépend, directement ou par transitivité. Un écran indépendant a un ensemble vide. */
export function amontsTransitifs(ecrans: readonly Pick<EcranDeclare, "champ" | "dependDe">[]): Map<string, ReadonlySet<string>> {
  const amonts = new Map<string, Set<string>>();
  // `validerDependances` garantit que dependDe ne cite que des écrans PRÉCÉDENTS : une seule passe dans l'ordre suffit.
  for (const ecran of ecrans) {
    const tous = new Set<string>();
    for (const d of ecran.dependDe ?? []) {
      tous.add(d);
      for (const a of amonts.get(d) ?? []) tous.add(a);
    }
    amonts.set(ecran.champ, tous);
  }
  return amonts;
}

/**
 * Dernière ligne VALIDE de chaque écran. `lignesChronologiques` : toutes les lignes de l'exercice, de la plus ancienne à la plus
 * récente (tous champs confondus). Un écran absent du résultat n'a pas de réponse valide. Un écran dont un amont n'a AUCUNE ligne
 * n'a pas de réponse valide non plus (jamais possible par l'API, qui sert un écran dépendant après ses prédécesseurs).
 */
export function dernieresReponsesValides<T extends { champ: string }>(
  amonts: ReadonlyMap<string, ReadonlySet<string>>,
  lignesChronologiques: readonly T[],
): Map<string, T> {
  const derniere = new Map<string, number>();
  lignesChronologiques.forEach((l, i) => derniere.set(l.champ, i));
  const valides = new Map<string, T>();
  for (const [champ, i] of derniere) {
    const estValide = [...(amonts.get(champ) ?? [])].every((a) => {
      const ia = derniere.get(a);
      return ia !== undefined && ia < i;
    });
    if (estValide) valides.set(champ, lignesChronologiques[i]!);
  }
  return valides;
}
