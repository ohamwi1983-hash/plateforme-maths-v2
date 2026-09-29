// Test permanent — score partiel `fractionCorrecte` du moteur de tentatives (RAPPORT §16).
// Lancer : `npm run test-score-partiel` (= `npx tsx scripts/test-score-partiel.ts`). Sans réseau : le VRAI
// `api/router.ts` contre une base en mémoire (scripts/support/), comme les autres tests de phase 2/3.
//
// Cinq blocs :
//  1. NON-RÉGRESSION EXHAUSTIVE — une copie GELÉE, mot pour mot, de `calculerEtatChampTentatives` d'avant la
//     fonctionnalité (`ancienneFonction`) est comparée à la fonction réelle sur TOUTES les séquences de
//     statuts (longueur 0 à 8) × tentativesMax 1..6 × aide × pourcentages × chrono, sans fraction : zéro
//     divergence exigée, score comparé par `Object.is` (bit à bit, `-0` inclus). Jamais un échantillon.
//  2. PROPRIÉTÉS avec fractions (tirages pseudo-aléatoires déterministes) : le verdict et la progression ne
//     bougent jamais ; le score reste dans [0, 100], ne descend jamais sous l'ancienne formule, croît avec φ.
//  3. SCÉNARIOS synthétiques, valeurs attendues calculées à la main (voir chaque libellé).
//  4. `verifierAvecControle` : rejets des fractions invalides.
//  5. ROUTE : la fraction est stockée, relue par la dérivation d'état, et n'apparaît dans AUCUNE réponse HTTP.

export {}; // module (évite les collisions de noms globaux entre scripts/*.ts)

import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { calculerEtatChampTentatives, type EtatChampTentatives } from "../lib/moteurTentatives";
import type { StatutVerification } from "../src/moteur/statutVerification";
import type { Generateur, ResultatVerification } from "../lib/contratGenerateur";
import { CHAMP_SOMME, generateurTemoinTechnique as temoin, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}
const proche = (a: number | null, b: number): boolean => a !== null && Math.abs(a - b) < 1e-9;

// ════ Copie GELÉE de l'implémentation d'origine (avant la phase « score partiel ») — NE JAMAIS MODIFIER ════
// Reproduite mot pour mot depuis `lib/moteurTentatives.ts` @ dc64fb3 (fusion de la PR #3), corps de la
// fonction compris. C'est la référence de la comparaison exhaustive : la retoucher la viderait de son sens.
function ancienneFonction(
  statutsChronologiques: readonly StatutVerification[],
  tentativesMax: number,
  aideUtilisee: boolean,
  aidePenalitePourcent: number,
  chronoExpire: boolean = false,
): EtatChampTentatives {
  if (chronoExpire) {
    return { tentativesUtilisees: statutsChronologiques.length, terminee: true, reussie: false, revelee: true, score: 0 };
  }
  let tentativesRatees = 0;
  for (const statut of statutsChronologiques) {
    if (statut === "correct") {
      const penalitePourTentative = 100 / tentativesMax;
      const scoreSiCorrect = Math.max(0, 100 - tentativesRatees * penalitePourTentative);
      const score = aideUtilisee ? scoreSiCorrect * (1 - aidePenalitePourcent / 100) : scoreSiCorrect;
      return { tentativesUtilisees: tentativesRatees, terminee: true, reussie: true, revelee: false, score };
    }
    tentativesRatees++;
    if (tentativesRatees >= tentativesMax) {
      return { tentativesUtilisees: tentativesRatees, terminee: true, reussie: false, revelee: true, score: 0 };
    }
  }
  return { tentativesUtilisees: tentativesRatees, terminee: false, reussie: false, revelee: false, score: null };
}

const progressionEgale = (a: EtatChampTentatives, b: EtatChampTentatives): boolean =>
  a.tentativesUtilisees === b.tentativesUtilisees && a.terminee === b.terminee && a.reussie === b.reussie && a.revelee === b.revelee;
const identiques = (a: EtatChampTentatives, b: EtatChampTentatives): boolean => progressionEgale(a, b) && Object.is(a.score, b.score);

const ALPHABET: StatutVerification[] = ["correct", "not_equivalent", "parse_error"];
function* sequences(longueurMax: number): Generator<StatutVerification[]> {
  const courante: StatutVerification[] = [];
  function* rec(): Generator<StatutVerification[]> {
    yield courante.slice();
    if (courante.length === longueurMax) return;
    for (const s of ALPHABET) {
      courante.push(s);
      yield* rec();
      courante.pop();
    }
  }
  yield* rec();
}

