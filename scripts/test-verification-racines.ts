// Test permanent — vérification de la factorisation de gen7 (phase 3b-2) : modules purs
// `src/generateurs/analyseFonction/racines/` (`racinesChamp1`, `racinesChamp2`, génération, exception
// `af_irreductible`). Lancer : `npm run test-verification-racines`. Sans réseau ; le vrai `api/router.ts`
// contre une base en mémoire pour le bloc 6.
//
// Critère d'acceptation : la TABLE DE VÉRITÉ DIFFÉRENTIELLE (`scripts/support/table-verite-racines-pilote.json`) —
// 100 exercices × 75 saisies (champ 1) + 76 (champ 2) = 15 100 cas produits en appelant le VRAI code de l'ancien
// pilote (`6acc102`, `docs/extraction-table-verite-racines.md`) — est reproduite à l'identique (statut, code de
// compétence, message du champ 2), sauf les DIVERGENCES DÉLIBÉRÉES listées et comptées ici.
//
// Blocs : 1. table différentielle ; 2. cas verrouillés par `test-gen7`/`test-taxonomie-gen7` de l'ancien pilote ;
// 3. lecture des saisies et messages pédagogiques (D6) ; 4. `af_irreductible` ; 5. génération seedée ;
// 6. ROUTE (exception `af_irreductible` et `parse_error` avec message, en réel).

export {}; // module (évite les collisions de noms globaux entre scripts/*.ts)

import { readFileSync } from "node:fs";
import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { CATEGORIES_TEST, CHAMP_DEBUT, CHAMP_FIN, installerGenerateurRacinesTest, VARIANTE_RACINES } from "./support/generateurRacinesTest";
import { verifierBalisageMath } from "./support/texteMath";
import { creerPrng } from "../lib/prng";
import { validerDependances } from "../lib/cascadeEcrans";
import type { EcranDeclare, ResultatVerification } from "../lib/contratGenerateur";
import { evaluerReponseNumerique } from "../src/generateurs/analyseFonction/racines/expressionNumerique";
import { messageSyntaxeFactorisation, messageSyntaxeZeros } from "../src/generateurs/analyseFonction/racines/messagesSyntaxe";
import { ErreurSyntaxe } from "../src/generateurs/analyseFonction/racines/erreurSyntaxe";
import {
  CATEGORIES_AVEC_RACINES,
  CHAMP_RACINES_FACTORISATION,
  CHAMP_RACINES_ZEROS,
  CODES_RACINES,
  construireRacines,
  ecransRacines,
  genererRacines,
  reponseBruteZerosCorrecte,
  solutionFactorisation,
  solutionZeros,
  verifierRacinesChamp1,
  verifierRacinesChamp2,
  type CategorieRacines,
  type DonneesRacines,
} from "../src/generateurs/analyseFonction/racines";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

type CasTable = [saisie: string, statut: string, code: string | null, message: string | null];
interface ExerciceTable {
  categorie: CategorieRacines;
  a: number;
  r: number;
  b: number;
  c: number;
  racines: [number, number];
  formeFactorisee: string;
  racinesExactes: boolean;
  champ1: CasTable[];
  champ2: CasTable[];
}
interface Table {
  provenance: { commit: string; cas: { champ1: number; champ2: number; exercices: number } };
  exercices: ExerciceTable[];
}

const codes = (r: ResultatVerification): string[] => r.codesCompetence;
const messageDe = (r: ResultatVerification): string | undefined => (r.statut === "parse_error" ? r.messageErreur : undefined);
const memeVerdict = (r: ResultatVerification, statut: string, code: string | null): boolean => r.statut === statut && codes(r).join() === (code === null ? "" : code);
/** Réponse brute v2 d'une saisie de l'ancien format « v1;v2 » / « aucune ». */
const versWire = (saisie: string): string => (saisie.trim() === "aucune" ? "[]" : JSON.stringify(saisie.trim().split(";")));

