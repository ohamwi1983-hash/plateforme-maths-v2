// Test permanent — durcissement contre la chaîne de PROTOTYPES (RAPPORT.md §20). `table[cle]` et `cle in table`
// lisent aussi les membres d'`Object.prototype` (`constructor`, `toString`, `valueOf`, `hasOwnProperty`,
// `__proto__`) : « présents » dans tout objet littéral, et `table["constructor"]` est une FONCTION. Un test par site
// corrigé, chacun REPRODUIT d'abord l'entrée hostile (vérifié par mutation : retirer le correctif fait échouer le test).
// Lancer : `npm run test-durcissement-prototype`.
//
// Sites : 1. `lib/registreGenerateurs.ts` (`code in dictionnaire`) ; 2. `lib/profilCompetences.ts` (les 3 tables :
// dictionnaire, explications, explications élève) ; 3. `lib/categoriesCompetences.ts` ; 4. `lib/routes/profs/resultats.ts`
// (`resumeBugs`, dictionnaire, explications — vrai `api/router.ts`) ; 5. `lib/reponsesEcran.ts` (`decoderTableauSignes`, clés
// venues de l'ÉLÈVE) ; 6. `public/moteur/ecrans/tableauSignes.js` (`NOMS_SYMBOLES`, valeur d'une réponse stockée) ; 7. `lib/tablePropre.ts`.

