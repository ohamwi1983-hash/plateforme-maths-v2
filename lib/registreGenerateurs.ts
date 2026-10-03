import type { Generateur, ResultatVerification } from "./contratGenerateur";
import { CATALOGUE_GENERATEURS } from "./catalogueGenerateurs";
import { DICTIONNAIRE_COMPETENCES } from "./dictionnaireCompetences";
import { generateurTemoinTechnique } from "../src/generateurs/_temoinTechnique";
import { GENERATEURS_MOTIF_DELTA } from "../src/generateurs/analyseFonctionMotifDelta/generateurs";
import { generateurCompletionDuCarre } from "../src/generateurs/completionDuCarre/generateur";
import { generateurFxDepuisGraphe } from "../src/generateurs/fxDepuisGraphe/generateur";

/**
 * REGISTRE UNIQUE — seule autorité sur « quel `variante_id` correspond à quel générateur exécutable ».
 * Ne jamais recréer une deuxième liste de variantes à tenir à la main en parallèle (défaut de la
 * phase 1 : `MIROIR_GENERATEURS` non documenté, une entrée jamais copiée dans
 * `catalogue-generateurs-complet.json`). Tout consommateur (assignation, réponses, tableau de bord,
 * GET exercice) passe par `chercherGenerateur`, jamais par une chaîne de tests sur `variante_id`.
 *
 * Distinct de `lib/catalogueGenerateurs.ts`, qui reste la source du catalogue AFFICHÉ au professeur
 * (ce qu'on peut composer) : le registre sait EXÉCUTER. Les deux ne sont pas fusionnés, leur
 * cohérence est contrôlée par `verifierCoherenceRegistre` au chargement de ce module.
 */
export const REGISTRE_GENERATEURS: readonly Generateur<any>[] = [generateurTemoinTechnique, ...GENERATEURS_MOTIF_DELTA, generateurFxDepuisGraphe, generateurCompletionDuCarre];

interface EntreeCatalogue {
  generateur_id: string;
  variante_id: string;
}

/**
 * Renvoie la liste des incohérences (vide = registre sain). Pure, pour être testée avec de mauvais
 * registres. Contrôles :
 *  - `variante_id` uniques ;
 *  - générateur curriculaire : entrée de catalogue obligatoire, avec le MÊME `generateur_id`, et
 *    codes déclarés présents dans le dictionnaire de compétences ;
 *  - générateur non curriculaire (témoin) : ne doit PAS figurer dans le catalogue affiché ;
 *  - codes de compétence déclarés sans doublon.
 * Les entrées de catalogue SANS générateur au registre ne sont pas une erreur (une variante cataloguée avant
 * d'être livrée) : elles sont exposées par `variantesCatalogueSansGenerateur`. Les dix variantes de gen7 (`af_motif_*`, `af_delta_*`)
 * sont au registre : la liste est vide.
 */
export function verifierCoherenceRegistre(
  registre: readonly Generateur<any>[],
  catalogue: readonly EntreeCatalogue[],
  dictionnaire: Record<string, unknown>,
): string[] {
  const erreurs: string[] = [];
  const vus = new Set<string>();
  for (const g of registre) {
    if (vus.has(g.variante_id)) erreurs.push(`variante_id en double dans le registre : ${g.variante_id}`);
    vus.add(g.variante_id);

    const dansCatalogue = catalogue.find((e) => e.variante_id === g.variante_id);
    const codesAbsents = (): string[] =>
      // `Object.hasOwn` : `code in dictionnaire` acceptait « constructor », « toString »… (membres d'Object.prototype), RAPPORT.md §20.
      g.codesCompetenceDeclares.filter((code) => !Object.hasOwn(dictionnaire, code)).map((code) => `${g.variante_id} : code de compétence "${code}" absent de lib/dictionnaireCompetences.ts`);
    if (g.curriculaire) {
      if (!dansCatalogue) erreurs.push(`${g.variante_id} : générateur curriculaire absent de CATALOGUE_GENERATEURS`);
      else if (dansCatalogue.generateur_id !== g.generateur_id) erreurs.push(`${g.variante_id} : generateur_id "${g.generateur_id}" ≠ catalogue "${dansCatalogue.generateur_id}"`);
      erreurs.push(...codesAbsents());
    } else if (dansCatalogue) {
      erreurs.push(`${g.variante_id} : générateur non curriculaire présent dans CATALOGUE_GENERATEURS (jamais exposé au professeur)`);
    }
    if (new Set(g.codesCompetenceDeclares).size !== g.codesCompetenceDeclares.length) erreurs.push(`${g.variante_id} : codesCompetenceDeclares contient des doublons`);
    // Cases obligatoires du descripteur de configuration (RAPPORT §59) : connues, et dans aucun groupe exclusif (sinon une case obligatoire en interdirait une autre à jamais).
    for (const id of g.configuration?.obligatoires ?? []) {
      if (!g.configuration?.cases.some((c) => c.id === id)) erreurs.push(`${g.variante_id} : case obligatoire "${id}" absente de \`cases\``);
      if ((g.configuration?.exclusifs ?? []).some((groupe) => groupe.includes(id))) erreurs.push(`${g.variante_id} : case obligatoire "${id}" membre d'un groupe exclusif`);
    }
  }
  return erreurs;
}

