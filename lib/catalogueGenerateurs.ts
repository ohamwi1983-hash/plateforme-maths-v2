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
  // gen7 « Analyse d'une fonction du second degré » (RAPPORT §49) : dix sous-variantes en deux familles — « sans discriminant » (reconnaissance de motif, `af_motif_*`)
  // et « avec discriminant » (méthode générale, `af_delta_*`). Libellés IDENTIQUES mot pour mot à `public/catalogue-generateurs-complet.json` (4e, n° 7), où l'axe
  // « sans discriminant » / « avec discriminant » est ajouté devant par `prof.html`.
  { generateur_id: "gen7", variante_id: "af_motif_aucune_racine", label: "Aucune racine réelle (b=0)" },
  { generateur_id: "gen7", variante_id: "af_motif_racine_double_rationnelle", label: "Racine double rationnelle" },
  { generateur_id: "gen7", variante_id: "af_motif_racine_double_irrationnelle", label: "Racine double irrationnelle" },
  { generateur_id: "gen7", variante_id: "af_motif_racines_opposees_rationnelles", label: "Racines opposées rationnelles (b=0)" },
  { generateur_id: "gen7", variante_id: "af_motif_racines_opposees_irrationnelles", label: "Racines opposées irrationnelles (b=0)" },
  { generateur_id: "gen7", variante_id: "af_motif_racine_nulle_rationnelle", label: "Une racine nulle, l'autre rationnelle (c=0)" },
  { generateur_id: "gen7", variante_id: "af_motif_racine_nulle_irrationnelle", label: "Une racine nulle, l'autre irrationnelle (c=0)" },
  { generateur_id: "gen7", variante_id: "af_delta_aucune_racine", label: "Aucune racine réelle (Δ<0)" },
  { generateur_id: "gen7", variante_id: "af_delta_racines_rationnelles", label: "Deux racines distinctes rationnelles" },
  { generateur_id: "gen7", variante_id: "af_delta_racines_irrationnelles", label: "Deux racines distinctes irrationnelles" },
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
