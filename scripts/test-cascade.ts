// Test permanent — cascade de réponses entre écrans (RAPPORT §18) : une donnée affichée qui dépend d'un écran
// précédent vient de la réponse CONFIRMÉE par l'élève, la vérification de l'écran suivant se fait sur cette
// même valeur (une méthode juste sur une donnée fausse RÉUSSIT), le repli à deux régimes ne fuit rien.
// Lancer : `npm run test-cascade`. Vrai `api/router.ts` contre une base en mémoire ; le générateur de test
// `scripts/support/generateurCascade.ts` (aucun type d'écran nouveau) est ajouté au registre le temps du test.
//
// Blocs : 1. contrat exhaustif (projection, vérification, solution, aide, repli, chaîne) ; 2. déclaration
// des dépendances et filtrage des écrans ; 3. sans `projeter` : exercice brut, strictement inchangé ;
// 4. ROUTE (GET, POST réponse, POST aide, tableau de bord) sous correction immédiate active ET coupée,
// dont le contrôle qu'aucune charge utile ne contient la vraie valeur avant qu'elle soit révélée.

export {}; // module (évite les collisions de noms globaux entre scripts/*.ts)

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { CHAMP_ETAPE1, CHAMP_ETAPE2, CHAMP_ETAPE3, CHAMP_LIBRE, CHAMPS_CASCADE, DECALAGE_REPLI, generateurCascade as g, installerGenerateurCascade, VARIANTE_CASCADE, type ExerciceCascade } from "./support/generateurCascade";
import { dependancesTerminees, ecransServis, validerDependances } from "../lib/cascadeEcrans";
import type { EcranDeclare, ReponseConfirmee } from "../lib/contratGenerateur";
import type { ExerciceRegenere } from "../lib/etatExercice";
import { CHAMP_SOMME, generateurTemoinTechnique as temoin } from "../src/generateurs/_temoinTechnique";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

const confirmee = (champ: string, brute: string, statut: ReponseConfirmee["statut"] = "not_equivalent"): ReponseConfirmee => ({ champ, reponseBrute: brute, statut });
const consigne = (ecrans: EcranDeclare[], champ: string) => ecrans.find((e) => e.champ === champ)!.consigne;
const aideDe = (ecrans: EcranDeclare[], champ: string) => ecrans.find((e) => e.champ === champ)!.aide as string;
const CONSIGNE2 = (d1: number) => `Ton résultat précédent est $${d1}$. Calcule son double.`;
const CONSIGNE3 = (d2: number) => `Ton résultat précédent est $${d2}$. Ajoute-lui 1.`;

function regenere(seed: number): ExerciceRegenere {
  const exercice = g.generer(seed);
  return { ligne: null as never, generateur: g, exercice, ecrans: g.ecrans(exercice) };
}

async function projeter(seed: number, confirmees: ReponseConfirmee[], correctionImmediate: boolean) {
  const { projeterExercice } = require("../lib/etatExercice") as typeof import("../lib/etatExercice");
  return projeterExercice(regenere(seed), confirmees, { reglages: { feedback_immediat: correctionImmediate } });
}