function blocTableDifferentielle(): void {
  const table = JSON.parse(readFileSync(`${__dirname}/support/table-verite-racines-pilote.json`, "utf8")) as Table;
  verifier(table.provenance.commit === "6acc102", "provenance de la table : ancien pilote 6acc102");
  const div = { listeVide: 0, valeurNonFinie: 0, constructor: 0 };
  let compares1 = 0;
  let compares2 = 0;
  const divergences1: string[] = [];
  const divergences2: string[] = [];
  const codesVus = new Set<string>();
  let nbParseError1 = 0;
  let nbParseError2 = 0;
  let parametresIdentiques = 0;

  for (const ex of table.exercices) {
    const d = construireRacines(ex.categorie, ex.a, ex.r);
    if (d.b === ex.b && d.c === ex.c && d.racines.join() === ex.racines.join() && d.formeFactorisee === ex.formeFactorisee && ex.racinesExactes) parametresIdentiques++;

    for (const [saisie, statut, code, message] of ex.champ1) {
      compares1++;
      const r = verifierRacinesChamp1(d, saisie);
      if (code) codesVus.add(code);
      if (statut === "parse_error") {
        nbParseError1++;
        if (r.statut !== "parse_error" || !r.messageErreur || verifierBalisageMath(r.messageErreur).length > 0) divergences1.push(`${ex.categorie} a=${ex.a} r=${ex.r} « ${saisie} » : parse_error attendu avec message sain, reçu ${JSON.stringify(r)}`);
        else if (message !== null) divergences1.push(`la table ne doit pas porter de message pour le champ 1 (« ${saisie} »)`);
      } else if (!memeVerdict(r, statut, code)) {
        divergences1.push(`${ex.categorie} a=${ex.a} r=${ex.r} « ${saisie} » : ancien ${statut}/${code}, nouveau ${r.statut}/${codes(r).join()}`);
      }
    }

    for (const [saisie, statut, code, message] of ex.champ2) {
      compares2++;
      const r = verifierRacinesChamp2(d, versWire(saisie));
      if (code) codesVus.add(code);
      if (statut === "parse_error") nbParseError2++;
      const parties = saisie.trim() === "aucune" ? [] : saisie.trim().split(";").map((p) => p.trim()).filter((p) => p !== "");
      // Divergence 3 : le mot « constructor » (clé du prototype d'objet) était lu comme une fonction par l'ancien code.
      if (/constructor/i.test(saisie)) {
        div.constructor++;
        if (r.statut !== "parse_error" || !r.messageErreur) divergences2.push(`« ${saisie} » : identifiant inconnu attendu (parse_error), reçu ${r.statut}`);
        continue;
      }
      // Divergence 2 : liste ENTIÈREMENT vide → parse_error avec message (D6) ; l'ancien : not_equivalent.
      if (saisie.trim() !== "aucune" && parties.length === 0) {
        div.listeVide++;
        if (statut !== "not_equivalent" || r.statut !== "parse_error" || !r.messageErreur) divergences2.push(`« ${saisie} » : liste vide → parse_error attendu (ancien not_equivalent), reçu ${r.statut}`);
        continue;
      }
      // Divergence 1 : valeur NON FINIE → jamais RACINE_PARTIELLE (le statut reste celui de l'ancien code).
      const valeurs = parties.map((p) => {
        try {
          return evaluerReponseNumerique(p);
        } catch {
          return 0;
        }
      });
      if (code === "RACINE_PARTIELLE" && valeurs.some((v) => !Number.isFinite(v))) {
        div.valeurNonFinie++;
        if (!memeVerdict(r, "not_equivalent", null)) divergences2.push(`« ${saisie} » : not_equivalent sans code attendu (valeur non finie), reçu ${r.statut}/${codes(r).join()}`);
        continue;
      }
      if (statut === "parse_error") {
        // message ancien = message nouveau, sauf le caractère recopié (échappé : `$` → `\$`)
        if (r.statut !== "parse_error" || r.messageErreur !== (message ?? "").replace(/\$/g, "\\$")) divergences2.push(`« ${saisie} » : message ancien ${JSON.stringify(message)}, nouveau ${JSON.stringify(messageDe(r))}`);
        else if (verifierBalisageMath(messageDe(r) ?? "").length > 0) divergences2.push(`« ${saisie} » : message hors balisage sain`);
      } else if (!memeVerdict(r, statut, code)) {
        divergences2.push(`${ex.categorie} a=${ex.a} r=${ex.r} « ${saisie} » : ancien ${statut}/${code}, nouveau ${r.statut}/${codes(r).join()}`);
      }
    }
  }
  console.log(`  1) table différentielle : ${compares1} cas champ 1 + ${compares2} cas champ 2 sur ${table.exercices.length} exercices ; divergences délibérées ${JSON.stringify(div)} ; non délibérées ${divergences1.length + divergences2.length}`);
  verifier(table.exercices.length === 100 && compares1 === table.provenance.cas.champ1 && compares2 === table.provenance.cas.champ2, `taille de la table inattendue (${compares1}/${compares2})`);
  verifier(compares1 === 7500 && compares2 === 7600, `nombre de cas : ${compares1} + ${compares2} (attendu 7 500 + 7 600, compté pour qu'une table tronquée ne passe pas)`);
  verifier(parametresIdentiques === 100, `génération : b, c, racines et texte de solution identiques à l'ancien pilote pour ${parametresIdentiques}/100 exercices`);
  for (const code of ["C04", "C05_SIGNE_REPETE", "C06_SIGNE_OPPOSE", "RACINE_PARTIELLE"]) verifier(codesVus.has(code), `la table doit exercer ${code}`);
  verifier(nbParseError1 > 1000 && nbParseError2 > 1000, `la table doit exercer les parse_error (${nbParseError1} / ${nbParseError2})`);
  verifier(div.listeVide > 0 && div.valeurNonFinie > 0 && div.constructor > 0, `chaque divergence délibérée doit être exercée par la table : ${JSON.stringify(div)}`);
  verifier(divergences1.length === 0, `champ 1 : ${divergences1.length} divergence(s) non délibérée(s), ex. ${divergences1.slice(0, 3).join(" | ")}`);
  verifier(divergences2.length === 0, `champ 2 : ${divergences2.length} divergence(s) non délibérée(s), ex. ${divergences2.slice(0, 3).join(" | ")}`);
}

