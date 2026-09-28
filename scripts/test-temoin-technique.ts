// Test permanent — phase 2 : contrat de générateur, registre unique, dispatcher serveur, avec le
// générateur témoin technique (`_temoin_technique_v1`). Exécute le VRAI `api/router.ts` contre une
// base en mémoire (scripts/support/), sans réseau. Lancer : `npx tsx scripts/test-temoin-technique.ts`.

export {}; // module (évite les collisions de noms globaux entre scripts/*.ts)

import { readFileSync } from "node:fs";
import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { creerPrng } from "../lib/prng";
import { CHAMP_DIVISEURS, CHAMP_PARITE, CHAMP_SIGNES, CHAMP_SOMME, CODE_ERREUR_CALCUL, CODE_MAUVAIS_CHOIX, generateurTemoinTechnique as temoin, reponseBruteCorrecte, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

async function main() {
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
  const ex = temoin.generer(2024);
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
  verifier(chercherGenerateur("af_mise_en_evidence") === null, "gen7 ne doit pas encore être au registre (phase 3)");
  verifier(variantesCatalogueSansGenerateur().length === 4, `4 variantes gen7 cataloguées sans générateur attendues, obtenu ${variantesCatalogueSansGenerateur().length}`);
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
  const rejetGen7 = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheGen7, classe_id: s.classeId } });
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
  // 2e échec : tentatives épuisées => révélation forcée + code de compétence stocké.
  const r2 = await poster(CHAMP_SOMME, String(exercice.a - exercice.b));
  verifier(r2.corps.statut === "not_equivalent" && r2.corps.verrouille === true && r2.corps.revele === true && r2.corps.solution_attendue === String(exercice.a + exercice.b), `épuisement : ${JSON.stringify(r2.corps)}`);
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
  verifier(champSomme.revele === true && champSomme.solution_attendue === String(exercice.a + exercice.b), "tableau de bord : champ révélé avec sa solution");

  // Chrono : un champ déjà réussi reste réussi une fois le chrono écoulé ; un champ en cours est révélé.
  const tacheChrono = creerTache(s, { nom: "chrono", chrono_mode: "par_ecran", chrono_duree_secondes: 60, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
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
  verifier(rm.corps.statut === undefined && rm.corps.solution_attendue === undefined && rm.corps.message_erreur === undefined && rm.corps.verrouille === true && rm.corps.champ_courant === CHAMP_PARITE, `feedback désactivé : ni statut ni solution, champ verrouillé côté client : ${JSON.stringify(rm.corps)}`);
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

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nbVerifs}`);
    for (const e of echecs) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`OK : ${nbVerifs} vérifications (reproductibilité, 4 types d'écran × statuts, registre, assignation, réponses, aide, chrono, réglages, dates, tableau de bord)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
