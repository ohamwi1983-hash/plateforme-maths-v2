// Test permanent — prompt "Gestion de classe étendue", Étape 6 : "désactivation bloque bien la
// connexion avec message explicite, modification redétecte un homonyme, transfert déplace
// l'inscription sans toucher aux exercices existants, élève désactivé absent des listes actives".
//
// Exerce les VRAIS handlers compilés (require()'d tels quels, jamais réimplémentés) —
// POST /api/classes, GET /api/eleves, PATCH /api/profs/eleves/:id,
// POST /api/profs/desactiver-eleve, POST /api/profs/transferer-eleve, POST /api/connexion-eleve —
// contre une fausse base de données EN MÉMOIRE partagée entre tous les appels (même technique que
// scripts/test-scenario-multiclasses.ts).
//
// Contrairement à ce précédent (qui déclare explicitement la faute d'Auth Supabase hors de
// portée), ce test fait exception pour `admin.auth.admin.getUserById`/`admin.auth.signInWithPassword`
// : minimalement simulés ici (email/mot de passe déclarés à la création des fixtures, sans passer
// par `admin.auth.admin.createUser`) parce que la vérification `actif` de ce prompt vit À
// L'INTÉRIEUR de `lib/routes/connexion-eleve.ts`, après la résolution du mot de passe — la
// contourner rendrait ce test aveugle à l'endroit exact où le bug visé pourrait se nicher.

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
    exercices_assignes: [],
    reponses: [],
  };

  let compteurId = 0;
  function nouvelId(prefixe: string): string {
    compteurId += 1;
    return `${prefixe}-${compteurId}`;
  }

  const emailParId: Record<string, string> = {};
  const motDePasseParId: Record<string, string> = {};

  function declarerCompteAuth(id: string, email: string, motDePasse: string): void {
    emailParId[id] = email;
    motDePasseParId[id] = motDePasse;
  }

  function construireAdmin() {
    return {
      auth: {
        admin: {
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
        let embedEleves = false;
        const materialiser = (lignes: Ligne[]) =>
          embedEleves && table === "inscriptions"
            ? lignes.map((l) => ({ ...l, eleves: tables.eleves.find((e) => e.id === l.eleve_id) ?? null }))
            : lignes;
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
          order: () => chaine,
          limit: () => chaine,
          returns: () => chaine,
          range: (debut: number, fin: number) => Promise.resolve({ data: lignesFiltrees().slice(debut, fin + 1), error: null }),
          maybeSingle: () => Promise.resolve({ data: lignesFiltrees()[0] ?? null, error: null }),
          single: () => Promise.resolve({ data: lignesFiltrees()[0] ?? null, error: null }),
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
          delete: () => {
            const chaineDelete: any = {
              eq: (col: string, val: unknown) => {
                filtres.push((l) => l[col] === val);
                return chaineDelete;
              },
              in: (col: string, vals: unknown[]) => {
                filtres.push((l) => vals.includes(l[col]));
                return chaineDelete;
              },
              then: (resolve: any) => {
                const aSupprimer = new Set(tables[table].filter((l) => filtres.every((f) => f(l))));
                tables[table] = tables[table].filter((l) => !aSupprimer.has(l));
                resolve({ data: null, error: null });
              },
            };
            return chaineDelete;
          },
          then: (resolve: any) => resolve({ data: lignesFiltrees(), error: null }),
        };
        return chaine;
      },
    };
  }

  return { tables, admin: construireAdmin(), nouvelId, declarerCompteAuth };
}

const { tables, admin, declarerCompteAuth } = creerBaseEnMemoire();

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

const ENTETES_PROF = { authorization: "Bearer prof" };
const ENTETES_AUTRE_PROF = { authorization: "Bearer autre-prof" };

