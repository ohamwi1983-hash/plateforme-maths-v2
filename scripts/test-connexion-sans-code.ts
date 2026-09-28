// Test permanent — prompt "Connexion élève sans code + page d'accueil", Étape 5 : "inscription de
// deux élèves de même nom/prénom dans deux classes différentes (suffixe '(2)' appliqué correctement
// au niveau global, pas seulement s'ils étaient dans la même classe) ; connexion réussie de chacun
// par nom+prénom+mot de passe, sans code ; échec propre si mot de passe incorrect parmi plusieurs
// candidats homonymes."
//
// Exerce les VRAIS handlers compilés (require()'d tels quels, jamais réimplémentés) —
// POST /api/classes, POST /api/inscription-eleve, POST /api/connexion-eleve — contre une fausse
// base de données EN MÉMOIRE partagée entre tous les appels (même technique que
// scripts/test-gestion-classe-etendue.ts), avec `admin.auth.admin.createUser`/`getUserById`/
// `signInWithPassword` minimalement simulés (nécessaire ici : `provisionnerEleve.ts` crée un VRAI
// compte via `createUser`, contrairement aux autres tests qui déclarent les comptes directement).
//
// Les 2 classes appartiennent à 2 PROFS DIFFÉRENTS, délibérément — pour qu'aucune ambiguïté ne
// subsiste sur le fait que la désambiguïsation globale (Étape 1) ne dépend ni du prof ni de la
// classe, contrairement au comportement d'avant cette tâche (`elevesDeLaClasse`, scopé à UNE classe).

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
const PROF_A_ID = "prof-a-uuid";
const PROF_B_ID = "prof-b-uuid";

type Ligne = Record<string, any>;

function creerBaseEnMemoire() {
  const tables: Record<string, Ligne[]> = {
    classes: [],
    eleves: [],
    inscriptions: [],
  };

  let compteurId = 0;
  function nouvelId(prefixe: string): string {
    compteurId += 1;
    return `${prefixe}-${compteurId}`;
  }

  const emailParId: Record<string, string> = {};
  const motDePasseParId: Record<string, string> = {};

  function construireAdmin() {
    return {
      auth: {
        admin: {
          createUser: async ({ email, password }: { email: string; password: string; email_confirm?: boolean }) => {
            const id = nouvelId("auth-user");
            emailParId[id] = email;
            motDePasseParId[id] = password;
            return { data: { user: { id, email } }, error: null };
          },
          getUserById: async (id: string) => {
            const email = emailParId[id];
            return email ? { data: { user: { email } }, error: null } : { data: { user: null }, error: { message: "introuvable" } };
          },
        },
        signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
          const id = Object.keys(emailParId).find((k) => emailParId[k] === email);
          if (id !== undefined && motDePasseParId[id] === password) {
            return { data: { session: { access_token: "tok-" + id, refresh_token: "ref-" + id } }, error: null };
          }
          return { data: { session: null }, error: { message: "Identifiants invalides" } };
        },
      },
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
          order: () => chaine,
          returns: () => chaine,
          maybeSingle: () => Promise.resolve({ data: lignesFiltrees()[0] ?? null, error: null }),
          single: () => Promise.resolve({ data: lignesFiltrees()[0] ?? null, error: null }),
          insert: (payload: Ligne | Ligne[]) => {
            const lignesAInserer = Array.isArray(payload) ? payload : [payload];
            // `eleves.actif` porte `not null default true` en vrai schéma Postgres
            // (supabase/schema.sql) — `provisionnerEleve.ts` ne le fixe jamais explicitement à
            // l'insertion (il compte sur ce défaut), donc cette fausse base en mémoire doit le
            // reproduire ici, sinon `actif` resterait `undefined` (faussement "désactivé" côté
            // connexion-eleve.ts) — limite du bac à sable, pas un bug applicatif.
            const inserees = lignesAInserer.map((l) => ({
              id: l.id ?? nouvelId(table),
              ...(table === "eleves" ? { actif: true } : {}),
              ...l,
            }));
            tables[table].push(...inserees);
            const chaineInsertion: any = {
              select: () => chaineInsertion,
              single: () => Promise.resolve({ data: inserees[0] ?? null, error: null }),
              then: (resolve: any) => resolve({ data: inserees, error: null }),
            };
            return chaineInsertion;
          },
          then: (resolve: any) => resolve({ data: lignesFiltrees(), error: null }),
        };
        return chaine;
      },
    };
  }

  return { tables, admin: construireAdmin(), nouvelId };
}

