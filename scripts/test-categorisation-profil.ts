// Test permanent — prompt "Catégorisation des compétences + regroupement du profil élève
// (Option B)". 2 couches, même convention que scripts/test-profil-competences.ts (dont ce fichier
// reprend le harnais de base EN MÉMOIRE) :
// 1. `categoriserCompetence`/`ORDRE_CATEGORIES` (lib/categoriesCompetences.ts) en isolation, sans
//    mock réseau.
// 2. Le VRAI handler compilé — GET /api/profs/eleves/:id/profil — pour prouver que
//    `categorie`/`sousCategorie` par compétence et `ordreCategories` au niveau racine sont bien
//    exposés au client (public/prof.html n'a pas de bundler, jamais de 2e table dupliquée côté
//    client — voir le commentaire de tête de lib/categoriesCompetences.ts).

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error("ECHEC : " + message);
  console.log("OK : " + message);
}

// --- Couche 1 : fonction pure, sans mock réseau ---
function testerCouchePure() {
  const { categoriserCompetence, ORDRE_CATEGORIES, CATEGORIE_PAR_DEFAUT } = require("../lib/categoriesCompetences");

  const cePartielle = categoriserCompetence("CE_PARTIELLE");
  assert(
    cePartielle.categorie === "Réponse partielle" && cePartielle.sousCategorie === "Paire de valeurs",
    `categoriserCompetence("CE_PARTIELLE") -> catégorie "Réponse partielle"/sous-catégorie "Paire de valeurs" (obtenu ${JSON.stringify(cePartielle)})`
  );

  const c05 = categoriserCompetence("C05_SIGNE_REPETE");
  assert(
    c05.categorie === "Confusion de signe/sens" && c05.sousCategorie === undefined,
    `categoriserCompetence("C05_SIGNE_REPETE") -> catégorie "Confusion de signe/sens", AUCUNE sous-catégorie (obtenu ${JSON.stringify(c05)})`
  );

  const inconnu = categoriserCompetence("CODE_FICTIF_JAMAIS_VU_DANS_LE_DICTIONNAIRE");
  assert(
    inconnu.categorie === CATEGORIE_PAR_DEFAUT.categorie && inconnu.sousCategorie === undefined,
    `categoriserCompetence(code fictif absent de la table) -> "Non classé", jamais de plantage (obtenu ${JSON.stringify(inconnu)})`
  );

  assert(Array.isArray(ORDRE_CATEGORIES) && ORDRE_CATEGORIES.length > 0, "ORDRE_CATEGORIES est un tableau non vide");
  assert(
    ORDRE_CATEGORIES[ORDRE_CATEGORIES.length - 1] === "Non classé",
    `"Non classé" toujours en dernière position de ORDRE_CATEGORIES (obtenu ${JSON.stringify(ORDRE_CATEGORIES)})`
  );
  const idxReponsePartielle = ORDRE_CATEGORIES.indexOf("Réponse partielle");
  const idxConfusionSigne = ORDRE_CATEGORIES.indexOf("Confusion de signe/sens");
  assert(
    idxReponsePartielle >= 0 && idxConfusionSigne >= 0 && idxReponsePartielle < idxConfusionSigne,
    `"Réponse partielle" (catégorie 1) précède "Confusion de signe/sens" (catégorie 2) dans ORDRE_CATEGORIES, ordre d'apparition dans la table (obtenu ${JSON.stringify(ORDRE_CATEGORIES)})`
  );

  // Vérification de couverture explicite (garde-fou "grep avant de dupliquer" transversal) : les 5
  // codes réels du dictionnaire (lib/dictionnaireCompetences.ts, 38 codes à cette date) SANS entrée
  // dans CATEGORIES_COMPETENCES, déjà documentés en tête de lib/categoriesCompetences.ts et dans
  // RAPPORT.md — doivent retomber sur "Non classé", jamais deviner une catégorie plausible.
  const codesManquants = ["C04", "FC_PRODUIT_NUL_OUBLIE", "GRILLE_SIGNE_QUOTIENT", "FONCTION_REFERENCE_ORIENTATION_IMPAIRE", "DOMAINE_EXCLUSION_OUBLIEE"];
  for (const code of codesManquants) {
    const resultat = categoriserCompetence(code);
    assert(
      resultat.categorie === "Non classé",
      `${code} (absent de CATEGORIES_COMPETENCES, code réel du dictionnaire introduit après la rédaction du prompt) -> "Non classé", jamais deviné (obtenu ${JSON.stringify(resultat)})`
    );
  }
}

