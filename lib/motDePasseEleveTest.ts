import { randomBytes } from "node:crypto";

const ALPHABET_MDP = "abcdefghijkmnpqrstuvwxyz23456789"; // sans caractères ambigus (l, o, 0, 1)

/**
 * Mot de passe commun d'une série d'élèves de test (RAPPORT §61, §64) : 8 caractères tirés de `crypto` (jamais `Math.random`). SEULE définition : la création des élèves de test
 * (`admin/classes-test/:id/eleves`) et la régénération du mot de passe commun (`admin/classes-test/:id/mot-de-passe`) l'utilisent toutes deux.
 */
export function genererMotDePasseEleveTest(): string {
  return [...randomBytes(8)].map((o) => ALPHABET_MDP[o % ALPHABET_MDP.length]).join("");
}