const { admin } = creerBaseEnMemoire();

require.cache[cheminSupabaseAdmin] = {
  id: cheminSupabaseAdmin,
  filename: cheminSupabaseAdmin,
  loaded: true,
  exports: {
    supabaseAdmin: () => admin,
    profAuthentifie: async (authHeader: string | undefined) => {
      if (authHeader === "Bearer prof-a") return { id: PROF_A_ID };
      if (authHeader === "Bearer prof-b") return { id: PROF_B_ID };
      return null;
    },
    eleveAuthentifie: async () => null,
  },
} as any;

async function appeler(cheminHandler: string, nomExport: string, req: any): Promise<{ statusCode: number | null; corps: any }> {
  delete require.cache[require.resolve(cheminHandler)];
  const handler = require(cheminHandler)[nomExport];
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
  await handler(req, res, req.params ?? {});
  return { statusCode, corps };
}

async function main() {
  // --- 2 classes, 2 PROFS DIFFÉRENTS — aucun lien entre elles hormis le nom/prénom homonyme des élèves. ---
  const { statusCode: scA, corps: classeA } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "POST",
    headers: { authorization: "Bearer prof-a" },
    body: { nom: "4Ga" },
  });
  const { statusCode: scB, corps: classeB } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "POST",
    headers: { authorization: "Bearer prof-b" },
    body: { nom: "4Gb (autre prof)" },
  });
  if (scA !== 201 || scB !== 201) throw new Error(`Création des 2 classes attendue acceptée, obtenu ${scA}/${scB}`);

  // --- Inscription du 1er "Léa Dupont", dans classeA. ---
  const { statusCode: scInsc1, corps: insc1 } = await appeler("../lib/routes/inscription-eleve", "gererInscriptionEleve", {
    method: "POST",
    headers: {},
    body: { code: classeA.code, nom: "Dupont", prenom: "Léa", motDePasse: "secret1" },
  });
  if (scInsc1 !== 201) throw new Error(`Inscription du 1er homonyme attendue acceptée (201), obtenu ${scInsc1}, ${JSON.stringify(insc1)}`);
  if (insc1.eleve.affichage !== "Léa Dupont") {
    throw new Error(`1er homonyme : affichage attendu "Léa Dupont" (premier occurrent, sans suffixe), obtenu "${insc1.eleve.affichage}"`);
  }
  console.log('OK : inscription du 1er "Léa Dupont" (classeA, prof A) -> affichage "Léa Dupont", sans suffixe');

  // --- Inscription du 2e "Léa Dupont", dans classeB — AUTRE CLASSE, AUTRE PROF. ---
  // C'est l'assertion centrale de l'Étape 5 : avant cette tâche (désambiguïsation scopée à UNE
  // classe), ce 2e élève aurait reçu affichage "Léa Dupont" SANS suffixe (classeB ne contenait
  // aucun homonyme). Après cette tâche, le suffixe doit être détecté au niveau GLOBAL.
  const { statusCode: scInsc2, corps: insc2 } = await appeler("../lib/routes/inscription-eleve", "gererInscriptionEleve", {
    method: "POST",
    headers: {},
    body: { code: classeB.code, nom: "Dupont", prenom: "Léa", motDePasse: "secret2" },
  });
  if (scInsc2 !== 201) throw new Error(`Inscription du 2e homonyme attendue acceptée (201), obtenu ${scInsc2}, ${JSON.stringify(insc2)}`);
  if (insc2.eleve.affichage !== "Léa Dupont (2)") {
    throw new Error(
      `2e homonyme (classe et prof DIFFÉRENTS du 1er) : affichage attendu "Léa Dupont (2)" (suffixe global, Étape 1), obtenu "${insc2.eleve.affichage}"`,
    );
  }
  console.log('OK : inscription du 2e "Léa Dupont" (classeB, prof B, AUCUN lien avec classeA) -> affichage "Léa Dupont (2)" (suffixe détecté globalement, pas seulement au sein d\'une classe)');

  if (insc1.eleve.id === insc2.eleve.id) throw new Error("Les 2 homonymes doivent être 2 comptes distincts");

  // --- Connexion SANS CODE : le mot de passe du 1er identifie bien le 1er compte. ---
  const { statusCode: scConn1, corps: conn1 } = await appeler("../lib/routes/connexion-eleve", "gererConnexionEleve", {
    method: "POST",
    headers: {},
    body: { nom: "Dupont", prenom: "Léa", motDePasse: "secret1" },
  });
  if (scConn1 !== 200 || !conn1.access_token) throw new Error(`Connexion du 1er homonyme (sans code) attendue acceptée, obtenu ${scConn1}, ${JSON.stringify(conn1)}`);
  if (conn1.eleve.id !== insc1.eleve.id) throw new Error(`Connexion du 1er homonyme : id attendu ${insc1.eleve.id}, obtenu ${conn1.eleve.id}`);
  console.log("OK : connexion du 1er homonyme par nom+prénom+mot de passe SEULS (aucun champ code envoyé) -> bon compte identifié");

  // --- Connexion SANS CODE : le mot de passe du 2e (classe/prof totalement différents à l'inscription) identifie bien le 2e compte. ---
  const { statusCode: scConn2, corps: conn2 } = await appeler("../lib/routes/connexion-eleve", "gererConnexionEleve", {
    method: "POST",
    headers: {},
    body: { nom: "Dupont", prenom: "Léa", motDePasse: "secret2" },
  });
  if (scConn2 !== 200 || !conn2.access_token) throw new Error(`Connexion du 2e homonyme (sans code) attendue acceptée, obtenu ${scConn2}, ${JSON.stringify(conn2)}`);
  if (conn2.eleve.id !== insc2.eleve.id) throw new Error(`Connexion du 2e homonyme : id attendu ${insc2.eleve.id}, obtenu ${conn2.eleve.id}`);
  console.log("OK : connexion du 2e homonyme (classe/prof différents à l'inscription) par nom+prénom+mot de passe seuls -> bon compte identifié");

  // --- Mot de passe ne correspondant à AUCUN des 2 candidats -> échec propre, message générique. ---
  const { statusCode: scConnMauvais, corps: connMauvais } = await appeler("../lib/routes/connexion-eleve", "gererConnexionEleve", {
    method: "POST",
    headers: {},
    body: { nom: "Dupont", prenom: "Léa", motDePasse: "ni-l-un-ni-l-autre" },
  });
  if (scConnMauvais !== 401) throw new Error(`Mot de passe incorrect parmi plusieurs candidats homonymes : attendu 401, obtenu ${scConnMauvais}`);
  if (connMauvais.access_token) throw new Error("Mot de passe incorrect : aucun jeton ne devrait être renvoyé");
  if (!connMauvais.erreur || connMauvais.erreur.toLowerCase().includes("dupont") || connMauvais.erreur.toLowerCase().includes("léa")) {
    throw new Error(`Mot de passe incorrect : message attendu générique (jamais le nom/prénom en clair), obtenu ${JSON.stringify(connMauvais)}`);
  }
  console.log(`OK : mot de passe incorrect parmi plusieurs candidats homonymes -> échec propre (401), message générique : "${connMauvais.erreur}"`);

  console.log("TOUS LES TESTS DE CONNEXION ELEVE SANS CODE PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
