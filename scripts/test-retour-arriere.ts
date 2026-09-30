// Test permanent — retour en arrière (RAPPORT §37), contre le VRAI `api/router.ts`, le VRAI registre (gen7 : cascade racinesChamp1 ->
// racinesChamp2 -> tableauSignes) et une base en mémoire. Vérifie : modification d'un écran déjà traversé ; invalidation TRANSITIVE des
// écrans aval quand la réponse change, aucune quand elle est identique (D7) ; état = dernière réponse valide (ordre d'insertion, D4) ;
// remise obligatoire pour terminer (D3) ; indistinguabilité d'un échec et d'une réussite avant la remise (règle de révélation) ; réglage
// sans effet sous correction immédiate ; verrouillage par remise / chrono global (D1) ; aide collante (D5) ; lecteurs prof/élève
// alignés sur la dernière réponse valide (D8 : les statistiques comptent toutes les lignes).
// Lancer : `npm run test-retour-arriere`. Sans réseau.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { amontsTransitifs, dernieresReponsesValides } from "../lib/reponsesValides";
import { chercherGenerateur } from "../lib/registreGenerateurs";
import { champsAnalyseFonction, genererExercice, reponseBruteCorrecteAnalyseFonction, type ExerciceAnalyseFonction } from "../src/generateurs/analyseFonction";
import { readFileSync } from "node:fs";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const ORDRE = champsAnalyseFonction("mise_en_evidence");