async function main() {
  // --- Fixtures : 2 classes de PROF_ID, 1 classe de AUTRE_PROF_ID, via les VRAIS endpoints ---
  const { statusCode: scA, corps: classeA } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { nom: "4Ga" },
  });
  const { statusCode: scB, corps: classeB } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { nom: "4Gb" },
  });
  const { statusCode: scC, corps: classeAutrePro } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "POST",
    headers: ENTETES_AUTRE_PROF,
    body: { nom: "Classe d'un autre prof" },
  });
  if (scA !== 201 || scB !== 201 || scC !== 201) throw new Error(`Création des 3 classes attendue acceptée, obtenu ${scA}/${scB}/${scC}`);

  // eleve-1 et eleve-2, homonymes ("Léa Dupont"), tous deux dans classeA.
  tables.eleves.push({ id: "eleve-1", nom: "Martin", prenom: "Léa", suffixe_affichage: null, actif: true });
  tables.eleves.push({ id: "eleve-2", nom: "Dupont", prenom: "Léa", suffixe_affichage: null, actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-1", classe_id: classeA.id });
  tables.inscriptions.push({ eleve_id: "eleve-2", classe_id: classeA.id });
  declarerCompteAuth("eleve-1", "eleve1@test.fr", "secret1");
  declarerCompteAuth("eleve-2", "eleve2@test.fr", "secret2");
  const exerciceEleve1 = { id: "exo-1", tache_id: "tache-x", eleve_id: "eleve-1", enonce: { a: 1, b: 2, c: 3 }, solution: {} };
  tables.exercices_assignes.push({ ...exerciceEleve1 });

  // --- GET /api/eleves : les 2 sont actifs, tous deux listés ---
  const { statusCode: scListe1, corps: liste1 } = await appeler("../lib/routes/eleves", "gererEleves", {
    method: "GET",
    query: { classe_id: classeA.id },
    headers: {},
  });
  if (scListe1 !== 200 || liste1.length !== 2) {
    throw new Error(`GET /api/eleves : 2 élèves actifs attendus, obtenu statut ${scListe1}, ${JSON.stringify(liste1)}`);
  }
  console.log("OK : GET /api/eleves liste bien les 2 élèves actifs de la classe");

  // --- PATCH /api/profs/eleves/eleve-1 : renomme en homonyme de eleve-2, redétection attendue ---
  const { statusCode: scModif, corps: modif } = await appeler("../lib/routes/profs/eleves/[id]", "gererProfsElevesId", {
    method: "PATCH",
    headers: ENTETES_PROF,
    body: { nom: "Dupont", prenom: "Léa" },
    params: { id: "eleve-1" },
  });
  if (scModif !== 200 || modif.affichage !== "Léa Dupont (2)") {
    throw new Error(`PATCH modification attendue acceptée avec redétection d'homonyme (suffixe 2), obtenu statut ${scModif}, ${JSON.stringify(modif)}`);
  }
  const eleve1ApresModif = tables.eleves.find((e) => e.id === "eleve-1");
  if (!eleve1ApresModif || eleve1ApresModif.nom !== "Dupont" || eleve1ApresModif.suffixe_affichage !== 2) {
    throw new Error(`Ligne eleves attendue mise à jour (nom=Dupont, suffixe=2), obtenu ${JSON.stringify(eleve1ApresModif)}`);
  }
  console.log("OK : PATCH /api/profs/eleves/:id modifie nom/prénom et redétecte l'homonyme (suffixe 2)");

  // --- PATCH sur un élève n'appartenant pas au prof authentifié -> 404 ---
  tables.eleves.push({ id: "eleve-autre-prof", nom: "Autre", prenom: "Eleve", suffixe_affichage: null, actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-autre-prof", classe_id: classeAutrePro.id });
  const { statusCode: scModifRefusee } = await appeler("../lib/routes/profs/eleves/[id]", "gererProfsElevesId", {
    method: "PATCH",
    headers: ENTETES_PROF,
    body: { nom: "X", prenom: "Y" },
    params: { id: "eleve-autre-prof" },
  });
  if (scModifRefusee !== 404) throw new Error(`Modification d'un élève d'un autre prof attendue refusée (404), obtenu ${scModifRefusee}`);
  console.log("OK : PATCH /api/profs/eleves/:id refuse (404) un élève n'appartenant à aucune classe du prof authentifié");

  // --- POST /api/profs/desactiver-eleve : désactive eleve-2 ---
  const { statusCode: scDesactive } = await appeler("../lib/routes/profs/desactiver-eleve", "gererProfsDesactiverEleve", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { eleve_id: "eleve-2" },
  });
  if (scDesactive !== 200) throw new Error(`Désactivation attendue acceptée, obtenu ${scDesactive}`);
  if (tables.eleves.find((e) => e.id === "eleve-2")?.actif !== false) throw new Error("eleve-2 attendu actif=false après désactivation");
  console.log("OK : POST /api/profs/desactiver-eleve désactive le compte (actif=false), aucune suppression");

  const { statusCode: scDesactiveRefusee } = await appeler("../lib/routes/profs/desactiver-eleve", "gererProfsDesactiverEleve", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { eleve_id: "eleve-autre-prof" },
  });
  if (scDesactiveRefusee !== 404) throw new Error(`Désactivation d'un élève d'un autre prof attendue refusée (404), obtenu ${scDesactiveRefusee}`);
  console.log("OK : POST /api/profs/desactiver-eleve refuse (404) un élève n'appartenant à aucune classe du prof authentifié");

  // --- GET /api/eleves après désactivation : eleve-2 disparaît de la liste active ---
  const { corps: liste2 } = await appeler("../lib/routes/eleves", "gererEleves", {
    method: "GET",
    query: { classe_id: classeA.id },
    headers: {},
  });
  if (liste2.length !== 1 || liste2[0].id !== "eleve-1") {
    throw new Error(`Après désactivation, GET /api/eleves attendu ne lister que eleve-1, obtenu ${JSON.stringify(liste2)}`);
  }
  console.log("OK : élève désactivé absent de GET /api/eleves (liste active)");

  // --- POST /api/connexion-eleve (prompt "Connexion élève sans code" : plus de champ `code`) :
  // eleve-2 (désactivé), bon mot de passe -> 403 message explicite ---
  const { statusCode: scConnexionDesactive, corps: connexionDesactive } = await appeler("../lib/routes/connexion-eleve", "gererConnexionEleve", {
    method: "POST",
    headers: {},
    body: { nom: "Dupont", prenom: "Léa", motDePasse: "secret2" },
  });
  if (scConnexionDesactive !== 403 || !connexionDesactive.erreur?.includes("désactivé")) {
    throw new Error(`Connexion d'un compte désactivé (bon mot de passe) attendue rejetée (403, message explicite), obtenu ${scConnexionDesactive}, ${JSON.stringify(connexionDesactive)}`);
  }
  console.log(`OK : POST /api/connexion-eleve rejette (403) un compte désactivé avec un message explicite : "${connexionDesactive.erreur}"`);

  // --- Même élève désactivé, MAUVAIS mot de passe -> message générique, pas de fuite ---
  const { statusCode: scConnexionDesactiveMauvaisMdp, corps: connexionDesactiveMauvaisMdp } = await appeler(
    "../lib/routes/connexion-eleve",
    "gererConnexionEleve",
    { method: "POST", headers: {}, body: { nom: "Dupont", prenom: "Léa", motDePasse: "mauvais" } },
  );
  if (scConnexionDesactiveMauvaisMdp !== 401 || connexionDesactiveMauvaisMdp.erreur.includes("désactivé")) {
    throw new Error(`Compte désactivé + mauvais mot de passe attendu générique (401, jamais "désactivé"), obtenu ${scConnexionDesactiveMauvaisMdp}, ${JSON.stringify(connexionDesactiveMauvaisMdp)}`);
  }
  console.log("OK : compte désactivé + mauvais mot de passe -> message générique (jamais révélé avant un mot de passe correct)");

  // --- eleve-1 (actif, renommé en Léa Dupont) se connecte normalement ---
  const { statusCode: scConnexionOk, corps: connexionOk } = await appeler("../lib/routes/connexion-eleve", "gererConnexionEleve", {
    method: "POST",
    headers: {},
    body: { nom: "Dupont", prenom: "Léa", motDePasse: "secret1" },
  });
  if (scConnexionOk !== 200 || !connexionOk.access_token) {
    throw new Error(`Connexion d'un élève actif attendue acceptée avec session, obtenu ${scConnexionOk}, ${JSON.stringify(connexionOk)}`);
  }
  console.log("OK : élève actif toujours connectable normalement (aucune régression de la désactivation d'un homonyme)");

  // --- POST /api/profs/transferer-eleve : eleve-1 de classeA vers classeB ---
  const { statusCode: scTransfert, corps: transfert } = await appeler("../lib/routes/profs/transferer-eleve", "gererProfsTransfererEleve", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { eleve_id: "eleve-1", nouvelle_classe_id: classeB.id },
  });
  if (scTransfert !== 200) throw new Error(`Transfert attendu accepté, obtenu ${scTransfert}, ${JSON.stringify(transfert)}`);
  const inscriptionsEleve1 = tables.inscriptions.filter((i) => i.eleve_id === "eleve-1");
  if (inscriptionsEleve1.length !== 1 || inscriptionsEleve1[0].classe_id !== classeB.id) {
    throw new Error(`Après transfert, eleve-1 attendu inscrit UNIQUEMENT dans classeB, obtenu ${JSON.stringify(inscriptionsEleve1)}`);
  }
  const exerciceApresTransfert = tables.exercices_assignes.find((e) => e.id === "exo-1");
  if (JSON.stringify(exerciceApresTransfert) !== JSON.stringify(exerciceEleve1)) {
    throw new Error(`exercices_assignes attendu strictement inchangé après transfert, obtenu ${JSON.stringify(exerciceApresTransfert)}`);
  }
  console.log("OK : POST /api/profs/transferer-eleve déplace l'inscription (ancienne classe retirée, nouvelle ajoutée), exercices_assignes intact");

  // --- Retransférer vers la même classe (classeB) -> 400 ---
  const { statusCode: scTransfertMemeClasse } = await appeler("../lib/routes/profs/transferer-eleve", "gererProfsTransfererEleve", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { eleve_id: "eleve-1", nouvelle_classe_id: classeB.id },
  });
  if (scTransfertMemeClasse !== 400) throw new Error(`Transfert vers la classe déjà occupée attendu refusé (400), obtenu ${scTransfertMemeClasse}`);
  console.log("OK : transfert refusé (400) vers la classe où l'élève est déjà inscrit");

  // --- Transfert vers la classe d'un AUTRE prof -> 404 (jamais accepté) ---
  const { statusCode: scTransfertAutrePro } = await appeler("../lib/routes/profs/transferer-eleve", "gererProfsTransfererEleve", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { eleve_id: "eleve-1", nouvelle_classe_id: classeAutrePro.id },
  });
  if (scTransfertAutrePro !== 404) throw new Error(`Transfert vers la classe d'un autre prof attendu refusé (404), obtenu ${scTransfertAutrePro}`);
  console.log("OK : transfert vers la classe d'un autre prof refusé (404) — jamais autorisé");

  console.log("TOUS LES TESTS DE GESTION DE CLASSE ETENDUE PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
