import { type VariantePilote, estVarianteConnue, labelPourVariante } from "./catalogueGenerateurs";
import type { ChronoMode } from "./moteurTentatives";
import type { ConfigurationCases } from "./contratGenerateur";
import { validerDependances } from "./cascadeEcrans";
import { cleConfiguration, validerConfigurationDeLigne } from "./configurationLigne";
import { genererPourLigne } from "./genererPourLigne";
import { chercherGenerateur } from "./registreGenerateurs";

const CHRONO_MODES_VALIDES: readonly ChronoMode[] = ["aucun", "par_ecran", "global"];

export interface LigneComposition {
  variante_id: VariantePilote;
  nombre_exercices: number;
  /**
   * Correctif "Chrono par variante" — surcharge de `taches.chrono_duree_secondes` pour CETTE ligne
   * de composition ; `undefined`/absent : repli sur le réglage de tâche (voir
   * lib/resoudreChronoDureeSecondes.ts). N'a d'effet qu'en `chrono_mode="par_ecran"` — ignoré en
   * `"global"`/`"aucun"`, jamais rejeté pour autant s'il est quand même fourni (le prof peut avoir
   * réglé une valeur avant de changer de mode).
   */
  chrono_duree_secondes?: number;
  /**
   * Configuration PAR LIGNE, forme CANONIQUE (RAPPORT §55, `lib/configurationLigne.ts`) : présente seulement pour un générateur qui déclare une configuration, jamais complétée
   * par un défaut. Deux lignes de même variante peuvent porter des configurations différentes dans une même tâche.
   */
  configuration?: ConfigurationCases;
}

/** `variante_id` en `string` ici (pas encore `VariantePilote`) : le catalogue n'est vérifié qu'ensuite, séparément, pour pouvoir produire un message d'erreur explicite. */
export interface CorpsTaches {
  nom: string;
  composition: { variante_id: string; nombre_exercices: number; chrono_duree_secondes?: number; configuration?: unknown }[];
  /** Réglages de correction (prompt "Authentification élève", Étape 1/4) — optionnels : valeurs par défaut du schéma (true/false) si omis. */
  feedback_immediat?: boolean;
  reponse_visible?: boolean;
  /**
   * Réglages de tentatives/aide/récapitulatif (prompt "Tentatives, aide, récapitulatif" (3/3),
   * Étape 1) — tous optionnels, valeurs par défaut du schéma si omis (0/false/0/false).
   * `aide_penalite_pourcent` n'a d'effet que si `aide_activee` (même convention que
   * `reponse_visible`/`feedback_immediat` ci-dessus) mais reste validé même si `aide_activee` est
   * absent/faux — jamais une valeur silencieusement hors bornes stockée en base.
   */
  tentatives_supplementaires?: number;
  aide_activee?: boolean;
  aide_penalite_pourcent?: number;
  afficher_recapitulatif?: boolean;
  /**
   * Correctif "Chrono de réponse" — un seul mode actif (jamais les deux "par_ecran"/"global"
   * superposés, imposé par ce type lui-même : un seul champ `chrono_mode`). `chrono_duree_secondes`
   * strictement positif quand fourni (validé plus bas), mais OBLIGATOIRE uniquement en mode
   * "global" — en "par_ecran", correctif "Chrono par variante" : simple repli pour les lignes de
   * composition sans durée propre, jamais requis pour autant.
   */
  chrono_mode?: ChronoMode;
  chrono_duree_secondes?: number;
  /** Retour en arrière (RAPPORT §37) : sans effet sous correction immédiate ; interdit avec `chrono_mode = "par_ecran"`. */
  autoriser_retour_arriere?: boolean;
}

/**
 * Validation du corps de `POST /api/taches` et `PATCH /api/taches/:id` (prompt "Séparer création
 * et assignation de tâche", Étape 3) — extraite ici pour que les deux endpoints réutilisent
 * exactement la même règle de forme, jamais deux copies pouvant diverger.
 */