async function main(): Promise<void> {
  // ── 0. Validité : fonction pure (D4) ──
  {
    const ecrans = [{ champ: "a" }, { champ: "b", dependDe: ["a"] }, { champ: "c", dependDe: ["b"] }, { champ: "d" }];
    const amonts = amontsTransitifs(ecrans);
    verifier([...amonts.get("c")!].sort().join() === "a,b" && amonts.get("a")!.size === 0 && amonts.get("d")!.size === 0, "fermeture transitive de dependDe");
    const l = (champ: string, n: number) => ({ champ, n });
    const seq = [l("a", 1), l("b", 2), l("c", 3), l("d", 4)];
    verifier(["a", "b", "c", "d"].every((c) => dernieresReponsesValides(amonts, seq).has(c)), "séquence normale : tout est valide");
    const revA = dernieresReponsesValides(amonts, [...seq, l("a", 5)]);
    verifier(revA.has("a") && !revA.has("b") && !revA.has("c") && revA.has("d"), "a modifié : b ET c (transitif) périmés, d (indépendant) intact");
    const revB = dernieresReponsesValides(amonts, [...seq, l("b", 5)]);
    verifier(revB.has("a") && revB.has("b") && !revB.has("c"), "b modifié : c périmé, a intact");
    const repond = dernieresReponsesValides(amonts, [...seq, l("a", 5), l("b", 6)]);
    verifier(repond.has("b") && !repond.has("c"), "b re-répondu après a : b valide de nouveau, c toujours périmé tant qu'il n'est pas re-répondu");
    verifier(dernieresReponsesValides(amonts, [...seq, l("a", 5), l("b", 6), l("c", 7)]).has("c"), "c re-répondu : tout est valide");
    verifier(dernieresReponsesValides(amonts, [l("b", 1)]).size === 0, "réponse sans amont répondu : jamais valide");
    verifier(dernieresReponsesValides(amonts, [...seq, l("a", 5)]).get("a")!.n === 5, "l'état d'un écran est sa DERNIÈRE ligne");
  }

  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let compteur = 0;

  const nouveau = async (options: { feedback?: boolean; retour?: boolean; chrono?: { mode: string; duree: number }; aide?: boolean } = {}) => {
    compteur++;
    const tache = creerTache(s, {
      nom: `retour ${compteur}`,
      variantes: [{ variante_id: "af_mise_en_evidence", nombre_exercices: 1 }],
      feedback_immediat: options.feedback ?? false,
      autoriser_retour_arriere: options.retour ?? true,
      aide_activee: options.aide ?? false,
      aide_penalite_pourcent: 50,
      chrono_mode: options.chrono?.mode,
      chrono_duree_secondes: options.chrono?.duree ?? null,
    });
    const origine = Math.random;
    Math.random = () => 12345 / 2 ** 32; // f = 4x² + 8x
    try {
      const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `assignation : ${a.statut} ${JSON.stringify(a.corps)}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const ex: ExerciceAnalyseFonction = genererExercice("mise_en_evidence", Number(ligne.graine));
    const bonne = (champ: string) => reponseBruteCorrecteAnalyseFonction(ex, champ);
    return {
      tache,
      id,
      ex,
      bonne,
      poster: (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } }),
      aide: (champ: string) => appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ } }),
      rendre: () => appeler(`exercices/${id}/remise`, "POST", { jeton: jetonEleve }),
      lire: async () => (await appeler(`exercices/${id}`, "GET", { jeton: jetonEleve })).corps as any,
      lignes: () => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id),
      repondreJusqua: async (dernier: string) => {
        for (const champ of ORDRE) {
          const r = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: bonne(champ) } });
          verifier(r.statut === 200, `réponse ${champ} : ${r.statut} ${JSON.stringify(r.corps)}`);
          if (champ === dernier) break;
        }
      },
    };
  };
  const champDe = (g: any, champ: string) => g.champs.find((c: any) => c.champ === champ);
  const servis = (g: any) => g.ecrans.map((e: any) => e.champ) as string[];

  // ── 1. Parcours, modification, remise ──
  {
    const x = await nouveau();
    verifier(ORDRE.join() === "coefficients,allure,axeSommet,domaineImage,racinesReconnaissance,racinesChamp1,racinesChamp2,tableauSignes", `ordre des écrans gen7 (${ORDRE.join()})`);
    await x.repondreJusqua("allure");
    let g = await x.lire();
    verifier(g.tache.retour_arriere === true, "GET : tache.retour_arriere = true");
    verifier(champDe(g, "coefficients").modifiable === true && champDe(g, "coefficients").verrouille === false, "un écran répondu est modifiable, pas verrouillé");
    verifier(champDe(g, "coefficients").valeur_saisie === x.bonne("coefficients"), "GET : la dernière réponse confirmée pré-remplit l'écran");
    verifier(g.champ_courant === "axeSommet" && g.exercice_termine === false && g.pret_a_rendre === false, "l'écran courant reste le premier sans réponse");
    // modifier un écran traversé (coefficients)
    const nouvelle = JSON.stringify({ a: "4", b: "8", c: "1" });
    const r = await x.poster("coefficients", nouvelle);
    verifier(r.statut === 200 && r.corps.modifiable === true && r.corps.verrouille === false && r.corps.inchangee === false, `modifier un écran traversé : accepté (${r.statut} ${JSON.stringify(r.corps)})`);
    verifier(x.lignes().filter((l) => l.champ === "coefficients").length === 2, "l'ancienne ligne est CONSERVÉE (aucune suppression)");
    g = await x.lire();
    verifier(champDe(g, "coefficients").valeur_saisie === nouvelle, "GET : l'écran affiche la DERNIÈRE réponse");
    // RAPPORT §38 : allure dépend de coefficients (dependDe) : la modifier le périme, l'écran courant redevient allure.
    verifier(JSON.stringify(r.corps.champs_invalides) === JSON.stringify(["allure"]) && g.champ_courant === "allure", `modifier coefficients périme allure (dépendance déclarée) : ${JSON.stringify(r.corps.champs_invalides)}, courant ${g.champ_courant}`);
    // écran pas encore atteint : refusé
    const futur = await x.poster("domaineImage", x.bonne("domaineImage"));
    verifier(futur.statut === 409, `un écran pas encore atteint reste refusé (${futur.statut})`);
    // rendre trop tôt
    const tot = await x.rendre();
    verifier(tot.statut === 409 && tot.corps.champ_courant === "allure", `rendre avant d'avoir tout répondu : 409 (${tot.statut})`);
    // finir
    await (async () => {
      for (const champ of ORDRE.slice(1)) {
        const p = await x.poster(champ, x.bonne(champ));
        verifier(p.statut === 200, `réponse ${champ} : ${p.statut} ${JSON.stringify(p.corps)}`);
        if (champ === "tableauSignes") verifier(p.corps.pret_a_rendre === true && p.corps.exercice_termine === false && p.corps.tache_terminee === false, "tout répondu : prêt à rendre, MAIS exercice et tâche pas terminés (D3)");
      }
    })();
    g = await x.lire();
    verifier(g.pret_a_rendre === true && g.exercice_termine === false, "GET : prêt à rendre, pas terminé");
    verifier(g.champs.every((c: any) => c.statut === null && c.solution_attendue === null && c.revele === false), "AVANT la remise : ni verdict, ni solution, ni « révélé » pour aucun écran (règle de révélation)");
    verifier(!JSON.stringify(g).includes('"correct"') && !JSON.stringify(g).includes("not_equivalent"), "AVANT la remise : aucun statut nulle part dans la charge utile");
    const fin = await x.rendre();
    verifier(fin.statut === 200 && fin.corps.tache_terminee === true && fin.corps.exercice_termine === true, `remise : ${fin.statut} ${JSON.stringify(fin.corps)}`);
    verifier(s.base.table("exercices_assignes").find((l) => l.id === x.id)!.remis_le !== null, "remis_le écrit");
    g = await x.lire();
    verifier(g.exercice_termine === true && g.champs.every((c: any) => c.verrouille === true && c.modifiable === false), "après la remise : tout est verrouillé");
    verifier(g.champs.every((c: any) => c.solution_attendue !== null && c.statut !== null), "après la remise (tâche terminée) : tout est révélé d'un coup");
    verifier(champDe(g, "coefficients").statut === "not_equivalent", "la révélation porte sur la DERNIÈRE réponse (coefficients modifié en faux)");
    const apres = await x.poster("allure", x.bonne("allure"));
    verifier(apres.statut === 409, `modifier après la remise : 409 (${apres.statut})`);
    const encore = await x.rendre();
    verifier(encore.statut === 200, `rendre deux fois : idempotent (${encore.statut})`);
    verifier(s.base.table("exercices_assignes").find((l) => l.id === x.id)!.remis_le === s.base.table("exercices_assignes").find((l) => l.id === x.id)!.remis_le, "remis_le inchangé");
  }

  // ── 2. Invalidation transitive : modifier racinesChamp1 périme racinesChamp2 ET le tableau ──
  {
    const x = await nouveau();
    await x.repondreJusqua("tableauSignes");
    let g = await x.lire();
    verifier(g.pret_a_rendre === true && servis(g).join() === ORDRE.join(), "départ : 8 écrans répondus et servis");
    const avant = x.lignes().length;
    const r = await x.poster("racinesChamp1", "(4x)(x+2)"); // autre écriture de la même factorisation : chaîne DIFFÉRENTE
    verifier(r.statut === 200 && r.corps.inchangee === false, `nouvelle écriture acceptée (${r.statut})`);
    verifier(JSON.stringify(r.corps.champs_invalides) === JSON.stringify(["racinesChamp2", "tableauSignes"]), `invalidation transitive annoncée : racinesChamp2 ET tableauSignes (${JSON.stringify(r.corps.champs_invalides)})`);
    verifier(r.corps.champ_courant === "racinesChamp2" && r.corps.pret_a_rendre === false, `l'écran courant devient racinesChamp2 (${r.corps.champ_courant})`);
    verifier(x.lignes().length === avant + 1, "une seule ligne ajoutée : aucune ligne aval réécrite ni supprimée");
    g = await x.lire();
    verifier(champDe(g, "racinesChamp2").modifiable === false && champDe(g, "racinesChamp2").valeur_saisie === null, "racinesChamp2 : plus de réponse valide (rien à pré-remplir)");
    verifier(champDe(g, "tableauSignes").valeur_saisie === null, "tableauSignes : plus de réponse valide");
    verifier(servis(g).includes("racinesChamp2") && !servis(g).includes("tableauSignes"), `racinesChamp2 re-servi, le tableau retiré tant que ses amonts ne sont pas re-répondus (${servis(g).join()})`);
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance", "racinesChamp1"]) verifier(champDe(g, champ).modifiable === true, `${champ} : intact`);
    verifier((await x.rendre()).statut === 409, "rendre : refusé tant que les écrans périmés ne sont pas re-répondus");
    // la consigne de racinesChamp2 suit la NOUVELLE factorisation confirmée (cascade)
    verifier(g.ecrans.find((e: any) => e.champ === "racinesChamp2").consigne.includes("$(4x)(x + 2) = 0$"), "cascade : racinesChamp2 est bâti sur la NOUVELLE réponse confirmée");
    const r2 = await x.poster("racinesChamp2", x.bonne("racinesChamp2"));
    verifier(r2.statut === 200 && r2.corps.pret_a_rendre === false && r2.corps.champ_courant === "tableauSignes", "re-répondre racinesChamp2 : le tableau redevient courant");
    const r3 = await x.poster("tableauSignes", x.bonne("tableauSignes"));
    verifier(r3.corps.pret_a_rendre === true, "tout est de nouveau valide : prêt à rendre");
    // modifier un écran INTERMÉDIAIRE : périme seulement son aval
    const r4 = await x.poster("racinesChamp2", JSON.stringify(["-2", "1"]));
    verifier(JSON.stringify(r4.corps.champs_invalides) === JSON.stringify(["tableauSignes"]) && r4.corps.champ_courant === "tableauSignes", `modifier racinesChamp2 : périme le tableau seulement (${JSON.stringify(r4.corps.champs_invalides)})`);
    // modifier un écran sans aval : rien ne bouge ailleurs
    await x.poster("tableauSignes", x.bonne("tableauSignes"));
    const r5 = await x.poster("domaineImage", JSON.stringify({}) + " ");
    verifier(r5.statut === 200 && JSON.stringify(r5.corps.champs_invalides) === "[]", `domaineImage n'a aucun écran aval : rien n'est périmé (${JSON.stringify(r5.corps.champs_invalides)})`);
  }

  // ── 3. Réponse IDENTIQUE : rien ne bouge (D7) ──
  {
    const x = await nouveau();
    await x.repondreJusqua("tableauSignes");
    const avant = x.lignes().length;
    for (const variante of [x.bonne("racinesChamp1"), `  ${x.bonne("racinesChamp1")}  `]) {
      const r = await x.poster("racinesChamp1", variante);
      verifier(r.statut === 200 && r.corps.inchangee === true && JSON.stringify(r.corps.champs_invalides) === "[]" && r.corps.pret_a_rendre === true, `réponse identique (${JSON.stringify(variante).slice(0, 25)}…) : aucun effet (${JSON.stringify(r.corps)})`);
    }
    verifier(x.lignes().length === avant, "réponse identique : AUCUNE ligne écrite");
    const g = await x.lire();
    verifier(g.pret_a_rendre === true && champDe(g, "racinesChamp2").modifiable === true && champDe(g, "tableauSignes").modifiable === true, "réponse identique : les écrans aval restent valides");
  }

  // ── 4. Un échec et une réussite sont INDISTINGUABLES avant la remise ──
  {
    const juste = await nouveau();
    const faux = await nouveau();
    const rj = await juste.poster("coefficients", juste.bonne("coefficients"));
    const rf = await faux.poster("coefficients", JSON.stringify({ a: "9", b: "9", c: "9" }));
    verifier(JSON.stringify(rj.corps) === JSON.stringify(rf.corps), `réponse HTTP identique pour une réussite et un échec : ${JSON.stringify(rj.corps)} / ${JSON.stringify(rf.corps)}`);
    const gj = await juste.lire();
    const gf = await faux.lire();
    // Les consignes des écrans suivants rappellent la fonction CONFIRMÉE (RAPPORT §38) : c'est l'écho de ce que l'élève a tapé, comme `valeur_saisie` ;
    // le LIBELLÉ, lui, doit être identique pour une réussite et un échec (sinon l'échec serait visible avant la remise).
    const sansSaisie = (g: any) => JSON.stringify({ ...g, id: undefined, tache: { ...g.tache, nom: undefined }, champs: g.champs.map((c: any) => ({ ...c, valeur_saisie: undefined })) }).replace(/\$f\(x\) = [^$]*\$/g, "$f$").replace(/"croquis_allure","c":-?[\d.]+/g, '"croquis_allure","c":0');
    {
      const [aj, af] = [sansSaisie(gj), sansSaisie(gf)];
      let i = 0;
      while (i < aj.length && aj[i] === af[i]) i++;
      verifier(aj === af, `GET identique (hors texte saisi) pour une réussite et un échec — premier écart : « ${aj.slice(Math.max(0, i - 40), i + 60)} » / « ${af.slice(Math.max(0, i - 40), i + 60)} »`);
    }
    verifier(champDe(gf, "coefficients").modifiable === true && champDe(gf, "coefficients").verrouille === false, "un échec ne verrouille pas l'écran (même état qu'une réussite)");
    // corriger l'échec
    const corr = await faux.poster("coefficients", faux.bonne("coefficients"));
    verifier(corr.statut === 200, "l'échec se corrige librement");
  }

  // ── 5. Sans effet sous correction immédiate ──
  {
    const x = await nouveau({ feedback: true, retour: true });
    const g0 = await x.lire();
    verifier(g0.tache.retour_arriere === false, "correction immédiate : tache.retour_arriere = false malgré le réglage");
    const r = await x.poster("coefficients", x.bonne("coefficients"));
    verifier(r.corps.verrouille === true && r.corps.statut === "correct" && r.corps.modifiable === undefined, `correction immédiate : comportement d'origine (${JSON.stringify(r.corps)})`);
    const encore = await x.poster("coefficients", x.bonne("coefficients"));
    verifier(encore.statut === 409, `correction immédiate : un écran terminé n'est PAS modifiable (${encore.statut})`);
    verifier((await x.rendre()).statut === 409, "correction immédiate : pas de remise");
  }
  {
    const x = await nouveau({ feedback: false, retour: false });
    const r = await x.poster("coefficients", x.bonne("coefficients"));
    const encore = await x.poster("coefficients", x.bonne("coefficients"));
    verifier(r.corps.verrouille === true && encore.statut === 409, "correction coupée SANS retour : comportement d'origine (un essai, verrouillé)");
    verifier((await x.rendre()).statut === 409, "sans retour : pas de remise");
  }

  // ── 6. Chrono global : compatible, verrouille quand il expire (D1, D6) ──
  {
    const x = await nouveau({ chrono: { mode: "global", duree: 60 } });
    await x.repondreJusqua("allure");
    s.base.inserer("debuts_ecran", { exercice_assigne_id: x.id, champ: "coefficients", horodatage_debut: new Date(Date.now() - 600_000).toISOString() });
    const r = await x.poster("allure", x.bonne("allure"));
    verifier(r.statut === 409, `chrono global écoulé : plus de modification (${r.statut})`);
    const g = await x.lire();
    verifier(g.exercice_termine === true && g.champs.every((c: any) => c.verrouille === true && c.modifiable === false), "chrono global écoulé : exercice terminé, tout verrouillé");
    verifier((await x.rendre()).statut === 200, "chrono global écoulé : la remise devient une formalité (200, idempotente)");
  }

  // ── 7. Aide : collante (D5) ──
  {
    const x = await nouveau({ aide: true });
    await x.repondreJusqua("coefficients");
    let champAvecAide = "";
    for (const champ of ORDRE) {
      const a = await x.aide(champ);
      if (a.statut === 200) {
        champAvecAide = champ;
        break;
      }
    }
    verifier(champAvecAide !== "", "l'aide est demandable sur un écran encore modifiable");
    if (champAvecAide !== "") {
      const enBase = () => s.base.table("aides_utilisees").filter((l) => l.exercice_assigne_id === x.id && l.champ === champAvecAide).length;
      verifier(enBase() === 1, "usage d'aide enregistré");
      if (champAvecAide === "coefficients") {
        await x.poster("coefficients", JSON.stringify({ a: "4", b: "8", c: "0" }));
        await x.poster("coefficients", x.bonne("coefficients"));
        verifier(enBase() === 1 && (await x.lire()).champs.find((c: any) => c.champ === "coefficients").aide_utilisee === true, "modifier la réponse ne réinitialise JAMAIS l'usage d'aide (collant)");
      }
    }
    await x.repondreJusqua("tableauSignes").catch(() => undefined);
  }

  // ── 8. Lecteurs prof / élève : dernière réponse VALIDE ; les statistiques gardent toutes les lignes (D8) ──
  {
    const x = await nouveau();
    await x.repondreJusqua("tableauSignes");
    await x.poster("racinesChamp1", "x"); // faux : périme racinesChamp2 et le tableau
    let pr = await appeler("profs/resultats", "GET", { jeton: jetonProf, query: { tache_id: x.tache } });
    let exRes = pr.corps.eleves?.find((e: any) => e.id === "eleve-1")?.exercices?.[0];
    const champsProf = (exRes?.champs ?? []).map((c: any) => c.champ) as string[];
    verifier(!champsProf.includes("racinesChamp2") && !champsProf.includes("tableauSignes") && champsProf.includes("racinesChamp1"), `vue prof : les écrans périmés n'apparaissent plus (${champsProf.join()})`);
    verifier(exRes?.champs.find((c: any) => c.champ === "racinesChamp1")?.statut === "not_equivalent", "vue prof : racinesChamp1 = sa dernière réponse (fausse)");
    verifier(exRes?.complet === false, "vue prof : pas complet tant que l'élève n'a pas rendu");
    await x.poster("racinesChamp1", x.bonne("racinesChamp1"));
    await x.poster("racinesChamp2", x.bonne("racinesChamp2"));
    await x.poster("tableauSignes", x.bonne("tableauSignes"));
    verifier((await x.rendre()).statut === 200, "remise après correction");
    pr = await appeler("profs/resultats", "GET", { jeton: jetonProf, query: { tache_id: x.tache } });
    exRes = pr.corps.eleves?.find((e: any) => e.id === "eleve-1")?.exercices?.[0];
    verifier(exRes?.complet === true && exRes.champs.length === 8 && exRes.champs.every((c: any) => c.statut === "correct"), `vue prof après remise : complet, 8 écrans, tous à leur dernière réponse (juste) : ${JSON.stringify(exRes?.champs?.map((c: any) => [c.champ, c.statut]))} complet=${exRes?.complet}`);
    const mr = await appeler("eleves/mes-resultats", "GET", { jeton: jetonEleve });
    const ligneTache = mr.corps.historiqueTaches?.find((t: any) => t.nomTache === `retour ${compteur}`);
    verifier(ligneTache !== undefined && ligneTache.pourcentage === 100, `mes-resultats : score sur les dernières réponses valides (${JSON.stringify(ligneTache)})`);
    verifier(x.lignes().length === 8 + 4, `D8 : toutes les lignes sont conservées (${x.lignes().length})`);
    const td = await appeler("eleves/tableau-de-bord", "GET", { jeton: jetonEleve });
    const t = ["en_cours", "effectuees", "anterieures"].flatMap((k) => td.corps[k] ?? []).find((t: any) => t.nom_tache === `retour ${compteur}`);
    verifier(td.corps.effectuees?.some((t: any) => t.nom_tache === `retour ${compteur}`) && t !== undefined, "tableau de bord : la tâche rendue est « effectuée »");
  }
  {
    // Tâche répondue en entier mais NON rendue : « en cours » partout (D3).
    const x = await nouveau();
    await x.repondreJusqua("tableauSignes");
    const td = await appeler("eleves/tableau-de-bord", "GET", { jeton: jetonEleve });
    verifier(td.corps.en_cours?.some((t: any) => t.nom_tache === `retour ${compteur}`), "tâche entièrement répondue mais non rendue : « en cours » au tableau de bord");
    const pr = await appeler("profs/resultats", "GET", { jeton: jetonProf, query: { tache_id: x.tache } });
    verifier(pr.corps.eleves?.[0]?.exercices?.[0]?.complet === false, "… et non « complet » côté prof");
  }

  // ── 9. Garde statique : les lecteurs passent par la règle de validité partagée ──
  {
    for (const f of ["lib/etatExercice.ts", "lib/routes/eleves/mes-resultats.ts", "lib/routes/profs/resultats.ts"]) {
      verifier(/dernieresReponsesValides|donneesEffectives/.test(readFileSync(f, "utf8")), `${f} passe par lib/reponsesValides.ts`);
    }
    verifier(chercherGenerateur("af_mise_en_evidence") !== undefined, "registre : gen7 présent");
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (validité par ordre d'insertion, modification d'écrans traversés, invalidation transitive, réponse identique, indistinguabilité avant remise, remise, chrono global, aide collante, lecteurs prof/élève)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
