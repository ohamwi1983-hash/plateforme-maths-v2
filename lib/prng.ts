/**
 * PRNG déterministe (mulberry32) — seule source d'aléa autorisée dans un générateur : un
 * `generer(graine)` qui appelle `Math.random()` nu casse la régénération (`exercices_assignes.graine`,
 * voir lib/contratGenerateur.ts) et rend les tests irreproductibles (classe de flake déjà rencontrée
 * en phase 1 sur le tirage non seedé de l'ancien `test-gen7.ts`).
 *
 * Graine : entier 32 bits non signé (`0 <= graine < 2**32`), stocké tel quel en base
 * (`exercices_assignes.graine`, `bigint`). Même graine -> même suite de tirages, à l'identique, sur
 * toute machine (arithmétique entière 32 bits uniquement, pas de dépendance à `Math.random`).
 */

export const GRAINE_MAX = 2 ** 32;

export function estGraineValide(graine: unknown): graine is number {
  return typeof graine === "number" && Number.isInteger(graine) && graine >= 0 && graine < GRAINE_MAX;
}

/** Tire une graine aléatoire (usage serveur, à l'assignation uniquement — jamais dans un générateur). */
export function tirerGraine(): number {
  return Math.floor(Math.random() * GRAINE_MAX);
}

export interface Prng {
  /** Flottant dans [0, 1). */
  suivant(): number;
  /** Entier dans [min, max], bornes incluses. */
  entierEntre(min: number, max: number): number;
  /** Élément tiré uniformément dans un tableau non vide. */
  choisir<T>(elements: readonly T[]): T;
}

export function creerPrng(graine: number): Prng {
  if (!estGraineValide(graine)) throw new Error(`Graine invalide : ${String(graine)} (entier 0 <= g < 2^32 attendu)`);
  let etat = graine >>> 0;
  const suivant = (): number => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    suivant,
    entierEntre(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) throw new Error(`Bornes invalides : [${min}, ${max}]`);
      return min + Math.floor(suivant() * (max - min + 1));
    },
    choisir(elements) {
      if (elements.length === 0) throw new Error("choisir() sur un tableau vide");
      return elements[Math.floor(suivant() * elements.length)];
    },
  };
}
