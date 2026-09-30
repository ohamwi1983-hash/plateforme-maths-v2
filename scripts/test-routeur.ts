// Test permanent — prompt "Point d'entrée unique" (api/router.ts), Étape 5/6 : la logique de
// dispatch elle-même est du code NEUF sans couverture existante ("si une route n'a aucun test
// existant, en écrire un minimal avant de la migrer" — ici c'est le routeur, pas une route
// migrée, qui est neuf). Vérifie que chacune des routes du socle de gestion (phase 1) est bien
// dispatchée vers SON PROPRE handler (pas un autre), qu'une méthode incorrecte sur un chemin connu
// atteint quand même le handler (405 produit par le handler, jamais le 404 du routeur — la
// décision documentée dans api/router.ts), qu'un chemin inconnu produit bien le 404 explicite du
// routeur, et que l'extraction manuelle de :id (Étape 3) transmet la bonne valeur au handler
// déplacé.
//
// **Adapté à la table élaguée (phase 1, socle de gestion — voir RAPPORT.md)** : ce fichier est une
// copie de `scripts/test-routeur.ts` de l'ancien pilote, avec les cas de dispatch portant sur des
// routes ABSENTES de `TABLE_ROUTAGE` dans ce dépôt retirés — `assignations` (moteur/tentatives,
// différé phase 2), `eleves/tableau-de-bord` (différé phase 2, voir RAPPORT.md §E), `reponses`
// (moteur, différé phase 2), et les deux cas `taches/apercu` (dépend d'`assignations`, voir
// RAPPORT.md §3 "Écart n°2" — jamais copié). Le cas "méthode incorrecte sur un chemin connu"
// utilisait `assignations` PUT dans l'original ; remplacé ici par `classes` PUT (405 confirmé en
// lisant `lib/routes/classes.ts`, qui ne gère que GET/POST et tombe sur le 405 générique en fin de
// fonction). Tout le reste — dispatch des routes restantes, fusion de `classe_id`, extraction de
// :id, 404 sur chemin inconnu — est porté à l'identique.
//
// Exerce le VRAI routeur compilé (require()'d tel quel), avec un faux client Supabase injecté via
// require.cache — pas d'accès réseau réel.

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
const cheminRouteur = require.resolve("../api/router");

function injecterFauxAdmin(admin: any, authentifie: boolean): void {
  require.cache[cheminSupabaseAdmin] = {
    id: cheminSupabaseAdmin,
    filename: cheminSupabaseAdmin,
    loaded: true,
    exports: {
      supabaseAdmin: () => admin,
      profAuthentifie: async () => (authentifie ? { id: "prof-uuid" } : null),
      eleveAuthentifie: async () => (authentifie ? { id: "eleve-uuid" } : null),
    },
  } as any;
}

/**
 * `query.path` construit exactement comme le fait le rewrite réel de `vercel.json`
 * (`?path=$1`, confirmé sur `.vercel/output/config.json`) fusionné avec `queryExtra` (les
 * paramètres de requête d'origine du client, ex. `classe_id`) — jamais `req.query.route`/`req.url`
 * fabriqués à la main (voir l'entête de ce fichier).
 */
async function appelerRouteur(
  cheminSegments: string,
  method: string,
  options: { body?: unknown; queryExtra?: Record<string, string> } = {},
): Promise<{ statusCode: number | null; corps: any }> {
  delete require.cache[cheminRouteur];
  const { default: routeur } = require("../api/router");

  const req = {
    method,
    headers: {},
    query: { path: cheminSegments, ...(options.queryExtra ?? {}) },
    body: options.body ?? {},
  };
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
  await routeur(req, res);
  return { statusCode, corps };
}

// Admin minimal : aucune route de ce test n'a besoin d'atteindre une vraie requête DB (chaque cas
// s'arrête à la vérification de méthode/auth/corps, avant tout accès à `admin.from(...)`) — sauf
// les tests dédiés plus bas, qui ont leur propre faux admin.
const ADMIN_INUTILISE = {
  from() {
    throw new Error("Ce test ne devrait jamais atteindre une requête DB à ce stade");
  },
};

