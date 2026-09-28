// Test permanent — prompt "Profil de compétences élève", Étape 5 (complément intégration à la
// suite de fumée de scripts/smoke-test.ts, qui couvre déjà `calculerProfilCompetences` en
// isolation) : exerce le VRAI handler compilé — GET /api/profs/eleves/:id/profil — contre une
// fausse base de données EN MÉMOIRE (même technique que scripts/test-ecran-resultats.ts).

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
    exercices_assignes: [],
    reponses: [],
  };

  function construireAdmin() {
    return {
      from(table: string) {
        if (!(table in tables)) throw new Error("Table non simulée dans ce test : " + table);
        const filtres: ((ligne: Ligne) => boolean)[] = [];
        let tri: { colonne: string; ascendant: boolean } | null = null;
        const lignesFiltrees = () => {
          let resultat = tables[table].filter((ligne) => filtres.every((f) => f(ligne)));
          if (tri) {
            const { colonne, ascendant } = tri;
            resultat = [...resultat].sort((a, b) => (a[colonne] < b[colonne] ? -1 : a[colonne] > b[colonne] ? 1 : 0) * (ascendant ? 1 : -1));
          }
          return resultat;
        };

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
          order: (col: string, opts?: { ascending?: boolean }) => {
            tri = { colonne: col, ascendant: opts?.ascending !== false };
            return chaine;
          },
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

async function appeler(req: any, params: Record<string, string>): Promise<{ statusCode: number | null; corps: any }> {
  const cheminHandler = "../lib/routes/profs/eleves/profil";
  delete require.cache[require.resolve(cheminHandler)];
  const handler = require(cheminHandler).gererProfsElevesProfil;
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
  await handler(req, res, params);
  return { statusCode, corps };
}

const ENTETES_PROF = { authorization: "Bearer prof" };

async function main() {
  // --- Fixtures ---
  tables.classes.push({ id: "classe-a", prof_id: PROF_ID, nom: "4Ga" });
  tables.classes.push({ id: "classe-autre-prof", prof_id: AUTRE_PROF_ID, nom: "Autre" });
  tables.taches.push({ id: "tache-1", prof_id: PROF_ID, nom: "Devoir 1" });
  tables.taches.push({ id: "tache-2", prof_id: PROF_ID, nom: "Devoir 2" });
  tables.taches.push({ id: "tache-autre-prof", prof_id: AUTRE_PROF_ID, nom: "Devoir d'un autre prof" });

  tables.eleves.push({ id: "eleve-1", nom: "Martin", prenom: "Léa", actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-1", classe_id: "classe-a" });

  // 2 exercices assignés par CE prof (tâches 1 et 2), 1 exercice assigné par un AUTRE prof — ne
  // doit jamais entrer dans l'agrégation (isolation entre profs, pas seulement au niveau élève).
  tables.exercices_assignes.push({ id: "ex-1", tache_id: "tache-1", eleve_id: "eleve-1" });
  tables.exercices_assignes.push({ id: "ex-2", tache_id: "tache-2", eleve_id: "eleve-1" });
  tables.exercices_assignes.push({ id: "ex-autre-prof", tache_id: "tache-autre-prof", eleve_id: "eleve-1" });

  // ex-1/reconnaissance : 1re tentative ratée (C07_ou_C08), puis CORRIGÉE — correctif (signalé par
  // l'utilisateur, cas réel "Nathan"/FC_CE_FANTOME) : TOUTES les occurrences historiques comptent
  // désormais, jamais dédupliquées par champ (revirement volontaire par rapport à l'ancienne
  // convention "dernière soumission par champ", qui faisait disparaître ce genre de cas réel).
  // C07_ou_C08 doit donc bien apparaître (1 occurrence -> en_observation) malgré la correction.
  tables.reponses.push({ id: "r1", exercice_assigne_id: "ex-1", champ: "reconnaissance", statut: "not_equivalent", bug_detecte: "C07_ou_C08", horodatage: "2026-01-01T00:00:00.000Z" });
  tables.reponses.push({ id: "r2", exercice_assigne_id: "ex-1", champ: "reconnaissance", statut: "correct", bug_detecte: null, horodatage: "2026-01-01T00:05:00.000Z" });
  // ex-1/isolement : bug C04, jamais corrigé.
  tables.reponses.push({ id: "r3", exercice_assigne_id: "ex-1", champ: "isolement", statut: "not_equivalent", bug_detecte: "C04", horodatage: "2026-01-01T00:00:00.000Z" });
  // ex-2/isolement (2e tâche, même élève, même champ) : encore C04 -> 2 occurrences au total,
  // tous exercices/tâches confondus (Étape 2 : "toutes ses tâches").
  tables.reponses.push({ id: "r4", exercice_assigne_id: "ex-2", champ: "isolement", statut: "not_equivalent", bug_detecte: "C04", horodatage: "2026-01-01T00:00:00.000Z" });
  // Exercice d'un AUTRE prof : bug FC_CE_FANTOME qui ne doit JAMAIS apparaître dans le profil.
  tables.reponses.push({ id: "r5", exercice_assigne_id: "ex-autre-prof", champ: "ce", statut: "not_equivalent", bug_detecte: "FC_CE_FANTOME", horodatage: "2026-01-01T00:00:00.000Z" });
  // ex-3/ce : reproduit EXACTEMENT le cas réel confirmé (requête directe en base, cas "Nathan") — 2
  // tentatives ratées sur le MÊME (exercice_assigne_id, champ), toutes deux FC_CE_FANTOME, PUIS une
  // resoumission corrective sur ce même champ. Sous l'ancienne convention ("dernière soumission par
  // champ"), les 2 occurrences réelles disparaissaient ENTIÈREMENT (aucune n'étant la dernière) —
  // c'est le point exact où le signal se perdait, confirmé par l'utilisateur. Doit désormais compter
  // 2 occurrences -> non_maitrisee, quel que soit le fait que le champ ait fini par être résolu.
  tables.exercices_assignes.push({ id: "ex-3", tache_id: "tache-1", eleve_id: "eleve-1" });
  tables.reponses.push({ id: "r6", exercice_assigne_id: "ex-3", champ: "ce", statut: "not_equivalent", bug_detecte: "FC_CE_FANTOME", horodatage: "2026-01-01T00:00:00.000Z" });
  tables.reponses.push({ id: "r7", exercice_assigne_id: "ex-3", champ: "ce", statut: "not_equivalent", bug_detecte: "FC_CE_FANTOME", horodatage: "2026-01-01T00:01:00.000Z" });
  tables.reponses.push({ id: "r8", exercice_assigne_id: "ex-3", champ: "ce", statut: "correct", bug_detecte: null, horodatage: "2026-01-01T00:02:00.000Z" });

  const { statusCode, corps } = await appeler({ method: "GET", headers: ENTETES_PROF }, { id: "eleve-1" });
  if (statusCode !== 200) throw new Error(`Profil attendu accepté (200), obtenu ${statusCode}, ${JSON.stringify(corps)}`);
  const parCode = Object.fromEntries(corps.competences.map((c: any) => [c.code, c]));

  if (Object.keys(parCode).length !== 3) {
    throw new Error(`3 compétences attendues (C04, C07_ou_C08, FC_CE_FANTOME — toutes malgré une correction ultérieure ; le FC_CE_FANTOME d'un AUTRE prof reste exclu) — obtenu ${JSON.stringify(corps.competences)}`);
  }
  if (!parCode.C04 || parCode.C04.statut !== "non_maitrisee" || parCode.C04.occurrences !== 2) {
    throw new Error(`C04 attendu non_maitrisee/2 occurrences (ex-1 + ex-2, tâches distinctes du même prof), obtenu ${JSON.stringify(parCode.C04)}`);
  }
  if (!parCode.C07_ou_C08 || parCode.C07_ou_C08.statut !== "en_observation" || parCode.C07_ou_C08.occurrences !== 1) {
    throw new Error(`C07_ou_C08 attendu en_observation/1 occurrence (compte malgré la correction ultérieure — correctif "Nathan"), obtenu ${JSON.stringify(parCode.C07_ou_C08)}`);
  }
  // Cas réel exact confirmé par l'utilisateur (requête directe en base) : 2 occurrences sur le
  // MÊME champ, toutes deux suivies d'une resoumission qui a corrigé ce champ — devrait maintenant
  // compter 2 (non_maitrisee), PAS 0 comme avant ce correctif, et pas 3 (l'occurrence d'un autre
  // prof, r5, doit rester exclue).
  if (!parCode.FC_CE_FANTOME || parCode.FC_CE_FANTOME.statut !== "non_maitrisee" || parCode.FC_CE_FANTOME.occurrences !== 2) {
    throw new Error(`FC_CE_FANTOME attendu non_maitrisee/2 occurrences (cas réel "Nathan" : 2 échecs sur le même champ, puis corrigé — isolation d'un autre prof toujours respectée), obtenu ${JSON.stringify(parCode.FC_CE_FANTOME)}`);
  }
  console.log("OK : profil agrège correctement toutes les tâches DE CE PROF pour l'élève (TOUTES les occurrences historiques comptent, même 2 fois sur le même champ ensuite corrigé — cas réel 'Nathan' reproduit et résolu ; exercice d'un autre prof exclu)");

  // --- Isolation entre profs : élève d'un autre prof, jamais confirmé ---
  const { statusCode: scAutreProf } = await appeler({ method: "GET", headers: { authorization: "Bearer autre-prof" } }, { id: "eleve-1" });
  if (scAutreProf !== 404) throw new Error(`Élève n'appartenant à aucune classe de cet autre prof attendu refusé (404), obtenu ${scAutreProf}`);
  console.log("OK : élève d'un autre prof refusé (404) — jamais confirmé son existence");

  // --- Méthode incorrecte ---
  const { statusCode: scMethode } = await appeler({ method: "POST", headers: ENTETES_PROF }, { id: "eleve-1" });
  if (scMethode !== 405) throw new Error(`Méthode POST attendue rejetée (405), obtenu ${scMethode}`);
  console.log("OK : méthode incorrecte (405) correctement rejetée");

  console.log("TOUS LES TESTS DU PROFIL DE COMPETENCES PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
