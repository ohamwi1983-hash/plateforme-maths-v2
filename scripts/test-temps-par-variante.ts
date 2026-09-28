// Test permanent — prompt "Temps de réponse par type d'exercice — profil élève" : exerce le VRAI
// handler compilé (GET /api/profs/eleves/:id/profil, étendu avec `tempsParVariante`) contre une
// fausse base EN MÉMOIRE, même technique que scripts/test-profil-competences.ts. Couvre les 3
// scénarios exigés par le prompt (§ "Vérification attendue") :
//   1. Double tentative sur un même champ -> `tempsTotalExercice` ne compte la durée qu'une fois.
//   2. Élève dans exactement une classe, camarades ayant fait la même variante via des tâches
//      DIFFÉRENTES -> médiane de classe calculée correctement, peu importe le mode d'assignation.
//   3. Élève dans 0 classe, puis dans 2 classes -> volet B absent dans les deux cas.

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

import { classeUniqueDeEleve } from "../lib/classeUniqueDeEleve";

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
const PROF_ID = "prof-uuid";

type Ligne = Record<string, any>;

function creerBaseEnMemoire() {
  const tables: Record<string, Ligne[]> = {
    classes: [],
    eleves: [],
    inscriptions: [],
    taches: [],
    exercices_assignes: [],
    reponses: [],
  };

  function construireAdmin() {
    return {
      from(table: string) {
        if (!(table in tables)) throw new Error("Table non simulée dans ce test : " + table);
        const filtres: ((ligne: Ligne) => boolean)[] = [];
        const lignesFiltrees = () => tables[table].filter((ligne) => filtres.every((f) => f(ligne)));

        const chaine: any = {
          select: () => chaine,
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
    profAuthentifie: async (authHeader: string | undefined) => (authHeader === "Bearer prof" ? { id: PROF_ID } : null),
    eleveAuthentifie: async () => null,
  },
} as any;

async function appeler(eleveId: string): Promise<any> {
  const cheminHandler = "../lib/routes/profs/eleves/profil";
  delete require.cache[require.resolve(cheminHandler)];
  const handler = require(cheminHandler).gererProfsElevesProfil;
  let corps: any = null;
  const res = {
    status() {
      return this;
    },
    json(objet: unknown) {
      corps = objet;
    },
  };
  await handler({ method: "GET", headers: { authorization: "Bearer prof" } }, res, { id: eleveId });
  return corps;
}

async function main() {
  // --- Fixtures communes ---
  tables.classes.push({ id: "classe-a", prof_id: PROF_ID, nom: "4Ga" });
  tables.classes.push({ id: "classe-b", prof_id: PROF_ID, nom: "4Gb" });
  tables.taches.push({ id: "tache-1", prof_id: PROF_ID, nom: "Devoir 1" });
  tables.taches.push({ id: "tache-2", prof_id: PROF_ID, nom: "Devoir 2" });
  tables.taches.push({ id: "tache-3", prof_id: PROF_ID, nom: "Devoir 3" });

  tables.eleves.push({ id: "eleve-1", nom: "Martin", prenom: "Léa", actif: true });
  tables.eleves.push({ id: "eleve-2", nom: "Dupont", prenom: "Théo", actif: true });
  tables.eleves.push({ id: "eleve-3", nom: "Petit", prenom: "Nora", actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-1", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-2", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-3", classe_id: "classe-a" });

  // --- Scénario 1+2 : eleve-1, exactement 1 classe (classe-a) ---
  // ex-1 (variante v1, via tache-1) : 2 tentatives sur le MÊME champ "c1" — la 1re ratée (durée
  // partielle 100s, `debuts_ecran` posé à t0), la 2e réussie SUR LE MÊME champ (durée cumulée
  // depuis ce même t0 -> 130s, jamais 100+130). Seule la plus récente (130) doit compter.
  tables.exercices_assignes.push({ id: "ex-1", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.reponses.push({ id: "r1", exercice_assigne_id: "ex-1", champ: "c1", duree_ecoulee_secondes: 100, horodatage: "2026-01-01T00:01:00.000Z", bug_detecte: "C04" });
  tables.reponses.push({ id: "r2", exercice_assigne_id: "ex-1", champ: "c1", duree_ecoulee_secondes: 130, horodatage: "2026-01-01T00:02:00.000Z", bug_detecte: null });

  // Camarades de classe-a, même variante v1, via des tâches DIFFÉRENTES de celle d'eleve-1
  // (tache-2/tache-3) — la reformulation actée du prompt élimine l'ambiguïté du mode d'assignation :
  // seule compte l'appartenance à la classe, jamais la tâche d'origine de chaque camarade.
  tables.exercices_assignes.push({ id: "ex-2", tache_id: "tache-2", eleve_id: "eleve-2", variante_id: "v1" });
  tables.reponses.push({ id: "r3", exercice_assigne_id: "ex-2", champ: "c1", duree_ecoulee_secondes: 100, horodatage: "2026-01-01T00:01:00.000Z", bug_detecte: null });
  tables.exercices_assignes.push({ id: "ex-3", tache_id: "tache-3", eleve_id: "eleve-3", variante_id: "v1" });
  tables.reponses.push({ id: "r4", exercice_assigne_id: "ex-3", champ: "c1", duree_ecoulee_secondes: 200, horodatage: "2026-01-01T00:01:00.000Z", bug_detecte: null });

  const corps1 = await appeler("eleve-1");
  const entree1 = corps1.tempsParVariante.find((e: any) => e.variante_id === "v1");
  if (!entree1) throw new Error(`Entrée "v1" attendue dans tempsParVariante, obtenu ${JSON.stringify(corps1.tempsParVariante)}`);
  if (entree1.tempsMoyenEleve !== 130) {
    throw new Error(`Scénario 1 : tempsMoyenEleve attendu 130 (dédoublonnage par champ — dernière tentative seule), obtenu ${entree1.tempsMoyenEleve}`);
  }
  console.log("OK : scénario 1 — double tentative sur le même champ ne compte la durée qu'une fois (130, jamais 230)");

  if (entree1.medianeClasse !== 150) {
    throw new Error(`Scénario 2 : medianeClasse attendue 150 (médiane de [100, 200], camarades assignés via des tâches différentes), obtenu ${entree1.medianeClasse}`);
  }
  console.log("OK : scénario 2 — médiane de classe (150) correcte, indépendamment du mode d'assignation de chaque camarade");

  // --- Scénario 3a : élève dans 0 classe ---
  // NOTE IMPORTANTE (constatée en écrivant ce test, pas anticipée par le prompt) : ce cas n'est PAS
  // atteignable via l'endpoint `GET /api/profs/eleves/:id/profil` lui-même. Sa garde d'appartenance
  // PRÉEXISTANTE (`classesDuProfPourEleve`, lib/eleveDuProf.ts:13-22, invoquée profil.ts:53-57)
  // renvoie 404 "Élève introuvable" pour tout élève inscrit dans 0 classe DE CE PROF, avant même que
  // `calculerTempsParVariante`/`classeUniqueDeEleve` ne s'exécutent. Un élève qui franchit cette
  // garde a donc TOUJOURS au moins 1 ligne dans `inscriptions` — le cas "0 classe" ne peut donc
  // jamais être observé en pratique par `classeUniqueDeEleve` DANS ce endpoint. Vérifié ici en
  // isolation (le helper lui-même, correct par construction : `data?.length === 1 ? ... : null`,
  // donc `null` sur un tableau vide) plutôt que via un appel endpoint qui 404erait avant d'y arriver.
  tables.eleves.push({ id: "eleve-solo", nom: "Solo", prenom: "Iris", actif: true });
  const classeEleveSolo0 = await classeUniqueDeEleve(admin as any, "eleve-solo");
  if (classeEleveSolo0 !== null) {
    throw new Error(`Scénario 3a (unitaire) : classeUniqueDeEleve attendue null (0 inscription), obtenu ${classeEleveSolo0}`);
  }
  console.log("OK : scénario 3a (helper, en isolation — inatteignable via l'endpoint qui 404e avant, voir note ci-dessus) — classeUniqueDeEleve renvoie null sur 0 classe");

  // --- Scénario 3b : élève dans 2 classes (CE cas, lui, est bien atteignable via l'endpoint : la
  // garde d'appartenance exige seulement >= 1 classe DE CE PROF, pas une appartenance unique) ---
  tables.inscriptions.push({ eleve_id: "eleve-solo", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-solo", classe_id: "classe-b" });
  tables.exercices_assignes.push({ id: "ex-solo", tache_id: "tache-1", eleve_id: "eleve-solo", variante_id: "v1" });
  tables.reponses.push({ id: "r-solo", exercice_assigne_id: "ex-solo", champ: "c1", duree_ecoulee_secondes: 42, horodatage: "2026-01-01T00:01:00.000Z", bug_detecte: null });

  const corps3b = await appeler("eleve-solo");
  const entree3b = corps3b.tempsParVariante.find((e: any) => e.variante_id === "v1");
  if (!entree3b || entree3b.tempsMoyenEleve !== 42) {
    throw new Error(`Scénario 3b : volet A attendu inchangé (tempsMoyenEleve 42), obtenu ${JSON.stringify(entree3b)}`);
  }
  if (entree3b.medianeClasse !== null) {
    throw new Error(`Scénario 3b : medianeClasse attendue null (2 classes -> ambiguïté, aucune classe devinée), obtenu ${entree3b.medianeClasse}`);
  }
  console.log("OK : scénario 3b — élève dans 2 classes : volet B toujours absent (jamais une classe devinée), volet A seul affiché");

  console.log("TOUS LES TESTS DE TEMPS-PAR-VARIANTE PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