async function main() {
  const echecs: string[] = [];
  function verifier(condition: boolean, message: string): void {
    if (!condition) echecs.push(message);
  }

  // --- Dispatch : chaque route connue atteint SON PROPRE handler (fingerprint = 1er statut
  // renvoyé par ce handler précis, sans authentification ni corps — voir tableau ci-dessous, back
  // à l'entête de ce fichier pour la justification de chaque valeur attendue). ---
  injecterFauxAdmin(ADMIN_INUTILISE, false);
  const CAS_DISPATCH: { chemin: string; methode: string; statutAttendu: number; description: string }[] = [
    { chemin: "catalogue-generateurs", methode: "GET", statutAttendu: 401, description: "catalogue-generateurs (profAuthentifie)" },
    { chemin: "taches/apercu", methode: "POST", statutAttendu: 401, description: "taches/apercu POST (profAuthentifie) — atteint son handler, pas `taches/:id`" },
    { chemin: "taches/apercu", methode: "GET", statutAttendu: 405, description: "taches/apercu GET (405 de son propre handler, pas celui de `taches/:id`)" },
    { chemin: "classes/regenerer-code", methode: "POST", statutAttendu: 401, description: "classes/regenerer-code (profAuthentifie)" },
    { chemin: "classes", methode: "GET", statutAttendu: 401, description: "classes GET (profAuthentifie)" },
    { chemin: "classes", methode: "POST", statutAttendu: 401, description: "classes POST (profAuthentifie)" },
    { chemin: "config", methode: "GET", statutAttendu: 200, description: "config (pas d'authentification) — c'est cette route précise qui a régressé en production" },
    { chemin: "connexion-eleve", methode: "POST", statutAttendu: 400, description: "connexion-eleve (corps vide invalide, pas d'authentification)" },
    { chemin: "eleves", methode: "GET", statutAttendu: 401, description: "eleves (classe_id manquant -> branche multi-classes, profAuthentifie requis depuis \"Assigner à des élèves spécifiques\")" },
    { chemin: "exercices/un-id-quelconque", methode: "GET", statutAttendu: 401, description: "exercices/:id (eleveAuthentifie)" },
    { chemin: "exercices", methode: "GET", statutAttendu: 401, description: "exercices (eleveAuthentifie)" },
    { chemin: "inscription-eleve", methode: "POST", statutAttendu: 400, description: "inscription-eleve (corps vide invalide, pas d'authentification)" },
    { chemin: "profs/creer-eleve", methode: "POST", statutAttendu: 401, description: "profs/creer-eleve (profAuthentifie)" },
    { chemin: "profs/reset-mdp-eleve", methode: "POST", statutAttendu: 401, description: "profs/reset-mdp-eleve (profAuthentifie)" },
    { chemin: "taches", methode: "POST", statutAttendu: 401, description: "taches POST (profAuthentifie)" },
    { chemin: "taches", methode: "GET", statutAttendu: 401, description: "taches GET (profAuthentifie) — prompt \"Séparer création et assignation de tâche\"" },
    { chemin: "taches/un-id-quelconque", methode: "PATCH", statutAttendu: 401, description: "taches/:id PATCH (profAuthentifie)" },
    { chemin: "taches/un-id-quelconque", methode: "DELETE", statutAttendu: 401, description: "taches/:id DELETE (profAuthentifie)" },
  ];
  for (const cas of CAS_DISPATCH) {
    const { statusCode } = await appelerRouteur(cas.chemin, cas.methode);
    verifier(statusCode === cas.statutAttendu, `${cas.description} : attendu ${cas.statutAttendu}, obtenu ${statusCode}`);
  }
  console.log(`OK : les ${CAS_DISPATCH.length} routes couvertes dispatchent chacune vers leur propre handler, via la vraie forme de req.query.path (fingerprint de statut vérifié)`);

  // --- Un paramètre de requête d'origine (classe_id) fusionné par le rewrite survit et atteint
  // bien le handler déplacé, exactement comme avant la migration. ---
  let classeIdInterrogee: string | null = null;
  const adminEleves = {
    from(table: string) {
      if (table === "inscriptions") {
        return {
          select: () => ({
            eq: (colonne: string, valeur: string) => {
              if (colonne === "classe_id") classeIdInterrogee = valeur;
              return Promise.resolve({ data: [], error: null });
            },
          }),
        };
      }
      // Refonte "Onglet Classes" : la branche classe_id de gererEleves interroge aussi
      // exercices_assignes puis reponses (nb_reponses/derniere_activite) — `eleves` ci-dessus est
      // toujours vide dans ce cas précis (inscriptions ne renvoie rien), donc ces 2 tables ne sont
      // jamais réellement lues, mais le mock doit les reconnaître pour ne pas planter.
      if (table === "exercices_assignes" || table === "reponses") {
        // Correctif "pagination 1000 lignes" (`recupererToutesLesLignes`, lib/routes/eleves.ts)
        // appelle systématiquement `.range()` après `.in()` — le simuler ici plutôt que de le
        // rendre optionnel, pour exercer le VRAI chemin de code.
        return { select: () => ({ in: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }) };
      }
      throw new Error("Table inattendue : " + table);
    },
  };
  injecterFauxAdmin(adminEleves, false);
  delete require.cache[require.resolve("../lib/routes/eleves")];
  const CLASSE_ID_ATTENDUE = "classe-abc-123";
  const { statusCode: scEleves } = await appelerRouteur("eleves", "GET", { queryExtra: { classe_id: CLASSE_ID_ATTENDUE } });
  verifier(scEleves === 200, `eleves avec classe_id présent : attendu 200, obtenu ${scEleves}`);
  verifier(classeIdInterrogee === CLASSE_ID_ATTENDUE, `classe_id attendu transmis au handler déplacé ("${CLASSE_ID_ATTENDUE}"), obtenu ${JSON.stringify(classeIdInterrogee)}`);
  console.log("OK : un paramètre de requête d'origine (classe_id) fusionné par le rewrite atteint bien le handler déplacé");

  // --- Méthode incorrecte sur un chemin CONNU -> atteint quand même le handler (405 produit par
  // lui, jamais le 404 du routeur) — décision documentée dans api/router.ts, vérifiée ici.
  // Adapté (phase 1) : `assignations` PUT (original) remplacé par `classes` PUT — `assignations`
  // n'existe plus dans TABLE_ROUTAGE ; `gererClasses` ne gère que GET/POST et tombe sur le 405
  // générique de fin de fonction pour toute autre méthode (lib/routes/classes.ts). Authentifié
  // (contrairement à l'original `assignations` PUT non authentifié) : `gererClasses` vérifie
  // `profAuthentifie` AVANT le dispatch de méthode (lib/routes/classes.ts:35-39, contrairement à
  // `assignations` qui vérifiait la méthode en premier) — sans authentification, PUT renvoie 401
  // avant même d'atteindre le 405, ce qui aurait fait échouer cette assertion pour la mauvaise
  // raison (401 au lieu de 405, confirmé en exécutant le test avant ce correctif). Idem pour le
  // cache : `lib/routes/classes` a déjà été chargé (et a capturé le faux admin non-authentifié
  // d'ALORS) par la boucle CAS_DISPATCH ci-dessus — même piège que celui déjà documenté plus bas
  // pour `lib/routes/exercices/[id]`, sans ce nettoyage ciblé le module mettrait silencieusement en
  // œuvre l'ancien admin non-authentifié malgré `injecterFauxAdmin` ci-dessous (confirmé lui aussi
  // en exécutant le test avant ce 2e correctif : 401 persistait même avec authentifie=true).
  injecterFauxAdmin(ADMIN_INUTILISE, true);
  delete require.cache[require.resolve("../lib/routes/classes")];
  const { statusCode: scMethodeInvalide } = await appelerRouteur("classes", "PUT");
  verifier(scMethodeInvalide === 405, `méthode incorrecte sur chemin connu : attendu 405 (produit par le handler), obtenu ${scMethodeInvalide}`);
  console.log("OK : méthode incorrecte sur un chemin connu -> 405 du handler (pas le 404 du routeur)");

  // --- Chemin inconnu -> 404 explicite du routeur. ---
  const CAS_404: string[] = ["route-inexistante", "classes/chemin-invalide", "exercices/a/b", "profs"];
  for (const chemin of CAS_404) {
    const { statusCode, corps } = await appelerRouteur(chemin, "GET");
    verifier(statusCode === 404 && corps?.erreur === "Route introuvable", `chemin inconnu /api/${chemin} : attendu 404 "Route introuvable", obtenu ${statusCode} ${JSON.stringify(corps)}`);
  }
  // Cas particulier : `path` absent (route "/api" nue — le groupe capturant du rewrite est
  // optionnel, voir .vercel/output/config.json) -> aucun segment, doit aussi 404 proprement.
  {
    delete require.cache[cheminRouteur];
    const { default: routeur } = require("../api/router");
    const req = { method: "GET", headers: {}, query: {}, body: {} };
    let statusCode: number | null = null;
    const res = { status: (c: number) => { statusCode = c; return res; }, json: () => {} };
    await routeur(req, res);
    verifier(statusCode === 404, `"path" absent de la query (route /api nue) : attendu 404, obtenu ${statusCode}`);
  }
  console.log("OK : chemins inconnus (et \"path\" absent) -> 404 explicite du routeur (jamais un plantage silencieux)");

  // --- Extraction manuelle de :id (Étape 3) : la bonne valeur atteint le handler déplacé. ---
  const ID_ATTENDU = "exercice-xyz-789";
  let idInterroge: string | null = null;
  const adminExercice = {
    from(table: string) {
      if (table !== "exercices_assignes") throw new Error("Table inattendue : " + table);
      return {
        select: () => ({
          eq: (colonne: string, valeur: string) => {
            if (colonne === "id") idInterroge = valeur;
            return { maybeSingle: () => Promise.resolve({ data: null, error: null }) };
          },
        }),
      };
    },
  };
  injecterFauxAdmin(adminExercice, true);
  // `require.resolve("../api/router")` (dans appelerRouteur) recharge le routeur, mais PAS ses
  // dépendances déjà mises en cache (le handler `lib/routes/exercices/[id].ts` a capturé sa
  // référence à `lib/supabaseAdmin` lors de son tout premier chargement, pendant les cas de
  // dispatch ci-dessus, avec le faux admin d'ALORS) — sans ce nettoyage ciblé, il continuerait
  // silencieusement à utiliser cette référence obsolète malgré `injecterFauxAdmin` ci-dessus.
  delete require.cache[require.resolve("../lib/routes/exercices/[id]")];
  await appelerRouteur(`exercices/${ID_ATTENDU}`, "GET");
  verifier(idInterroge === ID_ATTENDU, `extraction de :id : attendu "${ID_ATTENDU}" transmis au handler déplacé, obtenu ${JSON.stringify(idInterroge)}`);
  if (idInterroge === ID_ATTENDU) console.log("OK : le segment dynamique exercices/:id est extrait manuellement et transmis correctement au handler déplacé");

  if (echecs.length > 0) {
    console.error("ECHECS :\n" + echecs.map((e) => "- " + e).join("\n"));
    process.exit(1);
  }
  console.log("TOUS LES TESTS DU ROUTEUR PASSENT");
}

main().catch((e) => {
  console.error("Erreur inattendue :", e);
  process.exit(1);
});
