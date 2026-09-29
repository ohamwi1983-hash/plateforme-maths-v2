import type { EcranDeclare } from "./contratGenerateur";

/**
 * Cascade de réponses entre écrans (RAPPORT §18) : règles PURES sur `EcranDeclare.dependDe`. Un écran
 * dépendant est bâti sur la valeur CONFIRMÉE d'un écran précédent (`Generateur.projeter`) ; tant que ses
 * prédécesseurs ne sont pas terminés il n'existe pas côté élève — son texte est absent des réponses HTTP
 * (masquer l'écran dans le navigateur ne suffit pas : la charge utile serait lisible).
 */

/** Problèmes de déclaration des dépendances d'une liste d'écrans (vide = sain). */
export function validerDependances(ecrans: readonly EcranDeclare[]): string[] {
  const problemes: string[] = [];
  const rang = new Map<string, number>();
  ecrans.forEach((e, i) => {
    if (rang.has(e.champ)) problemes.push(`champ en double : ${e.champ}`);
    rang.set(e.champ, i);
  });
  ecrans.forEach((e, i) => {
    if (e.dependDe === undefined) return;
    if (!Array.isArray(e.dependDe) || e.dependDe.length === 0) problemes.push(`${e.champ} : dependDe doit être une liste non vide (ou absent)`);
    else {
      for (const d of e.dependDe) {
        const r = rang.get(d);
        if (r === undefined) problemes.push(`${e.champ} : dependDe cite un champ inconnu « ${d} »`);
        else if (r >= i) problemes.push(`${e.champ} : dependDe cite « ${d} », qui ne le précède pas (cycle ou auto-référence)`);
      }
    }
  });
  return problemes;
}

/** Vrai si tous les champs dont dépend l'écran sont terminés (un écran indépendant l'est toujours). */
export function dependancesTerminees(ecran: Pick<EcranDeclare, "dependDe">, champsTermines: ReadonlySet<string>): boolean {
  return (ecran.dependDe ?? []).every((d) => champsTermines.has(d));
}

/**
 * Écrans que le serveur peut envoyer : les indépendants, et les dépendants dont les prédécesseurs sont
 * terminés. `tout` (tâche antérieure : consultation de l'historique) sert tous les écrans.
 */
export function ecransServis(ecrans: readonly EcranDeclare[], champsTermines: ReadonlySet<string>, tout: boolean): EcranDeclare[] {
  return tout ? [...ecrans] : ecrans.filter((e) => dependancesTerminees(e, champsTermines));
}
