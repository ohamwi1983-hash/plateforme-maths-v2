import { etatActuelSequentiel, type Generateur, type ReponseConfirmee, type ContexteProjection } from "../../../lib/contratGenerateur";
import { projeterMotifDelta } from "./cascade";
import { CODES_MOTIF_DELTA } from "./codes";
import { champsMotifDelta, ecransMotifDelta } from "./ecrans";
import { genererExerciceMD } from "./exercice";
import { FAMILLES, type Famille } from "./familles";
import { solutionAttendueMotifDelta } from "./solutions";
import type { ExerciceMotifDelta } from "./types";
import { verifierMotifDelta } from "./verification";

/**
 * Les dix `Generateur` de gen7 « motif / delta » (RAPPORT §49), un par sous-variante, qui PARTAGENT les mêmes fonctions : seule la famille (donc `genererExerciceMD` et les poids) change.
 * Aucune branche `if` par variante ailleurs que dans la table `FAMILLES` ; le registre (`lib/registreGenerateurs.ts`) reste l'unique autorité sur variante → générateur. Identifiants =
 * ceux du catalogue AFFICHÉ (`lib/catalogueGenerateurs.ts`), tels quels : première livraison, donc pas de suffixe `_v`. Tout changement ULTÉRIEUR de ce que `generer` produit pour une
 * graine donnée imposera un nouveau `variante_id` (CLAUDE.md).
 *
 * Codes de compétence : ceux que `verifier` peut réellement renvoyer (`CODES_MOTIF_DELTA`) ; `C04`, `C05_SIGNE_REPETE`, `C06_SIGNE_OPPOSE` (factorisation) n'en font plus partie.
 */
export const GENERATEUR_ID_ANALYSE_FONCTION_MD = "gen7";

function creerGenerateur(famille: Famille): Generateur<ExerciceMotifDelta> {
  const champs = champsMotifDelta();
  return {
    variante_id: famille.id,
    generateur_id: GENERATEUR_ID_ANALYSE_FONCTION_MD,
    curriculaire: true,
    codesCompetenceDeclares: [...CODES_MOTIF_DELTA],
    generer: (graine: number) => genererExerciceMD(famille.id, graine),
    ecrans: (exercice: ExerciceMotifDelta) => ecransMotifDelta(exercice),
    etatActuel: (_exercice: ExerciceMotifDelta, reponsesConfirmees: ReponseConfirmee[]) => etatActuelSequentiel(champs, reponsesConfirmees),
    verifier: verifierMotifDelta,
    projeter: (exercice: ExerciceMotifDelta, reponsesConfirmees: ReponseConfirmee[], contexte: ContexteProjection) => projeterMotifDelta(exercice, reponsesConfirmees, contexte),
    solutionAttendue: solutionAttendueMotifDelta,
  };
}

/** Dans l'ordre du catalogue affiché. */
export const GENERATEURS_MOTIF_DELTA: readonly Generateur<ExerciceMotifDelta>[] = FAMILLES.map(creerGenerateur);