export function estCorpsValide(corps: unknown): corps is CorpsTaches {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  if (typeof c.nom !== "string" || c.nom.trim() === "") return false;
  if (!Array.isArray(c.composition) || c.composition.length === 0) return false;
  if (c.feedback_immediat !== undefined && typeof c.feedback_immediat !== "boolean") return false;
  if (c.reponse_visible !== undefined && typeof c.reponse_visible !== "boolean") return false;
  if (c.tentatives_supplementaires !== undefined && (typeof c.tentatives_supplementaires !== "number" || !Number.isInteger(c.tentatives_supplementaires) || c.tentatives_supplementaires < 0)) {
    return false;
  }
  if (c.aide_activee !== undefined && typeof c.aide_activee !== "boolean") return false;
  if (c.aide_penalite_pourcent !== undefined && (typeof c.aide_penalite_pourcent !== "number" || !Number.isInteger(c.aide_penalite_pourcent) || c.aide_penalite_pourcent < 0 || c.aide_penalite_pourcent > 100)) {
    return false;
  }
  if (c.afficher_recapitulatif !== undefined && typeof c.afficher_recapitulatif !== "boolean") return false;
  // Correctif "Chrono de réponse" : `chrono_mode` doit être une des 3 valeurs connues.
  // `chrono_duree_secondes` (niveau tâche) reste strictement positif quand fourni, mais n'est
  // OBLIGATOIRE qu'en mode "global" (seule durée qui existe alors — voir
  // lib/resoudreChronoDureeSecondes.ts, `chronoMode !== "par_ecran" -> return chronoDureeSecondesTache`
  // directement, aucune autre source possible). Correctif "Chrono par variante" (retour utilisateur
  // réel) : en mode "par_ecran", ce champ n'est qu'un REPLI pour les lignes de composition sans
  // durée propre — l'exiger même quand toutes les lignes ont déjà leur propre durée n'a pas de sens.
  // `resoudreChronoDureeSecondes` tolère déjà un repli `null` (traité comme "aucune limite", même
  // chemin que chrono_mode="aucun" — voir lib/routes/reponses-debut-ecran.ts) : rien ne dépend de sa
  // présence en "par_ecran".
  if (c.chrono_mode !== undefined && !CHRONO_MODES_VALIDES.includes(c.chrono_mode as ChronoMode)) return false;
  if (c.chrono_duree_secondes !== undefined && (typeof c.chrono_duree_secondes !== "number" || !Number.isInteger(c.chrono_duree_secondes) || c.chrono_duree_secondes <= 0)) {
    return false;
  }
  if (c.chrono_mode === "global" && c.chrono_duree_secondes === undefined) return false;
  // Retour en arrière (RAPPORT §37, D6) : un chrono PAR ÉCRAN limite la durée d'un écran ; revenir en arrière le
  // rouvrirait (ou le laisserait expiré) — combinaison sans sens, refusée plutôt que réinterprétée.
  if (c.autoriser_retour_arriere !== undefined && typeof c.autoriser_retour_arriere !== "boolean") return false;
  if (c.autoriser_retour_arriere === true && c.chrono_mode === "par_ecran") return false;
  return c.composition.every((ligne) => {
    if (typeof ligne !== "object" || ligne === null) return false;
    const l = ligne as Record<string, unknown>;
    if (l.chrono_duree_secondes !== undefined && (typeof l.chrono_duree_secondes !== "number" || !Number.isInteger(l.chrono_duree_secondes) || l.chrono_duree_secondes <= 0)) {
      return false;
    }
    // Forme seulement : le contenu de la configuration est validé par `validerComposition` (il faut le registre).
    if (l.configuration !== undefined && l.configuration !== null && (typeof l.configuration !== "object" || Array.isArray(l.configuration))) return false;
    return (
      typeof l.variante_id === "string" &&
      typeof l.nombre_exercices === "number" &&
      Number.isInteger(l.nombre_exercices) &&
      l.nombre_exercices >= 0
    );
  });
}

export type ResultatValidationComposition = { ok: true; composition: LigneComposition[] } | { ok: false; erreur: string };

/** Graine de contrôle : valide pour tout générateur (`estGraineValide`) ; sert uniquement à vérifier qu'une configuration produit des écrans. */
const GRAINE_DE_CONTROLE = 1;