function blocCasVerrouilles(): void {
  // Cas EXPLICITES de `pilote:scripts/test-taxonomie-gen7.ts:129-135, 228-229, 258-269` et de l'E2E de `test-gen7.ts`.
  for (const a of [1, 2, 3, 4]) {
    for (const r of [-5, -3, -1, 2, 4, 5]) {
      const d = construireRacines("mise_en_evidence", a, r);
      const rInverse = -d.b / d.a;
      const saisieMasqueeC04 = `-x(${-d.a}x${d.a * rInverse >= 0 ? "+" : "-"}${Math.abs(d.a * rInverse)})`; // `saisieMasqueeC04` de l'ancien test
      const c04 = verifierRacinesChamp1(d, saisieMasqueeC04);
      verifier(c04.statut === "not_equivalent" && codes(c04).join() === "C04", `C04 (a=${a}, r=${r}) : ${JSON.stringify(c04)}`);
    }
  }
  const binome = construireRacines("binome_conjugue", 2, 3);
  const [r0, r1] = binome.racines;
  const partielle = verifierRacinesChamp2(binome, versWire(`${r0};${r1 + 137}`));
  verifier(partielle.statut === "not_equivalent" && codes(partielle).join() === "RACINE_PARTIELLE", `RACINE_PARTIELLE (${r0};${r1 + 137}) : ${JSON.stringify(partielle)}`);
  const aucune = verifierRacinesChamp2(binome, "[]");
  verifier(aucune.statut === "not_equivalent" && codes(aucune).length === 0, `« aucune » : jamais correct, jamais de code : ${JSON.stringify(aucune)}`);
  // E2E « réponse correcte » (test-gen7) : la solution affichée est acceptée, pour chaque exercice de la table.
  const table = JSON.parse(readFileSync(`${__dirname}/support/table-verite-racines-pilote.json`, "utf8")) as Table;
  let acceptees = 0;
  for (const ex of table.exercices) {
    const d = construireRacines(ex.categorie, ex.a, ex.r);
    const ok1 = verifierRacinesChamp1(d, solutionFactorisation(d)).statut === "correct";
    const ok2 = verifierRacinesChamp2(d, reponseBruteZerosCorrecte(d)).statut === "correct";
    const [x1, x2] = d.racines;
    const ok2bis = verifierRacinesChamp2(d, versWire(`${x2};${x1}`)).statut === "correct" || x1 === x2; // ordre indifférent
    if (ok1 && ok2 && ok2bis) acceptees++;
  }
  verifier(acceptees === 100, `la solution de chaque exercice est acceptée par les deux écrans : ${acceptees}/100`);
  // C07_ou_C08 n'est jamais émis
  verifier(!CODES_RACINES.includes("C07_ou_C08" as never), "C07_ou_C08 ne doit pas être déclaré (inatteignable pour gen7)");
  console.log("  2) cas verrouillés par les tests de l'ancien pilote : C04 (24 exercices), RACINE_PARTIELLE, « aucune », solution acceptée (100/100)");
}

