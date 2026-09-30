// Test permanent — prompt "Inscription professeur (par invitation)", Étape 5 : "test de fumée sur
// l'inscription (code valide -> compte créé, code déjà utilisé -> rejet, code inexistant -> rejet)".
//
// Exerce le VRAI handler compilé (require()'d tel quel, jamais réimplémenté) — POST
// /api/inscription-prof — contre une fausse base de données EN MÉMOIRE, avec
// `admin.auth.admin.createUser`/`admin.auth.signInWithPassword` minimalement simulés (même
// technique que scripts/test-connexion-sans-code.ts : nécessaire ici car `gererInscriptionProf`
// crée un VRAI compte Auth via `createUser`).

export {}; // force ce fichier en module (évite les collisions de noms globaux avec les autres scripts/*.ts)

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");

type Ligne = Record<string, any>;

function creerBaseEnMemoire() {
  const tables: Record<string, Ligne[]> = {
    invitations_prof: [],
    profs: [],
  };

  let compteurId = 0;
  function nouvelId(prefixe: string): string {
    compteurId += 1;
    return `${prefixe}-${compteurId}`;
  }

  /** Panne simulée de la lecture de `invitations_prof` (null = base saine). */
  const panne: { invitations: string | null } = { invitations: null };

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
          maybeSingle: () => Promise.resolve(table === "invitations_prof" && panne.invitations !== null ? { data: null, error: { message: panne.invitations } } : { data: lignesFiltrees()[0] ?? null, error: null }),
          insert: (payload: Ligne | Ligne[]) => {
            const lignesAInserer = Array.isArray(payload) ? payload : [payload];
            const inserees = lignesAInserer.map((l) => ({ id: l.id ?? nouvelId(table), ...l }));
            tables[table].push(...inserees);
            const chaineInsertion: any = {
              select: () => chaineInsertion,
              single: () => Promise.resolve({ data: inserees[0] ?? null, error: null }),
              then: (resolve: any) => resolve({ data: inserees, error: null }),
            };
            return chaineInsertion;
          },
          update: (patch: Ligne) => ({
            eq: (col: string, val: unknown) => {
              filtres.push((l) => l[col] === val);
              tables[table].filter((l) => filtres.every((f) => f(l))).forEach((l) => Object.assign(l, patch));
              return Promise.resolve({ data: null, error: null });
            },
          }),
          then: (resolve: any) => resolve({ data: lignesFiltrees(), error: null }),
        };
        return chaine;
      },
    };
  }

  return { tables, panne, admin: construireAdmin() };
}

const { tables, panne, admin } = creerBaseEnMemoire();

require.cache[cheminSupabaseAdmin] = {
  id: cheminSupabaseAdmin,
  filename: cheminSupabaseAdmin,
  loaded: true,
  exports: {
    supabaseAdmin: () => admin,
    profAuthentifie: async () => null,
    eleveAuthentifie: async () => null,
  },
} as any;

