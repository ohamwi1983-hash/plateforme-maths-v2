// Test permanent — prompt "Onglets Tableau de bord/Résultats élève" : GET /api/eleves/mes-resultats,
// exécuté contre le VRAI handler compilé (require()'d tel quel, jamais réimplémenté), même technique
// que scripts/test-badge-serie.ts. Le faux client Supabase ne trie pas réellement les lignes passées
// à `.order(...)` — les tableaux `reponses` ci-dessous sont donc écrits DÉJÀ dans l'ordre que
// produirait la vraie requête `.order("horodatage", { ascending: true })` (la plus ancienne en
// premier).

export {};

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");

function construireChaineFausse(donnees: unknown): any {
  const chaine: any = {
    select: () => chaine,
    eq: () => chaine,
    in: () => chaine,
    order: () => chaine,
    returns: () => chaine,
    then: (resolve: (v: { data: unknown; error: null }) => void) => resolve({ data: donnees, error: null }),
  };
  return chaine;
}

const ELEVE_ID = "eleve-resultats-uuid";
const TACHE_A = "tache-effectuee";
const TACHE_B = "tache-anterieure";
const CLASSE_ID = "classe-resultats";
const EX_A = "ex-a";
const EX_B = "ex-b";
const FUTUR = "2099-01-01T00:00:00.000Z";
const PASSE = "2020-01-01T00:00:00.000Z";
const DEBUT = "2024-01-01T00:00:00.000Z";

const DONNEES: Record<string, unknown> = {
  exercices_assignes: [
    { id: EX_A, tache_id: TACHE_A, champs_attendus: ["champ1", "champ2"] },
    { id: EX_B, tache_id: TACHE_B, champs_attendus: ["champ1"] },
  ],
  taches: [
    { id: TACHE_A, nom: "Devoir A" },
    { id: TACHE_B, nom: "Devoir B" },
  ],
  inscriptions: [{ classe_id: CLASSE_ID }],
  taches_assignations: [
    { tache_id: TACHE_A, classe_id: CLASSE_ID, date_echeance: FUTUR, date_debut: DEBUT }, // pas encore échue + complète -> "effectuees"
    { tache_id: TACHE_B, classe_id: CLASSE_ID, date_echeance: PASSE, date_debut: DEBUT }, // échue -> "anterieures"
  ],
  // Ordre chronologique croissant. 2 échecs C04 (ancien) puis 2 réussites (récent) sur la tâche A :
  // évolution attendue "en_progres". Tâche B : 1 réussite directe.
  reponses: [
    { exercice_assigne_id: EX_A, champ: "champ1", statut: "not_equivalent", bug_detecte: "C04", horodatage: "2024-02-01T00:00:00.000Z" },
    { exercice_assigne_id: EX_A, champ: "champ2", statut: "not_equivalent", bug_detecte: "C04", horodatage: "2024-02-02T00:00:00.000Z" },
    { exercice_assigne_id: EX_A, champ: "champ1", statut: "correct", bug_detecte: null, horodatage: "2024-02-03T00:00:00.000Z" },
    { exercice_assigne_id: EX_A, champ: "champ2", statut: "correct", bug_detecte: null, horodatage: "2024-02-04T00:00:00.000Z" },
    { exercice_assigne_id: EX_B, champ: "champ1", statut: "correct", bug_detecte: null, horodatage: "2024-02-05T00:00:00.000Z" },
  ],
};

const DONNEES_VIDES: Record<string, unknown> = { exercices_assignes: [], taches: [], inscriptions: [], taches_assignations: [], reponses: [] };

async function appelerHandler(donnees: Record<string, unknown>): Promise<{ statusCode: number | null; corps: any }> {
  const fauxAdmin = {
    from(table: string) {
      if (!(table in donnees)) throw new Error("Table non simulée dans ce test : " + table);
      return construireChaineFausse(donnees[table]);
    },
  };

  require.cache[cheminSupabaseAdmin] = {
    id: cheminSupabaseAdmin,
    filename: cheminSupabaseAdmin,
    loaded: true,
    exports: {
      supabaseAdmin: () => fauxAdmin,
      eleveAuthentifie: async () => ({ id: ELEVE_ID }),
    },
  } as any;
  delete require.cache[require.resolve("../lib/routes/eleves/mes-resultats")];

  const { gererElevesMesResultats: handler } = require("../lib/routes/eleves/mes-resultats");

  const req = { method: "GET", headers: { authorization: "Bearer stub" } };
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

async function main() {
  const { statusCode: scVide, corps: corpsVide } = await appelerHandler(DONNEES_VIDES);
  if (scVide !== 200) throw new Error(`Vide : attendu 200, obtenu ${scVide}`);
  if (corpsVide.competences.length !== 0 || corpsVide.evolution.length !== 0 || corpsVide.historiqueTaches.length !== 0) {
    throw new Error(`Vide : attendu tout vide, obtenu ${JSON.stringify(corpsVide)}`);
  }
  if (corpsVide.tendanceScore !== "stable") throw new Error(`Vide : tendanceScore attendu "stable", obtenu ${corpsVide.tendanceScore}`);
  console.log("OK : aucun exercice assigné -> compétences/évolution/historique vides, tendanceScore stable");

  const { statusCode: sc, corps } = await appelerHandler(DONNEES);
  if (sc !== 200) throw new Error(`Principal : attendu 200, obtenu ${sc}`);

  if (corps.historiqueTaches.length !== 2) throw new Error(`Historique : attendu 2 tâches, obtenu ${corps.historiqueTaches.length}`);
  const [tacheA, tacheB] = corps.historiqueTaches; // triées par date croissante -> A avant B
  if (tacheA.tacheId !== TACHE_A || tacheA.correct !== 2 || tacheA.total !== 2 || tacheA.pourcentage !== 100) {
    throw new Error(`Tâche A : attendu {correct:2,total:2,pourcentage:100}, obtenu ${JSON.stringify(tacheA)}`);
  }
  if (tacheB.tacheId !== TACHE_B || tacheB.correct !== 1 || tacheB.total !== 1) {
    throw new Error(`Tâche B : attendu {correct:1,total:1}, obtenu ${JSON.stringify(tacheB)}`);
  }
  console.log("OK : historiqueTaches — 2 tâches notées (effectuée + antérieure), scores corrects, triées chronologiquement");

  const c04 = corps.competences.find((c: any) => c.code === "C04");
  if (!c04 || c04.statut !== "non_maitrisee" || c04.occurrences !== 2) {
    throw new Error(`Compétences : C04 attendu {statut:non_maitrisee, occurrences:2}, obtenu ${JSON.stringify(c04)}`);
  }
  console.log("OK : competences — C04 correctement remonté (2 occurrences, non_maitrisee)");

  const evoC04 = corps.evolution.find((e: any) => e.code === "C04");
  if (!evoC04 || evoC04.tendance !== "en_progres" || evoC04.occurrencesAnciennes !== 2 || evoC04.occurrencesRecentes !== 0) {
    throw new Error(`Évolution : C04 attendu {tendance:en_progres, anciennes:2, recentes:0}, obtenu ${JSON.stringify(evoC04)}`);
  }
  console.log("OK : evolution — C04 correctement calculé en_progres (2 échecs anciens -> 0 récent)");

  if (corps.ordreCategories === undefined) throw new Error("ordreCategories absent de la réponse");
  console.log("OK : ordreCategories exposé (même convention que GET /api/profs/eleves/:id/profil)");

  console.log("TOUS LES TESTS MES-RESULTATS PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