function blocNonRegression(): void {
  const POURCENTAGES = [0, 10, 20, 33.3, 50, 100];
  let configurations = 0;
  const divergences = { sansFraction: 0, fractionsNulles: 0, fractionsZero: 0, fractionsIgnorees: 0 };
  for (const seq of sequences(8)) {
    const nulles = seq.map(() => null);
    const zeros = seq.map((s) => (s === "not_equivalent" ? 0 : null));
    // fractions positives mais sur des lignes où elles ne sont JAMAIS lues (correct / parse_error)
    const ignorees = seq.map((s) => (s === "not_equivalent" ? null : 0.5));
    for (let tm = 1; tm <= 6; tm++) {
      for (const aide of [false, true]) {
        for (const pct of POURCENTAGES) {
          for (const chrono of [false, true]) {
            configurations++;
            const ref = ancienneFonction(seq, tm, aide, pct, chrono);
            if (!identiques(ref, calculerEtatChampTentatives(seq, tm, aide, pct, chrono))) divergences.sansFraction++;
            if (!identiques(ref, calculerEtatChampTentatives(seq, tm, aide, pct, chrono, undefined))) divergences.sansFraction++;
            if (!identiques(ref, calculerEtatChampTentatives(seq, tm, aide, pct, chrono, nulles))) divergences.fractionsNulles++;
            if (!identiques(ref, calculerEtatChampTentatives(seq, tm, aide, pct, chrono, zeros))) divergences.fractionsZero++;
            if (!identiques(ref, calculerEtatChampTentatives(seq, tm, aide, pct, chrono, ignorees))) divergences.fractionsIgnorees++;
          }
        }
      }
    }
  }
  console.log(`  1) non-régression : ${configurations} configurations × 5 formes d'appel comparées à la copie gelée`);
  verifier(configurations === 1_417_104, `nombre de configurations inattendu : ${configurations} (attendu 1 417 104 : 9841 séquences × 6 × 2 × 6 × 2)`);
  verifier(divergences.sansFraction === 0, `divergences sans fraction : ${divergences.sansFraction}`);
  verifier(divergences.fractionsNulles === 0, `divergences avec fractions toutes nulles : ${divergences.fractionsNulles}`);
  verifier(divergences.fractionsZero === 0, `divergences avec fractions égales à 0 : ${divergences.fractionsZero}`);
  verifier(divergences.fractionsIgnorees === 0, `divergences avec fractions sur correct/parse_error (jamais lues) : ${divergences.fractionsIgnorees}`);
}

