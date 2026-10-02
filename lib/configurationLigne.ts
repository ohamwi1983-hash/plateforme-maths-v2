import type { ConfigurationCases, DescripteurConfigurationCases, Generateur } from "./contratGenerateur";

/**
 * Configuration par ligne de composition (RAPPORT §55) — SEULE autorité sur « une configuration de ligne est-elle valable, et quelle est sa forme canonique ».
 * Jamais de seconde implémentation (routes de tâches, assignation, aperçu, relecture d'un exercice passent toutes ici).
 *
 * Règles (audit `docs/AUDIT-config-par-ligne-composition.md`, décisions B et D) :
 *  - un générateur SANS descripteur n'accepte AUCUNE configuration (absente ou `null` seulement) ;
 *  - un générateur AVEC descripteur exige une configuration NON VIDE : aucune case cochée est refusé, jamais complété par un défaut ;
 *  - la forme canonique ne fait que NORMALISER (identifiants connus, doublons retirés, ordre de `cases`) ; elle ne choisit jamais à la place du professeur.
 */
export type ResultatConfiguration<T> = { ok: true; configuration: T } | { ok: false; erreur: string };

export const MESSAGE_CONFIGURATION_VIDE = "Sélectionnez au moins une case pour cette ligne.";

function estObjetSimple(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Canonise une configuration `cases` ; ne lève jamais. */
export function canoniserConfigurationCases(descripteur: DescripteurConfigurationCases, brute: unknown): ResultatConfiguration<ConfigurationCases> {
  if (!estObjetSimple(brute)) return { ok: false, erreur: "Configuration invalide : un objet { actives: [...] } est attendu." };
  const cles = Object.keys(brute);
  if (cles.length !== 1 || cles[0] !== "actives") return { ok: false, erreur: "Configuration invalide : seule la clé « actives » est admise." };
  const actives = brute.actives;
  if (!Array.isArray(actives) || actives.some((a) => typeof a !== "string")) return { ok: false, erreur: "Configuration invalide : « actives » doit être une liste d'identifiants." };
  const connus = new Set(descripteur.cases.map((c) => c.id));
  const inconnu = (actives as string[]).find((a) => !connus.has(a));
  if (inconnu !== undefined) return { ok: false, erreur: "Configuration invalide : case inconnue." };
  const choisies = new Set(actives as string[]);
  if (choisies.size === 0) return { ok: false, erreur: MESSAGE_CONFIGURATION_VIDE };
  for (const groupe of descripteur.exclusifs ?? []) {
    if (groupe.filter((id) => choisies.has(id)).length > 1) {
      const libelles = groupe.map((id) => descripteur.cases.find((c) => c.id === id)?.libelle ?? id);
      return { ok: false, erreur: `Configuration invalide : ${libelles.join(" et ")} s'excluent mutuellement.` };
    }
  }
  return { ok: true, configuration: { actives: descripteur.cases.map((c) => c.id).filter((id) => choisies.has(id)) } };
}

/**
 * Valide la configuration d'UNE ligne pour un générateur. `configuration: null` = « pas de configuration » (générateur qui n'en déclare pas).
 * `generateur === null` (variante du catalogue sans générateur au registre) : une configuration fournie est refusée (rien ne permet de la contrôler).
 */
export function validerConfigurationDeLigne(generateur: Pick<Generateur<any>, "configuration"> | null, brute: unknown): ResultatConfiguration<ConfigurationCases | null> {
  const fournie = brute !== undefined && brute !== null;
  if (generateur === null || generateur.configuration === undefined) {
    return fournie ? { ok: false, erreur: "Cette variante n'a pas de configuration." } : { ok: true, configuration: null };
  }
  if (!fournie) return { ok: false, erreur: MESSAGE_CONFIGURATION_VIDE };
  return canoniserConfigurationCases(generateur.configuration, brute);
}

/** Clé de comparaison d'une configuration canonique (fusion des doublons) : `""` pour « aucune ». */
export function cleConfiguration(configuration: ConfigurationCases | null | undefined): string {
  return configuration === null || configuration === undefined ? "" : JSON.stringify(configuration.actives);
}

/** Libellé lisible d'une configuration (relecture professeur) : `"TH, TV"`. `null` si aucune. */
export function libelleConfiguration(descripteur: DescripteurConfigurationCases | undefined, configuration: ConfigurationCases | null | undefined): string | null {
  if (!descripteur || !configuration) return null;
  return configuration.actives.map((id) => descripteur.cases.find((c) => c.id === id)?.libelle ?? id).join(", ");
}
