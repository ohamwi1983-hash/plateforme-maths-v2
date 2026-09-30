/**
 * Générateur de TEST (jamais dans `src/`, jamais au catalogue) qui exerce le mécanisme de CASCADE
 * (RAPPORT §18) : `dependDe`, `projeter`, filtrage des écrans servis, aide et solution projetées, repli à
 * deux régimes. Il n'ajoute AUCUN type d'écran (que des `champ_expression`) : le témoin technique unique
 * (`src/generateurs/_temoinTechnique`) garde ses deux profils et ses graines — un troisième profil
 * aurait déplacé le profil de graines utilisées par des centaines d'assertions.
 *
 *   etape1 : « Calcule a + b »                       (vraie valeur d1 = a + b)
 *   etape2 : « Ton résultat précédent est d1. Double » (dépend d'etape1 ; attendu 2·d1, d1 = valeur CONFIRMÉE)
 *   etape3 : « Ton résultat précédent est d2. + 1 »   (dépend d'etape2 ; attendu d2 + 1, d2 = valeur CONFIRMÉE)
 *   libre  : indépendant (servi dès le départ, comme tout écran sans `dependDe`)
 */
import { creerPrng } from "../../lib/prng";
import { etatActuelSequentiel, type EcranDeclare, type Generateur, type ReponseConfirmee, type ResultatVerification } from "../../lib/contratGenerateur";

export const VARIANTE_CASCADE = "_cascade_fixture_v1";
export const CHAMP_ETAPE1 = "etape1";
export const CHAMP_ETAPE2 = "etape2";
export const CHAMP_ETAPE3 = "etape3";
export const CHAMP_LIBRE = "libre";
export const CHAMPS_CASCADE = [CHAMP_ETAPE1, CHAMP_ETAPE2, CHAMP_ETAPE3, CHAMP_LIBRE];
/** Décalage de la donnée de repli sous correction coupée : toujours DISTINCTE de la vraie valeur. */
export const DECALAGE_REPLI = 7;
const BORNE = 10_000;

export interface ExerciceCascade {
  a: number;
  b: number;
  /** Donnée effective de l'écran 2 (vraie valeur dans l'exercice brut, valeur confirmée après projection). */
  d1: number;
  /** Donnée effective de l'écran 3. */
  d2: number;
}

const ENTIER = /^\s*-?\d+\s*$/;

/** Valeur confirmée exploitable d'un champ, ou repli à deux régimes (RAPPORT §18). */
function donneeEffective(confirmees: readonly ReponseConfirmee[], champ: string, valeurVraie: number, correctionImmediate: boolean): number {
  const c = confirmees.find((r) => r.champ === champ);
  if (c && c.statut !== "parse_error" && ENTIER.test(c.reponseBrute) && Math.abs(Number(c.reponseBrute)) <= BORNE) return Number(c.reponseBrute);
  return correctionImmediate ? valeurVraie : valeurVraie + DECALAGE_REPLI;
}

export function attendus(ex: ExerciceCascade): Record<string, number> {
  return { [CHAMP_ETAPE1]: ex.a + ex.b, [CHAMP_ETAPE2]: 2 * ex.d1, [CHAMP_ETAPE3]: ex.d2 + 1, [CHAMP_LIBRE]: 4 };
}

export const generateurCascade: Generateur<ExerciceCascade> = {
  variante_id: VARIANTE_CASCADE,
  generateur_id: "_cascade_fixture",
  curriculaire: false,
  codesCompetenceDeclares: [],

  generer(graine: number): ExerciceCascade {
    const prng = creerPrng(graine);
    const a = prng.entierEntre(2, 9);
    const b = prng.entierEntre(2, 9);
    return { a, b, d1: a + b, d2: 2 * (a + b) };
  },

  ecrans(ex: ExerciceCascade): EcranDeclare[] {
    return [
      { type: "champ_expression", champ: CHAMP_ETAPE1, consigne: `Calcule $${ex.a} + ${ex.b}$.`, aide: `Additionne $${ex.a}$ et $${ex.b}$.` },
      { type: "champ_expression", champ: CHAMP_ETAPE2, consigne: `Ton résultat précédent est $${ex.d1}$. Calcule son double.`, aide: `Double de $${ex.d1}$ : $2 \\times ${ex.d1}$.`, dependDe: [CHAMP_ETAPE1] },
      { type: "champ_expression", champ: CHAMP_ETAPE3, consigne: `Ton résultat précédent est $${ex.d2}$. Ajoute-lui 1.`, aide: `$${ex.d2} + 1$.`, dependDe: [CHAMP_ETAPE2] },
      { type: "champ_expression", champ: CHAMP_LIBRE, consigne: "Combien font $2 + 2$ ?" },
    ];
  },

  etatActuel(_ex, reponsesConfirmees) {
    return etatActuelSequentiel(CHAMPS_CASCADE, reponsesConfirmees);
  },

  projeter(ex, reponsesConfirmees, contexte): ExerciceCascade {
    const d1 = donneeEffective(reponsesConfirmees, CHAMP_ETAPE1, ex.a + ex.b, contexte.solutionMontree);
    // Pour l'écran 3, la « vraie valeur » de l'écran 2 est celle que la solution projetée lui donne : 2·d1.
    const d2 = donneeEffective(reponsesConfirmees, CHAMP_ETAPE2, 2 * d1, contexte.solutionMontree);
    return { a: ex.a, b: ex.b, d1, d2 };
  },

  verifier(ex: ExerciceCascade, champ: string, reponseBrute: string): ResultatVerification {
    if (!ENTIER.test(reponseBrute)) return { statut: "parse_error", codesCompetence: [], messageErreur: "Écris un nombre entier." };
    const attendu = attendus(ex)[champ];
    if (attendu === undefined) throw new Error(`Champ inconnu : ${champ}`);
    return { statut: Number(reponseBrute) === attendu ? "correct" : "not_equivalent", codesCompetence: [] };
  },

  solutionAttendue(ex: ExerciceCascade, champ: string): string {
    const attendu = attendus(ex)[champ];
    if (attendu === undefined) throw new Error(`Champ inconnu : ${champ}`);
    return String(attendu);
  },
};

/** Enregistre le générateur de test au registre COURANT (à appeler APRÈS `installerBase`, qui purge le cache de lib/). */
export function installerGenerateurCascade(): () => void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { REGISTRE_GENERATEURS } = require("../../lib/registreGenerateurs") as { REGISTRE_GENERATEURS: Generateur<any>[] };
  REGISTRE_GENERATEURS.push(generateurCascade);
  return () => {
    const i = REGISTRE_GENERATEURS.indexOf(generateurCascade);
    if (i >= 0) REGISTRE_GENERATEURS.splice(i, 1);
  };
}