async function blocContrat(): Promise<void> {
  const compteurs = { projection: 0, verifMethode: 0, verifOfficielleRejetee: 0, solution: 0, aide: 0, chaine: 0, repliVraie: 0, repliDecoy: 0, decoyDistinct: 0, independance: 0, champsConstants: 0 };
  let cas = 0;
  for (let seed = 0; seed < 100; seed++) {
    const brut = g.generer(seed);
    const vrai = brut.a + brut.b;
    for (let rPrime = -30; rPrime <= 60; rPrime++) {
      for (const ci of [true, false]) {
        cas++;
        const conf = [confirmee(CHAMP_ETAPE1, String(rPrime), rPrime === vrai ? "correct" : "not_equivalent")];
        const p = await projeter(seed, conf, ci);
        const ex = p.exercice as ExerciceCascade;
        // énoncé, aide, solution : bâtis sur la valeur CONFIRMÉE, jamais sur la vraie
        if (consigne(p.ecrans, CHAMP_ETAPE2) !== CONSIGNE2(rPrime)) compteurs.projection++;
        if (!aideDe(p.ecrans, CHAMP_ETAPE2).includes(`$2 \\times ${rPrime}$`)) compteurs.aide++;
        if (g.solutionAttendue(ex, CHAMP_ETAPE2) !== String(2 * rPrime)) compteurs.solution++;
        // la méthode juste appliquée à la donnée confirmée RÉUSSIT
        if (g.verifier(ex, CHAMP_ETAPE2, String(2 * rPrime)).statut !== "correct") compteurs.verifMethode++;
        // la chaîne officiellement correcte n'est acceptée que si la donnée confirmée est la vraie
        if ((g.verifier(ex, CHAMP_ETAPE2, String(2 * vrai)).statut === "correct") !== (rPrime === vrai)) compteurs.verifOfficielleRejetee++;
        // liste des champs constante quelles que soient les confirmations
        if (p.ecrans.map((e) => e.champ).join() !== CHAMPS_CASCADE.join()) compteurs.champsConstants++;
        // indépendance : confirmer aussi les écrans suivants ne change pas l'énoncé de l'écran 2
        const p2 = await projeter(seed, [...conf, confirmee(CHAMP_ETAPE3, "1"), confirmee(CHAMP_LIBRE, "4", "correct")], ci);
        if (consigne(p2.ecrans, CHAMP_ETAPE2) !== consigne(p.ecrans, CHAMP_ETAPE2)) compteurs.independance++;
      }
    }
    // chaîne : etape1 = r', etape2 = w (confirmés) → l'écran 3 porte w, la méthode juste (w + 1) réussit
    for (const [rPrime, w] of [[vrai + 3, 5], [vrai, 2 * vrai + 1], [-4, -9], [0, 0]] as const) {
      const p = await projeter(seed, [confirmee(CHAMP_ETAPE1, String(rPrime)), confirmee(CHAMP_ETAPE2, String(w))], true);
      const ex = p.exercice as ExerciceCascade;
      if (consigne(p.ecrans, CHAMP_ETAPE3) !== CONSIGNE3(w) || consigne(p.ecrans, CHAMP_ETAPE2) !== CONSIGNE2(rPrime) || g.verifier(ex, CHAMP_ETAPE3, String(w + 1)).statut !== "correct" || g.solutionAttendue(ex, CHAMP_ETAPE3) !== String(w + 1)) compteurs.chaine++;
    }
    // repli : prédécesseur inexploitable (non analysable, chrono sans réponse, hors domaine, absent)
    const inexploitables: (ReponseConfirmee[])[] = [[confirmee(CHAMP_ETAPE1, "abc", "parse_error")], [confirmee(CHAMP_ETAPE1, "", "not_equivalent")], [confirmee(CHAMP_ETAPE1, "99999")], [confirmee(CHAMP_ETAPE1, "3,5")], []];
    for (const conf of inexploitables) {
      const on = await projeter(seed, conf, true);
      const off = await projeter(seed, conf, false);
      if (consigne(on.ecrans, CHAMP_ETAPE2) !== CONSIGNE2(vrai)) compteurs.repliVraie++; // correction active : la vraie valeur (déjà révélée)
      if (consigne(off.ecrans, CHAMP_ETAPE2) !== CONSIGNE2(vrai + DECALAGE_REPLI)) compteurs.repliDecoy++; // coupée : donnée de repli déclarée
      if ((off.exercice as ExerciceCascade).d1 === vrai || consigne(off.ecrans, CHAMP_ETAPE2).includes(`$${vrai}$`)) compteurs.decoyDistinct++; // jamais la vraie valeur
    }
  }
  console.log(`  1) contrat : ${cas} projections (100 graines × 91 valeurs × 2 régimes), violations ${JSON.stringify(compteurs)}`);
  for (const [nom, n] of Object.entries(compteurs)) verifier(n === 0, `contrat « ${nom} » : ${n} violation(s)`);
  verifier(cas === 100 * 91 * 2, `nombre de projections inattendu : ${cas}`);
}

