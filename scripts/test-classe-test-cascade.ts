// Test permanent — suppression en cascade d'une CLASSE DE TEST (RAPPORT §61) : `lib/suppressionClasseTest.ts`. Quatre volets, sans réseau, base en mémoire :
//  1. SCHÉMA : la liste d'étapes couvre toute table qui référence `classes`, `eleves` ou une table supprimée (clés étrangères RELUES dans `supabase/schema.sql`, pas de mémoire) — une future table
//     qui oublierait la cascade fait échouer ce test (c'est l'oubli historique de `aides_utilisees` dans la suppression de l'aperçu) ;
//  2. SCÉNARIO : classe de test + vraie classe coexistent ; après suppression, un ORACLE indépendant balaie TOUTES les tables (aucune cellule ne contient un identifiant supprimé, comptes Auth compris)
//     et tout ce qui n'appartenait pas à la classe de test est strictement identique ;
//  3. REFUS : vraie classe (404, rien supprimé), élève partagé (409, rien supprimé), classe inconnue (404) ;
//  4. MUTATION : retirer N'IMPORTE LAQUELLE des étapes est détecté par l'oracle (comme l'aurait fait un test de l'aperçu pour `aides_utilisees`).
// Lancer : `npm run test-classe-test-cascade`.

export {}; // module

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BaseMemoire } from "./support/fauxSupabase";
import { ETAPES_SUPPRESSION_CLASSE_TEST, supprimerClasseDeTest, type EtapeSuppression } from "../lib/suppressionClasseTest";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

