/**
 * Catalogue des générateurs/variantes proposés par ce pilote — repris de l'ancien pilote
 * (`plateforme-maths-pilote/lib/catalogueGenerateurs.ts`), élagué à gen7 pour la phase 1 (Décision
 * actée 3 du prompt "Nouveau pilote — Phase 1" : "garder la structure et les fonctions génériques
 * (`VariantePilote`, `estVarianteConnue`, `generateurIdPourVariante`, `labelPourVariante`) avec
 * uniquement les 4 entrées de gen7 comme données de catalogue"). gen7 lui-même sera réécrit en
 * phase 3 ; ces 4 entrées ne sont que de la donnée de catalogue (aucun code de générateur), elles
 * servent uniquement à valider/afficher la composition d'une tâche gen7 côté `prof.html`. Labels
 * IDENTIQUES mot pour mot à l'ancien pilote (`lib/catalogueGenerateurs.ts:165-168`).
 */
export const CATALOGUE_GENERATEURS = [
  { generateur_id: "gen7", variante_id: "af_mise_en_evidence", label: "Mise en évidence (c=0)" },
  { generateur_id: "gen7", variante_id: "af_binome_conjugue", label: "Binôme conjugué (b=0, différence de deux carrés)" },
  { generateur_id: "gen7", variante_id: "af_produit_remarquable", label: "Produit remarquable (Δ=0, carré parfait)" },
  { generateur_id: "gen7", variante_id: "af_irreductible", label: "Irréductible (Δ<0, aucune racine réelle)" },
] as const;

export type VariantePilote = (typeof CATALOGUE_GENERATEURS)[number]["variante_id"];

export function estVarianteConnue(varianteId: string): varianteId is VariantePilote {
  return CATALOGUE_GENERATEURS.some((entree) => entree.variante_id === varianteId);
}

/** Lève si `varianteId` n'est pas dans le catalogue — n'appeler qu'après `estVarianteConnue`. */
export function generateurIdPourVariante(varianteId: VariantePilote): string {
  const entree = CATALOGUE_GENERATEURS.find((e) => e.variante_id === varianteId);
  if (!entree) throw new Error(`Variante inconnue du catalogue : ${varianteId}`);
  return entree.generateur_id;
}

/**
 * Libellé humain d'une variante pour l'affichage. `null` (jamais une exception, contrairement à
 * `generateurIdPourVariante` ci-dessus) si `varianteId` n'est pas dans le catalogue — un label
 * manquant est un simple repli d'affichage côté client, jamais une erreur de câblage serveur qui
 * doit interrompre la requête.
 */
export function labelPourVariante(varianteId: string): string | null {
  const entree = CATALOGUE_GENERATEURS.find((e) => e.variante_id === varianteId);
  return entree ? entree.label : null;
}