function blocLectureEtMessages(): void {
  const d = construireRacines("mise_en_evidence", 2, 4); // 2x² − 8x
  // imbrication démesurée : jamais une exception (`RangeError`), toujours `parse_error` (comme l'ancien `catch` global)
  const profond = "(".repeat(20000) + "x" + ")".repeat(20000);
  let res: ResultatVerification | null = null;
  let leve = false;
  try {
    res = verifierRacinesChamp1(d, profond);
  } catch {
    leve = true;
  }
  verifier(!leve && res !== null && (res.statut === "parse_error" || res.statut === "not_equivalent"), `imbrication démesurée : aucune exception, obtenu ${JSON.stringify(res)?.slice(0, 80)}`);
  const profond2 = verifierRacinesChamp2(d, JSON.stringify(["(".repeat(20000) + "1" + ")".repeat(20000)]));
  verifier(profond2.statut === "parse_error" || profond2.statut === "not_equivalent", "champ 2 : imbrication démesurée sans exception");

  // Chaque nature d'erreur atteignable a un message sain (balisage), non vide ; les deux champs ont des textes distincts.
  const natures = ["caractere_inattendu", "identifiant_inconnu", "expression_vide", "expression_incomplete", "expression_mal_formee", "parenthese_fermante_manquante", "barre_fermante_manquante", "parenthese_ouvrante_attendue"] as const;
  for (const nature of natures) {
    for (const detail of ["", "x", "$", "é", "\\", "=", "abc"]) {
      const e = new ErreurSyntaxe(nature, detail);
      for (const message of [messageSyntaxeFactorisation(e), messageSyntaxeZeros(e)]) {
        verifier(message.length > 10 && verifierBalisageMath(message).length === 0, `message ${nature}/${JSON.stringify(detail)} : balisage sain attendu, obtenu ${JSON.stringify(message)} ${verifierBalisageMath(message).join(",")}`);
      }
    }
  }
  verifier(messageSyntaxeFactorisation(new Error("autre")).includes("n'a pas pu être lue") && messageSyntaxeZeros(new Error("autre")).includes("n'a pas pu être lue"), "erreur inconnue : message par défaut");
  // Écho d'un texte d'ÉLÈVE : un `$` tapé reste un `$` (échappé), jamais un délimiteur de mathématiques.
  const dollar = messageSyntaxeZeros(new ErreurSyntaxe("caractere_inattendu", "$"));
  verifier(dollar.includes("\\$") && !/(^|[^\\])\$/.test(dollar), `« $ » échappé dans le message du champ 2 : ${dollar}`);
  const dollar1 = messageSyntaxeFactorisation(new ErreurSyntaxe("caractere_inattendu", "$"));
  verifier(dollar1.includes("\\$") && !/(^|[^\\])\$/.test(dollar1), `« $ » échappé dans le message du champ 1 : ${dollar1}`);
  // Champ 1 : messages ADAPTÉS à la grammaire (et non copiés de l'ancien texte sur les fonctions / le copier-coller)
  const lettre = verifierRacinesChamp1(d, "y(x-4)");
  verifier(lettre.statut === "parse_error" && /seule la lettre x/.test(lettre.messageErreur ?? ""), `lettre étrangère : ${JSON.stringify(lettre)}`);
  const egal = verifierRacinesChamp1(d, "2x(x-4)=1");
  verifier(egal.statut === "parse_error" && /« = 0 »/.test(egal.messageErreur ?? ""), `« = » hors « = 0 » final : ${JSON.stringify(egal)}`);
  const ouverte = verifierRacinesChamp1(d, "2x(x-4");
  verifier(ouverte.statut === "parse_error" && /parenthèse fermante/.test(ouverte.messageErreur ?? ""), `parenthèse manquante : ${JSON.stringify(ouverte)}`);
  const vide = verifierRacinesChamp1(d, "");
  verifier(vide.statut === "parse_error" && (vide.messageErreur ?? "").length > 0, `saisie vide : parse_error avec message, obtenu ${JSON.stringify(vide)}`);
  // Champ 2 : illisibles décodés par `liste_valeurs`
  for (const brut of ["pas du json", "{}", "[1, 2]", "[\"\"]", "[\" \"]"]) {
    const r = verifierRacinesChamp2(d, brut);
    verifier(r.statut === "parse_error" && !!r.messageErreur && verifierBalisageMath(r.messageErreur).length === 0, `champ 2 « ${brut} » : parse_error avec message sain, obtenu ${JSON.stringify(r)}`);
  }
  // Non finies : statut inchangé (not_equivalent), aucun code ; l'ancien code émettait RACINE_PARTIELLE sur `sqrt(-1) ; 4`
  const nan = verifierRacinesChamp2(d, JSON.stringify(["sqrt(-1)", "4"]));
  verifier(nan.statut === "not_equivalent" && nan.codesCompetence.length === 0, `sqrt(-1) ; 4 : pas de RACINE_PARTIELLE, obtenu ${JSON.stringify(nan)}`);
  const inf = verifierRacinesChamp2(d, JSON.stringify(["1/0", "4"]));
  verifier(inf.statut === "not_equivalent" && inf.codesCompetence.length === 0, "1/0 ; 4 : not_equivalent sans code");
  // Comptage par POSITION (pas une intersection d'ensembles) : 5 est une racine de [0 ; 5] mais [5 ; 7] n'émet rien
  const d2 = construireRacines("mise_en_evidence", 1, 5); // racines [0, 5]
  verifier(verifierRacinesChamp2(d2, JSON.stringify(["5", "7"])).codesCompetence.length === 0, "[5 ; 7] pour [0 ; 5] : aucun code (comptage par position)");
  verifier(verifierRacinesChamp2(d2, JSON.stringify(["0", "7"])).codesCompetence.join() === "RACINE_PARTIELLE", "[0 ; 7] pour [0 ; 5] : RACINE_PARTIELLE");
  // Trois valeurs ou plus : faux, jamais de code
  const trois = verifierRacinesChamp2(d2, JSON.stringify(["0", "5", "5"]));
  verifier(trois.statut === "not_equivalent" && trois.codesCompetence.length === 0, "3 valeurs : not_equivalent sans code");
  // Une seule valeur n'est correcte que pour une racine double
  const dble = construireRacines("produit_remarquable", 1, 3);
  verifier(verifierRacinesChamp2(dble, JSON.stringify(["3"])).statut === "correct" && verifierRacinesChamp2(d2, JSON.stringify(["5"])).statut === "not_equivalent", "1 valeur : correcte ssi racine double");
  console.log("  3) lecture des saisies : imbrication démesurée, messages sains (balisage), écho de `$` échappé, non finies, comptage par position");
}