function blocProprietes(): void {
  let graine = 12345;
  const alea = () => (graine = (graine * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const violations = { progression: 0, bornes: 0, sousAncienne: 0, nullite: 0, monotonie: 0, plafondAide: 0 };
  const TIRAGES = 200_000;
  let avecFractionPositive = 0;
  for (let i = 0; i < TIRAGES; i++) {
    const tm = 1 + Math.floor(alea() * 6);
    const longueur = Math.floor(alea() * (tm + 2));
    const seq: StatutVerification[] = [];
    const fr: (number | null)[] = [];
    for (let k = 0; k < longueur; k++) {
      const s = ALPHABET[Math.floor(alea() * 3)];
      seq.push(s);
      fr.push(s === "not_equivalent" && alea() < 0.7 ? Math.floor(alea() * 100) / 100 : null);
    }
    if (fr.some((f) => f !== null && f > 0)) avecFractionPositive++;
    const aide = alea() < 0.4;
    const pct = [0, 20, 50][Math.floor(alea() * 3)];
    const chrono = alea() < 0.2;
    const a = ancienneFonction(seq, tm, aide, pct, chrono);
    const b = calculerEtatChampTentatives(seq, tm, aide, pct, chrono, fr);
    if (!progressionEgale(a, b)) violations.progression++; // le verdict reste binaire : rien d'autre que `score` ne bouge
    if ((a.score === null) !== (b.score === null)) violations.nullite++;
    if (b.score !== null && a.score !== null) {
      if (!(b.score >= 0 && b.score <= 100)) violations.bornes++;
      if (b.score < a.score) violations.sousAncienne++; // jamais MOINS que l'ancienne formule
      if (aide && b.score > 100 * (1 - pct / 100) + 1e-9) violations.plafondAide++; // l'aide plafonne aussi un score partiel
    }
    const k = Math.floor(alea() * Math.max(1, seq.length));
    if (seq[k] === "not_equivalent" && b.score !== null) {
      const fr2 = fr.slice();
      fr2[k] = Math.min(0.99, (fr[k] ?? 0) + 0.2);
      const c = calculerEtatChampTentatives(seq, tm, aide, pct, chrono, fr2);
      if (c.score === null || c.score < b.score) violations.monotonie++; // augmenter φ ne peut jamais baisser le score
    }
  }
  console.log(`  2) propriétés : ${TIRAGES} tirages (${avecFractionPositive} avec une fraction positive), violations ${JSON.stringify(violations)}`);
  verifier(avecFractionPositive > TIRAGES / 4, "trop peu de tirages avec fraction positive : le test ne prouverait rien");
  for (const [nom, n] of Object.entries(violations)) verifier(n === 0, `propriété « ${nom} » violée ${n} fois`);
}

function blocScenarios(): void {
  const NE: StatutVerification = "not_equivalent";
  const OK: StatutVerification = "correct";
  const PE: StatutVerification = "parse_error";
  const sc = (statuts: StatutVerification[], tm: number, fr: (number | null)[], aide = false, pct = 0, chrono = false) => calculerEtatChampTentatives(statuts, tm, aide, pct, chrono, fr);

  // tentativesMax = 3 → p = 33,33…
  let e = sc([NE, OK], 3, [2 / 3, null]);
  verifier(e.terminee && e.reussie && !e.revelee && proche(e.score, 200 / 3), `2/3 puis correct (tm 3) : attendu 66,67 réussi, reçu ${JSON.stringify(e)}`); // max(100 − 33,33 ; 66,67)
  e = sc([NE, NE, OK], 3, [1 / 3, 2 / 3, null]);
  verifier(e.reussie && proche(e.score, (2 / 3) * (100 - 100 / 3)), `1/3, 2/3 puis correct : attendu 44,44 (le 2e échec vaut 2/3 × 66,67 > 33,33 du rang 3), reçu ${JSON.stringify(e)}`);
  e = sc([NE, NE, NE], 3, [2 / 3, 2 / 3, 2 / 3]);
  verifier(e.terminee && !e.reussie && e.revelee && proche(e.score, 200 / 3), `épuisement 2/3 ×3 : attendu révélé avec 66,67 (meilleure tentative), reçu ${JSON.stringify(e)}`);
  e = sc([NE, NE, NE], 3, [0, 0, 0]);
  verifier(e.revelee && e.score === 0, `épuisement fractions nulles : attendu révélé à 0, reçu ${JSON.stringify(e)}`);
  e = sc([NE, NE, NE], 3, [2 / 3, 2 / 3, 2 / 3], true, 50);
  verifier(e.revelee && proche(e.score, 100 / 3), `épuisement 2/3 ×3 avec aide 50 % : attendu 33,33, reçu ${JSON.stringify(e)}`);
  e = sc([NE], 1, [2 / 3]);
  verifier(e.terminee && !e.reussie && e.revelee && proche(e.score, 200 / 3), `tentativesMax 1 (correction coupée) : 2/3 → révélé avec 66,67, reçu ${JSON.stringify(e)}`);
  e = sc([NE], 1, [2 / 3], true, 20);
  verifier(proche(e.score, (200 / 3) * 0.8), `tentativesMax 1, aide 20 % : attendu 53,33, reçu ${JSON.stringify(e)}`);
  e = sc([NE], 3, [2 / 3], false, 0, true);
  verifier(e.terminee && !e.reussie && e.revelee && e.tentativesUtilisees === 1 && proche(e.score, 200 / 3), `chrono expiré après un essai à 2/3 : attendu révélé avec 66,67, reçu ${JSON.stringify(e)}`);
  e = sc([], 3, [], false, 0, true);
  verifier(e.revelee && e.tentativesUtilisees === 0 && e.score === 0 && Object.is(e.score, 0), `chrono expiré sans essai : attendu 0, reçu ${JSON.stringify(e)}`);
  e = sc([PE, NE], 3, [null, 2 / 3], false, 0, true);
  verifier(proche(e.score, (2 / 3) * (100 - 100 / 3)), `parse_error puis 2/3 puis chrono : le parse_error compte comme échec de rang 1 → 44,44, reçu ${JSON.stringify(e)}`);
  // L'exemple limite validé : 0,9 puis réussite avec tentativesMax = 2 (p = 50) → la réussite vaut 90, pas 50.
  e = sc([NE, OK], 2, [0.9, null]);
  verifier(e.reussie && proche(e.score, 90), `0,9 puis correct (tm 2) : attendu 90 (meilleure tentative), reçu ${JSON.stringify(e)}`);
  e = sc([NE, OK], 2, [0, null]);
  verifier(e.reussie && e.score === 50, `0 puis correct (tm 2) : attendu 50 (formule d'origine), reçu ${JSON.stringify(e)}`);
  e = sc([NE, OK], 2, [null, null]);
  verifier(e.reussie && e.score === 50, `sans fraction puis correct (tm 2) : attendu 50, reçu ${JSON.stringify(e)}`);
  // Le verdict reste binaire : un échec partiel ne termine rien et ne réussit rien.
  e = sc([NE], 3, [0.99]);
  verifier(!e.terminee && !e.reussie && !e.revelee && e.score === null && e.tentativesUtilisees === 1, `un échec à 0,99 ne termine pas le champ, reçu ${JSON.stringify(e)}`);
  e = sc([NE, NE, NE], 3, [0.99, 0.99, 0.99]);
  verifier(!e.reussie && e.revelee, `trois échecs à 0,99 restent un épuisement (révélé, non réussi), reçu ${JSON.stringify(e)}`);
  // Une fraction n'est lue que sur not_equivalent.
  e = sc([PE, PE], 2, [0.9, 0.9]);
  verifier(e.revelee && e.score === 0, `parse_error : la fraction est ignorée, reçu ${JSON.stringify(e)}`);
  e = sc([NE, OK], 2, [null, 0.9]);
  verifier(e.reussie && e.score === 50, `fraction posée sur un correct : ignorée, reçu ${JSON.stringify(e)}`);
  console.log("  3) scénarios synthétiques : voir les assertions (valeurs calculées à la main)");
}

function generateurFactice(resultat: ResultatVerification): Generateur<any> {
  return { ...temoin, variante_id: "_factice", codesCompetenceDeclares: [], verifier: () => resultat } as Generateur<any>;
}

function blocVerifierAvecControle(): void {
  const { verifierAvecControle } = require("../lib/registreGenerateurs") as typeof import("../lib/registreGenerateurs");
  const passe = (r: unknown): boolean => {
    try {
      verifierAvecControle(generateurFactice(r as ResultatVerification), {}, "c", "x");
      return true;
    } catch {
      return false;
    }
  };
  const ne = (f: unknown) => ({ statut: "not_equivalent", codesCompetence: [], fractionCorrecte: f });
  for (const f of [0, 0.5, 0.999]) verifier(passe(ne(f)), `fractionCorrecte ${f} sur not_equivalent : doit passer`);
  verifier(passe({ statut: "not_equivalent", codesCompetence: [] }), "not_equivalent sans fraction : doit passer");
  verifier(passe({ statut: "correct", codesCompetence: [] }), "correct sans fraction : doit passer");
  for (const f of [1, 1.5, -0.1, NaN, Infinity, -Infinity, "0.5", null, true]) verifier(!passe(ne(f)), `fractionCorrecte ${String(f)} : doit être rejetée`);
  verifier(!passe({ statut: "correct", codesCompetence: [], fractionCorrecte: 0.5 }), "fractionCorrecte sur correct : doit être rejetée");
  verifier(!passe({ statut: "parse_error", codesCompetence: [], messageErreur: "m", fractionCorrecte: 0.5 }), "fractionCorrecte sur parse_error : doit être rejetée");
  console.log("  4) verifierAvecControle : rejets vérifiés");
}

const contientFraction = (objet: unknown): boolean => /fraction_?correcte/i.test(JSON.stringify(objet));

async function blocRoute(): Promise<void> {
  imposerProfilAssignation("base");
  const s = creerScenario();
  installerBase(s.base);
  // `installerBase` purge le cache de lib/ : les modules de lib/ doivent être (re)chargés APRÈS.
  const { chargerContexteTache, chargerDonneesExercice, calculerEtatChamp } = require("../lib/etatExercice") as typeof import("../lib/etatExercice");
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";

  // Injection de test UNIQUEMENT (le vrai `verifier` du témoin n'est jamais modifié : restauré dans `finally`).
  const verifierOrigine = temoin.verifier;
  let fractionInjectee: number | undefined;
  temoin.verifier = (ex, champ, brute) => {
    const r = verifierOrigine.call(temoin, ex, champ, brute);
    return champ === CHAMP_SOMME && r.statut === "not_equivalent" && fractionInjectee !== undefined ? { ...r, fractionCorrecte: fractionInjectee } : r;
  };
  try {
    // ── A. correction immédiate active, tentativesMax = 3, aide 50 % ──
    const tache = creerTache(s, { nom: "partiel", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }], tentatives_supplementaires: 2, aide_activee: true, aide_penalite_pourcent: 50 });
    const assign = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    verifier(assign.statut === 201, `assignation : ${assign.statut}`);
    const ex = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const exercice = temoin.generer(Number(ex.graine));
    const fausse = String(exercice.a + exercice.b + 1);
    const poster = (brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: ex.id, champ: CHAMP_SOMME, reponse_brute: brute } });
    const reponsesHttp: unknown[] = [];

    fractionInjectee = 0.6;
    const r1 = await poster(fausse);
    reponsesHttp.push(r1.corps);
    verifier(r1.statut === 200 && r1.corps.statut === "not_equivalent" && r1.corps.verrouille === false && r1.corps.tentatives_restantes === 2, `échec partiel : réponse inattendue ${JSON.stringify(r1.corps)}`);
    const lignes = () => s.base.table("reponses").filter((l) => l.exercice_assigne_id === ex.id && l.champ === CHAMP_SOMME);
    verifier(lignes().length === 1 && lignes()[0].fraction_correcte === 0.6, `fraction_correcte stockée : ${JSON.stringify(lignes()[0])}`);

    fractionInjectee = undefined;
    const r2 = await poster(fausse);
    reponsesHttp.push(r2.corps);
    verifier(lignes().length === 2 && (lignes()[1].fraction_correcte ?? null) === null, `un not_equivalent sans fraction stocke NULL : ${JSON.stringify(lignes()[1])}`);
    const r3 = await poster("1+");
    reponsesHttp.push(r3.corps);
    verifier(r3.corps.statut === "parse_error" && (lignes()[2].fraction_correcte ?? null) === null, `parse_error : NULL attendu : ${JSON.stringify(lignes()[2])}`);

    // L'état est relu depuis la base par la dérivation réelle : 3 échecs (0,6 puis rien) = épuisement, score = meilleure tentative.
    const maintenant = new Date();
    const contexte = (await chargerContexteTache(s.base as any, tache, VARIANTE_TEMOIN))!;
    const donnees = await chargerDonneesExercice(s.base as any, ex.id as string);
    const etat = calculerEtatChamp(CHAMP_SOMME, donnees, contexte, maintenant).etat;
    verifier(contexte.tentativesMax === 3 && etat.terminee && !etat.reussie && etat.revelee && proche(etat.score, 60), `état relu après 0,6 / NULL / parse_error (tm 3) : attendu révélé, score 60, reçu ${JSON.stringify(etat)}`);
    verifier(lignes()[2].fraction_correcte === undefined || lignes()[2].fraction_correcte === null, "ligne parse_error : fraction NULL");

    // ── B. scénario « partiel puis réussite » sur un autre exercice/élève, aide utilisée ──
    const tacheB = creerTache(s, { nom: "partiel puis réussite", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }], tentatives_supplementaires: 1, aide_activee: true, aide_penalite_pourcent: 50 });
    await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheB, eleve_ids: ["eleve-1"] } });
    const exB = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheB)!;
    const exerciceB = temoin.generer(Number(exB.graine));
    const posterB = (brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exB.id, champ: CHAMP_SOMME, reponse_brute: brute } });
    fractionInjectee = 0.9;
    reponsesHttp.push((await posterB(String(exerciceB.a + exerciceB.b + 1))).corps);
    fractionInjectee = undefined;
    const aide = await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exB.id, champ: CHAMP_SOMME } });
    reponsesHttp.push(aide.corps);
    const rB = await posterB(String(exerciceB.a + exerciceB.b));
    reponsesHttp.push(rB.corps);
    const contexteB = (await chargerContexteTache(s.base as any, tacheB, VARIANTE_TEMOIN))!;
    const etatB = calculerEtatChamp(CHAMP_SOMME, await chargerDonneesExercice(s.base as any, exB.id as string), contexteB, new Date()).etat;
    // tentativesMax 2 (p = 50) : réussite au rang 2 = 50 ; meilleure tentative = 0,9 × 100 = 90 ; aide 50 % → 45.
    verifier(contexteB.tentativesMax === 2 && etatB.reussie && proche(etatB.score, 45), `0,9 puis réussite avec aide 50 % : attendu 45, reçu ${JSON.stringify(etatB)}`);

    // ── C. LIGNE HÉRITÉE (colonne absente/NULL) : comportement strictement inchangé ──
    const tacheC = creerTache(s, { nom: "héritée", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }], tentatives_supplementaires: 1 });
    await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheC, eleve_ids: ["eleve-1"] } });
    const exC = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheC)!;
    for (const statut of ["not_equivalent", "correct"]) {
      s.base.inserer("reponses", { exercice_assigne_id: exC.id, champ: CHAMP_SOMME, valeur_saisie: "0", statut, bug_detecte: null, indice_utilise: false, duree_ecoulee_secondes: null });
    }
    const contexteC = (await chargerContexteTache(s.base as any, tacheC, VARIANTE_TEMOIN))!;
    const etatC = calculerEtatChamp(CHAMP_SOMME, await chargerDonneesExercice(s.base as any, exC.id as string), contexteC, new Date()).etat;
    verifier(etatC.reussie && etatC.score === 50, `ligne héritée sans fraction : score d'origine 50 attendu, reçu ${JSON.stringify(etatC)}`);

    // ── D. correction immédiate COUPÉE (tentativesMax effectif 1) : rien de plus révélé ──
    const tacheD = creerTache(s, { nom: "correction coupée", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }], feedback_immediat: false });
    await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheD, eleve_ids: ["eleve-1"] } });
    const exD = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheD)!;
    const exerciceD = temoin.generer(Number(exD.graine));
    fractionInjectee = 0.5;
    const rD = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exD.id, champ: CHAMP_SOMME, reponse_brute: String(exerciceD.a + exerciceD.b + 1) } });
    reponsesHttp.push(rD.corps);
    fractionInjectee = undefined;
    verifier(rD.statut === 200 && rD.corps.statut === undefined && rD.corps.solution_attendue === undefined && rD.corps.revele === false && rD.corps.tache_terminee === false, `correction coupée : rien ne doit être révélé, reçu ${JSON.stringify(rD.corps)}`);

    // ── E. AUCUNE réponse HTTP n'expose la fraction (ni POST, ni GET exercice, ni tableau de bord, ni résultats) ──
    const lectures: [string, string, string][] = [
      ...[ex.id, exB.id, exC.id, exD.id].map((id): [string, string, string] => [`exercices/${id}`, jetonEleve, "GET exercice"]),
      ["eleves/tableau-de-bord", jetonEleve, "tableau de bord élève"],
      ["eleves/mes-resultats", jetonEleve, "mes résultats"],
      ["profs/tableau-de-bord", jetonProf, "tableau de bord prof"],
      ["profs/eleves/eleve-1/profil", jetonProf, "profil d'un élève (prof)"],
    ];
    for (const [chemin, jeton, nom] of lectures) {
      const r = await appeler(chemin, "GET", { jeton });
      verifier(r.statut === 200 && r.corps !== null, `${nom} : 200 attendu, reçu ${r.statut}`);
      reponsesHttp.push(r.corps);
    }
    verifier(reponsesHttp.length === 7 + lectures.length && reponsesHttp.every((c) => c !== null && c !== undefined), `réponses HTTP inspectées : ${reponsesHttp.length} (${7 + lectures.length} attendues), certaines vides`);
    verifier(!reponsesHttp.some(contientFraction), "une réponse HTTP contient fraction_correcte / fractionCorrecte");
    console.log(`  5) route : ${reponsesHttp.length} réponses HTTP inspectées, aucune n'expose la fraction`);
  } finally {
    temoin.verifier = verifierOrigine;
  }
}

async function main() {
  console.log("Score partiel — fractionCorrecte");
  blocNonRegression();
  blocProprietes();
  blocScenarios();
  blocVerifierAvecControle();
  await blocRoute();
  console.log(`${nbVerifs} vérifications`);
  if (echecs.length > 0) {
    console.error(`ÉCHEC — ${echecs.length} vérification(s) :\n - ${echecs.join("\n - ")}`);
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
