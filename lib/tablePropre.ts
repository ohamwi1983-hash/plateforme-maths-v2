/**
 * Lecture dans une table d'OBJET LITTÉRAL par clé dynamique, sans jamais suivre la chaîne de prototypes.
 *
 * `table[cle]` et `cle in table` lisent aussi les membres hérités d'`Object.prototype` : `"constructor"`,
 * `"toString"`, `"valueOf"`, `"hasOwnProperty"`, `"__proto__"` sont « présents » dans n'importe quel objet
 * littéral, et `table["constructor"]` renvoie une FONCTION, pas `undefined` (RAPPORT.md §20 ; même piège que
 * l'ancien `mot in NOMS_FONCTIONS` de `racinesChamp2`, RAPPORT.md §19-D n°3). Toute lecture d'une table
 * de compétences / de symboles par une clé qui n'est pas une constante du code passe donc par ici, ou par
 * `Object.hasOwn`.
 */
export function lirePropre<T>(table: Readonly<Record<string, T>>, cle: string): T | undefined {
  return Object.hasOwn(table, cle) ? table[cle] : undefined;
}