/** Variantes du catalogue affiché qui n'ont pas (encore) de générateur exécutable au registre. */
export function variantesCatalogueSansGenerateur(registre: readonly Generateur<any>[] = REGISTRE_GENERATEURS): string[] {
  return CATALOGUE_GENERATEURS.filter((e) => !registre.some((g) => g.variante_id === e.variante_id)).map((e) => e.variante_id);
}

const erreursAuChargement = verifierCoherenceRegistre(REGISTRE_GENERATEURS, CATALOGUE_GENERATEURS, DICTIONNAIRE_COMPETENCES);
if (erreursAuChargement.length > 0) {
  // Échec bruyant volontaire : un registre incohérent ne doit jamais démarrer à moitié.
  throw new Error(`Registre de générateurs incohérent :\n - ${erreursAuChargement.join("\n - ")}`);
}

export function chercherGenerateur(varianteId: string): Generateur<any> | null {
  return REGISTRE_GENERATEURS.find((g) => g.variante_id === varianteId) ?? null;
}

/**
 * `verifier` + contrôle croisé : tout code renvoyé doit figurer dans `codesCompetenceDeclares`.
 * Lève sinon (-> 500 via `avecGestionErreurs`) : un détecteur qui émet un code non déclaré est un bug
 * de câblage à voir immédiatement, jamais un code silencieusement stocké hors dictionnaire.
 */
export function verifierAvecControle(generateur: Generateur<any>, exercice: unknown, champ: string, reponseBrute: string): ResultatVerification {
  const resultat = generateur.verifier(exercice, champ, reponseBrute);
  for (const code of resultat.codesCompetence) {
    if (!generateur.codesCompetenceDeclares.includes(code)) {
      throw new Error(`${generateur.variante_id} : verifier() a renvoyé le code "${code}" non déclaré dans codesCompetenceDeclares`);
    }
  }
  if (resultat.statut === "parse_error" && !resultat.messageErreur) {
    throw new Error(`${generateur.variante_id} : parse_error sans messageErreur pédagogique`);
  }
  // Lu comme `unknown` : le type n'autorise `fractionCorrecte` que sur `not_equivalent`, ce contrôle
  // attrape aussi un générateur qui contournerait le typage (cast, JS).
  const f: unknown = (resultat as { fractionCorrecte?: unknown }).fractionCorrecte;
  if (f !== undefined) {
    if (resultat.statut !== "not_equivalent") {
      throw new Error(`${generateur.variante_id} : fractionCorrecte n'est admise que sur not_equivalent (reçu sur ${resultat.statut})`);
    }
    if (typeof f !== "number" || !Number.isFinite(f) || f < 0 || f >= 1) {
      throw new Error(`${generateur.variante_id} : fractionCorrecte doit être un nombre fini avec 0 ≤ φ < 1 (reçu ${String(f)})`);
    }
  }
  // `partiesFausses` (RAPPORT §52) : une liste de chaînes courtes, sans doublon, jamais sur un autre verdict que `not_equivalent`.
  const parties: unknown = (resultat as { partiesFausses?: unknown }).partiesFausses;
  if (parties !== undefined) {
    if (resultat.statut !== "not_equivalent") throw new Error(`${generateur.variante_id} : partiesFausses n'est admise que sur not_equivalent (reçu sur ${resultat.statut})`);
    if (!Array.isArray(parties) || parties.length > 200 || parties.some((p) => typeof p !== "string" || p.length === 0 || p.length > 60) || new Set(parties).size !== parties.length) {
      throw new Error(`${generateur.variante_id} : partiesFausses invalide (liste de ≤ 200 chaînes de 1 à 60 caractères, sans doublon)`);
    }
  }
  return resultat;
}
