import { type VariantePilote, estVarianteConnue } from "./catalogueGenerateurs";
import type { ChronoMode } from "./moteurTentatives";

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
}

/** `variante_id` en `string` ici (pas encore `VariantePilote`) : le catalogue n'est vérifié qu'ensuite, séparément, pour pouvoir produire un message d'erreur explicite. */
export interface CorpsTaches {
  nom: string;
  composition: { variante_id: string; nombre_exercices: number; chrono_duree_secondes?: number }[];
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
  return c.composition.every((ligne) => {
    if (typeof ligne !== "object" || ligne === null) return false;
    const l = ligne as Record<string, unknown>;
    if (l.chrono_duree_secondes !== undefined && (typeof l.chrono_duree_secondes !== "number" || !Number.isInteger(l.chrono_duree_secondes) || l.chrono_duree_secondes <= 0)) {
      return false;
    }
    return (
      typeof l.variante_id === "string" &&
      typeof l.nombre_exercices === "number" &&
      Number.isInteger(l.nombre_exercices) &&
      l.nombre_exercices >= 0
    );
  });
}

export type ResultatValidationComposition = { ok: true; composition: LigneComposition[] } | { ok: false; erreur: string };

/**
 * Rejette (message explicite) une combinaison absente du catalogue plutôt que de tenter une
 * génération qui échouerait plus loin, moins clairement — validé contre
 * `lib/catalogueGenerateurs.ts`, seule source de vérité. Omet aussi les entrées à
 * `nombre_exercices: 0` (jamais de ligne `taches_composition` à 0) et rejette une composition
 * entièrement vide après cette omission. Même règle pour la création et la modification d'une
 * tâche (Étape 3) — jamais redéfinie séparément aux deux endroits.
 */
export function validerComposition(compositionBrute: { variante_id: string; nombre_exercices: number; chrono_duree_secondes?: number }[]): ResultatValidationComposition {
  const ligneInconnue = compositionBrute.find((ligne) => !estVarianteConnue(ligne.variante_id));
  if (ligneInconnue) {
    return { ok: false, erreur: `Variante inconnue du catalogue : "${ligneInconnue.variante_id}"` };
  }
  // `Array.prototype.find` ci-dessus ne renarrowe pas le tableau entier (contrairement à `every`
  // avec un type predicate) : cast explicite, sûr puisque chaque ligne vient d'être vérifiée contre
  // `estVarianteConnue`.
  const compositionConnue = compositionBrute as LigneComposition[];
  const composition = compositionConnue.filter((ligne) => ligne.nombre_exercices > 0);
  if (composition.length === 0) {
    return { ok: false, erreur: "Au moins une variante doit avoir nombre_exercices > 0" };
  }
  return { ok: true, composition };
}
