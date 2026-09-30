// Test permanent — UNE définition de « champ / exercice / tâche terminé » (RAPPORT §37).
//  1. différentiel pur : `champsTermines` (lib/etatExercice.ts) == `verrouille` de `calculerEtatExercice`, sur des milliers d'historiques
//     tirés (statuts, tentatives 1..3, chrono aucun / par écran / global, expiré ou non) ;
//  2. accord de bout en bout : la catégorie de `categorieTachePourEleve` (verrouillageTache.ts, qui gate POST /reponses) == celle du
//     tableau de bord élève (`en_cours` / `effectuees`), dans des scénarios réels du vrai routeur — dont l'EXPIRATION DU CHRONO,
//     que l'ancienne boucle de verrouillageTache ignorait ; et « complet » de profs/resultats (vue prof), qui valait « a une réponse ».
// Lancer : `npm run test-completion-unique`. Sans réseau.

export {}; // module

import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { creerPrng } from "../lib/prng";
import { calculerEtatExercice, champsTermines, regenererExercice, type ContexteTache, type DonneesExercice, type LigneReponse } from "../lib/etatExercice";
import type { ChronoMode, LigneDebutEcran } from "../lib/moteurTentatives";
import type { StatutVerification } from "../src/moteur/statutVerification";
import { generateurTemoinTechnique, VARIANTE_TEMOIN, CHAMPS_BASE } from "../src/generateurs/_temoinTechnique";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

