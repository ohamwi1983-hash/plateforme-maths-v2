// Test permanent — contrat de générateur, registre unique, dispatcher serveur, avec le générateur témoin
// technique UNIQUE (`_temoin_technique_v1`). Exécute le VRAI `api/router.ts` contre une base en mémoire
// (scripts/support/), sans réseau. Lancer : `npx tsx scripts/test-temoin-technique.ts`.
//
// Deux sections, un seul témoin (deux PROFILS d'exercice, tirés de la graine — voir src/generateurs/_temoinTechnique) :
//  - SECTION A — assertions d'ORIGINE (phase 2), profil « base » (4 écrans), INCHANGÉES : leur nombre est
//    compté et vérifié (`NB_SECTION_A`) pour qu'aucune ne soit retirée ni affaiblie en silence ;
//  - SECTION B — extension de la phase 3b-1, profil « étendu » (7 écrans) : champs_multiples, intervalle,
//    liste_valeurs.permetAucune, tableau_signes étendu (3 ou 7 colonnes), aides typées, balisage mathématique.
// Le profil des exercices assignés par la route est déclaré explicitement (`imposerProfilAssignation`).

export {}; // module (évite les collisions de noms globaux entre scripts/*.ts)

import { readFileSync } from "node:fs";
import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { creerPrng } from "../lib/prng";
import { imposerProfilAssignation } from "./support/harnaisRouteur";
import { verifierBalisageMath, versTexteBrut } from "./support/texteMath";
import { validerAide, aidePresente, NB_SEGMENTS_MAX, LONGUEUR_LATEX_MAX } from "../lib/aideTypee";
import type { EcranDeclare, Generateur } from "../lib/contratGenerateur";
import {
  CHAMP_ALLURE, CHAMP_AXE, CHAMP_COEFFICIENTS, CHAMP_DIVISEURS, CHAMP_EXTREMUM, CHAMP_IMAGE, CHAMP_PARITE, CHAMP_QUOTIENT, CHAMP_RACINES, CHAMP_SIGNES, CHAMP_SIGNES_VARIATION, CHAMP_SOMME, CHAMPS_ETENDUS,
  CODE_AXE_NOTATION, CODE_ERREUR_CALCUL, CODE_MAUVAIS_CHOIX, generateurTemoinTechnique as temoin, graineDeProfil, reponseBruteCorrecte, VARIANTE_TEMOIN,
  type ExerciceEtendu, type ExerciceTemoin,
} from "../src/generateurs/_temoinTechnique";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

/** Nombre d'assertions de la Section A (origine) : 137 depuis la phase 2. Un changement doit être une décision, pas un accident. */
const NB_SECTION_A = 137;