function blocIrreductible(): void {
  verifier(ecransRacines("irreductible").length === 0, "af_irreductible : AUCUN écran « racines » (liste vide)");
  for (const categorie of CATEGORIES_AVEC_RACINES) {
    const ecrans = ecransRacines(categorie);
    verifier(ecrans.map((e) => e.champ).join() === `${CHAMP_RACINES_FACTORISATION},${CHAMP_RACINES_ZEROS}` && ecrans.every((e) => e.aide === undefined && e.poids === undefined && e.dependDe === undefined), `${categorie} : les deux écrans, dans l'ordre, sans aide ni poids ni dépendance`);
    verifier(validerDependances(ecrans).length === 0, `${categorie} : dépendances saines`);
    const [f, z] = ecrans as [EcranDeclare, EcranDeclare];
    verifier(f.type === "champ_expression" && z.type === "liste_valeurs" && z.permetAucune === true, `${categorie} : types d'écran (champ_expression, liste_valeurs avec permetAucune)`);
    for (const texte of [f.consigne, z.consigne, z.type === "liste_valeurs" ? z.etiquetteAjout : "", z.type === "liste_valeurs" ? (z.etiquetteAucune ?? "") : "", z.type === "liste_valeurs" ? (z.etiquetteAuMoinsUne ?? "") : ""]) {
      verifier(verifierBalisageMath(texte).length === 0, `${categorie} : texte d'auteur sain « ${texte} »`);
    }
  }
  // Garde d'EXÉCUTION pour un appelant qui contournerait le typage : jamais un « toujours correct » silencieux.
  const forge = { categorie: "irreductible", a: 1, b: 0, c: 1, racines: [0, 0], formeFactorisee: "" } as unknown as DonneesRacines;
  for (const [nom, appel] of [
    ["verifierRacinesChamp1", () => verifierRacinesChamp1(forge, "x")],
    ["verifierRacinesChamp2", () => verifierRacinesChamp2(forge, "[]")],
    ["construireRacines", () => construireRacines("irreductible" as unknown as CategorieRacines, 1, 1)],
    ["genererRacines", () => genererRacines("irreductible" as unknown as CategorieRacines, creerPrng(1))],
  ] as const) {
    let leve = false;
    try {
      appel();
    } catch (e) {
      leve = /irreductible/.test(String(e));
    }
    verifier(leve, `${nom} sur « irreductible » : doit lever (jamais appelée)`);
  }
  // Au niveau du TYPE : ceci ne doit pas compiler (vérifié par `tsc -b`, une erreur ici casserait la compilation)
  // @ts-expect-error — `irreductible` n'est pas une `CategorieRacines`
  const _pasDeCompilation: CategorieRacines = "irreductible";
  void _pasDeCompilation;
  console.log("  4) af_irreductible : aucun écran, garde d'exécution sur les 4 points d'entrée, exclusion au niveau du type");
}

