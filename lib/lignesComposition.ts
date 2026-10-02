import type { LigneComposition } from "./validationCorpsTaches";
import { generateurIdPourVariante } from "./catalogueGenerateurs";

/**
 * Lignes `taches_composition` à insérer pour une composition VALIDÉE (`validerComposition`) : constructeur UNIQUE des trois routes d'écriture (création, modification, aperçu).
 * Une quatrième copie à la main rendrait l'oubli d'une colonne quasi certain (c'est ainsi que l'aperçu avait dû être rattrapé pour `chrono_duree_secondes`).
 * `generateurId` : par défaut le catalogue ; l'aperçu passe le registre (seul à savoir exécuter).
 */
export function lignesDeComposition(
  tacheId: string,
  composition: readonly LigneComposition[],
  generateurId: (varianteId: LigneComposition["variante_id"]) => string = generateurIdPourVariante,
): Record<string, unknown>[] {
  return composition.map((ligne) => ({
    tache_id: tacheId,
    generateur_id: generateurId(ligne.variante_id),
    variante_id: ligne.variante_id,
    nombre_exercices: ligne.nombre_exercices,
    // Surcharge du chrono de tâche, `null` si absente (repli sur `taches.chrono_duree_secondes`, lib/resoudreChronoDureeSecondes.ts).
    chrono_duree_secondes: ligne.chrono_duree_secondes ?? null,
    // Configuration CANONIQUE (RAPPORT §55) ; `null` pour un générateur sans configuration. Jamais « résolue » par un défaut.
    configuration: ligne.configuration ?? null,
  }));
}