/**
 * Rejette (message explicite) une combinaison absente du catalogue plutôt que de tenter une
 * génération qui échouerait plus loin, moins clairement — validé contre
 * `lib/catalogueGenerateurs.ts`, seule source de vérité. Omet aussi les entrées à
 * `nombre_exercices: 0` (jamais de ligne `taches_composition` à 0) et rejette une composition
 * entièrement vide après cette omission. Même règle pour la création et la modification d'une
 * tâche (Étape 3) — jamais redéfinie séparément aux deux endroits.
 *
 * Configuration par ligne (RAPPORT §55, audit décisions A à E) — POINT UNIQUE des trois routes d'écriture (création, modification, aperçu) :
 *  1. chaque ligne retenue est validée et CANONISÉE par `validerConfigurationDeLigne` (une ligne sans case cochée est refusée : 400, aucune écriture) ;
 *  2. une configuration qui ne produit AUCUN écran, ou des dépendances invalides, est refusée (sans quoi `champs_attendus` serait vide et l'exercice « complet » d'emblée) ;
 *  3. les doublons EXACTS sont fusionnés en ADDITIONNANT les `nombre_exercices`. Clé : `(variante_id, configuration canonique, durée de chrono normalisée)` ; la durée n'a d'effet
 *     qu'en mode `par_ecran` : hors de ce mode elle est ignorée par la clé (elle ne distingue pas deux lignes), jamais rejetée. Deux lignes de même variante et de durées
 *     différentes en `par_ecran` restent DISTINCTES. L'ordre est celui de la première occurrence.
 */
export function validerComposition(
  compositionBrute: { variante_id: string; nombre_exercices: number; chrono_duree_secondes?: number; configuration?: unknown }[],
  chronoMode: ChronoMode = "aucun",
): ResultatValidationComposition {
  const ligneInconnue = compositionBrute.find((ligne) => !estVarianteConnue(ligne.variante_id));
  if (ligneInconnue) {
    return { ok: false, erreur: `Variante inconnue du catalogue : "${ligneInconnue.variante_id}"` };
  }
  // `Array.prototype.find` ci-dessus ne renarrowe pas le tableau entier (contrairement à `every`
  // avec un type predicate) : cast explicite, sûr puisque chaque ligne vient d'être vérifiée contre
  // `estVarianteConnue`.
  const compositionConnue = compositionBrute as (Omit<LigneComposition, "configuration"> & { configuration?: unknown })[];
  const retenues = compositionConnue.filter((ligne) => ligne.nombre_exercices > 0);
  if (retenues.length === 0) {
    return { ok: false, erreur: "Au moins une variante doit avoir nombre_exercices > 0" };
  }
  const fusionnees = new Map<string, LigneComposition>();
  for (const ligne of retenues) {
    const generateur = chercherGenerateur(ligne.variante_id);
    const lue = validerConfigurationDeLigne(generateur, ligne.configuration);
    const nom = labelPourVariante(ligne.variante_id) ?? ligne.variante_id;
    if (!lue.ok) return { ok: false, erreur: `Ligne « ${nom} » : ${lue.erreur}` };
    if (generateur !== null && lue.configuration !== null) {
      try {
        const ecrans = (generateur.ecrans(genererPourLigne(generateur, GRAINE_DE_CONTROLE, lue.configuration)) as unknown[]).length;
        const problemes = validerDependances(generateur.ecrans(genererPourLigne(generateur, GRAINE_DE_CONTROLE, lue.configuration)));
        if (ecrans === 0) return { ok: false, erreur: `Ligne « ${nom} » : cette configuration ne produit aucun écran.` };
        if (problemes.length > 0) return { ok: false, erreur: `Ligne « ${nom} » : configuration incohérente (${problemes.join(" ; ")}).` };
      } catch (e) {
        return { ok: false, erreur: `Ligne « ${nom} » : configuration inutilisable (${(e as Error).message}).` };
      }
    }
    const dureeEffective = chronoMode === "par_ecran" ? (ligne.chrono_duree_secondes ?? null) : null;
    const cle = `${ligne.variante_id}\u0000${cleConfiguration(lue.configuration)}\u0000${dureeEffective === null ? "" : dureeEffective}`;
    const existante = fusionnees.get(cle);
    if (existante) existante.nombre_exercices += ligne.nombre_exercices;
    else {
      const { configuration: _brute, ...reste } = ligne;
      fusionnees.set(cle, { ...reste, ...(lue.configuration === null ? {} : { configuration: lue.configuration }) });
    }
  }
  return { ok: true, composition: [...fusionnees.values()] };
}