function blocGeneration(): void {
  // Ordre des tirages FIGÉ (`_v1` de gen7) : (graine, a, r) des 10 premières graines ; mise en évidence et produit
  // remarquable partagent leurs tirages (même rejet de r = 0), le binôme tire r dans [1, 5].
  const gele: Record<CategorieRacines, [number, number, number][]> = {
    mise_en_evidence: [[0, 2, -5], [1, 3, -5], [2, 3, -2], [3, 3, -5], [4, 4, -2], [5, 3, 3], [6, 3, -5], [7, 1, -5], [42, 3, -1], [2024, 4, 2]],
    binome_conjugue: [[0, 2, 1], [1, 3, 1], [2, 3, 2], [3, 3, 1], [4, 4, 2], [5, 3, 4], [6, 3, 1], [7, 1, 1], [42, 3, 3], [2024, 4, 4]],
    produit_remarquable: [[0, 2, -5], [1, 3, -5], [2, 3, -2], [3, 3, -5], [4, 4, -2], [5, 3, 3], [6, 3, -5], [7, 1, -5], [42, 3, -1], [2024, 4, 2]],
  };
  const rDe = (d: DonneesRacines): number => (d.categorie === "mise_en_evidence" ? (d.racines[0] === 0 ? d.racines[1] : d.racines[0]) : d.categorie === "binome_conjugue" ? d.racines[1] : d.racines[0]);
  let figes = 0;
  for (const categorie of CATEGORIES_AVEC_RACINES) {
    for (const [graine, a, r] of gele[categorie]) {
      const d = genererRacines(categorie, creerPrng(graine));
      if (d.a === a && rDe(d) === r) figes++;
    }
  }
  verifier(figes === 30, `ordre des tirages figé : ${figes}/30 (toute modification impose un nouveau variante_id)`);

  const vus = { a: new Set<number>(), r: new Set<number>() };
  let invariants = 0;
  let deterministes = 0;
  const TIRAGES = 3000;
  for (const categorie of CATEGORIES_AVEC_RACINES) {
    for (let graine = 0; graine < TIRAGES; graine++) {
      const d = genererRacines(categorie, creerPrng(graine));
      const bis = genererRacines(categorie, creerPrng(graine));
      if (JSON.stringify(d) === JSON.stringify(bis)) deterministes++;
      const r = rDe(d);
      vus.a.add(d.a);
      vus.r.add(r);
      const enonceOk =
        d.a >= 1 && d.a <= 4 && r !== 0 && Math.abs(r) <= 5 &&
        (categorie === "mise_en_evidence" ? d.b === -d.a * r && d.c === 0 && d.racines.join() === (r < 0 ? [r, 0] : [0, r]).join() :
          categorie === "binome_conjugue" ? r >= 1 && d.b === 0 && d.c === -d.a * r * r && d.racines.join() === [-r, r].join() :
          d.b === -2 * d.a * r && d.c === d.a * r * r && d.racines.join() === [r, r].join());
      // les racines annoncées sont bien les zéros du trinôme, et la solution affichée est acceptée
      const zeros = d.racines.every((x) => Math.abs(d.a * x * x + d.b * x + d.c) < 1e-9);
      if (enonceOk && zeros && verifierRacinesChamp1(d, solutionFactorisation(d)).statut === "correct" && verifierRacinesChamp2(d, reponseBruteZerosCorrecte(d)).statut === "correct") invariants++;
    }
  }
  verifier(deterministes === 3 * TIRAGES, `génération déterministe : ${deterministes}/${3 * TIRAGES}`);
  verifier(invariants === 3 * TIRAGES, `invariants (bornes, relations, zéros, solution acceptée) : ${invariants}/${3 * TIRAGES}`);
  verifier([...vus.a].sort().join() === "1,2,3,4" && [...vus.r].sort((x, y) => x - y).join() === "-5,-4,-3,-2,-1,1,2,3,4,5", `couverture des tirages : a ${[...vus.a]}, r ${[...vus.r]}`);
  verifier(solutionZeros(construireRacines("mise_en_evidence", 2, 4)) === "0 ; 4" && solutionZeros(construireRacines("produit_remarquable", 1, 3)) === "3" && solutionFactorisation(construireRacines("binome_conjugue", 1, 3)) === "(x - 3)(x + 3)", "solutions lisibles");
  console.log(`  5) génération : ordre des tirages figé (30), ${3 * TIRAGES} exercices déterministes aux invariants tenus`);
}