function blocDependances(): void {
  const e = (champ: string, dependDe?: string[]): EcranDeclare => ({ type: "champ_expression", champ, consigne: "x", ...(dependDe ? { dependDe } : {}) });
  verifier(validerDependances(g.ecrans(g.generer(1))).length === 0, "le générateur de test déclare des dépendances saines");
  verifier(validerDependances([e("a"), e("b", ["a"]), e("c", ["a", "b"])]).length === 0, "dépendances multiples valides");
  verifier(validerDependances([e("a", ["a"])]).length === 1, "auto-référence rejetée");
  verifier(validerDependances([e("a", ["b"]), e("b")]).length === 1, "dépendance vers un écran SUIVANT (cycle possible) rejetée");
  verifier(validerDependances([e("a"), e("b", ["zz"])]).length === 1, "dépendance vers un champ inconnu rejetée");
  verifier(validerDependances([e("a"), e("b", [])]).length === 1, "dependDe vide rejeté");
  verifier(validerDependances([e("a"), e("a")]).length === 1, "champ en double rejeté");
  const ecrans = g.ecrans(g.generer(1));
  const noms = (termines: string[], tout = false) => ecransServis(ecrans, new Set(termines), tout).map((x) => x.champ);
  verifier(noms([]).join() === `${CHAMP_ETAPE1},${CHAMP_LIBRE}`, `aucun terminé : etape1 + libre (indépendants), reçu ${noms([])}`);
  verifier(noms([CHAMP_ETAPE1]).join() === `${CHAMP_ETAPE1},${CHAMP_ETAPE2},${CHAMP_LIBRE}`, `etape1 terminé : etape2 apparaît, reçu ${noms([CHAMP_ETAPE1])}`);
  verifier(noms([CHAMP_ETAPE1, CHAMP_ETAPE2]).join() === CHAMPS_CASCADE.join(), "etape1+2 terminés : les 4 écrans");
  verifier(noms([], true).join() === CHAMPS_CASCADE.join(), "tâche antérieure : tout est servi");
  verifier(dependancesTerminees(ecrans[0], new Set()) && !dependancesTerminees(ecrans[1], new Set()) && dependancesTerminees(ecrans[1], new Set([CHAMP_ETAPE1])), "dependancesTerminees");
  console.log("  2) dépendances : déclaration validée, filtrage des écrans servis vérifié");
}

async function blocSansProjeter(): Promise<void> {
  const { projeterExercice } = require("../lib/etatExercice") as typeof import("../lib/etatExercice");
  const exercice = temoin.generer(0);
  const reg: ExerciceRegenere = { ligne: null as never, generateur: temoin, exercice, ecrans: temoin.ecrans(exercice) };
  const p = projeterExercice(reg, [{ champ: CHAMP_SOMME, reponseBrute: "1", statut: "not_equivalent" }], { reglages: { feedback_immediat: false } });
  verifier(p.exercice === exercice && p.ecrans === reg.ecrans, "générateur sans projeter : exercice ET écrans strictement inchangés (même référence)");
  // dependDe sans projeter = bug de générateur (échec bruyant) ; projection qui change la liste des champs = idem
  const sansProjeter = { ...g, projeter: undefined } as typeof g;
  let leve = false;
  try {
    projeterExercice({ ...regenere(1), generateur: sansProjeter }, [], { reglages: { feedback_immediat: true } });
  } catch {
    leve = true;
  }
  verifier(leve, "dependDe sans projeter() : doit lever");
  const qui_change = { ...g, projeter: (ex: ExerciceCascade) => ex, ecrans: (ex: ExerciceCascade) => (ex.d1 === ex.a + ex.b ? g.ecrans(ex) : g.ecrans(ex).slice(0, 2)) } as typeof g;
  const mauvaise = { ...qui_change, projeter: (ex: ExerciceCascade) => ({ ...ex, d1: -1 }) } as typeof g;
  leve = false;
  try {
    projeterExercice({ ...regenere(1), generateur: mauvaise }, [], { reglages: { feedback_immediat: true } });
  } catch {
    leve = true;
  }
  verifier(leve, "une projection qui change la liste des champs doit lever");
  console.log("  3) sans projeter : exercice brut inchangé ; déclarations incohérentes rejetées");
}