async function appeler(req: any): Promise<{ statusCode: number | null; corps: any }> {
  delete require.cache[require.resolve("../lib/routes/inscription-prof")];
  const { gererInscriptionProf: handler } = require("../lib/routes/inscription-prof");
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
  // Un code d'invitation inséré directement en base — comme le ferait le prof actuel via Supabase
  // Table Editor (Portée explicite : aucune interface de création dans ce prompt).
  tables.invitations_prof.push({ code: "INVIT-VALIDE", utilise: false, cree_le: "2024-01-01T00:00:00.000Z" });

  // --- Code inexistant -> rejet 404, aucun compte créé, aucune ligne "profs". ---
  const { statusCode: scInconnu, corps: corpsInconnu } = await appeler({
    method: "POST",
    body: { codeInvitation: "N-EXISTE-PAS", email: "x@test.fr", motDePasse: "secret1", nom: "Personne" },
  });
  if (scInconnu !== 404) throw new Error(`Code inexistant : 404 attendu, obtenu ${scInconnu}, ${JSON.stringify(corpsInconnu)}`);
  const nombreProfsApresInconnu = tables.profs.length;
  if (nombreProfsApresInconnu !== 0) throw new Error(`Code inexistant : aucun compte prof ne devrait avoir été créé, obtenu ${nombreProfsApresInconnu}`);
  console.log(`OK : code d'invitation inexistant -> rejet (404), message : "${corpsInconnu.erreur}"`);

  // --- Code valide, jamais utilisé -> compte créé (201), connecté automatiquement. ---
  const { statusCode: scValide, corps: corpsValide } = await appeler({
    method: "POST",
    body: { codeInvitation: "INVIT-VALIDE", email: "nouveau.prof@test.fr", motDePasse: "secret123", nom: "Nouveau Prof" },
  });
  if (scValide !== 201) throw new Error(`Code valide : 201 attendu, obtenu ${scValide}, ${JSON.stringify(corpsValide)}`);
  if (!corpsValide.access_token || !corpsValide.refresh_token) throw new Error(`Code valide : jetons de session attendus (connexion automatique), obtenu ${JSON.stringify(corpsValide)}`);
  if (corpsValide.prof?.nom !== "Nouveau Prof" || corpsValide.prof?.email !== "nouveau.prof@test.fr") {
    throw new Error(`Code valide : prof.nom/email attendus exacts, obtenu ${JSON.stringify(corpsValide.prof)}`);
  }
  const nombreProfsApresValide = tables.profs.length;
  if (nombreProfsApresValide !== 1) throw new Error(`Code valide : exactement 1 ligne "profs" attendue, obtenu ${nombreProfsApresValide}`);
  const invitationApres = tables.invitations_prof.find((i) => i.code === "INVIT-VALIDE");
  if (invitationApres?.utilise !== true) throw new Error(`Code valide : invitations_prof.utilise attendu true après usage, obtenu ${JSON.stringify(invitationApres)}`);
  console.log("OK : code d'invitation valide -> compte créé (201), connecté automatiquement, invitation marquée utilisée en base");

  // --- Même code réessayé (désormais utilisé) -> rejet 400, aucun 2e compte créé. ---
  const { statusCode: scReutilise, corps: corpsReutilise } = await appeler({
    method: "POST",
    body: { codeInvitation: "INVIT-VALIDE", email: "intrus@test.fr", motDePasse: "secret456", nom: "Intrus" },
  });
  if (scReutilise !== 400) throw new Error(`Code déjà utilisé : 400 attendu, obtenu ${scReutilise}, ${JSON.stringify(corpsReutilise)}`);
  const nombreProfsApresReutilise = tables.profs.length;
  if (nombreProfsApresReutilise !== 1) throw new Error(`Code déjà utilisé : toujours 1 seule ligne "profs" attendue (usage unique), obtenu ${nombreProfsApresReutilise}`);
  console.log(`OK : code d'invitation déjà utilisé (2e tentative) -> rejet (400), message : "${corpsReutilise.erreur}" — usage unique respecté`);

  // --- Panne de la base pendant la lecture du code -> 500 (journalisé), JAMAIS le 404 « code invalide », aucun compte créé. ---
  const profsAvantPanne = tables.profs.length;
  panne.invitations = "connection reset by peer";
  const { statusCode: scPanne, corps: corpsPanne } = await appeler({
    method: "POST",
    body: { codeInvitation: "INVIT-VALIDE", email: "panne@test.fr", motDePasse: "secret1", nom: "Panne" },
  });
  panne.invitations = null;
  if (scPanne !== 500) throw new Error(`Panne de lecture du code : 500 attendu (et non le 404 « code invalide »), obtenu ${scPanne}, ${JSON.stringify(corpsPanne)}`);
  if (corpsPanne.erreur === "Code d'invitation invalide") throw new Error("Panne de lecture du code : le message ne doit pas être « Code d'invitation invalide »");
  if (!String(corpsPanne.detail).includes("connection reset by peer")) throw new Error(`Panne de lecture du code : la cause doit figurer dans le détail journalisé, obtenu ${JSON.stringify(corpsPanne)}`);
  if (tables.profs.length !== profsAvantPanne) throw new Error("Panne de lecture du code : aucun compte ne doit être créé");
  console.log(`OK : panne de la base à la lecture du code -> 500 avec la cause ("${corpsPanne.detail}"), pas un faux « code invalide »`);

  console.log("TOUS LES TESTS D'INSCRIPTION PROFESSEUR PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