async function blocRoute(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const retirer = installerGenerateurRacinesTest();
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let graineCourante = 4; // 4 % 4 = 0 → mise_en_evidence ; on ajoute la catégorie voulue
  try {
    const nouveau = async (categorie: number, options: { feedback?: boolean; tentatives?: number } = {}) => {
      const graine = 400 + categorie; // graine % 4 === categorie
      graineCourante++;
      const tache = creerTache(s, { nom: `racines ${graineCourante}`, variantes: [{ variante_id: VARIANTE_RACINES, nombre_exercices: 1 }], feedback_immediat: options.feedback ?? true, tentatives_supplementaires: options.tentatives ?? 0, reponse_visible: true });
      const origine = Math.random;
      Math.random = () => graine / 2 ** 32;
      try {
        const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
        verifier(a.statut === 201, `assignation : ${a.statut} ${JSON.stringify(a.corps)}`);
      } finally {
        Math.random = origine;
      }
      const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
      const id = ligne.id as string;
      const poster = (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } });
      const lire = () => appeler(`exercices/${id}`, "GET", { jeton: jetonEleve });
      return { ligne, id, poster, lire, categorie: CATEGORIES_TEST[categorie]! };
    };

    // ── A. af_irreductible : les deux écrans n'existent pas — ni assignés, ni servis, ni acceptés ──
    {
      const x = await nouveau(3);
      const attendus = x.ligne.champs_attendus as string[];
      verifier(attendus.join() === `${CHAMP_DEBUT},${CHAMP_FIN}`, `irréductible : champs_attendus sans les écrans racines : ${attendus}`);
      const g = await x.lire();
      verifier(g.statut === 200 && (g.corps.ecrans as EcranDeclare[]).map((e) => e.champ).join() === `${CHAMP_DEBUT},${CHAMP_FIN}`, `irréductible : écrans servis ${JSON.stringify(g.corps.ecrans?.map((e: any) => e.champ))}`);
      for (const champ of [CHAMP_RACINES_FACTORISATION, CHAMP_RACINES_ZEROS]) {
        const forge = await x.poster(champ, champ === CHAMP_RACINES_ZEROS ? "[]" : "x(x-1)");
        verifier(forge.statut === 400 && s.base.table("reponses").filter((l) => l.exercice_assigne_id === x.id && l.champ === champ).length === 0, `irréductible : requête forgée sur ${champ} → 400, rien enregistré (${forge.statut})`);
      }
      verifier((await x.poster(CHAMP_DEBUT, "2")).corps.champ_courant === CHAMP_FIN, "irréductible : l'écran suivant est directement « fin » (saut entier)");
      const fin = await x.poster(CHAMP_FIN, "4");
      verifier(fin.corps.exercice_termine === true, "irréductible : exercice terminé sans jamais passer par les écrans racines");
    }

    // ── B. mise en évidence : parcours réel sur 3 tentatives — parse_error avec message, puis C04 stocké, puis correct ──
    {
      const x = await nouveau(0, { tentatives: 2 });
      const brut = (await x.lire()).corps;
      verifier((brut.ecrans as EcranDeclare[]).length === 4, "mise en évidence : 4 écrans (debut, racinesChamp1, racinesChamp2, fin)");
      await x.poster(CHAMP_DEBUT, "2");
      const d = genererRacines("mise_en_evidence", creerPrng(Number(x.ligne.graine)));
      const illisible = await x.poster(CHAMP_RACINES_FACTORISATION, "2x(x-4");
      verifier(illisible.statut === 200 && illisible.corps.statut === "parse_error" && /parenthèse fermante/.test(illisible.corps.message_erreur ?? ""), `parse_error + message pédagogique en réel : ${JSON.stringify(illisible.corps)}`);
      const c04 = await x.poster(CHAMP_RACINES_FACTORISATION, `-x(${-d.a}x${-d.b >= 0 ? "+" : "-"}${Math.abs(d.b)})`);
      verifier(c04.statut === 200 && c04.corps.statut === "not_equivalent", `C04 : not_equivalent, obtenu ${JSON.stringify(c04.corps)}`);
      const bon = await x.poster(CHAMP_RACINES_FACTORISATION, solutionFactorisation(d));
      verifier(bon.statut === 200 && bon.corps.statut === "correct", `troisième tentative correcte : ${JSON.stringify(bon.corps)}`);
      const lignes = s.base.table("reponses").filter((l) => l.exercice_assigne_id === x.id && l.champ === CHAMP_RACINES_FACTORISATION);
      verifier(lignes.map((l) => `${l.statut}/${l.bug_detecte ?? "-"}`).join() === "parse_error/-,not_equivalent/C04,correct/-", `historique stocké (statut/bug_detecte) : ${JSON.stringify(lignes.map((l) => `${l.statut}/${l.bug_detecte ?? "-"}`))}`);
      const z = await x.poster(CHAMP_RACINES_ZEROS, reponseBruteZerosCorrecte(d));
      verifier(z.corps.statut === "correct", `racinesChamp2 : solution acceptée en réel ${JSON.stringify(z.corps)}`);
    }

    // ── C. binôme : 2 tentatives autorisées → C05 puis correct, RACINE_PARTIELLE, codes stockés dans bug_detecte ──
    {
      const tache = creerTache(s, { nom: "racines binôme", variantes: [{ variante_id: VARIANTE_RACINES, nombre_exercices: 1 }], tentatives_supplementaires: 2, reponse_visible: true });
      const origine = Math.random;
      Math.random = () => 401 / 2 ** 32; // 401 % 4 = 1 → binome_conjugue
      try {
        await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      } finally {
        Math.random = origine;
      }
      const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
      const id = ligne.id as string;
      const poster = (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } });
      const d = genererRacines("binome_conjugue", creerPrng(401));
      const r = d.racines[1];
      await poster(CHAMP_DEBUT, "2");
      const c05 = await poster(CHAMP_RACINES_FACTORISATION, `${d.a === 1 ? "" : d.a}(x-${r})(x-${r})`);
      verifier(c05.corps.statut === "not_equivalent", `C05 : statut ${JSON.stringify(c05.corps)}`);
      const bon = await poster(CHAMP_RACINES_FACTORISATION, solutionFactorisation(d));
      verifier(bon.corps.statut === "correct", `solution acceptée en réel : ${JSON.stringify(bon.corps)}`);
      const lignes1 = s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === CHAMP_RACINES_FACTORISATION);
      verifier(lignes1.map((l) => l.bug_detecte ?? null).join() === "C05_SIGNE_REPETE," && lignes1.length === 2, `bug_detecte stocké : ${JSON.stringify(lignes1.map((l) => l.bug_detecte))}`);
      const partielle = await poster(CHAMP_RACINES_ZEROS, JSON.stringify([String(d.racines[0]), String(d.racines[1] + 137)]));
      verifier(partielle.corps.statut === "not_equivalent", "RACINE_PARTIELLE : statut not_equivalent");
      const lignes2 = s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === CHAMP_RACINES_ZEROS);
      verifier(lignes2[0]?.bug_detecte === "RACINE_PARTIELLE", `RACINE_PARTIELLE stocké : ${JSON.stringify(lignes2.map((l) => l.bug_detecte))}`);
      const aucune = await poster(CHAMP_RACINES_ZEROS, "[]");
      verifier(aucune.corps.statut === "not_equivalent", `« Pas de racine » jamais correct : ${JSON.stringify(aucune.corps)}`);
      const lignes3 = s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === CHAMP_RACINES_ZEROS);
      verifier(lignes3.length === 2 && (lignes3[1]?.bug_detecte ?? null) === null, `« Pas de racine » : aucun code de compétence, obtenu ${JSON.stringify(lignes3.map((l) => l.bug_detecte))}`);
    }

    // ── D. correction COUPÉE : ni verdict ni message d'erreur avant la fin de la tâche (§13) ──
    {
      const x = await nouveau(2, { feedback: false });
      await x.poster(CHAMP_DEBUT, "2");
      const r = await x.poster(CHAMP_RACINES_FACTORISATION, "((x-3)");
      verifier(r.statut === 200 && r.corps.statut === undefined && r.corps.message_erreur === undefined, `correction coupée : le message d'un parse_error n'est pas envoyé : ${JSON.stringify(r.corps)}`);
      verifier(s.base.table("reponses").filter((l) => l.exercice_assigne_id === x.id && l.statut === "parse_error").length === 1, "le parse_error est bien enregistré côté serveur");
    }
    console.log("  6) route : irréductible (aucun écran racines, forgé → 400), parse_error + message, codes stockés, correction coupée sans message");
  } finally {
    retirer();
  }
}

async function main() {
  console.log("Vérification de la factorisation de gen7 (racinesChamp1 / racinesChamp2)");
  blocTableDifferentielle();
  blocCasVerrouilles();
  blocLectureEtMessages();
  blocIrreductible();
  blocGeneration();
  await blocRoute();
  console.log(`${nbVerifs} vérifications`);
  if (echecs.length > 0) {
    console.error(`ÉCHEC — ${echecs.length} vérification(s) :\n - ${echecs.slice(0, 40).join("\n - ")}${echecs.length > 40 ? `\n … (${echecs.length - 40} autres)` : ""}`);
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