const contientVrai = (corps: unknown, vraiD1: number) => JSON.stringify(corps).includes(`Ton résultat précédent est $${vraiD1}$`);

async function blocRoute(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const retirer = installerGenerateurCascade();
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let compteurGraine = 500;
  try {
    const nouveau = async (ci: boolean, reponseVisible = false) => {
      const tache = creerTache(s, { nom: `cascade ${compteurGraine}`, variantes: [{ variante_id: VARIANTE_CASCADE, nombre_exercices: 1 }], feedback_immediat: ci, reponse_visible: reponseVisible, aide_activee: true, aide_penalite_pourcent: 50 });
      const origine = Math.random;
      const graine = compteurGraine++;
      Math.random = () => graine / 2 ** 32; // graine déterministe (`tirerGraine`)
      try {
        const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
        verifier(a.statut === 201, `assignation : ${a.statut} ${JSON.stringify(a.corps)}`);
      } finally {
        Math.random = origine;
      }
      const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
      const brut = g.generer(Number(ligne.graine));
      const id = ligne.id as string;
      const poster = (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } });
      const lire = () => appeler(`exercices/${id}`, "GET", { jeton: jetonEleve });
      const aide = (champ: string) => appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ } });
      const champsServis = (r: { corps: any }) => (r.corps.ecrans as EcranDeclare[]).map((e) => e.champ);
      const consigneServie = (r: { corps: any }, champ: string) => (r.corps.ecrans as EcranDeclare[]).find((e) => e.champ === champ)?.consigne;
      return { tache, id, brut, vrai: brut.a + brut.b, poster, lire, aide, champsServis, consigneServie };
    };
    const fausse = (v: number) => v + 5; // toujours ≠ vrai

    // ── R1 : correction ACTIVE — donnée fausse confirmée, méthode juste ⇒ RÉUSSITE en cascade ──
    {
      const x = await nouveau(true, true); // reponse_visible : les solutions relues à la fin sont montrées
      const g0 = await x.lire();
      verifier(g0.statut === 200 && x.champsServis(g0).join() === `${CHAMP_ETAPE1},${CHAMP_LIBRE}` && g0.corps.champs.length === 4, `R1 GET initial : seuls les écrans indépendants sont servis, état complet (${JSON.stringify(x.champsServis(g0))}, ${g0.corps.champs?.length} champs)`);
      verifier(!JSON.stringify(g0.corps).includes("Ton résultat précédent"), "R1 GET initial : aucun texte d'écran dépendant dans la charge utile");
      verifier((await x.aide(CHAMP_ETAPE2)).statut === 409, "R1 aide d'un écran dépendant avant ses prédécesseurs : 409");
      verifier(s.base.table("aides_utilisees").filter((l) => l.exercice_assigne_id === x.id).length === 0, "R1 aide refusée : aucun usage compté");
      verifier((await x.poster(CHAMP_ETAPE2, "1")).statut === 409, "R1 POST sur un écran dépendant avant ses prédécesseurs : 409");
      const r1 = await x.poster(CHAMP_ETAPE1, String(fausse(x.vrai)));
      verifier(r1.statut === 200 && r1.corps.statut === "not_equivalent", `R1 etape1 fausse : ${JSON.stringify(r1.corps)}`);
      const g1 = await x.lire();
      verifier(x.consigneServie(g1, CHAMP_ETAPE2) === CONSIGNE2(fausse(x.vrai)), `R1 etape2 bâtie sur la valeur CONFIRMÉE ${fausse(x.vrai)} : ${x.consigneServie(g1, CHAMP_ETAPE2)}`);
      verifier(!contientVrai(g1.corps, x.vrai), "R1 la charge utile ne contient pas l'énoncé bâti sur la vraie valeur");
      const a2 = await x.aide(CHAMP_ETAPE2);
      verifier(a2.statut === 200 && a2.corps.aide === `Double de $${fausse(x.vrai)}$ : $2 \\times ${fausse(x.vrai)}$.`, `R1 aide projetée : ${JSON.stringify(a2.corps)}`);
      const r2 = await x.poster(CHAMP_ETAPE2, String(2 * fausse(x.vrai)));
      verifier(r2.statut === 200 && r2.corps.statut === "correct", `R1 méthode juste sur donnée fausse : RÉUSSIT, reçu ${JSON.stringify(r2.corps)}`);
      const g2 = await x.lire();
      verifier(x.consigneServie(g2, CHAMP_ETAPE3) === CONSIGNE3(2 * fausse(x.vrai)), "R1 etape3 bâtie sur la valeur confirmée de l'étape 2");
      const r3 = await x.poster(CHAMP_ETAPE3, String(2 * fausse(x.vrai) + 1));
      verifier(r3.statut === 200 && r3.corps.statut === "correct", `R1 chaîne complète : ${JSON.stringify(r3.corps)}`);
      const r4 = await x.poster(CHAMP_LIBRE, "4");
      verifier(r4.corps.tache_terminee === true, "R1 tâche terminée");
      const fin = await x.lire();
      const sol = (champ: string) => fin.corps.champs.find((c: any) => c.champ === champ).solution_attendue;
      verifier(sol(CHAMP_ETAPE2) === String(2 * fausse(x.vrai)) && sol(CHAMP_ETAPE3) === String(2 * fausse(x.vrai) + 1), `R1 solutions relues cohérentes avec l'énoncé vu (${sol(CHAMP_ETAPE2)}, ${sol(CHAMP_ETAPE3)})`);
      const td = await appeler("eleves/tableau-de-bord", "GET", { jeton: jetonEleve });
      const champsTd = ["en_cours", "effectuees", "anterieures"].flatMap((k) => (td.corps[k] ?? []) as any[]).flatMap((t) => t.exercices ?? []).find((e: any) => e.id === x.id)?.champs ?? [];
      verifier(champsTd.find((c: any) => c.champ === CHAMP_ETAPE2)?.solution_attendue === String(2 * fausse(x.vrai)), "R1 tableau de bord : solution de l'étape 2 projetée");
    }

    // ── R2 : correction ACTIVE — la chaîne « officielle » est REJETÉE quand la donnée confirmée est fausse ──
    {
      const x = await nouveau(true);
      await x.poster(CHAMP_ETAPE1, String(fausse(x.vrai)));
      const r = await x.poster(CHAMP_ETAPE2, String(2 * x.vrai));
      verifier(r.statut === 200 && r.corps.statut === "not_equivalent" && r.corps.solution_attendue === String(2 * fausse(x.vrai)), `R2 chaîne officielle rejetée, solution projetée révélée : ${JSON.stringify(r.corps)}`);
    }

    // ── R3 : correction ACTIVE — prédécesseur non analysable : repli sur la vraie valeur (déjà révélée) ──
    {
      const x = await nouveau(true);
      const r = await x.poster(CHAMP_ETAPE1, "abc");
      verifier(r.corps.revele === true && r.corps.solution_attendue === String(x.vrai), `R3 la vraie valeur vient d'être révélée : ${JSON.stringify(r.corps)}`);
      const g1 = await x.lire();
      verifier(x.consigneServie(g1, CHAMP_ETAPE2) === CONSIGNE2(x.vrai), `R3 repli régime 1 : énoncé sur la vraie valeur ${x.vrai}, reçu ${x.consigneServie(g1, CHAMP_ETAPE2)}`);
    }

    // ── R4 : correction COUPÉE — repli sur la donnée déclarée, la vraie valeur ne fuit JAMAIS avant la fin ──
    {
      const x = await nouveau(false);
      const corpsHttp: unknown[] = [];
      const r1 = await x.poster(CHAMP_ETAPE1, "abc");
      corpsHttp.push(r1.corps);
      verifier(r1.statut === 200 && r1.corps.statut === undefined && r1.corps.solution_attendue === undefined && r1.corps.revele === false, `R4 rien n'est révélé : ${JSON.stringify(r1.corps)}`);
      const g1 = await x.lire();
      corpsHttp.push(g1.corps);
      const decoy = x.vrai + DECALAGE_REPLI;
      verifier(x.consigneServie(g1, CHAMP_ETAPE2) === CONSIGNE2(decoy), `R4 repli régime 2 : donnée de repli ${decoy}, reçu ${x.consigneServie(g1, CHAMP_ETAPE2)}`);
      verifier(decoy !== x.vrai && !contientVrai(g1.corps, x.vrai), "R4 la donnée de repli n'est pas la vraie valeur");
      const a2 = await x.aide(CHAMP_ETAPE2);
      corpsHttp.push(a2.corps);
      verifier(a2.corps.aide === `Double de $${decoy}$ : $2 \\times ${decoy}$.`, `R4 aide bâtie sur la donnée de repli : ${JSON.stringify(a2.corps)}`);
      const r2 = await x.poster(CHAMP_ETAPE2, String(2 * decoy));
      corpsHttp.push(r2.corps);
      verifier(r2.statut === 200 && r2.corps.statut === undefined, "R4 verdict non révélé sous correction coupée");
      corpsHttp.push((await x.lire()).corps);
      const r3 = await x.poster(CHAMP_ETAPE3, String(2 * decoy + 1));
      corpsHttp.push(r3.corps);
      const avantFin = JSON.stringify(corpsHttp);
      verifier(!avantFin.includes(`"solution_attendue":"${x.vrai}"`) && !avantFin.includes(`$${x.vrai}$`), "R4 aucune charge utile avant la fin de la tâche ne contient la vraie valeur");
      const r4 = await x.poster(CHAMP_LIBRE, "4");
      verifier(r4.corps.tache_terminee === true, "R4 tâche terminée");
      const fin = await x.lire();
      const sol = (champ: string) => fin.corps.champs.find((c: any) => c.champ === champ).solution_attendue;
      verifier(sol(CHAMP_ETAPE1) === String(x.vrai) && sol(CHAMP_ETAPE2) === String(2 * decoy), `R4 fin de tâche : tout est révélé, solutions cohérentes avec ce que l'élève a vu (${sol(CHAMP_ETAPE1)}, ${sol(CHAMP_ETAPE2)})`);
      verifier(x.consigneServie(fin, CHAMP_ETAPE2) === CONSIGNE2(decoy), "R4 l'énoncé déjà vu ne change pas à la fin de la tâche (repli statique, jamais `revele`)");
    }

    // ── R5 : correction COUPÉE — valeur analysable fausse : c'est SA valeur (rien à cacher), réussite en cascade ──
    {
      const x = await nouveau(false);
      const r1 = await x.poster(CHAMP_ETAPE1, String(fausse(x.vrai)));
      verifier(r1.corps.statut === undefined, "R5 verdict masqué");
      const g1 = await x.lire();
      verifier(x.consigneServie(g1, CHAMP_ETAPE2) === CONSIGNE2(fausse(x.vrai)), "R5 énoncé bâti sur la valeur de l'élève");
      await x.poster(CHAMP_ETAPE2, String(2 * fausse(x.vrai)));
      await x.poster(CHAMP_ETAPE3, String(2 * fausse(x.vrai) + 1));
      await x.poster(CHAMP_LIBRE, "4");
      const fin = await x.lire();
      const st = (champ: string) => fin.corps.champs.find((c: any) => c.champ === champ).statut;
      verifier(st(CHAMP_ETAPE1) === "not_equivalent" && st(CHAMP_ETAPE2) === "correct" && st(CHAMP_ETAPE3) === "correct", `R5 une seule erreur, pas de cascade d'échecs : ${st(CHAMP_ETAPE1)} / ${st(CHAMP_ETAPE2)} / ${st(CHAMP_ETAPE3)}`);
    }
    console.log("  4) route : correction active (réussite en cascade, chaîne officielle rejetée, repli vrai) et coupée (repli déclaré, aucune fuite, solutions cohérentes)");
  } finally {
    retirer();
  }
}

async function main() {
  console.log("Cascade de réponses");
  installerBase(creerScenario().base); // registre frais pour les blocs 1-3
  const retirer = installerGenerateurCascade();
  try {
    await blocContrat();
    blocDependances();
    await blocSansProjeter();
  } finally {
    retirer();
  }
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