async function main() {
  // ════ SECTION A — assertions d'origine (profil « base ») ════
  imposerProfilAssignation("base");
  // ── 1. Reproductibilité ──────────────────────────────────────────────────────────────────────
  for (const graine of [0, 1, 42, 123456789, 2 ** 32 - 1]) {
    verifier(JSON.stringify(temoin.generer(graine)) === JSON.stringify(temoin.generer(graine)), `generer(${graine}) : deux appels donnent des exercices différents`);
    verifier(JSON.stringify(temoin.ecrans(temoin.generer(graine))) === JSON.stringify(temoin.ecrans(temoin.generer(graine))), `ecrans(generer(${graine})) non reproductible`);
  }
  const distincts = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(temoin.generer(i * 7919))));
  verifier(distincts.size > 10, `50 graines distinctes ne donnent que ${distincts.size} exercices différents (PRNG dégénéré ?)`);
  const p1 = creerPrng(7);
  const p2 = creerPrng(7);
  verifier(Array.from({ length: 20 }, () => p1.suivant()).join() === Array.from({ length: 20 }, () => p2.suivant()).join(), "PRNG : même graine, suites différentes");
  let leve = false;
  try {
    creerPrng(-1);
  } catch {
    leve = true;
  }
  verifier(leve, "creerPrng(-1) devrait lever");
  verifier(!JSON.stringify(temoin.generer(5)).includes("undefined"), "exercice non JSON-sérialisable proprement");

  // ── 2. verifier : les 4 types × 3 statuts ─────────────────────────────────────────────────────
  const ex = temoin.generer(graineDeProfil("base", 0)); // (l'assertion d'origine utilisait la graine 2024, qui a désormais le profil étendu ; les valeurs attendues sont inchangées)
  const somme = ex.a + ex.b;
  verifier(temoin.verifier(ex, CHAMP_SOMME, String(somme)).statut === "correct", "somme correcte refusée");
  verifier(temoin.verifier(ex, CHAMP_SOMME, `${ex.a}+${ex.b}`).statut === "correct", "somme donnée sous forme d'expression refusée");
  const faux = temoin.verifier(ex, CHAMP_SOMME, String(ex.a - ex.b));
  verifier(faux.statut === "not_equivalent" && faux.codesCompetence.includes(CODE_ERREUR_CALCUL), "a−b devrait être not_equivalent + TEMOIN_ERREUR_CALCUL");
  const syntaxe = temoin.verifier(ex, CHAMP_SOMME, "12+");
  verifier(syntaxe.statut === "parse_error" && syntaxe.statut === "parse_error" && syntaxe.messageErreur.length > 0, "« 12+ » devrait être parse_error avec message");
  verifier(temoin.verifier(ex, CHAMP_SOMME, "abc").statut === "parse_error", "« abc » devrait être parse_error");

  const bonneParite = (somme % 2 === 0 ? "pair" : "impair") as string;
  const mauvaiseParite = bonneParite === "pair" ? "impair" : "pair";
  verifier(temoin.verifier(ex, CHAMP_PARITE, bonneParite).statut === "correct", "QCM correct refusé");
  verifier(temoin.verifier(ex, CHAMP_PARITE, mauvaiseParite).statut === "not_equivalent", "QCM faux accepté");
  const ni = temoin.verifier(ex, CHAMP_PARITE, "ni");
  verifier(ni.statut === "not_equivalent" && ni.codesCompetence.includes(CODE_MAUVAIS_CHOIX), "QCM « ni » devrait déclencher TEMOIN_MAUVAIS_CHOIX");
  verifier(temoin.verifier(ex, CHAMP_PARITE, "inexistant").statut === "parse_error", "QCM : choix inconnu devrait être parse_error");

  verifier(temoin.verifier(ex, CHAMP_DIVISEURS, reponseBruteCorrecte(ex, CHAMP_DIVISEURS)).statut === "correct", "liste correcte refusée");
  const listeInversee = JSON.stringify(JSON.parse(reponseBruteCorrecte(ex, CHAMP_DIVISEURS)).reverse());
  verifier(temoin.verifier(ex, CHAMP_DIVISEURS, listeInversee).statut === "correct", "liste : l'ordre ne doit pas compter (comparaison en ensemble)");
  verifier(temoin.verifier(ex, CHAMP_DIVISEURS, JSON.stringify(["1", "2"])).statut === "not_equivalent", "liste incomplète acceptée");
  verifier(temoin.verifier(ex, CHAMP_DIVISEURS, JSON.stringify([...JSON.parse(reponseBruteCorrecte(ex, CHAMP_DIVISEURS)), "999"])).statut === "not_equivalent", "liste avec valeur en trop acceptée");
  verifier(temoin.verifier(ex, CHAMP_DIVISEURS, JSON.stringify(["a", "1"])).statut === "parse_error", "liste : valeur non entière devrait être parse_error");
  verifier(temoin.verifier(ex, CHAMP_DIVISEURS, "pas du json").statut === "parse_error", "liste : JSON invalide devrait être parse_error");

  verifier(temoin.verifier(ex, CHAMP_SIGNES, reponseBruteCorrecte(ex, CHAMP_SIGNES)).statut === "correct", "tableau de signes correct refusé");
  const tableau = JSON.parse(reponseBruteCorrecte(ex, CHAMP_SIGNES));
  tableau.produit.c0 = tableau.produit.c0 === "+" ? "-" : "+";
  verifier(temoin.verifier(ex, CHAMP_SIGNES, JSON.stringify(tableau)).statut === "not_equivalent", "tableau de signes faux accepté");
  delete tableau.produit.c1;
  verifier(temoin.verifier(ex, CHAMP_SIGNES, JSON.stringify(tableau)).statut === "parse_error", "tableau incomplet devrait être parse_error");
  verifier(temoin.verifier(ex, CHAMP_SIGNES, "[]").statut === "parse_error", "tableau : forme invalide devrait être parse_error");

  // Le contrat : aucune solution ni aide dans les écrans envoyés (`aide` seul est retiré par la route).
  verifier(temoin.ecrans(ex).every((e) => !JSON.stringify(e).includes(reponseBruteCorrecte(ex, e.champ)) || e.champ === CHAMP_PARITE), "un écran semble contenir la solution");

  // etatActuel : séquentiel, jamais dépendant d'une saisie en cours (signature = réponses confirmées uniquement).
  verifier(temoin.etatActuel(ex, []).champCourant === CHAMP_SOMME, "etatActuel([]) devrait pointer sur le 1er écran");
  verifier(temoin.etatActuel(ex, [{ champ: CHAMP_SOMME, reponseBrute: "1", statut: "not_equivalent" }]).champCourant === CHAMP_PARITE, "etatActuel après « somme » devrait pointer sur « parite »");
  verifier(temoin.etatActuel(ex, temoin.ecrans(ex).map((e) => ({ champ: e.champ, reponseBrute: "", statut: "correct" as const }))).champCourant === null, "etatActuel épuisé devrait renvoyer null");

  // ── 3. Registre : cohérence + échec bruyant ───────────────────────────────────────────────────
  const { verifierCoherenceRegistre, verifierAvecControle, chercherGenerateur, REGISTRE_GENERATEURS, variantesCatalogueSansGenerateur } = require("../lib/registreGenerateurs");
  const { CATALOGUE_GENERATEURS } = require("../lib/catalogueGenerateurs");
  const { DICTIONNAIRE_COMPETENCES } = require("../lib/dictionnaireCompetences");
  verifier(verifierCoherenceRegistre(REGISTRE_GENERATEURS, CATALOGUE_GENERATEURS, DICTIONNAIRE_COMPETENCES).length === 0, "le registre réel devrait être cohérent");
  verifier(chercherGenerateur(VARIANTE_TEMOIN) === temoin, "chercherGenerateur(témoin)");
  // Depuis la 3b-3 les 4 variantes gen7 sont au registre (leur comportement : scripts/test-generation-gen7.ts, scripts/test-route-gen7.ts).
  verifier(["af_mise_en_evidence", "af_binome_conjugue", "af_produit_remarquable", "af_irreductible"].every((v) => chercherGenerateur(v)?.generateur_id === "gen7"), "les 4 variantes gen7 doivent être au registre (3b-3)");
  verifier(variantesCatalogueSansGenerateur().length === 0 && variantesCatalogueSansGenerateur(REGISTRE_GENERATEURS.filter((g: { variante_id: string }) => g.variante_id !== "af_irreductible")).join() === "af_irreductible", `aucune variante cataloguée sans générateur attendue, et une variante retirée du registre doit être nommée (obtenu ${variantesCatalogueSansGenerateur().join(",")})`);
  const cat = [{ generateur_id: "gX", variante_id: "x1" }];
  const base = { ...temoin, curriculaire: true, generateur_id: "gX", variante_id: "x1", codesCompetenceDeclares: [] as string[] };
  verifier(verifierCoherenceRegistre([base, base], cat, {}).some((e: string) => e.includes("en double")), "doublon de variante_id non détecté");
  verifier(verifierCoherenceRegistre([{ ...base, variante_id: "absent" }], cat, {}).some((e: string) => e.includes("absent de CATALOGUE")), "curriculaire absent du catalogue non détecté");
  verifier(verifierCoherenceRegistre([{ ...base, generateur_id: "gY" }], cat, {}).some((e: string) => e.includes("generateur_id")), "generateur_id incohérent non détecté");
  verifier(verifierCoherenceRegistre([{ ...base, codesCompetenceDeclares: ["CODE_INCONNU"] }], cat, {}).some((e: string) => e.includes("CODE_INCONNU")), "code hors dictionnaire non détecté");
  verifier(verifierCoherenceRegistre([{ ...base, curriculaire: false }], cat, {}).some((e: string) => e.includes("non curriculaire")), "témoin présent dans le catalogue non détecté");
  const menteur = { ...temoin, verifier: () => ({ statut: "not_equivalent" as const, codesCompetence: ["NON_DECLARE"] }) };
  let leveMenteur = false;
  try {
    verifierAvecControle(menteur, ex, CHAMP_SOMME, "1");
  } catch (e) {
    leveMenteur = e instanceof Error && e.message.includes("NON_DECLARE");
  }
  verifier(leveMenteur, "verifierAvecControle devrait lever sur un code non déclaré");
  const sansMessage = { ...temoin, verifier: () => ({ statut: "parse_error" as const, codesCompetence: [] }) };
  let leveSansMessage = false;
  try {
    verifierAvecControle(sansMessage as any, ex, CHAMP_SOMME, "1");
  } catch {
    leveSansMessage = true;
  }
  verifier(leveSansMessage, "parse_error sans message pédagogique devrait lever");

  // ── 4. Le témoin n'apparaît nulle part côté professeur ────────────────────────────────────────
  verifier(!CATALOGUE_GENERATEURS.some((e: { variante_id: string }) => e.variante_id.startsWith("_")), "une variante « _… » dans CATALOGUE_GENERATEURS");
  const json = readFileSync(`${__dirname}/../public/catalogue-generateurs-complet.json`, "utf8");
  verifier(!json.includes("_temoin") && !json.includes("temoin_technique"), "trace du témoin dans catalogue-generateurs-complet.json");
  const s0 = creerScenario();
  installerBase(s0.base);
  const cat0 = await appeler("catalogue-generateurs", "GET", { jeton: `prof:${s0.profId}` });
  verifier(cat0.statut === 200 && !JSON.stringify(cat0.corps).includes("temoin"), "GET /api/catalogue-generateurs expose le témoin");
  const creation = await appeler("taches", "POST", { jeton: `prof:${s0.profId}`, corps: { nom: "x", composition: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] } });
  verifier(creation.statut === 400, `POST /api/taches avec le témoin devrait être rejeté (400), obtenu ${creation.statut}`);

  // ── 5. Assignation (POST /api/assignations) ───────────────────────────────────────────────────
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const tacheId = creerTache(s, { variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }] });
  verifier((await appeler("assignations", "POST", { corps: { tache_id: tacheId, classe_id: s.classeId } })).statut === 401, "assignations sans jeton : 401 attendu");
  verifier((await appeler("assignations", "GET", { jeton: jetonProf })).statut === 405, "assignations GET : 405 attendu");
  verifier((await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheId } })).statut === 400, "assignations sans cible : 400 attendu");
  verifier((await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheId, classe_id: s.classeId, eleve_ids: ["eleve-1"] } })).statut === 400, "assignations classe + élèves : 400 attendu");
  verifier((await appeler("assignations", "POST", { jeton: `prof:${s.autreProfId}`, corps: { tache_id: tacheId, classe_id: s.classeId } })).statut === 404, "un autre prof ne doit pas pouvoir assigner");
  verifier(s.base.table("exercices_assignes").length === 0, "des exercices ont été créés malgré des rejets");

  const tacheGen7 = creerTache(s, { nom: "gen7", variantes: [{ variante_id: "af_mise_en_evidence", nombre_exercices: 1 }] });
  // Le catalogue n'a plus de variante sans générateur : on RETIRE un instant `af_mise_en_evidence` du registre pour exercer le 409 (puis on le remet).
  const { REGISTRE_GENERATEURS: registreVivant } = require("../lib/registreGenerateurs") as { REGISTRE_GENERATEURS: { variante_id: string }[] };
  const indiceGen7 = registreVivant.findIndex((g) => g.variante_id === "af_mise_en_evidence");
  const [retire] = registreVivant.splice(indiceGen7, 1);
  let rejetGen7;
  try {
    rejetGen7 = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheGen7, classe_id: s.classeId } });
  } finally {
    registreVivant.splice(indiceGen7, 0, retire as { variante_id: string });
  }
  verifier(rejetGen7.statut === 409 && rejetGen7.corps.variantes_indisponibles?.[0] === "af_mise_en_evidence", `variante sans générateur : 409 attendu, obtenu ${rejetGen7.statut}`);
  verifier(s.base.table("exercices_assignes").length === 0 && s.base.table("taches_assignations").length === 0, "écriture malgré le 409 (doit échouer AVANT toute écriture)");

  const ok = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheId, classe_id: s.classeId } });
  verifier(ok.statut === 201 && ok.corps.nombre_exercices_generes === 4, `assignation classe : 4 exercices attendus (2 élèves × 2), obtenu ${JSON.stringify(ok.corps)}`);
  const lignes = s.base.table("exercices_assignes");
  verifier(lignes.length === 4 && lignes.every((l) => Number.isInteger(l.graine) && l.variante_id === VARIANTE_TEMOIN && l.generateur_id === "_temoin_technique"), "lignes exercices_assignes : graine/variante/generateur attendus");
  verifier(lignes.every((l) => JSON.stringify(l.champs_attendus) === JSON.stringify([CHAMP_SOMME, CHAMP_PARITE, CHAMP_DIVISEURS, CHAMP_SIGNES])), "champs_attendus = champs des écrans, dans l'ordre");
  verifier(lignes.every((l) => l.enonce === undefined && l.solution === undefined), "enonce/solution ne doivent plus être écrits");
  verifier(new Set(lignes.map((l) => l.graine)).size === 4, "graines identiques entre exercices (tirage non aléatoire ?)");
  const ok2 = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheId, classe_id: s.classeId } });
  verifier(ok2.statut === 201 && ok2.corps.nombre_exercices_generes === 0 && s.base.table("exercices_assignes").length === 4, "ré-assignation : aucun nouvel exercice attendu (idempotence)");

  // ── 6. GET exercice : écrans sans aide ni solution, état initial ─────────────────────────────
  const tacheAide = creerTache(s, { nom: "avec aide", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }], aide_activee: true, aide_penalite_pourcent: 50, tentatives_supplementaires: 1 });
  verifier((await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheAide, eleve_ids: ["eleve-1"] } })).statut === 201, "assignation par élève");
  const exAide = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheAide)!;
  const jetonEleve = "eleve:eleve-1";
  const get = await appeler(`exercices/${exAide.id}`, "GET", { jeton: jetonEleve });
  verifier(get.statut === 200 && get.corps.ecrans.length === 4 && get.corps.champ_courant === CHAMP_SOMME, `GET exercice : ${get.statut} ${JSON.stringify(get.corps).slice(0, 200)}`);
  verifier(get.corps.ecrans.every((e: any) => e.aide === undefined && e.aide_disponible === true), "l'aide ne doit jamais être envoyée avec l'écran (aide_disponible seul)");
  verifier(get.corps.champs.every((c: any) => c.solution_attendue === null && c.statut === null && c.verrouille === false), "état initial : aucun champ verrouillé/révélé");
  verifier((await appeler(`exercices/${exAide.id}`, "GET", { jeton: "eleve:eleve-2" })).statut === 404, "un autre élève ne doit pas lire l'exercice");
  verifier((await appeler(`exercices/${exAide.id}`, "GET")).statut === 401, "GET exercice sans jeton : 401");

  // ── 7. POST /api/reponses ─────────────────────────────────────────────────────────────────────
  const exercice = temoin.generer(Number(exAide.graine));
  const poster = (champ: string, brute: string, jeton = jetonEleve) => appeler("reponses", "POST", { jeton, corps: { exercice_assigne_id: exAide.id, champ, reponse_brute: brute } });
  verifier((await appeler("reponses", "POST", { corps: {} })).statut === 401, "reponses sans jeton : 401");
  verifier((await appeler("reponses", "GET", { jeton: jetonEleve })).statut === 405, "reponses GET : 405");
  // Règle « état local d'édition ≠ réponse » : toute clé hors { exercice_assigne_id, champ, reponse_brute } est refusée.
  const brouillon = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exAide.id, champ: CHAMP_SOMME, reponse_brute: "1", brouillon: "12" } });
  verifier(brouillon.statut === 400, `clé « brouillon » : 400 attendu, obtenu ${brouillon.statut}`);
  const etatEdition = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exAide.id, champ: CHAMP_SOMME, etat_edition: { valeurs: ["1"] } } });
  verifier(etatEdition.statut === 400, "état d'édition à la place de reponse_brute : 400 attendu");
  verifier((await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exAide.id, champ: CHAMP_SOMME, reponse_brute: 12 } })).statut === 400, "reponse_brute non chaîne : 400");
  verifier((await poster(CHAMP_SOMME, "   ")).statut === 400, "réponse vide : 400");
  verifier((await poster("inconnu", "1")).statut === 400, "champ inconnu : 400");
  verifier((await poster(CHAMP_PARITE, "pair")).statut === 409, "champ hors ordre : 409");
  verifier((await poster(CHAMP_SOMME, "1", "eleve:eleve-2")).statut === 404, "réponse d'un autre élève : 404");
  verifier(s.base.table("reponses").length === 0, "des réponses ont été enregistrées malgré les rejets");

  // Aide : usage enregistré CÔTÉ SERVEUR, jamais déclaré par le client.
  const aide = await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exAide.id, champ: CHAMP_SOMME } });
  verifier(aide.statut === 200 && aide.corps.aide === "Additionne les deux nombres." && aide.corps.penalite_pourcent === 50, `aide : ${JSON.stringify(aide)}`);
  verifier(s.base.table("aides_utilisees").length === 1, "l'usage de l'aide doit être enregistré côté serveur");
  await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exAide.id, champ: CHAMP_SOMME } });
  verifier(s.base.table("aides_utilisees").length === 1, "aides_utilisees : une seule ligne par (exercice, champ)");
  const exSansAide = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheId && l.eleve_id === "eleve-1")!;
  verifier((await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exSansAide.id, champ: CHAMP_SOMME } })).statut === 403, "aide désactivée pour la tâche : 403");

  // parse_error : message pédagogique, tentative comptée (1 supplémentaire => 2 max).
  const r1 = await poster(CHAMP_SOMME, "12+");
  verifier(r1.statut === 200 && r1.corps.statut === "parse_error" && typeof r1.corps.message_erreur === "string" && r1.corps.verrouille === false && r1.corps.tentatives_restantes === 1, `parse_error : ${JSON.stringify(r1.corps)}`);
  verifier(r1.corps.solution_attendue === undefined, "reponse_visible=false : pas de solution après un échec");
  const ligne1 = s.base.table("reponses")[0];
  verifier(ligne1.statut === "parse_error" && ligne1.indice_utilise === true && ligne1.bug_detecte === null, "ligne reponses : statut, indice_utilise (dérivé du serveur), bug_detecte");
  // 2e échec : tentatives épuisées => verdict + verrouillage + code de compétence stocké ; SANS solution (reponse_visible=false, RAPPORT §42 : la case commande la révélation).
  const r2 = await poster(CHAMP_SOMME, String(exercice.a - exercice.b));
  verifier(r2.corps.statut === "not_equivalent" && r2.corps.verrouille === true && r2.corps.revele === false && r2.corps.solution_attendue === undefined, `épuisement, reponse_visible=false : verdict sans solution ni revele : ${JSON.stringify(r2.corps)}`);
  verifier(s.base.table("reponses")[1].bug_detecte === CODE_ERREUR_CALCUL, "le code de compétence doit être stocké dans bug_detecte");
  verifier(r2.corps.champ_courant === CHAMP_PARITE, "après épuisement, l'écran suivant devient courant");
  verifier((await poster(CHAMP_SOMME, "1")).statut === 409, "champ terminé : 409");
  const r3 = await poster(CHAMP_PARITE, reponseBruteCorrecte(exercice, CHAMP_PARITE));
  verifier(r3.corps.statut === "correct" && r3.corps.verrouille === true && r3.corps.champ_courant === CHAMP_DIVISEURS, `QCM correct : ${JSON.stringify(r3.corps)}`);
  const r4 = await poster(CHAMP_DIVISEURS, reponseBruteCorrecte(exercice, CHAMP_DIVISEURS));
  verifier(r4.corps.statut === "correct", "liste correcte");
  verifier(r4.corps.exercice_termine === false, "exercice pas encore terminé");
  const r5 = await poster(CHAMP_SIGNES, reponseBruteCorrecte(exercice, CHAMP_SIGNES));
  verifier(r5.corps.statut === "correct" && r5.corps.exercice_termine === true && r5.corps.champ_courant === null, `dernier écran : ${JSON.stringify(r5.corps)}`);

  // Tableau de bord : tâche complète -> « effectuées » ; resume ; série.
  const tdb = await appeler("eleves/tableau-de-bord", "GET", { jeton: jetonEleve });
  verifier(tdb.statut === 200, `tableau de bord : ${tdb.statut} ${JSON.stringify(tdb.corps)}`);
  const effectuee = tdb.corps.effectuees.find((t: any) => t.tache_id === tacheAide);
  verifier(!!effectuee && effectuee.resume.repondus === 4 && effectuee.resume.attendus === 4, `tâche complète en « effectuées » (resume 4/4) : ${JSON.stringify(effectuee?.resume)}`);
  verifier(tdb.corps.en_cours.some((t: any) => t.tache_id === tacheId), "la tâche non commencée doit être « en cours »");
  verifier(tdb.corps.serieActuelle === 3, `série : 3 bonnes réponses consécutives attendues, obtenu ${tdb.corps.serieActuelle}`);
  const champSomme = effectuee.exercices[0].champs.find((c: any) => c.champ === CHAMP_SOMME);
  verifier(champSomme.revele === false && champSomme.solution_attendue === null && champSomme.statut === "not_equivalent", "tableau de bord : champ épuisé, reponse_visible=false : verdict sans solution (RAPPORT §42)");

  // Chrono : un champ déjà réussi reste réussi une fois le chrono écoulé ; un champ en cours est révélé.
  const tacheChrono = creerTache(s, { nom: "chrono", reponse_visible: true, chrono_mode: "par_ecran", chrono_duree_secondes: 60, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheChrono, eleve_ids: ["eleve-1"] } });
  const exChrono = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheChrono)!;
  const exerciceChrono = temoin.generer(Number(exChrono.graine));
  verifier((await appeler("reponses/debut-ecran", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exChrono.id, champ: CHAMP_SOMME } })).statut === 200, "debut-ecran (réutilisé tel quel de la phase 1)");
  const rc = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exChrono.id, champ: CHAMP_SOMME, reponse_brute: reponseBruteCorrecte(exerciceChrono, CHAMP_SOMME) } });
  verifier(rc.corps.statut === "correct", "chrono : réponse à temps correcte");
  await appeler("reponses/debut-ecran", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exChrono.id, champ: CHAMP_PARITE } });
  const anciens = new Date(Date.now() - 3600_000).toISOString();
  for (const d of s.base.table("debuts_ecran").filter((d) => d.exercice_assigne_id === exChrono.id)) d.horodatage_debut = anciens;
  const gChrono = await appeler(`exercices/${exChrono.id}`, "GET", { jeton: jetonEleve });
  const cSomme = gChrono.corps.champs.find((c: any) => c.champ === CHAMP_SOMME);
  const cParite = gChrono.corps.champs.find((c: any) => c.champ === CHAMP_PARITE);
  verifier(cSomme.statut === "correct" && cSomme.revele === false, "chrono écoulé : un champ déjà réussi doit rester réussi (non révélé)");
  verifier(cParite.revele === true && cParite.verrouille === true && cParite.solution_attendue !== null, "chrono écoulé : le champ en cours est révélé et verrouillé");
  verifier((await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: exChrono.id, champ: CHAMP_PARITE, reponse_brute: "pair" } })).statut === 409, "chrono écoulé : la soumission tardive est refusée (409)");

  // Réglages de correction : feedback désactivé, reponse_visible.
  const tacheMuette = creerTache(s, { nom: "muette", feedback_immediat: false, tentatives_supplementaires: 2, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheMuette, eleve_ids: ["eleve-2"] } });
  const exMuet = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheMuette)!;
  const rm = await appeler("reponses", "POST", { jeton: "eleve:eleve-2", corps: { exercice_assigne_id: exMuet.id, champ: CHAMP_SOMME, reponse_brute: "0" } });
  // Sans correction immédiate : UN essai, et rien n'est révélé (ni verdict, ni solution, ni `revele`) avant la fin
  // de la TÂCHE entière — un échec n'est pas plus visible qu'une réussite.
  verifier(rm.corps.statut === undefined && rm.corps.solution_attendue === undefined && rm.corps.message_erreur === undefined && rm.corps.revele === false && rm.corps.verrouille === true && rm.corps.tache_terminee === false && rm.corps.champ_courant === CHAMP_PARITE, `feedback coupé, réponse fausse : rien de révélé, champ verrouillé : ${JSON.stringify(rm.corps)}`);
  // Option B : sans correction immédiate, UN SEUL essai quoi qu'indique `tentatives_supplementaires` (ici 2).
  const gMuet = await appeler(`exercices/${exMuet.id}`, "GET", { jeton: "eleve:eleve-2" });
  verifier(gMuet.corps.tache.tentatives_max === 1, `feedback coupé : tentatives_max effectif attendu 1, obtenu ${gMuet.corps.tache.tentatives_max}`);
  verifier(gMuet.corps.champs.find((c: any) => c.champ === CHAMP_SOMME).verrouille === true, "feedback coupé : la 1re réponse termine le champ (verrouille)");
  const exerciceMuet = temoin.generer(Number(exMuet.graine));
  // Réponse JUSTE sans correction immédiate : rien n'est révélé (ni statut ni solution), le champ est verrouillé.
  const bonnePariteMuet = await appeler("reponses", "POST", { jeton: "eleve:eleve-2", corps: { exercice_assigne_id: exMuet.id, champ: CHAMP_PARITE, reponse_brute: reponseBruteCorrecte(exerciceMuet, CHAMP_PARITE) } });
  verifier(bonnePariteMuet.corps.statut === undefined && bonnePariteMuet.corps.solution_attendue === undefined && bonnePariteMuet.corps.message_erreur === undefined && bonnePariteMuet.corps.verrouille === true && bonnePariteMuet.corps.revele === false && bonnePariteMuet.corps.tache_terminee === false, `feedback coupé, réponse juste : ni statut ni solution, champ verrouillé : ${JSON.stringify(bonnePariteMuet.corps)}`);
  const formeVisible = (c: any) => JSON.stringify({ statut: c.statut, solution: c.solution_attendue, message: c.message_erreur, revele: c.revele, verrouille: c.verrouille, restantes: c.tentatives_restantes });
  verifier(formeVisible(rm.corps) === formeVisible(bonnePariteMuet.corps), "feedback coupé : la réponse fausse et la réponse juste ont EXACTEMENT la même apparence côté élève");
  const mauvaises: Record<string, string> = {
    [CHAMP_DIVISEURS]: JSON.stringify(["1"]),
    [CHAMP_SIGNES]: JSON.stringify({ facteur1: { c0: "+", c1: "+", c2: "+", c3: "+", c4: "+" }, facteur2: { c0: "+", c1: "+", c2: "+", c3: "+", c4: "+" }, produit: { c0: "+", c1: "+", c2: "+", c3: "+", c4: "+" } }),
  };
  for (const [champ, brute] of Object.entries(mauvaises)) await appeler("reponses", "POST", { jeton: "eleve:eleve-2", corps: { exercice_assigne_id: exMuet.id, champ, reponse_brute: brute } });
  const tdbMuet = await appeler("eleves/tableau-de-bord", "GET", { jeton: "eleve:eleve-2" });
  verifier(tdbMuet.corps.effectuees.some((t: any) => t.tache_id === tacheMuette), "feedback coupé : tâche répondue une fois par champ = « effectuée » au tableau de bord");
  const resMuet = await appeler("eleves/mes-resultats", "GET", { jeton: "eleve:eleve-2" });
  const ligneMuette = resMuet.corps.historiqueTaches.find((h: any) => h.nomTache === "muette");
  verifier(!!ligneMuette && ligneMuette.total === 4 && ligneMuette.correct === 1, `feedback coupé : mes-résultats note la tâche (1/4), même verdict que le tableau de bord — obtenu ${JSON.stringify(ligneMuette)}`);
  const { tentativesMaxEffectif } = require("../lib/moteurTentatives");
  verifier(tentativesMaxEffectif(true, 0) === 1 && tentativesMaxEffectif(true, 2) === 3 && tentativesMaxEffectif(false, 0) === 1 && tentativesMaxEffectif(false, 5) === 1, "tentativesMaxEffectif : (true,0)=1 (true,2)=3 (false,·)=1");
  const tacheVisible = creerTache(s, { nom: "visible", reponse_visible: true, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheVisible, eleve_ids: ["eleve-2"] } });
  const exVis = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheVisible)!;
  const rv = await appeler("reponses", "POST", { jeton: "eleve:eleve-2", corps: { exercice_assigne_id: exVis.id, champ: CHAMP_SOMME, reponse_brute: reponseBruteCorrecte(temoin.generer(Number(exVis.graine)), CHAMP_SOMME) } });
  verifier(rv.corps.statut === "correct" && rv.corps.solution_attendue !== undefined, "reponse_visible : solution renvoyée sur une réponse correcte");

  // Fenêtres de dates : « pas commencée » absente du tableau de bord, « antérieure » consultable mais fermée.
  const tacheFuture = creerTache(s, { nom: "future" });
  await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheFuture, eleve_ids: ["eleve-2"], date_debut: new Date(Date.now() + 86400_000).toISOString() } });
  const tachePassee = creerTache(s, { nom: "passée" });
  await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tachePassee, eleve_ids: ["eleve-2"], date_debut: new Date(Date.now() - 2 * 86400_000).toISOString(), date_echeance: new Date(Date.now() - 86400_000).toISOString() } });
  const tdb2 = await appeler("eleves/tableau-de-bord", "GET", { jeton: "eleve:eleve-2" });
  const toutes = [...tdb2.corps.en_cours, ...tdb2.corps.effectuees, ...tdb2.corps.anterieures];
  verifier(!toutes.some((t: any) => t.tache_id === tacheFuture), "tâche pas encore commencée : absente du tableau de bord");
  verifier(tdb2.corps.anterieures.some((t: any) => t.tache_id === tachePassee), "tâche échue : « antérieures »");
  const exPasse = s.base.table("exercices_assignes").find((l) => l.tache_id === tachePassee)!;
  const exFutur = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheFuture)!;
  verifier((await appeler("reponses", "POST", { jeton: "eleve:eleve-2", corps: { exercice_assigne_id: exPasse.id, champ: CHAMP_SOMME, reponse_brute: "1" } })).statut === 403, "réponse après échéance : 403");
  verifier((await appeler("reponses", "POST", { jeton: "eleve:eleve-2", corps: { exercice_assigne_id: exFutur.id, champ: CHAMP_SOMME, reponse_brute: "1" } })).statut === 403, "réponse avant le début : 403");
  const gPasse = await appeler(`exercices/${exPasse.id}`, "GET", { jeton: "eleve:eleve-2" });
  verifier(gPasse.statut === 200 && gPasse.corps.saisie_possible === false && gPasse.corps.champs.every((c: any) => c.solution_attendue !== null), "tâche échue : consultable, solutions révélées, saisie fermée");
  verifier((await appeler(`exercices/${exFutur.id}`, "GET", { jeton: "eleve:eleve-2" })).statut === 403, "GET exercice d'une tâche pas commencée : 403");

  // ── Sans correction immédiate : révélation à la fin de la TÂCHE entière (2 exercices), jamais champ par champ ──
  {
    const s2 = creerScenario();
    installerBase(s2.base);
    const tache = creerTache(s2, { nom: "Fin de tâche", feedback_immediat: false, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }] });
    await appeler("assignations", "POST", { jeton: `prof:${s2.profId}`, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    const [ex1, ex2] = s2.base.table("exercices_assignes").filter((l) => l.tache_id === tache);
    const e1 = temoin.generer(Number(ex1.graine));
    const e2 = temoin.generer(Number(ex2.graine));
    const jeton = "eleve:eleve-1";
    const poster2 = (ex: any, champ: string, brute: string) => appeler("reponses", "POST", { jeton, corps: { exercice_assigne_id: ex.id, champ, reponse_brute: brute } });
    const toutBlanc = (r: any) => r.statut === 200 && r.corps.statut === undefined && r.corps.solution_attendue === undefined && r.corps.message_erreur === undefined && r.corps.revele === false && r.corps.verrouille === true && r.corps.tache_terminee === false;
    const signesFaux = JSON.stringify({ facteur1: { c0: "+", c1: "+", c2: "+", c3: "+", c4: "+" }, facteur2: { c0: "+", c1: "+", c2: "+", c3: "+", c4: "+" }, produit: { c0: "+", c1: "+", c2: "+", c3: "+", c4: "+" } });
    // Exercice 1 : faux (avec code de compétence), juste, juste, faux — tous indiscernables.
    const r1 = [
      await poster2(ex1, CHAMP_SOMME, String(e1.a - e1.b)),
      await poster2(ex1, CHAMP_PARITE, reponseBruteCorrecte(e1, CHAMP_PARITE)),
      await poster2(ex1, CHAMP_DIVISEURS, reponseBruteCorrecte(e1, CHAMP_DIVISEURS)),
      await poster2(ex1, CHAMP_SIGNES, signesFaux),
    ];
    verifier(r1.every(toutBlanc), `fin de tâche : les 4 réponses de l'exercice 1 (2 fausses, 2 justes) doivent être indiscernables : ${JSON.stringify(r1.map((r) => r.corps))}`);
    verifier(new Set(r1.map((r) => JSON.stringify({ ...r.corps, champ_courant: 0, exercice_termine: 0 }))).size === 1, "fin de tâche : réponses fausses et justes de forme strictement identique");
    verifier(r1[3].corps.exercice_termine === true && r1[3].corps.tache_terminee === false, "l'exercice 1 est terminé mais pas la tâche (exercice 2 ouvert)");
    // Rien ne fuit par les autres canaux tant que la tâche n'est pas terminée.
    const g1 = await appeler(`exercices/${ex1.id}`, "GET", { jeton });
    verifier(g1.corps.champs.every((c: any) => c.statut === null && c.solution_attendue === null && c.revele === false && c.verrouille === true), "GET exercice 1 en cours de tâche : aucun verdict ni solution");
    const t1 = await appeler("eleves/tableau-de-bord", "GET", { jeton });
    const tache1 = t1.corps.en_cours.find((t: any) => t.tache_id === tache);
    verifier(!!tache1 && tache1.exercices.every((e: any) => e.champs.every((c: any) => c.statut === null && c.solution_attendue === null && c.revele === false)), "tableau de bord en cours de tâche : aucun verdict ni solution");
    verifier(t1.corps.serieActuelle === 0, `série : les réponses masquées ne comptent pas (ni hausse ni remise à zéro), obtenu ${t1.corps.serieActuelle}`);
    const m1 = await appeler("eleves/mes-resultats", "GET", { jeton });
    verifier(m1.corps.competences.length === 0 && m1.corps.evolution.length === 0 && m1.corps.historiqueTaches.length === 0, `mes-résultats en cours de tâche : aucune compétence/évolution révélée : ${JSON.stringify(m1.corps.competences)}`);
    // Exercice 2 : tout juste. La dernière réponse termine la tâche ET la révèle.
    const r2 = [
      await poster2(ex2, CHAMP_SOMME, reponseBruteCorrecte(e2, CHAMP_SOMME)),
      await poster2(ex2, CHAMP_PARITE, reponseBruteCorrecte(e2, CHAMP_PARITE)),
      await poster2(ex2, CHAMP_DIVISEURS, reponseBruteCorrecte(e2, CHAMP_DIVISEURS)),
    ];
    verifier(r2.every(toutBlanc), "fin de tâche : les réponses de l'exercice 2 avant la dernière restent muettes");
    const derniere = await poster2(ex2, CHAMP_SIGNES, reponseBruteCorrecte(e2, CHAMP_SIGNES));
    verifier(derniere.corps.tache_terminee === true && derniere.corps.statut === "correct" && derniere.corps.solution_attendue !== undefined, `la réponse qui termine la tâche la révèle : ${JSON.stringify(derniere.corps)}`);
    // Après la fin : tout est révélé d'un coup (verdicts + solutions, y compris les échecs de l'exercice 1).
    const g1b = await appeler(`exercices/${ex1.id}`, "GET", { jeton });
    const champsG1 = Object.fromEntries(g1b.corps.champs.map((c: any) => [c.champ, c]));
    verifier(champsG1[CHAMP_SOMME].statut === "not_equivalent" && champsG1[CHAMP_SOMME].revele === true && champsG1[CHAMP_SOMME].solution_attendue === String(e1.a + e1.b), `après la tâche : l'échec de l'exercice 1 est révélé avec sa solution : ${JSON.stringify(champsG1[CHAMP_SOMME])}`);
    verifier(champsG1[CHAMP_PARITE].statut === "correct", "après la tâche : la réussite est révélée aussi");
    const t2 = await appeler("eleves/tableau-de-bord", "GET", { jeton });
    const fin = t2.corps.effectuees.find((t: any) => t.tache_id === tache);
    verifier(!!fin && fin.exercices.every((e: any) => e.champs.every((c: any) => c.statut !== null && c.solution_attendue !== null)), "tableau de bord après la tâche : tout est révélé");
    const m2 = await appeler("eleves/mes-resultats", "GET", { jeton });
    verifier(m2.corps.historiqueTaches.length === 1 && m2.corps.historiqueTaches[0].correct === 6 && m2.corps.historiqueTaches[0].total === 8, `mes-résultats après la tâche : noté 6/8, obtenu ${JSON.stringify(m2.corps.historiqueTaches)}`);
    verifier(m2.corps.competences.some((c: any) => c.code === CODE_ERREUR_CALCUL), "mes-résultats après la tâche : la compétence détectée apparaît");
    verifier(t2.corps.serieActuelle === 4, `série après la tâche : les 4 dernières réponses (exercice 2) sont justes, obtenu ${t2.corps.serieActuelle}`);
  }

  const nbSectionA = nbVerifs;
  if (nbSectionA !== NB_SECTION_A) echecs.push(`Section A (origine) : ${nbSectionA} vérifications au lieu de ${NB_SECTION_A} — une assertion chiffrée d'origine a été retirée ou ajoutée (à décider, pas à laisser passer)`);

  // ════ SECTION B — extension de la phase 3b-1 (profil « étendu ») ════
  await sectionB();

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nbVerifs}`);
    for (const e of echecs) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`OK : ${nbVerifs} vérifications = Section A (origine, profil base) ${nbSectionA} + Section B (extension 3b-1, profil étendu) ${nbVerifs - nbSectionA}`);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// SECTION B — extension de la phase 3b-1 (profil « étendu »)
// ════════════════════════════════════════════════════════════════════════════════════════════

const CHAMPS = CHAMPS_ETENDUS;

/** Tous les textes D'AUTEUR d'un écran, étiquetés par nature (pour vérifier que chaque nature porte du balisage). */
function textesAuteur(ecran: EcranDeclare): { nature: string; texte: string }[] {
  const t: { nature: string; texte: string }[] = [{ nature: "consigne", texte: ecran.consigne }];
  if (ecran.nom) t.push({ nature: "nom d'écran", texte: ecran.nom });
  if (typeof ecran.aide === "string") t.push({ nature: "aide (chaîne)", texte: ecran.aide });
  if (ecran.type === "qcm") for (const c of ecran.choix) t.push({ nature: "libellé de choix (qcm)", texte: c.libelle });
  if (ecran.type === "liste_valeurs") {
    t.push({ nature: "étiquette d'ajout", texte: ecran.etiquetteAjout });
    if (ecran.etiquetteAucune) t.push({ nature: "étiquette aucune", texte: ecran.etiquetteAucune });
    if (ecran.etiquetteAuMoinsUne) t.push({ nature: "étiquette au moins une", texte: ecran.etiquetteAuMoinsUne });
  }
  if (ecran.type === "champs_multiples") {
    for (const s of ecran.champs) {
      t.push({ nature: "libellé de sous-champ", texte: s.libelle });
      if (s.genre === "choix") for (const c of s.choix) t.push({ nature: "libellé de choix (sous-champ)", texte: c.libelle });
    }
  }
  if (ecran.type === "tableau_signes") {
    for (const c of ecran.colonnes) {
      t.push({ nature: "libellé de colonne", texte: c.libelle });
      if (c.symbole) t.push({ nature: "symbole de colonne", texte: c.symbole });
      if (c.valeur) t.push({ nature: "valeur de colonne", texte: c.valeur });
    }
    for (const l of ecran.lignes) t.push({ nature: "libellé de ligne", texte: l.libelle });
    if (ecran.titre) t.push({ nature: "titre de tableau", texte: ecran.titre });
  }
  return t;
}


/** Enveloppe un exercice étendu en exercice du témoin unique (seuls `profil` et `etendu` comptent pour ses écrans et sa vérification). */
const U = (e: ExerciceEtendu): ExerciceTemoin => ({ a: 11, b: 11, n: 12, r1: 0, r2: 1, profil: "etendu", etendu: e });
const genE = (graine: number): ExerciceEtendu => {
  const ex = temoin.generer(graine);
  if (!ex.etendu) throw new Error(`graine ${graine} : profil « ${ex.profil} », étendu attendu`);
  return ex.etendu;
};

async function sectionB(): Promise<void> {
  const grainesEtendues = Array.from({ length: 300 }, (_, i) => graineDeProfil("etendu", i));
  // ── 1. Reproductibilité et formes ──
  const formes = new Map<boolean, number>();
  for (const graine of grainesEtendues) {
    const ex = genE(graine);
    verifier(JSON.stringify(temoin.generer(graine)) === JSON.stringify(temoin.generer(graine)), `generer(${graine}) non reproductible`);
    verifier(JSON.stringify(temoin.ecrans(temoin.generer(graine))) === JSON.stringify(temoin.ecrans(temoin.generer(graine))), `ecrans(generer(${graine})) non reproductible`);
    formes.set(ex.large, (formes.get(ex.large) ?? 0) + 1);
    const delta = ex.b * ex.b - 4 * ex.a * ex.c;
    verifier(ex.large ? delta > 0 : delta === 0, `graine ${graine} : discriminant incohérent avec la forme (${delta})`);
    verifier(Number.isInteger(ex.a) && Number.isInteger(ex.b) && Number.isInteger(ex.c) && ex.a > 0, `graine ${graine} : coefficients entiers, a > 0`);
    const tableau = temoin.ecrans(U(ex)).find((e) => e.champ === CHAMP_SIGNES_VARIATION);
    verifier(tableau?.type === "tableau_signes" && tableau.colonnes.length === (ex.large ? 7 : 3), `graine ${graine} : ${ex.large ? 7 : 3} colonnes attendues`);
  }
  verifier((formes.get(true) ?? 0) > 20 && (formes.get(false) ?? 0) > 20, `les deux formes (7 et 3 colonnes) doivent être bien représentées : ${JSON.stringify([...formes])}`);
  const graineLarge = graineDeProfil("etendu", 0, { large: true });
  const graineEtroite = graineDeProfil("etendu", 0, { large: false });
  verifier(JSON.stringify(temoin.ecrans(U(genE(graineLarge))).map((e) => e.champ)) === JSON.stringify(CHAMPS), `les ${CHAMPS.length} écrans, dans l'ordre`);

  // ── 2. Balisage : chaque nature de texte d'auteur porte du balisage valide ──
  const naturesAvecMath = new Set<string>();
  for (const graine of grainesEtendues.slice(0, 60)) {
    const ex = genE(graine);
    for (const ecran of temoin.ecrans(U(ex))) {
      for (const { nature, texte } of textesAuteur(ecran)) {
        const problemes = verifierBalisageMath(texte);
        verifier(problemes.length === 0, `graine ${graine} / ${ecran.champ} : ${nature} « ${texte} » : ${problemes.join(" ; ")}`);
        if (texte.includes("$")) naturesAvecMath.add(nature);
      }
      if (ecran.type === "champs_multiples") {
        for (const s of ecran.champs) if (s.genre === "texte" && s.placeholder) verifier(!versTexteBrut(s.placeholder).includes("$") || s.placeholder.includes("\\$"), `${ecran.champ} : placeholder « ${s.placeholder} » : les délimiteurs doivent disparaître (versTexteBrut)`);
      }
      if (typeof ecran.aide === "object") verifier(validerAide(ecran.aide).length === 0, `graine ${graine} / ${ecran.champ} : aide typée invalide : ${validerAide(ecran.aide).join(" ; ")}`);
    }
    for (const champ of CHAMPS) {
      const problemes = verifierBalisageMath(temoin.solutionAttendue(U(ex), champ));
      verifier(problemes.length === 0, `graine ${graine} : solution attendue de ${champ} : ${problemes.join(" ; ")}`);
    }
  }
  for (const nature of ["consigne", "aide (chaîne)", "libellé de choix (qcm)", "étiquette d'ajout", "libellé de sous-champ", "libellé de choix (sous-champ)", "libellé de colonne", "symbole de colonne", "valeur de colonne", "libellé de ligne"]) {
    verifier(naturesAvecMath.has(nature), `le témoin doit porter du balisage mathématique dans « ${nature} » (couverture)`);
  }
  verifier(verifierBalisageMath(temoin.solutionAttendue(U(genE(graineLarge)), CHAMP_AXE)).length === 0, "solution d'axe saine");

  // ── 3. verifier : tous les écrans × statuts ──
  const ex = genE(graineLarge);
  const ex3 = genE(graineEtroite);
  const v = (e: typeof ex, champ: string, brute: string) => temoin.verifier(U(e), champ, brute);
  for (const e of [ex, ex3]) for (const champ of CHAMPS) verifier(v(e, champ, reponseBruteCorrecte(U(e), champ)).statut === "correct", `${champ} (${e.large ? "7" : "3"} colonnes) : réponse correcte refusée`);
  const coef = (a: string, b: string, c: string) => JSON.stringify({ a, b, c });
  verifier(v(ex, CHAMP_COEFFICIENTS, coef(String(ex.a + 1), String(ex.b), String(ex.c))).statut === "not_equivalent", "coefficients : faux → not_equivalent");
  verifier(v(ex, CHAMP_COEFFICIENTS, coef("abc", String(ex.b), String(ex.c))).statut === "parse_error", "coefficients : texte illisible → parse_error");
  const vide = v(ex, CHAMP_COEFFICIENTS, coef(String(ex.a), "", String(ex.c)));
  verifier(vide.statut === "parse_error" && vide.messageErreur.includes("b"), "coefficients : champ vide → parse_error nommant le champ (jamais lu comme 0)");
  verifier(v(ex, CHAMP_COEFFICIENTS, JSON.stringify({ a: String(ex.a), b: String(ex.b) })).statut === "parse_error", "coefficients : sous-champ manquant → parse_error");
  verifier(v(ex, CHAMP_COEFFICIENTS, "pas du json").statut === "parse_error", "coefficients : JSON invalide → parse_error");
  const bonA = ex.a > 0 ? "+" : "-";
  const signeAB = ex.a * ex.b > 0 ? "+" : ex.a * ex.b < 0 ? "-" : "0";
  verifier(v(ex, CHAMP_ALLURE, JSON.stringify({ signeA: bonA === "+" ? "-" : "+", signeAB })).statut === "not_equivalent", "allure : faux → not_equivalent");
  verifier(v(ex, CHAMP_ALLURE, JSON.stringify({ signeA: bonA })).statut === "parse_error", "allure : un choix manque → parse_error");
  verifier(v(ex, CHAMP_ALLURE, JSON.stringify({ signeA: bonA, signeAB: "?" })).statut === "parse_error", "allure : id de choix inconnu → parse_error");
  verifier(v(ex, CHAMP_EXTREMUM, "max").statut === "not_equivalent" && v(ex, CHAMP_EXTREMUM, "inconnu").statut === "parse_error", "extremum : faux / inconnu");
  const axe = JSON.parse(reponseBruteCorrecte(U(ex), CHAMP_AXE));
  const sansPrefixe = v(ex, CHAMP_AXE, JSON.stringify({ ...axe, axeTexte: axe.xS }));
  verifier(sansPrefixe.statut === "parse_error" && sansPrefixe.codesCompetence.includes(CODE_AXE_NOTATION) && sansPrefixe.messageErreur.includes("$x"), "axe : valeur juste sans « x = » → parse_error + code, message avec balisage");
  verifier(verifierBalisageMath(sansPrefixe.statut === "parse_error" ? sansPrefixe.messageErreur : "").length === 0, "axe : le message d'erreur passe le contrôle de balisage");
  const faussePuisMalFormee = v(ex, CHAMP_AXE, JSON.stringify({ ...axe, axeTexte: "999" }));
  verifier(faussePuisMalFormee.statut === "parse_error" && faussePuisMalFormee.codesCompetence.length === 0, "axe : valeur fausse ET mal formatée → parse_error SANS code");
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ ...axe, axeTexte: `X = ${axe.xS}` })).statut === "parse_error", "axe : « X = » (majuscule) illisible");
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ ...axe, yS: String(Number(axe.yS.includes("/") ? 0 : axe.yS) + 1) })).statut !== "correct", "axe : yS décalé refusé");
  const fractions = (n: number, d: number) => `${n}/${d}`;
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ axeTexte: `x = ${fractions(Math.round(-ex.b * 2 / (2 * ex.a)) , 2)}`, xS: axe.xS, yS: axe.yS })).statut === "correct", "axe : fraction équivalente acceptée");
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ ...axe, xS: "", })).statut === "parse_error", "axe : xS vide → parse_error");
  const image = JSON.parse(reponseBruteCorrecte(U(ex), CHAMP_IMAGE));
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, crochetGauche: "]" })).statut === "not_equivalent", "image : mauvais crochet → not_equivalent");
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, borneDroite: "-inf" })).statut === "not_equivalent", "image : mauvais infini → not_equivalent");
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, borneGauche: "abc" })).statut === "parse_error", "image : borne illisible → parse_error");
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, borneGauche: "" })).statut === "parse_error", "image : borne vide → parse_error");
  verifier(v(ex, CHAMP_IMAGE, "[]").statut === "parse_error", "image : forme invalide → parse_error");
  verifier(v(ex, CHAMP_RACINES, "[]").statut === "not_equivalent", "racines : « aucune » n'est jamais correct ici");
  verifier(v(ex, CHAMP_RACINES, JSON.stringify(["99"])).statut === "not_equivalent", "racines : fausse → not_equivalent");
  verifier(v(ex, CHAMP_RACINES, JSON.stringify(["a"])).statut === "parse_error", "racines : illisible → parse_error");
  verifier(v(ex, CHAMP_RACINES, JSON.stringify(["", " "])).statut === "parse_error", "racines : valeurs vides → parse_error (≠ « aucune »)");
  verifier(v(ex3, CHAMP_RACINES, JSON.stringify([String(ex3.r1), String(ex3.r1)])).statut === "correct", "racines : racine double saisie deux fois (comparaison en ensemble)");
  const tableau = JSON.parse(reponseBruteCorrecte(U(ex), CHAMP_SIGNES_VARIATION));
  tableau.variation.c3 = "⌢";
  verifier(v(ex, CHAMP_SIGNES_VARIATION, JSON.stringify(tableau)).statut === "not_equivalent", "tableau : variation fausse (sommet ⌢ au lieu de ⌣) → not_equivalent");
  tableau.variation.c3 = "↗";
  verifier(v(ex, CHAMP_SIGNES_VARIATION, JSON.stringify(tableau)).statut === "parse_error", "tableau : ↗ n'existe pas sur la case du sommet (⌢ ⌣) → parse_error, jamais un essai raté");
  delete tableau.variation.c3;
  verifier(v(ex, CHAMP_SIGNES_VARIATION, JSON.stringify(tableau)).statut === "parse_error", "tableau : case manquante → parse_error");
  const sol = JSON.parse(reponseBruteCorrecte(U(ex), CHAMP_SIGNES_VARIATION));
  verifier(JSON.stringify(Object.keys(sol.variation)) === JSON.stringify(["c0", "c3", "c4"]), `tableau : variations FUSIONNÉES, clés d'ancrage c0 (c0-c2), c3 (sommet), c4 (c4-c6) : ${JSON.stringify(Object.keys(sol.variation))}`);
  verifier(sol.variation.c3 === "⌣" && sol.variation.c0 === "↘" && sol.variation.c4 === "↗", "tableau : sommet ⌣, flèches ↘ puis ↗ (a > 0)");
  const paire = (o: any, ligne: string, id: string, valeur: string) => JSON.stringify({ ...o, [ligne]: { ...o[ligne], [id]: valeur } });
  const juste = JSON.parse(reponseBruteCorrecte(U(ex), CHAMP_SIGNES_VARIATION));
  verifier(v(ex, CHAMP_SIGNES_VARIATION, JSON.stringify(juste)).statut === "correct", "tableau : réponse juste → correct");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, paire(juste, "signe", "c0", "0")).statut === "parse_error", "tableau : « 0 » sur une colonne d'INTERVALLE (2 valeurs) → parse_error");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, paire(juste, "signe", "c3", "0")).statut === "parse_error", "tableau : « 0 » sur le sommet, qui n'est pas une racine ici (2 valeurs) → parse_error");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, paire(juste, "signe", "c1", "∅")).statut === "parse_error", "tableau : « ∅ » hors d'un pôle de quotient → parse_error");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, paire(juste, "signe", "c2", "?")).statut === "parse_error", "tableau : « ? » n'est jamais une réponse (Valider reste désactivé côté client) → parse_error");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, paire(juste, "variation", "c1", "↘")).statut === "parse_error", "tableau : c1 est COUVERTE par la case fusionnée c0 : sa clé n'existe pas → parse_error");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, paire(juste, "fantome", "c0", "+")).statut === "parse_error", "tableau : ligne inconnue → parse_error");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, '{"signe":{"__proto__":"+"},"variation":{}}').statut === "parse_error", "tableau : clé « __proto__ » → parse_error");
  verifier(v(ex, CHAMP_SIGNES_VARIATION, JSON.stringify({ ...juste, signe: { ...juste.signe, constructor: "+" } })).statut === "parse_error", "tableau : clé « constructor » (case inconnue) → parse_error, jamais lue dans le prototype");
  // Quotient : quatre lignes empilées, « ∅ » au pôle uniquement, jamais « 0 » sur le pôle de la ligne finale.
  const quotient = JSON.parse(reponseBruteCorrecte(U(ex), CHAMP_QUOTIENT));
  const idPole = Object.entries(quotient.quotient).find(([, val]) => val === "∅")![0];
  verifier(v(ex, CHAMP_QUOTIENT, JSON.stringify(quotient)).statut === "correct", "quotient : réponse juste → correct");
  verifier(Object.values(quotient.quotient).filter((val) => val === "∅").length === 1 && Object.values(quotient.quotient).filter((val) => val === "0").length === 2, "quotient : un seul ∅ (le pôle) et deux 0 (les racines du numérateur)");
  verifier(v(ex, CHAMP_QUOTIENT, paire(quotient, "quotient", idPole, "0")).statut === "not_equivalent", "quotient : « 0 » au pôle au lieu de « ∅ » → not_equivalent (les deux existent, ils sont distincts)");
  verifier(v(ex, CHAMP_QUOTIENT, paire(quotient, "facteur1", idPole, "∅")).statut === "parse_error", "quotient : « ∅ » sur une ligne de FACTEUR → parse_error (seule la ligne finale l'offre)");
  verifier(Object.keys(sol.signe).length === 7 && Object.values(sol.signe).filter((s) => s === "0").length === 2, "tableau (7 colonnes) : exactement 2 zéros (les racines)");
  const sol3 = JSON.parse(reponseBruteCorrecte(U(ex3), CHAMP_SIGNES_VARIATION));
  verifier(Object.keys(sol3.signe).length === 3 && sol3.signe.c1 === "0" && sol3.signe.c0 === "+" && sol3.signe.c2 === "+", "tableau (3 colonnes) : racine double, + 0 +");

  // ── 4. validerAide : exactement 2 formes, validation stricte ──
  const formule = { type: "formule_coloree", segments: [{ latex: "f(x) = " }, { latex: "3", role: "a" }, { latex: "x^2" }] };
  const croquis = { type: "croquis_parabole", a: 1, b: -8, c: 16, marqueS: true, surlignageImf: false, marquesOx: true };
  verifier(validerAide(formule).length === 0, "formule_coloree valide acceptée");
  verifier(validerAide(croquis).length === 0 && validerAide({ type: "croquis_parabole", a: -2, b: 0, c: 0 }).length === 0, "croquis_parabole valide accepté (options facultatives)");
  const rejets: [string, unknown][] = [
    ["null", null], ["tableau", []], ["chaîne", "texte"], ["nombre", 3], ["sans type", {}], ["type inconnu", { type: "diagramme" }], ["type numérique", { type: 1 }],
    ["formule : clé inconnue", { ...formule, extra: 1 }], ["formule : segments absents", { type: "formule_coloree" }], ["formule : segments vides", { type: "formule_coloree", segments: [] }],
    ["formule : segments non tableau", { type: "formule_coloree", segments: "x" }],
    ["formule : trop de segments", { type: "formule_coloree", segments: Array.from({ length: NB_SEGMENTS_MAX + 1 }, () => ({ latex: "x" })) }],
    ["formule : segment non objet", { type: "formule_coloree", segments: ["x"] }], ["formule : segment tableau", { type: "formule_coloree", segments: [[]] }],
    ["formule : latex absent", { type: "formule_coloree", segments: [{}] }], ["formule : latex vide", { type: "formule_coloree", segments: [{ latex: "  " }] }],
    ["formule : latex non chaîne", { type: "formule_coloree", segments: [{ latex: 3 }] }],
    ["formule : latex trop long", { type: "formule_coloree", segments: [{ latex: "x".repeat(LONGUEUR_LATEX_MAX + 1) }] }],
    ["formule : $ dans latex", { type: "formule_coloree", segments: [{ latex: "$x$" }] }],
    ["formule : \\textcolor", { type: "formule_coloree", segments: [{ latex: "\\textcolor{red}{x}" }] }], ["formule : \\htmlClass", { type: "formule_coloree", segments: [{ latex: "\\htmlClass{x}{y}" }] }],
    ["formule : \\href", { type: "formule_coloree", segments: [{ latex: "\\href{http://x}{y}" }] }], ["formule : rôle inconnu", { type: "formule_coloree", segments: [{ latex: "x", role: "d" }] }],
    ["formule : rôle numérique", { type: "formule_coloree", segments: [{ latex: "x", role: 1 }] }], ["formule : clé de segment inconnue", { type: "formule_coloree", segments: [{ latex: "x", couleur: "red" }] }],
    ["croquis : clé inconnue", { ...croquis, extra: 1 }], ["croquis : a = 0", { ...croquis, a: 0 }], ["croquis : a décimal", { ...croquis, a: 1.5 }], ["croquis : a chaîne", { ...croquis, a: "1" }],
    ["croquis : b manquant", { type: "croquis_parabole", a: 1, c: 1 }], ["croquis : c NaN", { ...croquis, c: NaN }], ["croquis : c infini", { ...croquis, c: Infinity }], ["croquis : trop grand", { ...croquis, b: 10 ** 6 }],
    ["croquis : option non booléenne", { ...croquis, marqueS: "oui" }], ["croquis : option numérique", { ...croquis, marquesOx: 1 }],
  ];
  for (const [nom, aide] of rejets) verifier(validerAide(aide).length > 0, `validerAide doit rejeter : ${nom}`);
  verifier(aidePresente("texte") && aidePresente(croquis) && !aidePresente("") && !aidePresente(undefined) && !aidePresente(null), "aidePresente : chaîne non vide ou objet");

  // ── 6. Parcours par le vrai routeur ──
  imposerProfilAssignation("etendu"); // les exercices assignés ci-dessous ont le profil étendu
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  const tache = creerTache(s, { nom: "étendu", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }], aide_activee: true, aide_penalite_pourcent: 25, tentatives_supplementaires: 1, feedback_immediat: true, reponse_visible: true });
  const ok = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
  verifier(ok.statut === 201 && ok.corps.nombre_exercices_generes === 2, `assignation du témoin étendu : ${JSON.stringify(ok.corps)}`);
  const lignes = s.base.table("exercices_assignes").filter((l) => l.tache_id === tache);
  verifier(lignes.every((l) => JSON.stringify(l.champs_attendus) === JSON.stringify(CHAMPS) && l.variante_id === VARIANTE_TEMOIN), "champs_attendus = tous les champs dans l'ordre");
  const lg = lignes[0];
  const exReel = genE(Number(lg.graine));
  const get = await appeler(`exercices/${lg.id}`, "GET", { jeton: jetonEleve });
  verifier(get.statut === 200 && get.corps.ecrans.length === CHAMPS.length && get.corps.champ_courant === CHAMP_COEFFICIENTS, `GET exercice : ${get.statut}`);
  const attendueDisponible: Record<string, boolean> = { [CHAMP_COEFFICIENTS]: true, [CHAMP_ALLURE]: false, [CHAMP_EXTREMUM]: false, [CHAMP_AXE]: true, [CHAMP_IMAGE]: true, [CHAMP_RACINES]: true, [CHAMP_SIGNES_VARIATION]: true, [CHAMP_QUOTIENT]: false };
  verifier(get.corps.ecrans.every((e: any) => e.aide === undefined && e.aide_disponible === attendueDisponible[e.champ]), `aide jamais envoyée avec l'écran ; aide_disponible par écran (typée ou chaîne) : ${JSON.stringify(get.corps.ecrans.map((e: any) => [e.champ, e.aide_disponible, e.aide === undefined]))}`);
  verifier(!JSON.stringify(get.corps).includes('"segments"') && !JSON.stringify(get.corps).includes("croquis_parabole"), "aucune aide typée (ni ses données) dans GET /api/exercices/:id");
  const allure = get.corps.ecrans.find((e: any) => e.champ === CHAMP_ALLURE);
  verifier(allure.type === "champs_multiples" && allure.illustration.type === "croquis_allure" && allure.illustration.c === exReel.c && allure.champs.length === 2, "écran d'allure : champs_multiples avec illustration (c public)");
  const tab = get.corps.ecrans.find((e: any) => e.champ === CHAMP_SIGNES_VARIATION);
  verifier(tab.bornes === undefined && tab.lignes.length === 2 && tab.lignes[1].nature === "variation" && tab.colonnes.every((c: any, i: number) => c.genre === (i % 2 === 0 ? "intervalle" : "valeur")), "tableau étendu servi : colonnes alternées, ni bornes ni −∞/+∞");
  verifier(Array.isArray(tab.rangees) && tab.rangees.length === 2 && tab.rangees[0].cellules.length === tab.colonnes.length && tab.rangees[1].cellules.length === 3 && tab.rangees[1].cellules.every((c: any) => c.alphabet.length === 2), "tableau étendu servi : structure RÉSOLUE par le serveur (7 cases de signe, 3 cases de variation à 2 valeurs)");
  const tabQuotient = get.corps.ecrans.find((e: any) => e.champ === CHAMP_QUOTIENT);
  verifier(tabQuotient.rangees.length === 4 && tabQuotient.rangees[3].cellules.some((c: any) => c.alphabet.length === 4 && c.alphabet.includes("∅")) && tabQuotient.rangees[0].cellules.every((c: any) => !c.alphabet.includes("∅")), "quotient servi : 4 lignes empilées, un seul type de case à 4 valeurs (le pôle), sur la ligne finale");
  verifier(get.corps.ecrans.find((e: any) => e.champ === CHAMP_RACINES).permetAucune === true, "permetAucune servi");
  verifier(!JSON.stringify(get.corps.ecrans).includes(reponseBruteCorrecte(U(exReel), CHAMP_COEFFICIENTS)), "un écran semble contenir la solution des coefficients");

  const poster = (l: any, champ: string, brute: unknown) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: l.id, champ, reponse_brute: brute } });
  verifier((await poster(lg, CHAMP_COEFFICIENTS, { a: "1" })).statut === 400, "reponse_brute objet (état d'édition) : 400");
  verifier((await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_COEFFICIENTS, reponse_brute: "{}", champs: { a: "1" } } })).statut === 400, "clé hors contrat : 400");
  verifier(s.base.table("reponses").length === 0, "rien n'est enregistré avant une réponse confirmée valide");
  verifier((await poster(lg, CHAMP_ALLURE, JSON.stringify({}))).statut === 409, "champ hors ordre : 409");

  // Aide typée : servie APRÈS validation, usage enregistré côté serveur.
  const aideCoef = await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_COEFFICIENTS } });
  const aideDeclaree = temoin.ecrans(U(exReel)).find((e) => e.champ === CHAMP_COEFFICIENTS)!.aide;
  verifier(aideCoef.statut === 200 && JSON.stringify(aideCoef.corps.aide) === JSON.stringify(aideDeclaree) && aideCoef.corps.aide.type === "formule_coloree" && aideCoef.corps.penalite_pourcent === 25, `aide formule_coloree servie telle que déclarée : ${JSON.stringify(aideCoef.corps).slice(0, 160)}`);
  verifier(s.base.table("aides_utilisees").length === 1, "usage de l'aide typée enregistré côté serveur");
  await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_COEFFICIENTS } });
  verifier(s.base.table("aides_utilisees").length === 1, "aides_utilisees : une ligne par (exercice, champ)");
  verifier((await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_ALLURE } })).statut === 404, "écran sans aide : 404 (et rien d'enregistré)");
  verifier(s.base.table("aides_utilisees").length === 1, "écran sans aide : aucun usage enregistré");

  // Le parcours complet, en réponses justes.
  for (const champ of CHAMPS) {
    const r = await poster(lg, champ, reponseBruteCorrecte(U(exReel), champ));
    verifier(r.statut === 200 && r.corps.statut === "correct" && r.corps.verrouille === true, `${champ} : ${JSON.stringify(r.corps).slice(0, 200)}`);
  }
  const fin = await appeler(`exercices/${lg.id}`, "GET", { jeton: jetonEleve });
  verifier(fin.corps.exercice_termine === true && fin.corps.champs.every((c: any) => c.statut === "correct"), "exercice terminé, 7 champs corrects");
  const lg2 = lignes[1];
  const ex2 = genE(Number(lg2.graine));
  for (const champ of CHAMPS.slice(0, 3)) await poster(lg2, champ, reponseBruteCorrecte(U(ex2), champ));

  // Sous correction immédiate active : `message_erreur` servi ; il contient du balisage valide.
  const axeParse = await poster(lg2, CHAMP_AXE, JSON.stringify({ axeTexte: JSON.parse(reponseBruteCorrecte(U(ex2), CHAMP_AXE)).xS, xS: "1", yS: "1" }));
  verifier(axeParse.corps.statut === "parse_error" && typeof axeParse.corps.message_erreur === "string" && verifierBalisageMath(axeParse.corps.message_erreur).length === 0, `parse_error servi avec message balisé : ${JSON.stringify(axeParse.corps)}`);
  verifier(s.base.table("reponses").some((r) => r.champ === CHAMP_AXE && r.bug_detecte === CODE_AXE_NOTATION), "le code de compétence d'un parse_error est stocké dans bug_detecte");
  // Solution révélée (reponse_visible) : balisage valide.
  const faux = await poster(lg2, CHAMP_AXE, JSON.stringify({ axeTexte: "x = 999", xS: "999", yS: "999" }));
  verifier(faux.corps.statut === "not_equivalent" && faux.corps.verrouille === true && typeof faux.corps.solution_attendue === "string" && verifierBalisageMath(faux.corps.solution_attendue).length === 0 && faux.corps.solution_attendue.includes("$"), `solution servie avec balisage valide : ${JSON.stringify(faux.corps)}`);

  // ── 7. Aide invalide : ni servie ni comptée (générateur défectueux temporaire) ──
  const ecransInvalides = (e: ExerciceTemoin): EcranDeclare[] => temoin.ecrans(e).map((ecran) => (ecran.champ === CHAMP_COEFFICIENTS ? { ...ecran, aide: { type: "formule_coloree", segments: [{ latex: "\\textcolor{red}{3}" }] } } : ecran)) as EcranDeclare[];
  const defectueux: Generateur<ExerciceTemoin> = { ...temoin, variante_id: "_temoin_aide_invalide_v1", ecrans: ecransInvalides, etatActuel: (e, r) => temoin.etatActuel(e, r) };
  // `installerBase` purge le cache des modules de lib/ : on insère dans l'instance du registre UTILISÉE par le routeur.
  const registreCourant = require("../lib/registreGenerateurs");
  registreCourant.REGISTRE_GENERATEURS.push(defectueux);
  try {
    const tacheDef = creerTache(s, { nom: "aide défectueuse", variantes: [{ variante_id: "_temoin_aide_invalide_v1", nombre_exercices: 1 }], aide_activee: true, aide_penalite_pourcent: 50 });
    await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheDef, eleve_ids: ["eleve-1"] } });
    const ld = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheDef)!;
    const avant = s.base.table("aides_utilisees").length;
    const rd = await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: ld.id, champ: CHAMP_COEFFICIENTS } });
    verifier(rd.statut === 500 && String(rd.corps.detail).includes("textcolor"), `aide invalide : erreur bruyante nommant la commande interdite, obtenu ${rd.statut} ${JSON.stringify(rd.corps)}`);
    verifier(rd.corps.aide === undefined, "aide invalide : rien n'est servi");
    verifier(s.base.table("aides_utilisees").length === avant, "aide invalide : l'usage n'est PAS enregistré (l'élève ne paie pas un défaut du générateur)");
  } finally {
    registreCourant.REGISTRE_GENERATEURS.pop();
  }
  verifier(registreCourant.chercherGenerateur("_temoin_aide_invalide_v1") === null, "générateur défectueux retiré du registre");

}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