// --- Couche 2 : VRAI handler HTTP, base en mémoire (harnais repris de test-profil-competences.ts) ---
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
          then: (resolve: any) => resolve({ data: lignesFiltrees(), error: null }),
        };
        return chaine;
      },
    };
  }

  return { tables, admin: construireAdmin() };
}

async function testerCoucheEndpoint() {
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

  // --- Fixtures : un élève avec des compétences non maîtrisées dans 3 catégories distinctes
  // ("Réponse partielle" x1 avec sous-catégorie, "Confusion de signe/sens" x1 sans sous-catégorie,
  // "Non classé" x1 via un code fictif) + une compétence "en observation" (1 seule occurrence,
  // jamais concernée par le regroupement — Étape 2e).
  tables.classes.push({ id: "classe-a", prof_id: PROF_ID, nom: "4Ga" });
  tables.taches.push({ id: "tache-1", prof_id: PROF_ID, nom: "Devoir 1" });
  tables.eleves.push({ id: "eleve-1", nom: "Martin", prenom: "Léa", actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-1", classe_id: "classe-a" });
  tables.exercices_assignes.push({ id: "ex-1", tache_id: "tache-1", eleve_id: "eleve-1" });

  // CE_PARTIELLE x2 -> non_maitrisee, catégorie "Réponse partielle" / sous-catégorie "Paire de valeurs".
  tables.reponses.push({ id: "r1", exercice_assigne_id: "ex-1", champ: "ce", statut: "not_equivalent", bug_detecte: "CE_PARTIELLE" });
  tables.reponses.push({ id: "r2", exercice_assigne_id: "ex-1", champ: "ce", statut: "not_equivalent", bug_detecte: "CE_PARTIELLE" });
  // C06_SIGNE_OPPOSE x2 -> non_maitrisee, catégorie "Confusion de signe/sens" / AUCUNE sous-catégorie.
  // (C05_SIGNE_REPETE, même catégorie, écarté ici depuis le masquage des 3 codes "jamais divulgués
  // au prof" — voir CODES_MASQUES_PROF, lib/profilCompetences.ts — un autre code de la même
  // catégorie suffit à couvrir le même cas "AUCUNE sous-catégorie".)
  tables.reponses.push({ id: "r3", exercice_assigne_id: "ex-1", champ: "champ1", statut: "not_equivalent", bug_detecte: "C06_SIGNE_OPPOSE" });
  tables.reponses.push({ id: "r4", exercice_assigne_id: "ex-1", champ: "champ1", statut: "not_equivalent", bug_detecte: "C06_SIGNE_OPPOSE" });
  // C05_SIGNE_REPETE x2 -> retour utilisateur ("aucun intérêt à être divulgué") : masqué au niveau
  // de `separerBugsDetectes` (lib/profilCompetences.ts, CODES_MASQUES_PROF) — doit être TOTALEMENT
  // absent de `corps.competences` malgré 2 occurrences réelles en base, jamais compté nulle part.
  tables.reponses.push({ id: "r3b", exercice_assigne_id: "ex-1", champ: "champ1b", statut: "not_equivalent", bug_detecte: "C05_SIGNE_REPETE" });
  tables.reponses.push({ id: "r4b", exercice_assigne_id: "ex-1", champ: "champ1b", statut: "not_equivalent", bug_detecte: "C05_SIGNE_REPETE" });
  // Code fictif, absent de TOUT dictionnaire (compétences ET catégories) x2 -> non_maitrisee, doit
  // apparaître sous "Non classé" sans jamais faire planter l'endpoint.
  tables.reponses.push({ id: "r5", exercice_assigne_id: "ex-1", champ: "champ2", statut: "not_equivalent", bug_detecte: "CODE_FICTIF_JAMAIS_VU_DANS_LE_DICTIONNAIRE" });
  tables.reponses.push({ id: "r6", exercice_assigne_id: "ex-1", champ: "champ2", statut: "not_equivalent", bug_detecte: "CODE_FICTIF_JAMAIS_VU_DANS_LE_DICTIONNAIRE" });
  // TYPE_RACINES x1 -> en_observation (jamais concernée par le regroupement/la bande de résumé).
  tables.reponses.push({ id: "r7", exercice_assigne_id: "ex-1", champ: "racines", statut: "not_equivalent", bug_detecte: "TYPE_RACINES" });

  const { statusCode, corps } = await appeler({ method: "GET", headers: { authorization: "Bearer prof" } }, { id: "eleve-1" });
  assert(statusCode === 200, `GET /api/profs/eleves/:id/profil accepté (200) malgré le code fictif (obtenu ${statusCode}, ${JSON.stringify(corps)})`);

  assert(Array.isArray(corps.ordreCategories) && corps.ordreCategories.includes("Non classé"), `corps.ordreCategories présent et contient "Non classé" (obtenu ${JSON.stringify(corps.ordreCategories)})`);

  const parCode = Object.fromEntries(corps.competences.map((c: any) => [c.code, c]));
  assert(Object.keys(parCode).length === 4, `4 compétences distinctes attendues (CE_PARTIELLE, C06_SIGNE_OPPOSE, code fictif, TYPE_RACINES), obtenu ${JSON.stringify(Object.keys(parCode))}`);

  assert(
    parCode.CE_PARTIELLE?.statut === "non_maitrisee" && parCode.CE_PARTIELLE?.categorie === "Réponse partielle" && parCode.CE_PARTIELLE?.sousCategorie === "Paire de valeurs",
    `CE_PARTIELLE : non_maitrisee, catégorie "Réponse partielle", sous-catégorie "Paire de valeurs" (obtenu ${JSON.stringify(parCode.CE_PARTIELLE)})`
  );
  assert(
    parCode.C06_SIGNE_OPPOSE?.statut === "non_maitrisee" && parCode.C06_SIGNE_OPPOSE?.categorie === "Confusion de signe/sens" && parCode.C06_SIGNE_OPPOSE?.sousCategorie === undefined,
    `C06_SIGNE_OPPOSE : non_maitrisee, catégorie "Confusion de signe/sens", AUCUNE sous-catégorie (obtenu ${JSON.stringify(parCode.C06_SIGNE_OPPOSE)})`
  );
  assert(
    parCode.C05_SIGNE_REPETE === undefined,
    `C05_SIGNE_REPETE attendu ABSENT du profil renvoyé au prof (code masqué, "aucun intérêt à être divulgué" — retour utilisateur), obtenu ${JSON.stringify(parCode.C05_SIGNE_REPETE)}`
  );
  const fictif = parCode.CODE_FICTIF_JAMAIS_VU_DANS_LE_DICTIONNAIRE;
  assert(
    fictif?.statut === "non_maitrisee" && fictif?.categorie === "Non classé",
    `Code fictif absent de tout dictionnaire : non_maitrisee, catégorie "Non classé", aucun plantage de l'endpoint (obtenu ${JSON.stringify(fictif)})`
  );
  assert(
    parCode.TYPE_RACINES?.statut === "en_observation" && parCode.TYPE_RACINES?.categorie === "Existence/validité non reconnue",
    `TYPE_RACINES : en_observation (1 seule occurrence), catégorie résolue quand même mais jamais utilisée pour le regroupement côté client (obtenu ${JSON.stringify(parCode.TYPE_RACINES)})`
  );
}

async function main() {
  testerCouchePure();
  await testerCoucheEndpoint();
  console.log("TOUS LES TESTS DE CATEGORISATION DU PROFIL PASSENT");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