export {}; // module (évite les collisions de noms globaux entre scripts/*.ts)

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { lirePropre } from "../lib/tablePropre";
import { verifierCoherenceRegistre } from "../lib/registreGenerateurs";
import { DICTIONNAIRE_COMPETENCES } from "../lib/dictionnaireCompetences";
import { calculerProfilCompetences } from "../lib/profilCompetences";
import { CATEGORIE_PAR_DEFAUT, categoriserCompetence } from "../lib/categoriesCompetences";
import { decoderChampsMultiples, decoderIntervalle, decoderListeValeurs, decoderListeValeursOuAucune, decoderTableauSignes } from "../lib/reponsesEcran";
import { CHAMP_SIGNES, generateurTemoinTechnique as temoin, graineDeProfil, reponseBruteCorrecte, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";
import type { Generateur } from "../lib/contratGenerateur";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

/** Un code réel présent dans les quatre tables (dictionnaire, explications, explications élève, catégories). */
const CODE_REEL = "FC_CE_FANTOME";

/** Les clés qui existent dans TOUT objet littéral (chaîne de prototypes). */
const CLES_HERITEES = ["constructor", "toString", "valueOf", "hasOwnProperty", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString", "__proto__", "__defineGetter__"];

function siteRegistre(): void {
  // Témoin de la faille : l'opérateur `in` voit ces clés dans le dictionnaire réel.
  for (const cle of CLES_HERITEES) verifier(cle in DICTIONNAIRE_COMPETENCES, `témoin : « ${cle} » est « présent » par \`in\` dans le dictionnaire (chaîne de prototypes)`);
  const faux = { ...temoin, variante_id: "_faux_curriculaire", generateur_id: "gen_faux", curriculaire: true, codesCompetenceDeclares: [...CLES_HERITEES, "C04"] } as Generateur<any>;
  const erreurs = verifierCoherenceRegistre([faux], [{ generateur_id: "gen_faux", variante_id: "_faux_curriculaire" }], DICTIONNAIRE_COMPETENCES);
  for (const cle of CLES_HERITEES) verifier(erreurs.some((e) => e.includes(`"${cle}"`)), `registre : le code déclaré « ${cle} » doit être refusé (absent du dictionnaire), erreurs : ${erreurs.length}`);
  verifier(!erreurs.some((e) => e.includes('"C04"')), "registre : un vrai code (C04) reste accepté");
  verifier(erreurs.length === CLES_HERITEES.length, `registre : exactement ${CLES_HERITEES.length} refus attendus, obtenu ${erreurs.length}`);
}

function siteProfil(): void {
  for (const cle of CLES_HERITEES) {
    const [entree] = calculerProfilCompetences([cle]);
    verifier(
      entree !== undefined && entree.code === cle && entree.libelle === cle && entree.description === "" && entree.explication === undefined && entree.exemple === undefined && entree.explicationEleve === undefined,
      `profil « ${cle} » : libellé de repli, aucune explication lue dans le prototype ; obtenu ${JSON.stringify(entree)}`,
    );
    verifier(entree !== undefined && entree.categorie === CATEGORIE_PAR_DEFAUT.categorie && entree.sousCategorie === undefined, `profil « ${cle} » : catégorie « Non classé » (table des catégories), obtenu ${JSON.stringify(entree?.categorie)}`);
  }
  // un code réel n'est pas affecté
  const [reel] = calculerProfilCompetences([CODE_REEL]);
  verifier(reel !== undefined && reel.libelle === DICTIONNAIRE_COMPETENCES[CODE_REEL]!.libelle && reel.explication !== undefined && reel.explicationEleve !== undefined && reel.categorie !== "Non classé", `profil : ${CODE_REEL} reste résolu depuis les quatre tables`);
}

function siteCategories(): void {
  for (const cle of CLES_HERITEES) verifier(categoriserCompetence(cle) === CATEGORIE_PAR_DEFAUT, `categoriserCompetence(« ${cle} ») doit renvoyer la catégorie par défaut (jamais un membre du prototype)`);
  verifier(categoriserCompetence(CODE_REEL) !== CATEGORIE_PAR_DEFAUT, `categoriserCompetence(${CODE_REEL}) reste classé`);
}

async function siteResultats(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const tache = creerTache(s, { nom: "prototype" });
  const ex = s.base.inserer("exercices_assignes", { tache_id: tache, eleve_id: "eleve-1", generateur_id: "_temoin_technique", variante_id: VARIANTE_TEMOIN, graine: 5, champs_attendus: ["somme"] });
  const codes = ["constructor", "constructor", "toString", "__proto__", "valueOf", CODE_REEL];
  for (const bug of codes) s.base.inserer("reponses", { exercice_assigne_id: ex.id, champ: "somme", valeur_saisie: "1", statut: "not_equivalent", bug_detecte: bug, indice_utilise: false, duree_ecoulee_secondes: null });
  const r = await appeler("profs/resultats", "GET", { jeton: `prof:${s.profId}`, query: { tache_id: tache } });
  verifier(r.statut === 200, `profs/resultats : ${r.statut} ${JSON.stringify(r.corps).slice(0, 120)}`);
  const resume = (r.corps.resume_bugs ?? []) as { code: string; libelle: string; occurrences: unknown; explication?: unknown; exemple?: unknown }[];
  const attendu: Record<string, number> = { constructor: 2, toString: 1, __proto__: 1, valueOf: 1, [CODE_REEL]: 1 };
  for (const [code, n] of Object.entries(attendu)) {
    const e = resume.find((x) => x.code === code);
    verifier(e !== undefined && e.occurrences === n, `resume_bugs « ${code} » : ${n} occurrence(s) NUMÉRIQUE(s), obtenu ${JSON.stringify(e)}`);
    if (code !== CODE_REEL) verifier(e !== undefined && e.libelle === code && e.explication === undefined && e.exemple === undefined, `resume_bugs « ${code} » : libellé de repli, aucune explication héritée, obtenu ${JSON.stringify(e)}`);
  }
  verifier(resume.length === 5 && resume.every((x) => typeof x.occurrences === "number" && Number.isInteger(x.occurrences)), `resume_bugs : 5 entrées, compteurs entiers ; obtenu ${JSON.stringify(resume)}`);
  const reel = resume.find((x) => x.code === CODE_REEL);
  verifier(reel !== undefined && reel.libelle === DICTIONNAIRE_COMPETENCES[CODE_REEL]!.libelle && reel.explication !== undefined, `resume_bugs : ${CODE_REEL} reste résolu (libellé, explication)`);
  const competences = (r.corps.eleves?.find((e: any) => e.id === "eleve-1")?.competences ?? []) as { code: string; occurrences: number; libelle: string }[];
  verifier(competences.some((c) => c.code === "constructor" && c.occurrences === 2 && c.libelle === "constructor"), `competences de l'élève : « constructor » compté 2 fois, libellé de repli : ${JSON.stringify(competences.map((c) => [c.code, c.occurrences]))}`);
}

function siteDecodeurTableau(): void {
  const illisible = (brut: string) => !decoderTableauSignes(brut).ok;
  // L'entrée EXACTE du constat : une clé « __proto__ » venue de JSON.parse.
  verifier(illisible('{"__proto__":{"signe":"+"}}'), 'decoderTableauSignes({"__proto__":{"signe":"+"}}) doit être REJETÉ (avant : prototype de l\'objet décodé remplacé, `signe` hérité)');
  verifier(illisible('{"signe":{"c0":"+"},"__proto__":{"c1":"-"}}'), "« __proto__ » à côté d'une ligne valide : rejeté");
  verifier(illisible('{"signe":{"__proto__":"+"}}'), "« __proto__ » comme id de colonne : rejeté");
  verifier(illisible('{"signe":{"c0":"+","__proto__":"-"}}'), "« __proto__ » parmi des colonnes valides : rejeté");
  // Les autres clés héritées sont des clés ordinaires, JAMAIS héritées : objets sans prototype.
  const r = decoderTableauSignes('{"signe":{"c0":"+"},"constructor":{"c1":"-"},"toString":{"c2":"0"}}');
  verifier(r.ok, "« constructor » / « toString » comme ids de ligne : lus comme des clés ordinaires");
  if (r.ok) {
    const v = r.valeur as Record<string, Record<string, string> | undefined>;
    verifier(Object.getPrototypeOf(v) === null && Object.getPrototypeOf(v.signe as object) === null, "lignes et colonnes décodées sans prototype");
    verifier(Object.keys(v).join() === "signe,constructor,toString" && typeof v.constructor === "object" && (v as any).constructor.c1 === "-", "« constructor » est une clé PROPRE (objet), jamais la fonction héritée");
    verifier(v.valueOf === undefined && v.hasOwnProperty === undefined && v.absente === undefined, "aucune clé héritée lisible sur l'objet décodé (valueOf, hasOwnProperty…)");
  }
  verifier(({} as Record<string, unknown>).signe === undefined && (Object.prototype as Record<string, unknown>).signe === undefined, "Object.prototype n'est pas pollué");
  // Un tableau correct est décodé comme avant.
  const ok = decoderTableauSignes('{"signe":{"c0":"+","c1":"-"},"variation":{"c0":"⌣","c1":"↗"}}');
  verifier(ok.ok && (ok.valeur.signe?.c1 === "-") && Object.keys(ok.valeur).join() === "signe,variation", "un tableau ordinaire reste décodé");
  // Le vérificateur du témoin (profil « base ») : la même entrée est un parse_error, jamais une réussite.
  const ex = temoin.generer(graineDeProfil("base", 0));
  const attendu = JSON.parse(reponseBruteCorrecte(ex, CHAMP_SIGNES)) as Record<string, Record<string, string>>;
  verifier(temoin.verifier(ex, CHAMP_SIGNES, JSON.stringify(attendu)).statut === "correct", "témoin : la bonne réponse reste acceptée");
  const forgee = temoin.verifier(ex, CHAMP_SIGNES, '{"__proto__":' + JSON.stringify(attendu.signe) + "}");
  verifier(forgee.statut === "parse_error", `témoin : une réponse portée par « __proto__ » est un parse_error, obtenu ${forgee.statut}`);
  // Les autres décodeurs de clés venues de l'élève refusaient déjà « __proto__ » : verrouillé.
  const ecranChamps = { champs: [{ id: "a", libelle: "a", genre: "texte" as const }, { id: "b", libelle: "b", genre: "texte" as const }] };
  verifier(!decoderChampsMultiples('{"a":"1","__proto__":"2"}', ecranChamps).ok && !decoderChampsMultiples('{"a":"1","b":"2","__proto__":{"x":1}}', ecranChamps).ok, "champs_multiples : « __proto__ » refusé");
  verifier(!decoderIntervalle('{"crochetGauche":"[","borneGauche":"1","crochetDroit":"]","__proto__":"2"}').ok, "intervalle : « __proto__ » refusé");
  verifier(!decoderListeValeurs('{"__proto__":["1"]}').ok && !decoderListeValeursOuAucune('{"__proto__":["1"]}').ok, "liste_valeurs : un objet (donc « __proto__ ») est refusé");
}

function siteClient(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tableau = require("../public/moteur/ecrans/tableauSignes.js").default as { resumer(ecran: unknown, valeurSaisie: string): string };
  const ecran = { lignes: [{ id: "variation", libelle: "Variation", rendu: "symboles_variation" }], colonnes: [{ id: "c0", libelle: "a" }, { id: "c1", libelle: "b" }] };
  const resume = (v: unknown) => tableau.resumer(ecran, JSON.stringify({ variation: { c0: v, c1: "↗" } }));
  for (const cle of CLES_HERITEES) {
    const texte = resume(cle);
    verifier(texte.includes(`${cle} croissante`) && !/function|\[object|native code/.test(texte), `résumé d'une réponse stockée contenant « ${cle} » : la valeur brute, jamais un membre du prototype ; obtenu « ${texte} »`);
  }
  verifier(resume("⌢").includes("maximum (en bosse) croissante") && resume("↘").includes("décroissante"), "résumé : les vrais symboles gardent leur nom accessible");
  verifier(!/function|native code/.test(resume({ a: 1 })) && !/function|native code/.test(resume(null)), "résumé : valeur non textuelle sans membre de prototype");
}

function siteTablePropre(): void {
  const table = { a: 1, b: 2 } as Record<string, number>;
  verifier(lirePropre(table, "a") === 1 && lirePropre(table, "z") === undefined, "lirePropre : clé propre / absente");
  for (const cle of CLES_HERITEES) verifier(lirePropre(table, cle) === undefined, `lirePropre(« ${cle} ») : undefined (jamais la chaîne de prototypes)`);
  verifier(typeof (table as any).constructor === "function", "témoin : `table.constructor` est bien une fonction");
}

async function main() {
  console.log("Durcissement contre la chaîne de prototypes");
  siteRegistre();
  siteProfil();
  siteCategories();
  await siteResultats();
  siteDecodeurTableau();
  siteClient();
  siteTablePropre();
  console.log(`${nbVerifs} vérifications`);
  if (echecs.length > 0) {
    console.error(`ÉCHEC — ${echecs.length} vérification(s) :\n - ${echecs.slice(0, 40).join("\n - ")}`);
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
