// Test permanent — prompt "Temps moyen par compétence — profil élève (renfort factuel, pas un
// nouveau diagnostic)" : exerce le VRAI handler compilé (GET /api/profs/eleves/:id/profil, étendu
// avec `competences[].tempsMoyenSecondes`) contre une fausse base en mémoire, même technique que
// scripts/test-profil-competences.ts.

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
const PROF_ID = "prof-uuid-temps-competence";

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
  tables.taches.push({ id: "tache-1", prof_id: PROF_ID, nom: "Devoir 1" });
  tables.eleves.push({ id: "eleve-1", nom: "Martin", prenom: "Léa", actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-1", classe_id: "classe-a" });

  // Scénario 1 : C04, 2 occurrences, toutes avec durée -> moyenne = (80+120)/2 = 100.
  tables.exercices_assignes.push({ id: "ex-1", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.exercices_assignes.push({ id: "ex-2", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.reponses.push({ id: "r1", exercice_assigne_id: "ex-1", champ: "c1", statut: "not_equivalent", bug_detecte: "C04", horodatage: "2026-01-01T00:00:00.000Z", duree_ecoulee_secondes: 80 });
  tables.reponses.push({ id: "r2", exercice_assigne_id: "ex-2", champ: "c1", statut: "not_equivalent", bug_detecte: "C04", horodatage: "2026-01-01T00:01:00.000Z", duree_ecoulee_secondes: 120 });

  // Scénario 2 : C07_ou_C08, 2 occurrences, TOUTES sans durée (antérieures à la mesure fiable) ->
  // aucune tempsMoyenSecondes ne doit apparaître pour cette carte.
  tables.exercices_assignes.push({ id: "ex-3", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.exercices_assignes.push({ id: "ex-4", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.reponses.push({ id: "r3", exercice_assigne_id: "ex-3", champ: "c2", statut: "not_equivalent", bug_detecte: "C07_ou_C08", horodatage: "2026-01-01T00:00:00.000Z", duree_ecoulee_secondes: null });
  tables.reponses.push({ id: "r4", exercice_assigne_id: "ex-4", champ: "c2", statut: "not_equivalent", bug_detecte: "C07_ou_C08", horodatage: "2026-01-01T00:01:00.000Z", duree_ecoulee_secondes: null });

  // Scénario 3 : RECOPIE_NON_REDUITE, 3 occurrences, mélange avec/sans durée -> moyenne calculée
  // UNIQUEMENT sur les 2 occurrences ayant une durée (50 et 150 -> 100), la 3e (null) ignorée.
  tables.exercices_assignes.push({ id: "ex-5", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.exercices_assignes.push({ id: "ex-6", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.exercices_assignes.push({ id: "ex-7", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.reponses.push({ id: "r5", exercice_assigne_id: "ex-5", champ: "c3", statut: "not_equivalent", bug_detecte: "RECOPIE_NON_REDUITE", horodatage: "2026-01-01T00:00:00.000Z", duree_ecoulee_secondes: 50 });
  tables.reponses.push({ id: "r6", exercice_assigne_id: "ex-6", champ: "c3", statut: "not_equivalent", bug_detecte: "RECOPIE_NON_REDUITE", horodatage: "2026-01-01T00:01:00.000Z", duree_ecoulee_secondes: null });
  tables.reponses.push({ id: "r7", exercice_assigne_id: "ex-7", champ: "c3", statut: "not_equivalent", bug_detecte: "RECOPIE_NON_REDUITE", horodatage: "2026-01-01T00:02:00.000Z", duree_ecoulee_secondes: 150 });

  // Bonus (correction par rapport au corps de fonction indicatif du prompt, qui suppose
  // `bug_detecte === code` — faux dès qu'une ligne porte plusieurs codes joints par une virgule,
  // cas réel gen8/gen9) : C05_SIGNE_REPETE co-déclenché avec C06_SIGNE_OPPOSE sur LA MÊME ligne,
  // durée 60 -> doit compter pour les deux codes, pas seulement le premier ni aucun des deux.
  tables.exercices_assignes.push({ id: "ex-8", tache_id: "tache-1", eleve_id: "eleve-1", variante_id: "v1" });
  tables.reponses.push({ id: "r8", exercice_assigne_id: "ex-8", champ: "c4", statut: "not_equivalent", bug_detecte: "C05_SIGNE_REPETE,C06_SIGNE_OPPOSE", horodatage: "2026-01-01T00:00:00.000Z", duree_ecoulee_secondes: 60 });

  const corps = await appeler("eleve-1");
  const parCode = Object.fromEntries(corps.competences.map((c: any) => [c.code, c]));

  if (parCode.C04?.tempsMoyenSecondes !== 100) {
    throw new Error(`Scénario 1 : C04 tempsMoyenSecondes attendu 100, obtenu ${JSON.stringify(parCode.C04)}`);
  }
  console.log("OK : scénario 1 — moyenne correcte (100s) sur 2 occurrences toutes avec durée");

  if (parCode.C07_ou_C08 === undefined) throw new Error("Scénario 2 : C07_ou_C08 attendu présent (occurrences comptent toujours), obtenu absent");
  if ("tempsMoyenSecondes" in parCode.C07_ou_C08) {
    throw new Error(`Scénario 2 : tempsMoyenSecondes attendu absent (toutes durées null), obtenu ${JSON.stringify(parCode.C07_ou_C08)}`);
  }
  console.log("OK : scénario 2 — occurrences toutes antérieures à la mesure fiable -> aucune tempsMoyenSecondes, aucune erreur");

  if (parCode.RECOPIE_NON_REDUITE?.tempsMoyenSecondes !== 100) {
    throw new Error(`Scénario 3 : RECOPIE_NON_REDUITE tempsMoyenSecondes attendu 100 (moyenne de 50 et 150, la null ignorée), obtenu ${JSON.stringify(parCode.RECOPIE_NON_REDUITE)}`);
  }
  console.log("OK : scénario 3 — mélange avec/sans durée : moyenne calculée uniquement sur les occurrences qui en ont");

  if (parCode.C05_SIGNE_REPETE) throw new Error("Bonus : C05_SIGNE_REPETE attendu MASQUÉ au prof (CODES_MASQUES_PROF), obtenu présent");
  if (parCode.C06_SIGNE_OPPOSE?.tempsMoyenSecondes !== 60) {
    throw new Error(`Bonus : C06_SIGNE_OPPOSE tempsMoyenSecondes attendu 60 (ligne multi-codes correctement répartie), obtenu ${JSON.stringify(parCode.C06_SIGNE_OPPOSE)}`);
  }
  console.log("OK : bonus — ligne multi-codes (bug_detecte joint par virgule) correctement répartie sur chaque code, C05 masqué au prof comme ailleurs");

  // --- Non-régression : libellé/description/occurrences inchangés pour le reste ---
  if (parCode.C04.occurrences !== 2 || parCode.C04.statut !== "non_maitrisee" || !parCode.C04.libelle) {
    throw new Error(`Non-régression : C04 libelle/occurrences/statut attendus inchangés, obtenu ${JSON.stringify(parCode.C04)}`);
  }
  console.log("OK : non-régression — libellé/description/occurrences des cartes restent inchangés");

  console.log("TOUS LES TESTS DE TEMPS-PAR-COMPETENCE PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
