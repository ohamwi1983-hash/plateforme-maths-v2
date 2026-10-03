// Test permanent — architecture « configuration par ligne de composition » (RAPPORT §55, docs/AUDIT-config-par-ligne-composition.md, décisions A à E), contre le VRAI
// `api/router.ts` et une base en mémoire. Un générateur de TEST à configuration est injecté au registre et au catalogue (scripts/support/generateurConfigurable.ts) : gen8
// n'existe pas encore. Lancer : `npm run test-configuration-ligne`. Sans réseau.

export {}; // module

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { appeler, creerScenario, installerBase } from "./support/harnaisRouteur";
import { injecterGenerateurConfigurable, VARIANTE_CONFIGURABLE } from "./support/generateurConfigurable";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const retirer = injecterGenerateurConfigurable();
  // Modules chargés APRÈS l'injection : mêmes instances que le routeur.
  const { canoniserConfigurationCases, validerConfigurationDeLigne, cleConfiguration, libelleConfiguration, MESSAGE_CONFIGURATION_VIDE } = require("../lib/configurationLigne");
  const { validerComposition } = require("../lib/validationCorpsTaches");
  const { chercherGenerateur } = require("../lib/registreGenerateurs");
  const { poidsDesChampsDeLigne } = require("../lib/poidsEcran");
  const { ecransDeLigne } = require("../lib/etatExercice");
  const g = chercherGenerateur(VARIANTE_CONFIGURABLE);
  const D = g.configuration;
  const GEN7 = "af_motif_racine_nulle_rationnelle";

  // ── 1. Forme canonique et validation d'une ligne (pur) ──
  const c = (brute: unknown) => canoniserConfigurationCases(D, brute);
  verifier(JSON.stringify(c({ actives: ["C", "A"] })) === JSON.stringify({ ok: true, configuration: { actives: ["A", "C"] } }), "canonique : ordre des cases du descripteur");
  verifier(JSON.stringify(c({ actives: ["A", "A", "B"] })) === JSON.stringify({ ok: true, configuration: { actives: ["A", "B"] } }), "canonique : doublons retirés");
  verifier(c({ actives: [] }).ok === false && c({ actives: [] }).erreur === MESSAGE_CONFIGURATION_VIDE, "configuration VIDE refusée (décision B) avec le message explicite");
  verifier(c({ actives: ["B", "C"] }).ok === false && /s'excluent/.test(c({ actives: ["B", "C"] }).erreur), "cases exclusives refusées ensemble");
  verifier(c({ actives: ["A", "B"] }).ok && c({ actives: ["A", "C"] }).ok, "une case de chaque groupe exclusif : admise");
  verifier(c({ actives: ["Z"] }).ok === false, "case inconnue refusée");
  for (const hostile of [null, undefined, 3, "A", [], { actives: "A" }, { actives: [1] }, { actives: ["A"], autre: 1 }, { autre: ["A"] }, { actives: ["__proto__"] }, { actives: ["constructor"] }, JSON.parse('{"__proto__":{"actives":["A"]}}')]) {
    verifier(c(hostile).ok === false, `entrée hostile refusée : ${JSON.stringify(hostile)}`);
  }
  verifier(validerConfigurationDeLigne(g, undefined).ok === false && validerConfigurationDeLigne(g, null).ok === false, "générateur configurable : configuration absente refusée (jamais de défaut)");
  verifier(JSON.stringify(validerConfigurationDeLigne(chercherGenerateur(GEN7), undefined)) === JSON.stringify({ ok: true, configuration: null }), "gen7 : sans configuration, acceptée (comportement inchangé)");
  verifier(validerConfigurationDeLigne(chercherGenerateur(GEN7), { actives: ["A"] }).ok === false, "gen7 : une configuration fournie est refusée");
  verifier(validerConfigurationDeLigne(null, { actives: ["A"] }).ok === false && validerConfigurationDeLigne(null, null).ok === true, "variante sans générateur : configuration refusée");
  verifier(cleConfiguration(null) === "" && cleConfiguration({ actives: ["A", "B"] }) === '["A","B"]', "clé de configuration");
  verifier(libelleConfiguration(D, { actives: ["A", "C"] }) === "Case A, Case C" && libelleConfiguration(D, null) === null && libelleConfiguration(undefined, { actives: ["A"] }) === null, "libellé de configuration");

  // Cases OBLIGATOIRES (RAPPORT §59) : refusées si absentes (jamais complétées), admises sinon, sans effet sur l'ordre canonique.
  {
    const DO = { type: "cases", libelle: "x", cases: [{ id: "A", libelle: "Case A" }, { id: "B", libelle: "Case B" }, { id: "C", libelle: "Case C" }], exclusifs: [["B", "C"]], obligatoires: ["A"] };
    const co = (brute: unknown) => canoniserConfigurationCases(DO, brute);
    verifier(co({ actives: ["B"] }).ok === false && /« Case A » est obligatoire/.test(co({ actives: ["B"] }).erreur), "case obligatoire absente : refusée, l'erreur la nomme");
    verifier(JSON.stringify(co({ actives: ["A"] })) === JSON.stringify({ ok: true, configuration: { actives: ["A"] } }), "la case obligatoire seule : admise");
    verifier(JSON.stringify(co({ actives: ["C", "A"] })) === JSON.stringify({ ok: true, configuration: { actives: ["A", "C"] } }), "obligatoire + autre : ordre canonique conservé");
    verifier(co({ actives: [] }).erreur === MESSAGE_CONFIGURATION_VIDE, "configuration vide : le message de la ligne vide (inchangé)");
    verifier(co({ actives: ["A", "B", "C"] }).ok === false && /s'excluent/.test(co({ actives: ["A", "B", "C"] }).erreur), "les exclusifs restent contrôlés");
    // Cohérence du registre : une case obligatoire connue et hors de tout groupe exclusif.
    const { verifierCoherenceRegistre } = require("../lib/registreGenerateurs");
    const faux = (configuration: unknown) => ({ ...g, variante_id: "faux_gen", configuration });
    const erreurs = (configuration: unknown) => verifierCoherenceRegistre([faux(configuration)], [{ generateur_id: g.generateur_id, variante_id: "faux_gen" }], {}).filter((e: string) => /obligatoire/.test(e));
    verifier(erreurs(DO).length === 0, "(sanité) descripteur obligatoire sain : aucune erreur de case obligatoire");
    verifier(erreurs({ ...DO, obligatoires: ["Z"] }).some((e: string) => /absente de/.test(e)), "case obligatoire inconnue : incohérence signalée");
    verifier(erreurs({ ...DO, obligatoires: ["B"] }).some((e: string) => /groupe exclusif/.test(e)), "case obligatoire dans un groupe exclusif : incohérence signalée");
  }

  // ── 2. validerComposition : lignes à 0, fusion des doublons (décisions C et E), refus (B, D) ──
  const L = (configuration: unknown, nombre = 1, chrono?: number) => ({ variante_id: VARIANTE_CONFIGURABLE, nombre_exercices: nombre, ...(chrono === undefined ? {} : { chrono_duree_secondes: chrono }), configuration });
  const ok = (compo: unknown[], mode: "aucun" | "par_ecran" | "global" = "aucun") => validerComposition(compo, mode);
  verifier(ok([L({ actives: [] })]).ok === false && /Variante configurable \(test\)/.test(ok([L({ actives: [] })]).erreur), "ligne vide refusée, l'erreur nomme la ligne");
  verifier(ok([L(undefined)]).ok === false, "ligne sans configuration refusée (une nouvelle ligne naît vide)");
  verifier(ok([L({ actives: [] }, 0), L({ actives: ["A"] })]).ok === true && ok([L({ actives: [] }, 0), L({ actives: ["A"] })]).composition.length === 1, "une ligne à 0 exercice est ignorée, même vide");
  verifier(JSON.stringify(ok([L({ actives: ["A"] }, 2), L({ actives: ["A"] }, 3)]).composition.map((l: any) => l.nombre_exercices)) === "[5]", "doublons exacts fusionnés : nombres additionnés");
  verifier(ok([L({ actives: ["C", "A"] }, 1), L({ actives: ["A", "C", "A"] }, 4)]).composition.length === 1 && ok([L({ actives: ["C", "A"] }, 1), L({ actives: ["A", "C", "A"] }, 4)]).composition[0].nombre_exercices === 5, "fusion sur la configuration CANONIQUE (ordre et doublons ignorés)");
  verifier(ok([L({ actives: ["A"] }), L({ actives: ["B"] })]).composition.length === 2, "configurations différentes : deux lignes");
  verifier(ok([L({ actives: ["A"] }, 1, 30), L({ actives: ["A"] }, 1, 60)], "par_ecran").composition.length === 2, "même configuration, durées différentes en par_ecran : lignes DISTINCTES (décision C)");
  verifier(ok([L({ actives: ["A"] }, 1, 30), L({ actives: ["A"] }, 1, 30)], "par_ecran").composition.length === 1, "même configuration, même durée en par_ecran : fusion");
  verifier(ok([L({ actives: ["A"] }, 1, 30), L({ actives: ["A"] }, 1, 60)], "global").composition.length === 1 && ok([L({ actives: ["A"] }, 1, 30), L({ actives: ["A"] }, 1)], "aucun").composition.length === 1, "hors par_ecran la durée est sans effet : fusion (décision E), jamais de rejet");
  verifier(ok([L({ actives: ["A"] }, 1, 30), L({ actives: ["A"] }, 1)], "par_ecran").composition.length === 2, "par_ecran : avec durée et sans durée sont distinctes");
  verifier(JSON.stringify(ok([L({ actives: ["B"] }), L({ actives: ["A"] }), L({ actives: ["B"] }, 2)]).composition.map((l: any) => l.configuration.actives.join() + ":" + l.nombre_exercices)) === '["B:3","A:1"]', "ordre de la première occurrence conservé");
  verifier(ok([{ variante_id: GEN7, nombre_exercices: 1 }, { variante_id: GEN7, nombre_exercices: 2 }]).composition.length === 1 && ok([{ variante_id: GEN7, nombre_exercices: 1 }, { variante_id: GEN7, nombre_exercices: 2 }]).composition[0].nombre_exercices === 3, "gen7 : deux lignes identiques fusionnées aussi (une seule ligne par variante, comportement conforme à l'interface actuelle)");
  verifier(!("configuration" in ok([{ variante_id: GEN7, nombre_exercices: 1 }]).composition[0]), "gen7 : aucune clé configuration sur la ligne");
  verifier(ok([{ variante_id: GEN7, nombre_exercices: 1, configuration: { actives: ["A"] } }]).ok === false, "gen7 avec configuration : refusé");

  // Un générateur dont la configuration ne produirait AUCUN écran est refusé (sinon champs_attendus = [] : « complet » d'emblée).
  const vide = { ...g, variante_id: "_test_vide_v1", ecrans: () => [] };
  const reg = require("../lib/registreGenerateurs").REGISTRE_GENERATEURS as any[];
  const cat = require("../lib/catalogueGenerateurs").CATALOGUE_GENERATEURS as any[];
  reg.push(vide);
  cat.push({ generateur_id: "gTest", variante_id: "_test_vide_v1", label: "Sans écran (test)" });
  const sansEcran = validerComposition([{ variante_id: "_test_vide_v1", nombre_exercices: 1, configuration: { actives: ["A"] } }]);
  verifier(sansEcran.ok === false && /aucun écran/.test(sansEcran.erreur), "configuration qui ne produit aucun écran : refusée");
  reg.splice(reg.indexOf(vide), 1);
  cat.splice(cat.length - 1, 1);

  // ── 3. Routes d'écriture : POST / PATCH / GET / aperçu ──
  const jeton = `prof:${s.profId}`;
  const ligneAB = { variante_id: VARIANTE_CONFIGURABLE, nombre_exercices: 2, configuration: { actives: ["B", "A"] } };
  const ligneAC = { variante_id: VARIANTE_CONFIGURABLE, nombre_exercices: 1, configuration: { actives: ["C"] } };
  const cree = await appeler("taches", "POST", { jeton, corps: { nom: "Config", composition: [ligneAB, ligneAC, { variante_id: GEN7, nombre_exercices: 1 }] } });
  verifier(cree.statut === 201, `POST avec configurations : ${cree.statut} ${JSON.stringify(cree.corps)}`);
  const tacheId = cree.corps.id as string;
  const lignesBase = () => s.base.table("taches_composition").filter((l) => l.tache_id === tacheId);
  verifier(lignesBase().length === 3, "trois lignes écrites");
  verifier(JSON.stringify(lignesBase()[0]!.configuration) === '{"actives":["A","B"]}', "configuration stockée sous sa forme CANONIQUE");
  verifier(lignesBase()[2]!.configuration === null, "ligne gen7 : configuration null");
  const nTachesAvant = s.base.table("taches").length;
  const refusee = await appeler("taches", "POST", { jeton, corps: { nom: "Vide", composition: [{ variante_id: VARIANTE_CONFIGURABLE, nombre_exercices: 1, configuration: { actives: [] } }] } });
  verifier(refusee.statut === 400 && /au moins une case/i.test(refusee.corps.erreur), `POST configuration vide : 400 explicite (${refusee.statut} ${refusee.corps?.erreur})`);
  verifier(s.base.table("taches").length === nTachesAvant && s.base.table("taches_composition").length === 3, "le POST refusé n'a RIEN écrit (aucune tâche orpheline)");
  const refuseeSans = await appeler("taches", "POST", { jeton, corps: { nom: "Sans", composition: [{ variante_id: VARIANTE_CONFIGURABLE, nombre_exercices: 1 }] } });
  verifier(refuseeSans.statut === 400, "POST ligne configurable sans configuration : 400");
  const refuseeForme = await appeler("taches", "POST", { jeton, corps: { nom: "Forme", composition: [{ variante_id: VARIANTE_CONFIGURABLE, nombre_exercices: 1, configuration: "A" }] } });
  verifier(refuseeForme.statut === 400, "POST configuration de mauvaise forme : 400");
  const fusion = await appeler("taches", "POST", { jeton, corps: { nom: "Fusion", composition: [ligneAB, { ...ligneAB, nombre_exercices: 3, configuration: { actives: ["A", "B"] } }] } });
  verifier(fusion.statut === 201 && s.base.table("taches_composition").filter((l) => l.tache_id === fusion.corps.id).length === 1 && s.base.table("taches_composition").find((l) => l.tache_id === fusion.corps.id)!.nombre_exercices === 5, "POST : doublons fusionnés à l'écriture (2 + 3)");
  const dureesDistinctes = await appeler("taches", "POST", { jeton, corps: { nom: "Durées", chrono_mode: "par_ecran", chrono_duree_secondes: 90, composition: [{ ...ligneAB, chrono_duree_secondes: 30 }, { ...ligneAB, chrono_duree_secondes: 60 }] } });
  verifier(dureesDistinctes.statut === 201 && s.base.table("taches_composition").filter((l) => l.tache_id === dureesDistinctes.corps.id).length === 2, "POST : mêmes cases, durées différentes en par_ecran : deux lignes");

  const liste = await appeler("taches", "GET", { jeton });
  const tacheListee = (liste.corps.taches ?? liste.corps).find((t: any) => t.id === tacheId);
  verifier(tacheListee.composition.length === 3 && JSON.stringify(tacheListee.composition[0].configuration) === '{"actives":["A","B"]}' && typeof tacheListee.composition[0].id === "string" && tacheListee.composition[2].configuration === null, "GET /api/taches renvoie id et configuration de chaque ligne (Modifier / Dupliquer)");

  const patch = await appeler(`taches/${tacheId}`, "PATCH", { jeton, corps: { nom: "Config", composition: [{ ...ligneAB, configuration: { actives: ["A"] } }] } });
  verifier(patch.statut === 200 && lignesBase().length === 1 && JSON.stringify(lignesBase()[0]!.configuration) === '{"actives":["A"]}', `PATCH remplace la composition et la configuration (${patch.statut})`);
  const patchVide = await appeler(`taches/${tacheId}`, "PATCH", { jeton, corps: { nom: "Config", composition: [{ ...ligneAB, configuration: { actives: [] } }] } });
  verifier(patchVide.statut === 400 && lignesBase().length === 1 && JSON.stringify(lignesBase()[0]!.configuration) === '{"actives":["A"]}', "PATCH configuration vide : 400 et la composition précédente est intacte");

  // Aperçu : lignes liées + configuration figée sur les exercices du fantôme.
  const apercu = await appeler("taches/apercu", "POST", { jeton, corps: { nom: "Aperçu", composition: [ligneAB, ligneAC] } });
  verifier(apercu.statut === 200 || apercu.statut === 201, `aperçu avec configurations : ${apercu.statut} ${JSON.stringify(apercu.corps).slice(0, 200)}`);
  const tacheApercu = s.base.table("taches").find((t) => t.est_apercu === true)!;
  const exApercu = s.base.table("exercices_assignes").filter((e) => e.tache_id === tacheApercu.id);
  const lignesApercu = s.base.table("taches_composition").filter((l) => l.tache_id === tacheApercu.id);
  verifier(exApercu.length === 3 && lignesApercu.length === 2, "aperçu : 3 exercices, 2 lignes");
  verifier(exApercu.every((e) => typeof e.composition_id === "string" && lignesApercu.some((l) => l.id === e.composition_id)), "aperçu : chaque exercice référence sa ligne de composition");
  verifier(exApercu.filter((e) => e.composition_id === lignesApercu[0]!.id).length === 2 && JSON.stringify(exApercu[0]!.configuration) === '{"actives":["A","B"]}', "aperçu : configuration copiée sur l'exercice, 2 exercices pour la 1re ligne");
  verifier(JSON.stringify(exApercu[0]!.champs_attendus) === '["case_A","case_B"]' && JSON.stringify(exApercu[2]!.champs_attendus) === '["case_C"]', "aperçu : champs_attendus suivent la configuration (la liste d'écrans en dépend)");
  const apercu2 = await appeler("taches/apercu", "POST", { jeton, corps: { nom: "Aperçu 2", composition: [ligneAB, ligneAC] } });
  verifier(apercu2.statut === 200 || apercu2.statut === 201, `2e aperçu consécutif (suppression des exercices avant les lignes de composition) : ${apercu2.statut}`);

  // ── 4. Assignation : configuration FIGÉE, identité de ligne, deux lignes de même variante ──
  const deux = await appeler("taches", "POST", { jeton, corps: { nom: "Deux lignes", chrono_mode: "par_ecran", composition: [{ ...ligneAB, nombre_exercices: 1, chrono_duree_secondes: 30 }, { ...ligneAB, nombre_exercices: 1, configuration: { actives: ["C"] }, chrono_duree_secondes: 75 }] } });
  verifier(deux.statut === 201, `tâche à deux lignes de même variante : ${deux.statut} ${JSON.stringify(deux.corps)}`);
  const idDeux = deux.corps.id as string;
  const assign = await appeler("assignations", "POST", { jeton, corps: { tache_id: idDeux, eleve_ids: ["eleve-1"] } });
  verifier(assign.statut === 201 && assign.corps.nombre_exercices_generes === 2, `assignation : ${assign.statut} ${JSON.stringify(assign.corps)}`);
  const exercices = s.base.table("exercices_assignes").filter((e) => e.tache_id === idDeux);
  const lignesDeux = s.base.table("taches_composition").filter((l) => l.tache_id === idDeux);
  const exAB = exercices.find((e) => e.composition_id === lignesDeux[0]!.id)!;
  const exC = exercices.find((e) => e.composition_id === lignesDeux[1]!.id)!;
  verifier(exAB !== undefined && exC !== undefined && exAB.id !== exC.id, "chaque exercice porte l'identité de SA ligne (même variante, deux lignes)");
  verifier(JSON.stringify(exAB.configuration) === '{"actives":["A","B"]}' && JSON.stringify(exC.configuration) === '{"actives":["C"]}', "configuration copiée (figée) sur chaque exercice");
  verifier(JSON.stringify(exAB.champs_attendus) === '["case_A","case_B"]' && JSON.stringify(exC.champs_attendus) === '["case_C"]', "champs_attendus de chaque exercice suivent sa configuration");

  // Immuabilité : modifier la ligne de composition APRÈS assignation ne change pas ce que voit l'élève.
  lignesDeux[0]!.configuration = { actives: ["A", "B", "C"] };
  const vue = await appeler(`exercices/${exAB.id}`, "GET", { jeton: "eleve:eleve-1" });
  verifier(vue.statut === 200 && JSON.stringify(vue.corps.ecrans.map((e: any) => e.champ)) === '["case_A","case_B"]', `l'élève voit la configuration FIGÉE, pas la ligne modifiée (${JSON.stringify(vue.corps.ecrans?.map((e: any) => e.champ))})`);
  lignesDeux[0]!.configuration = { actives: ["A", "B"] };
  const vueC = await appeler(`exercices/${exC.id}`, "GET", { jeton: "eleve:eleve-1" });
  verifier(vueC.statut === 200 && JSON.stringify(vueC.corps.ecrans.map((e: any) => e.champ)) === '["case_C"]', "l'autre exercice (configuration C) : son seul écran");

  // Poids et écrans régénérés depuis la ligne d'exercice (jamais depuis la graine seule).
  const poids = poidsDesChampsDeLigne(exAB);
  verifier(poids.get("case_A") === 1 && poids.get("case_B") === 2, "poids : suivent la configuration de l'exercice");
  verifier(poidsDesChampsDeLigne({ ...exAB, configuration: { actives: ["C"] } }).get("case_C") === 1 && poidsDesChampsDeLigne({ ...exAB, configuration: { actives: ["C"] } }).has("case_A") === false, "poids : une autre configuration donne d'autres écrans (c'est pourquoi la colonne est obligatoire au type)");
  verifier(JSON.stringify(ecransDeLigne(exAB)!.map((e: any) => e.champ)) === '["case_A","case_B"]', "ecransDeLigne suit la configuration");
  verifier(ecransDeLigne({ ...exAB, configuration: null }) === null && poidsDesChampsDeLigne({ ...exAB, configuration: null }).size === 0, "configuration figée absente pour un générateur qui l'exige : ligne non exécutable (jamais un défaut)");
  verifier((await appeler(`exercices/${exAB.id}`, "GET", { jeton: "eleve:eleve-1" })).statut === 200, "(sanité) exercice exécutable");
  const sauve = exAB.configuration;
  exAB.configuration = null;
  verifier((await appeler(`exercices/${exAB.id}`, "GET", { jeton: "eleve:eleve-1" })).statut === 409, "GET d'un exercice sans configuration figée : 409, pas d'exécution avec un défaut");
  exAB.configuration = sauve;

  // Chrono PAR LIGNE : deux lignes de même variante, deux durées.
  const d1 = await appeler("reponses/debut-ecran", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: exAB.id, champ: "case_A" } });
  const d2 = await appeler("reponses/debut-ecran", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: exC.id, champ: "case_C" } });
  verifier(d1.statut === 200 && d2.statut === 200 && d1.corps.secondes_restantes <= 30 && d1.corps.secondes_restantes > 25 && d2.corps.secondes_restantes <= 75 && d2.corps.secondes_restantes > 70, `chrono résolu PAR LIGNE (30 s et 75 s pour la même variante) : ${d1.corps.secondes_restantes} / ${d2.corps.secondes_restantes}`);
  const vueChrono = await appeler(`exercices/${exC.id}`, "GET", { jeton: "eleve:eleve-1" });
  verifier(vueChrono.corps.tache.chrono_duree_secondes === 75, "GET exercice : durée de la ligne (75)");

  // Ligne historique (sans composition_id) : ancienne règle « première valeur non nulle » inchangée.
  const histo = await appeler("taches", "POST", { jeton, corps: { nom: "Histo", chrono_mode: "par_ecran", composition: [{ variante_id: GEN7, nombre_exercices: 1, chrono_duree_secondes: 40 }] } });
  const aHisto = await appeler("assignations", "POST", { jeton, corps: { tache_id: histo.corps.id, eleve_ids: ["eleve-1"] } });
  const exHisto = s.base.table("exercices_assignes").find((e) => e.tache_id === histo.corps.id)!;
  verifier(aHisto.statut === 201 && typeof exHisto.composition_id === "string" && exHisto.configuration === null, "gen7 assigné : composition_id posé, configuration null");
  exHisto.composition_id = null; // exercice HISTORIQUE
  const dh = await appeler("reponses/debut-ecran", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: exHisto.id, champ: "coefficients" } });
  verifier(dh.statut === 200 && dh.corps.secondes_restantes <= 40 && dh.corps.secondes_restantes > 35, `exercice historique (sans composition_id) : résolution d'origine par variante (${dh.corps.secondes_restantes})`);

  // Assignation : configuration corrompue hors API -> 409 explicite, aucun exercice écrit.
  const corrompue = await appeler("taches", "POST", { jeton, corps: { nom: "Corrompue", composition: [ligneAB] } });
  s.base.table("taches_composition").find((l) => l.tache_id === corrompue.corps.id)!.configuration = { actives: [] };
  const aCorr = await appeler("assignations", "POST", { jeton, corps: { tache_id: corrompue.corps.id, eleve_ids: ["eleve-1"] } });
  verifier(aCorr.statut === 409 && /Configuration invalide/.test(aCorr.corps.erreur) && s.base.table("exercices_assignes").every((e) => e.tache_id !== corrompue.corps.id), `assignation d'une configuration vide forcée en base : 409 et rien d'écrit (${aCorr.statut})`);

  // Résultats professeur : identité de ligne et configuration exposées.
  const rep = await appeler("profs/resultats", "GET", { jeton, query: { classe_id: s.classeId } });
  const exRes = (rep.corps.eleves ?? []).flatMap((e: any) => e.exercices).filter((e: any) => e.tache_id === idDeux);
  verifier(rep.statut === 200 && exRes.length === 2 && exRes.every((e: any) => typeof e.composition_id === "string") && JSON.stringify(exRes.map((e: any) => e.configuration?.actives?.join("")).sort()) === '["AB","C"]', `profs/resultats : composition_id + configuration par exercice (${rep.statut} ${JSON.stringify(exRes.map((e: any) => [e.composition_id, e.configuration])).slice(0, 200)})`);

  // Catalogue : le descripteur est servi pour le générateur configurable, absent pour gen7.
  const cata = await appeler("catalogue-generateurs", "GET", { jeton });
  const entreeConf = cata.corps.find((e: any) => e.variante_id === VARIANTE_CONFIGURABLE);
  verifier(entreeConf?.configuration?.type === "cases" && entreeConf.configuration.cases.length === 3 && !("configuration" in cata.corps.find((e: any) => e.variante_id === GEN7)), "GET /api/catalogue-generateurs : descripteur pour le générateur configurable, rien pour gen7");

  retirer();

  // ── 5. Gardes statiques ──
  // (a) `generer` n'est appelé que par `genererPourLigne` en production.
  const racine = join(__dirname, "..");
  const fichiers: string[] = [];
  const parcourir = (d: string) => {
    for (const nom of readdirSync(d)) {
      const chemin = join(d, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (chemin.endsWith(".ts")) fichiers.push(chemin);
    }
  };
  for (const dossier of ["lib", "api"]) parcourir(join(racine, dossier));
  const appelants = fichiers.filter((f) => /\.generer\(/.test(readFileSync(f, "utf8")) && !f.endsWith("lib/genererPourLigne.ts"));
  verifier(appelants.length === 0, `genererPourLigne est le SEUL appelant de Generateur.generer en production (autres : ${appelants.join(", ")})`);
  // (b) discipline de migration : colonnes dans schema.sql ET cumulatif.sql.
  const schema = readFileSync(join(racine, "supabase/schema.sql"), "utf8");
  const cumulatif = readFileSync(join(racine, "supabase/migrations/cumulatif.sql"), "utf8");
  verifier(/create table taches_composition \([\s\S]*?configuration jsonb\s*\);/.test(schema), "schema.sql : taches_composition.configuration jsonb");
  verifier(/create table exercices_assignes \([\s\S]*?composition_id uuid references taches_composition\(id\) on delete set null,\s*configuration jsonb\s*\);/.test(schema), "schema.sql : exercices_assignes.composition_id + configuration");
  verifier(/alter table taches_composition add column if not exists configuration jsonb;/.test(cumulatif), "cumulatif.sql : taches_composition.configuration (idempotent)");
  verifier(/alter table exercices_assignes add column if not exists composition_id uuid references taches_composition\(id\) on delete set null;/.test(cumulatif), "cumulatif.sql : exercices_assignes.composition_id (idempotent)");
  verifier(/alter table exercices_assignes add column if not exists configuration jsonb;/.test(cumulatif), "cumulatif.sql : exercices_assignes.configuration (idempotent)");

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (configuration par ligne : canonique, refus, fusion, routes, aperçu, assignation figée, chrono par ligne, résultats, gardes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