// ── 1. Schéma : clés étrangères relues dans supabase/schema.sql ──
{
  const sql = readFileSync(join(__dirname, "..", "supabase", "schema.sql"), "utf8").replace(/--[^\n]*/g, "");
  const fk: { enfant: string; parent: string }[] = [];
  for (const m of sql.matchAll(/create table (\w+) \(([\s\S]*?)\n\);/g)) for (const r of (m[2] as string).matchAll(/references (\w+)\(/g)) fk.push({ enfant: m[1] as string, parent: r[1] as string });
  for (const m of sql.matchAll(/alter table (\w+) add column [^;]*?references (\w+)\(/g)) fk.push({ enfant: m[1] as string, parent: m[2] as string });
  verifier(fk.length >= 15, `clés étrangères lues dans le schéma (${fk.length})`);
  const supprimees = new Set(ETAPES_SUPPRESSION_CLASSE_TEST.flatMap((e) => (e.genre === "table" ? [e.table] : [])));
  // Tables qui référencent le périmètre SANS appartenir à la cascade, avec la raison : profs.eleve_apercu_id ne vise que l'élève fantôme de l'aperçu (jamais inscrit à une classe, donc jamais un élève de test).
  const EXEMPTEES: Record<string, string> = { profs: "eleve_apercu_id ne désigne que l'élève fantôme de l'aperçu" };
  const perimetre = new Set(["classes", "eleves", ...supprimees]);
  for (const { enfant, parent } of fk) {
    if (!perimetre.has(parent) || Object.hasOwn(EXEMPTEES, enfant)) continue;
    // `taches` n'est pas dans le périmètre : taches_assignations référence classes ET taches, il est donc couvert par `classes`.
    verifier(supprimees.has(enfant), `table « ${enfant} » (référence ${parent}) absente de la cascade de suppression d'une classe de test`);
  }
  verifier(fk.some((f) => f.enfant === "aides_utilisees" && f.parent === "exercices_assignes"), "garde : le schéma relu voit bien aides_utilisees -> exercices_assignes");
  verifier(!supprimees.has("taches") && !supprimees.has("taches_composition") && !supprimees.has("profs"), "taches, taches_composition et profs ne sont jamais supprimées");
  // L'ordre respecte les clés étrangères : un enfant est supprimé AVANT son parent.
  const ordre = ETAPES_SUPPRESSION_CLASSE_TEST.flatMap((e) => (e.genre === "table" ? [e.table] : []));
  for (const { enfant, parent } of fk) {
    if (ordre.includes(enfant) && ordre.includes(parent)) verifier(ordre.indexOf(enfant) < ordre.indexOf(parent), `ordre : ${enfant} doit être supprimée avant ${parent}`);
  }
  const iAuth = ETAPES_SUPPRESSION_CLASSE_TEST.findIndex((e) => e.genre === "auth");
  const iEleves = ETAPES_SUPPRESSION_CLASSE_TEST.findIndex((e) => e.genre === "table" && e.table === "eleves");
  verifier(iAuth > iEleves && iAuth < ETAPES_SUPPRESSION_CLASSE_TEST.length - 1, "les comptes Auth sont supprimés après les lignes eleves et avant la classe");
}

// ── Scénario ──
interface Scene {
  base: BaseMemoire;
  admin: ReturnType<BaseMemoire["from"]>;
  classeTest: string;
  classeReelle: string;
  elevesTest: string[];
  elevesReels: string[];
  exercicesTest: string[];
}
function scene(): Scene {
  const base = new BaseMemoire();
  const profId = base.inserer("profs", { id: "prof-admin", est_admin: true }).id as string;
  const autreProf = base.inserer("profs", { id: "prof-autre" }).id as string;
  const classeReelle = base.inserer("classes", { id: "classe-reelle", prof_id: profId, nom: "4A", code: "ABC123" }).id as string;
  const classeTest = base.inserer("classes", { id: "classe-test", prof_id: profId, nom: "Test 1", est_test: true, code: null }).id as string;
  const classeAutre = base.inserer("classes", { id: "classe-autre", prof_id: autreProf, nom: "5B", code: "ZZZ999" }).id as string;
  const elevesTest = ["t1", "t2", "t3"];
  const elevesReels = ["r1", "r2", "a1"];
  for (const id of [...elevesTest, ...elevesReels]) {
    base.inserer("eleves", { id, nom: id, prenom: "X", actif: true });
    base.utilisateursAuth.set(id, { id, email: `${id}@pilote.local`, password: "mdp", banni: null });
  }
  for (const id of elevesTest) base.inserer("inscriptions", { eleve_id: id, classe_id: classeTest });
  for (const id of ["r1", "r2"]) base.inserer("inscriptions", { eleve_id: id, classe_id: classeReelle });
  base.inserer("inscriptions", { eleve_id: "a1", classe_id: classeAutre });
  const tacheA = base.inserer("taches", { id: "tache-a", prof_id: profId, nom: "A" }).id as string;
  const tacheB = base.inserer("taches", { id: "tache-b", prof_id: profId, nom: "B" }).id as string;
  base.inserer("taches_composition", { tache_id: tacheA, variante_id: "v" });
  base.inserer("taches_composition", { tache_id: tacheB, variante_id: "v" });
  base.inserer("taches_assignations", { tache_id: tacheA, classe_id: classeReelle });
  base.inserer("taches_assignations", { tache_id: tacheA, classe_id: classeTest });
  base.inserer("taches_assignations", { tache_id: tacheB, classe_id: classeTest });
  base.inserer("taches_assignations_eleves", { tache_id: tacheB, eleve_id: "t1" });
  base.inserer("taches_assignations_eleves", { tache_id: tacheA, eleve_id: "r1" });
  const exercicesTest: string[] = [];
  for (const eleve of [...elevesTest, ...elevesReels]) {
    for (const tache of [tacheA, tacheB]) {
      for (let k = 0; k < 2; k++) {
        const ex = base.inserer("exercices_assignes", { tache_id: tache, eleve_id: eleve, graine: k }).id as string;
        if (elevesTest.includes(eleve)) exercicesTest.push(ex);
        for (const champ of ["c1", "c2"]) base.inserer("reponses", { exercice_assigne_id: ex, champ, statut: "correct" });
        base.inserer("debuts_ecran", { exercice_assigne_id: ex, champ: "c1" });
        base.inserer("aides_utilisees", { exercice_assigne_id: ex, champ: "c1", palier: 1 });
      }
    }
  }
  return { base, admin: base.from("classes"), classeTest, classeReelle, elevesTest, elevesReels, exercicesTest };
}
const adminDe = (s: Scene) => s.base as unknown as Parameters<typeof supprimerClasseDeTest>[0];

/** Instantané de toutes les lignes qui NE citent aucun identifiant de `exclus` (profondeur : toute cellule). */
function instantane(base: BaseMemoire, exclus: Set<string>): string {
  const sortie: Record<string, string[]> = {};
  for (const [nom, lignes] of [...base.tables.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    sortie[nom] = lignes.filter((l) => !Object.values(l).some((v) => typeof v === "string" && exclus.has(v))).map((l) => JSON.stringify(l, Object.keys(l).sort()));
  }
  return JSON.stringify(sortie);
}
/** ORACLE : toutes les cellules de toutes les tables, plus les comptes Auth, aucune ne cite un identifiant supprimé. Renvoie les restes. */
function restes(base: BaseMemoire, supprimes: Set<string>): string[] {
  const trouves: string[] = [];
  for (const [nom, lignes] of base.tables) for (const l of lignes) for (const [col, v] of Object.entries(l)) if (typeof v === "string" && supprimes.has(v)) trouves.push(`${nom}.${col}=${v}`);
  for (const id of supprimes) if (base.utilisateursAuth.has(id)) trouves.push(`auth.users=${id}`);
  return trouves;
}

async function main(): Promise<void> {
  // 2. suite
  {
    const s = scene();
    const supprimes = new Set<string>([s.classeTest, ...s.elevesTest, ...s.exercicesTest]);
    const avant = instantane(s.base, supprimes);
    const r = await supprimerClasseDeTest(adminDe(s), s.classeTest);
    verifier(r.ok && r.eleves === 3 && r.exercices === 12 && r.comptesAuthNonSupprimes.length === 0, `suppression réussie : 3 élèves, 12 exercices (${JSON.stringify(r)})`);
    const reste = restes(s.base, supprimes);
    verifier(reste.length === 0, `aucune ligne ne subsiste dans aucune table : ${reste.slice(0, 5).join(", ")}`);
    verifier(instantane(s.base, supprimes) === avant, "tout ce qui n'appartenait pas à la classe de test est STRICTEMENT identique (vraie classe, autre professeur, tâches, compositions)");
    verifier(s.base.table("taches").length === 2 && s.base.table("taches_composition").length === 2, "les tâches et leurs compositions sont conservées");
    verifier(s.base.table("taches_assignations").length === 1 && s.base.table("taches_assignations")[0]!.classe_id === s.classeReelle, "il ne reste que l'assignation de la vraie classe");
    verifier(s.base.table("eleves").length === 3 && s.base.table("inscriptions").length === 3, "les 3 vrais élèves (dont celui d'un autre professeur) et leurs inscriptions restent");
    verifier(s.base.appelsAuth.filter((a) => a.appel === "deleteUser").length === 3, "trois comptes Auth supprimés");
  }

  // ── 3. Refus ──
  {
    const s = scene();
    const tout = JSON.stringify([...s.base.tables.entries()]);
    const reelle = await supprimerClasseDeTest(adminDe(s), s.classeReelle);
    verifier(!reelle.ok && reelle.statut === 404 && JSON.stringify([...s.base.tables.entries()]) === tout, "une VRAIE classe n'est jamais supprimée (404, rien touché)");
    const inconnue = await supprimerClasseDeTest(adminDe(s), "inexistante");
    verifier(!inconnue.ok && inconnue.statut === 404, "classe inconnue : 404");
    s.base.inserer("inscriptions", { eleve_id: "t2", classe_id: s.classeReelle }); // élève de test AUSSI inscrit dans une vraie classe
    const tout2 = JSON.stringify([...s.base.tables.entries()]);
    const partage = await supprimerClasseDeTest(adminDe(s), s.classeTest);
    verifier(!partage.ok && partage.statut === 409 && (partage.elevesPartages ?? []).length === 1 && JSON.stringify([...s.base.tables.entries()]) === tout2, "élève partagé : 409 avec son nom, RIEN n'est supprimé");
  }

  // ── 4. Mutation : retirer n'importe quelle étape est détecté ──
  for (const [i, etape] of ETAPES_SUPPRESSION_CLASSE_TEST.entries()) {
    const s = scene();
    const supprimes = new Set<string>([s.classeTest, ...s.elevesTest, ...s.exercicesTest]);
    const mutees: EtapeSuppression[] = ETAPES_SUPPRESSION_CLASSE_TEST.filter((_, k) => k !== i);
    await supprimerClasseDeTest(adminDe(s), s.classeTest, mutees);
    const nom = etape.genre === "auth" ? "comptes Auth" : etape.table;
    verifier(restes(s.base, supprimes).length > 0, `MUTATION : sans l'étape « ${nom} », l'oracle détecte des restes`);
  }
}

main()
  .then(() => {
    if (echecs.length > 0) {
      console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
      for (const e of echecs) console.error(` - ${e}`);
      process.exit(1);
    }
    console.log(`OK : ${nb} vérifications (cascade d'une classe de test : couverture du schéma relue, scénario avec oracle, refus, mutation de chaque étape)`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
