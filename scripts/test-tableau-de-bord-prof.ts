// Test permanent — prompt "Tableau de bord professeur" (2/5), Étape 3 : "test de fumée sur les 3
// définitions exactement telles que formulées" au niveau des fonctions pures (voir
// scripts/smoke-test.ts) + ici, le VRAI handler compilé (require()'d tel quel) — GET
// /api/profs/tableau-de-bord — contre une fausse base de données EN MÉMOIRE (même technique que
// scripts/test-ecran-resultats.ts), pour couvrir la jonction requêtes SQL -> agrégation, pas
// seulement les fonctions pures en isolation.

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
const PROF_ID = "prof-uuid";
const AUTRE_PROF_ID = "autre-prof-uuid";

type Ligne = Record<string, any>;

function creerBaseEnMemoire() {
  const tables: Record<string, Ligne[]> = {
    classes: [],
    eleves: [],
    inscriptions: [],
    taches: [],
    taches_assignations: [],
    exercices_assignes: [],
    reponses: [],
  };

  function construireAdmin() {
    return {
      from(table: string) {
        if (!(table in tables)) throw new Error("Table non simulée dans ce test : " + table);
        const filtres: ((ligne: Ligne) => boolean)[] = [];
        let embedEleves = false;
        const materialiser = (lignes: Ligne[]): Ligne[] =>
          embedEleves && table === "inscriptions" ? lignes.map((l) => ({ ...l, eleves: tables.eleves.find((e) => e.id === l.eleve_id) ?? null })) : lignes;
        const lignesFiltrees = () => materialiser(tables[table].filter((ligne) => filtres.every((f) => f(ligne))));

        const chaine: any = {
          select: (cols?: string) => {
            if (typeof cols === "string" && /eleves\(/.test(cols)) embedEleves = true;
            return chaine;
          },
          eq: (col: string, val: unknown) => {
            filtres.push((l) => l[col] === val);
            return chaine;
          },
          in: (col: string, vals: unknown[]) => {
            filtres.push((l) => vals.includes(l[col]));
            return chaine;
          },
          range: (debut: number, fin: number) => Promise.resolve({ data: lignesFiltrees().slice(debut, fin + 1), error: null }),
          then: (resolve: any) => resolve({ data: lignesFiltrees(), error: null }),
        };
        return chaine;
      },
    };
  }

  return { tables, admin: construireAdmin() };
}

const { tables, admin } = creerBaseEnMemoire();

require.cache[cheminSupabaseAdmin] = {
  id: cheminSupabaseAdmin,
  filename: cheminSupabaseAdmin,
  loaded: true,
  exports: {
    supabaseAdmin: () => admin,
    profAuthentifie: async (authHeader: string | undefined) => {
      if (authHeader === "Bearer prof") return { id: PROF_ID };
      if (authHeader === "Bearer autre-prof") return { id: AUTRE_PROF_ID };
      return null;
    },
    eleveAuthentifie: async () => null,
  },
} as any;

async function appeler(req: any): Promise<{ statusCode: number | null; corps: any }> {
  const cheminHandler = "../lib/routes/profs/tableau-de-bord";
  delete require.cache[require.resolve(cheminHandler)];
  const handler = require(cheminHandler).gererProfsTableauDeBord;
  let statusCode: number | null = null;
  let corps: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(objet: unknown) {
      corps = objet;
    },
  };
  await handler(req, res, {});
  return { statusCode, corps };
}

const ENTETES_PROF = { authorization: "Bearer prof" };

function trierParNom(classes: any[]): any[] {
  return [...classes].sort((a, b) => a.nom.localeCompare(b.nom));
}