async function main(): Promise<void> {
  // ── 1. Différentiel pur ──
  const prng = creerPrng(20260930);
  const ligne = { id: "ex-1", tache_id: "t-1", eleve_id: "e-1", generateur_id: "_temoin_technique", variante_id: VARIANTE_TEMOIN, graine: 12345, champs_attendus: CHAMPS_BASE };
  const regenere = regenererExercice(ligne)!;
  verifier(regenere.generateur === generateurTemoinTechnique, "le témoin est régénéré");
  const STATUTS: StatutVerification[] = ["correct", "not_equivalent", "parse_error"];
  const maintenant = new Date("2026-09-30T12:00:00.000Z");
  const ilYa = (secondes: number) => new Date(maintenant.getTime() - secondes * 1000).toISOString();
  let comparaisons = 0;
  let nbExpires = 0;
  for (let i = 0; i < 4000; i++) {
    const mode = prng.choisir<ChronoMode>(["aucun", "par_ecran", "global"]);
    const contexte: ContexteTache = {
      nom: "t",
      reglages: { feedback_immediat: true, reponse_visible: false },
      tentativesMax: prng.entierEntre(1, 3),
      aideActivee: false,
      aidePenalitePourcent: 0,
      chronoMode: mode,
      chronoDureeSecondes: mode === "aucun" ? null : prng.choisir([30, 60, 300]),
    };
    const reponsesParChamp = new Map<string, LigneReponse[]>();
    const debuts: LigneDebutEcran[] = [];
    for (const champ of CHAMPS_BASE) {
      const n = prng.entierEntre(0, 4);
      const rows: LigneReponse[] = [];
      for (let k = 0; k < n; k++) rows.push({ exercice_assigne_id: "ex-1", champ, valeur_saisie: "x", statut: prng.choisir(STATUTS), indice_utilise: false, fraction_correcte: null });
      if (rows.length > 0) reponsesParChamp.set(champ, rows);
      if (prng.entierEntre(0, 2) > 0) debuts.push({ champ, horodatage_debut: ilYa(prng.choisir([1, 20, 45, 100, 1000])) });
    }
    const donnees: DonneesExercice = { reponsesParChamp, debuts, champsAvecAide: new Set() };
    const attendu = new Set(calculerEtatExercice(regenere, donnees, contexte, maintenant).champs.filter((c) => c.verrouille).map((c) => c.champ));
    const historique = new Map([...reponsesParChamp].map(([champ, rows]) => [champ, rows.map((r) => ({ statut: r.statut, fraction_correcte: r.fraction_correcte }))]));
    const obtenu = champsTermines(CHAMPS_BASE, historique, debuts, contexte, maintenant);
    comparaisons++;
    if (mode !== "aucun" && attendu.size > 0) nbExpires++;
    verifier(attendu.size === obtenu.size && [...attendu].every((c) => obtenu.has(c)), `cas ${i} (${mode}, tentativesMax ${contexte.tentativesMax}) : calculerEtatExercice {${[...attendu]}} ≠ champsTermines {${[...obtenu]}}`);
  }
  verifier(comparaisons === 4000 && nbExpires > 200, `la couverture inclut des chronos actifs (${nbExpires} cas avec chrono et champ terminé)`);

  // ── 2. Accord de bout en bout : verrouillageTache == tableau de bord ──
  imposerProfilAssignation("base");
  const categorieDuTableauDeBord = async (jeton: string, tacheId: string): Promise<string> => {
    const r = await appeler("eleves/tableau-de-bord", "GET", { jeton });
    for (const cat of ["en_cours", "effectuees", "anterieures"]) if ((r.corps[cat] ?? []).some((t: { tache_id: string }) => t.tache_id === tacheId)) return cat;
    return "absente";
  };
  const scenario = async (nom: string, options: { chrono_mode?: string; chrono_duree_secondes?: number | null; tentatives?: number; feedback?: boolean }, preparer: (s: ReturnType<typeof creerScenario>, exercices: { id: string; champs_attendus: string[] }[]) => void, attendu: "en_cours" | "effectuees") => {
    const s = creerScenario();
    installerBase(s.base);
    const tacheId = creerTache(s, { nom, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }], chrono_mode: options.chrono_mode, chrono_duree_secondes: options.chrono_duree_secondes ?? null, tentatives_supplementaires: options.tentatives ?? 0, feedback_immediat: options.feedback ?? true });
    const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
    verifier(a.statut === 201, `${nom} : assignation (${a.statut})`);
    const exercices = s.base.table("exercices_assignes").filter((e) => e.eleve_id === "eleve-1") as unknown as { id: string; champs_attendus: string[] }[];
    preparer(s, exercices);
    const { categorieTachePourEleve } = require("../lib/verrouillageTache") as typeof import("../lib/verrouillageTache");
    const parVerrouillage = await categorieTachePourEleve(s.base as never, tacheId, "eleve-1");
    const parTableauDeBord = await categorieDuTableauDeBord("eleve:eleve-1", tacheId);
    verifier(parVerrouillage === attendu, `${nom} : verrouillageTache dit « ${parVerrouillage} », attendu « ${attendu} »`);
    verifier(parTableauDeBord === attendu, `${nom} : le tableau de bord dit « ${parTableauDeBord} », attendu « ${attendu} »`);
    // Vue professeur (C2, RAPPORT §37) : « complet » d'un exercice = la tâche est effectuée (un seul exercice par tâche ici).
    const pr = await appeler("profs/resultats", "GET", { jeton: `prof:${s.profId}`, query: { tache_id: tacheId } });
    const completProf = pr.corps.eleves?.find((e: { id: string }) => e.id === "eleve-1")?.exercices?.[0]?.complet;
    verifier(pr.statut === 200 && completProf === (attendu === "effectuees"), `${nom} : profs/resultats « complet » = ${completProf}, attendu ${attendu === "effectuees"} (${pr.statut})`);
    verifier(parVerrouillage === parTableauDeBord, `${nom} : verrouillageTache (${parVerrouillage}) et tableau de bord (${parTableauDeBord}) doivent s'accorder`);
  };
  const repondre = (s: ReturnType<typeof creerScenario>, ex: { id: string }, champ: string, statut: string) => s.base.inserer("reponses", { exercice_assigne_id: ex.id, champ, valeur_saisie: "x", statut, indice_utilise: false });
  const debut = (s: ReturnType<typeof creerScenario>, ex: { id: string }, champ: string, secondes: number) => s.base.inserer("debuts_ecran", { exercice_assigne_id: ex.id, champ, horodatage_debut: new Date(Date.now() - secondes * 1000).toISOString() });

  await scenario("aucune réponse", {}, () => undefined, "en_cours");
  await scenario("tout répondu et réussi", {}, (s, [ex]) => ex!.champs_attendus.forEach((c) => repondre(s, ex!, c, "correct")), "effectuees");
  await scenario("tout répondu, une réponse fausse (1 seul essai) : terminé", {}, (s, [ex]) => ex!.champs_attendus.forEach((c, i) => repondre(s, ex!, c, i === 0 ? "not_equivalent" : "correct")), "effectuees");
  await scenario("un essai raté avec 2 essais autorisés : pas terminé", { tentatives: 1 }, (s, [ex]) => ex!.champs_attendus.forEach((c, i) => repondre(s, ex!, c, i === 0 ? "not_equivalent" : "correct")), "en_cours");
  await scenario("deux essais ratés avec 2 essais autorisés : terminé", { tentatives: 1 }, (s, [ex]) => ex!.champs_attendus.forEach((c, i) => { if (i === 0) { repondre(s, ex!, c, "not_equivalent"); repondre(s, ex!, c, "parse_error"); } else repondre(s, ex!, c, "correct"); }), "effectuees");
  // Le cas que l'ancienne boucle de verrouillageTache manquait : chrono global écoulé, aucun champ répondu.
  await scenario("chrono global ÉCOULÉ, rien répondu : tous les champs sont révélés par le chrono", { chrono_mode: "global", chrono_duree_secondes: 60 }, (s, [ex]) => debut(s, ex!, ex!.champs_attendus[0]!, 600), "effectuees");
  await scenario("chrono global en cours (10 s sur 600), rien répondu", { chrono_mode: "global", chrono_duree_secondes: 600 }, (s, [ex]) => debut(s, ex!, ex!.champs_attendus[0]!, 10), "en_cours");
  await scenario("chrono par écran écoulé sur UN champ seulement", { chrono_mode: "par_ecran", chrono_duree_secondes: 60 }, (s, [ex]) => { debut(s, ex!, ex!.champs_attendus[0]!, 600); for (const c of ex!.champs_attendus.slice(1)) repondre(s, ex!, c, "correct"); }, "effectuees");
  await scenario("chrono par écran écoulé sur un champ, un autre sans réponse ni début", { chrono_mode: "par_ecran", chrono_duree_secondes: 60 }, (s, [ex]) => { debut(s, ex!, ex!.champs_attendus[0]!, 600); for (const c of ex!.champs_attendus.slice(2)) repondre(s, ex!, c, "correct"); }, "en_cours");

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 30)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (champsTermines == calculerEtatExercice sur ${comparaisons} historiques ; verrouillageTache == tableau de bord == « complet » de la vue prof dans 9 scénarios réels, dont l'expiration du chrono)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