async function main() {
  const PASSE = "2020-01-01T00:00:00.000Z";
  const FUTUR = "2099-01-01T00:00:00.000Z";

  // --- Fixtures : 2 classes pour PROF_ID, 1 classe pour un autre prof (isolation) ---
  tables.classes.push({ id: "classe-a", prof_id: PROF_ID, nom: "4Ga", code: "AAA111" });
  tables.classes.push({ id: "classe-b", prof_id: PROF_ID, nom: "4Gb", code: "BBB222" });
  tables.classes.push({ id: "classe-autre", prof_id: AUTRE_PROF_ID, nom: "Autre", code: "ZZZ999" });

  tables.eleves.push({ id: "eleve-1", nom: "Martin", prenom: "Léa", actif: true });
  tables.eleves.push({ id: "eleve-2", nom: "Dupont", prenom: "Noah", actif: true });
  tables.eleves.push({ id: "eleve-3", nom: "Petit", prenom: "Sami", actif: false }); // désactivé — exclu du décompte
  tables.eleves.push({ id: "eleve-4", nom: "Roy", prenom: "Ana", actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-1", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-2", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-3", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-4", classe_id: "classe-b" });

  // tache-1 : échéance passée sur classe-a MAIS future sur classe-b -> DOIT compter "en cours"
  // (cas explicitement cité à l'Étape 3).
  tables.taches.push({ id: "tache-1", prof_id: PROF_ID, nom: "Devoir mixte", est_apercu: false });
  tables.taches_assignations.push({ tache_id: "tache-1", classe_id: "classe-a", date_echeance: PASSE });
  tables.taches_assignations.push({ tache_id: "tache-1", classe_id: "classe-b", date_echeance: FUTUR });

  // tache-2 : toutes ses assignations en retard -> ne doit PAS compter.
  tables.taches.push({ id: "tache-2", prof_id: PROF_ID, nom: "Devoir en retard", est_apercu: false });
  tables.taches_assignations.push({ tache_id: "tache-2", classe_id: "classe-a", date_echeance: PASSE });

  // tache-3 : jamais assignée -> ne doit PAS compter (cas explicitement cité à l'Étape 1).
  tables.taches.push({ id: "tache-3", prof_id: PROF_ID, nom: "Devoir jamais assigné", est_apercu: false });

  // tache-4 : échéance null -> DOIT compter "en cours".
  tables.taches.push({ id: "tache-4", prof_id: PROF_ID, nom: "Devoir sans échéance", est_apercu: false });
  tables.taches_assignations.push({ tache_id: "tache-4", classe_id: "classe-a", date_echeance: null });

  // Réponses avec bug, réparties sur tache-1/tache-2 (prof) — doivent compter.
  tables.exercices_assignes.push({ id: "ex-1", tache_id: "tache-1", eleve_id: "eleve-1" });
  tables.exercices_assignes.push({ id: "ex-2", tache_id: "tache-2", eleve_id: "eleve-2" });
  tables.reponses.push({ id: "r1", exercice_assigne_id: "ex-1", bug_detecte: "C04" });
  tables.reponses.push({ id: "r2", exercice_assigne_id: "ex-1", bug_detecte: null });
  tables.reponses.push({ id: "r3", exercice_assigne_id: "ex-2", bug_detecte: "C07_ou_C08" });

  // Tâche/exercice/réponse d'un AUTRE prof — ne doit apparaître dans AUCUN chiffre de PROF_ID.
  tables.taches.push({ id: "tache-autre", prof_id: AUTRE_PROF_ID, nom: "Devoir autre prof", est_apercu: false });
  tables.taches_assignations.push({ tache_id: "tache-autre", classe_id: "classe-autre", date_echeance: null });
  tables.exercices_assignes.push({ id: "ex-autre", tache_id: "tache-autre", eleve_id: "eleve-4" });
  tables.reponses.push({ id: "r-autre", exercice_assigne_id: "ex-autre", bug_detecte: "C04" });

  const { statusCode, corps } = await appeler({ method: "GET", headers: ENTETES_PROF, query: {} });
  if (statusCode !== 200) throw new Error(`Attendu 200, obtenu ${statusCode} : ${JSON.stringify(corps)}`);

  if (corps.nombreClasses !== 2) throw new Error(`nombreClasses attendu 2 (classe-autre exclue), obtenu ${corps.nombreClasses}`);
  console.log("OK : nombreClasses = 2 (classes du prof authentifié seulement, classe-autre exclue)");

  if (corps.nombreTachesEnCours !== 2) {
    throw new Error(`nombreTachesEnCours attendu 2 (tache-1 mixte + tache-4 échéance null ; tache-2 en retard et tache-3 jamais assignée exclues), obtenu ${corps.nombreTachesEnCours}`);
  }
  console.log("OK : nombreTachesEnCours = 2 (tache-1 échéance mixte passée/future comptée, tache-2 toute en retard exclue, tache-3 jamais assignée exclue, tache-4 échéance null comptée)");

  if (corps.reponsesAvecBug !== 2) {
    throw new Error(`reponsesAvecBug attendu 2 (r1+r3, r2 null exclue, r-autre d'un autre prof exclue), obtenu ${corps.reponsesAvecBug}`);
  }
  console.log("OK : reponsesAvecBug = 2 (bug_detecte non nuls des tâches du prof authentifié seulement — isolation vérifiée)");

  const classesTriees = trierParNom(corps.classes);
  if (classesTriees.length !== 2) throw new Error(`classes : 2 attendues, obtenu ${classesTriees.length}`);
  const classeA = classesTriees.find((c: any) => c.nom === "4Ga");
  const classeB = classesTriees.find((c: any) => c.nom === "4Gb");
  if (classeA.code !== "AAA111" || classeA.nombreElevesActifs !== 2) {
    throw new Error(`classe-a attendue {code:"AAA111", nombreElevesActifs:2} (eleve-3 désactivé exclu), obtenu ${JSON.stringify(classeA)}`);
  }
  if (classeB.code !== "BBB222" || classeB.nombreElevesActifs !== 1) {
    throw new Error(`classe-b attendue {code:"BBB222", nombreElevesActifs:1}, obtenu ${JSON.stringify(classeB)}`);
  }
  console.log("OK : classes — nom/code/nombreElevesActifs exacts pour chaque classe, élève désactivé exclu du décompte");

  // --- Prof sans aucune classe/tâche : tout à 0, jamais une erreur ---
  const { statusCode: scVide, corps: corpsVide } = await appeler({ method: "GET", headers: { authorization: "Bearer autre-prof" }, query: {} });
  if (scVide !== 200) throw new Error(`Prof avec classes/tâches attendu 200, obtenu ${scVide}`);
  if (corpsVide.nombreClasses !== 1 || corpsVide.nombreTachesEnCours !== 1 || corpsVide.reponsesAvecBug !== 1) {
    throw new Error(`Autre prof attendu {nombreClasses:1, nombreTachesEnCours:1, reponsesAvecBug:1} (ses propres données, isolées), obtenu ${JSON.stringify(corpsVide)}`);
  }
  console.log("OK : isolation symétrique — l'autre prof voit ses propres données (1/1/1), jamais celles de PROF_ID");

  // --- Méthode incorrecte / non authentifié ---
  const { statusCode: scPost } = await appeler({ method: "POST", headers: ENTETES_PROF, query: {} });
  if (scPost !== 405) throw new Error(`POST attendu rejeté (405), obtenu ${scPost}`);
  const { statusCode: scAnon } = await appeler({ method: "GET", headers: {}, query: {} });
  if (scAnon !== 401) throw new Error(`Non authentifié attendu rejeté (401), obtenu ${scAnon}`);
  console.log("OK : méthode incorrecte (405) et non authentifié (401) correctement rejetés");

  console.log("TOUS LES TESTS DU TABLEAU DE BORD PROF PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
