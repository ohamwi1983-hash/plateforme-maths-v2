// Test permanent — refonte "Onglet Classes" (Option C, validée par l'utilisateur avec maquette
// interactive) : effectif par classe (GET /api/classes), renommage de classe (POST
// /api/classes/renommer, crayon jaune du bandeau), et tri "Nom / Réponses / Dernière activité"
// (GET /api/eleves?classe_id=..., nb_reponses + derniere_activite — définitions 1 et 3 explicitement
// choisies par l'utilisateur pour "plus/moins actif").
//
// Exerce les VRAIS handlers compilés (require()'d tels quels) contre une fausse base EN MÉMOIRE —
// même technique que scripts/test-gestion-classe-etendue.ts, étendue avec la table `reponses`.

export {};

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

  function construireAdmin() {
    return {
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
              const cible = tables[table].filter((l) => filtres.every((f) => f(l)));
              cible.forEach((l) => Object.assign(l, patch));
              const chaineUpdate: any = {
                select: () => chaineUpdate,
                single: () => Promise.resolve({ data: cible[0] ?? null, error: null }),
                then: (resolve: any) => resolve({ data: cible, error: null }),
              };
              return chaineUpdate;
            },
          }),
          then: (resolve: any) => resolve({ data: lignesFiltrees(), error: null }),
        };
        return chaine;
      },
    };
  }

  return { tables, admin: construireAdmin(), nouvelId };
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
  // --- Fixtures : 1 classe de PROF_ID avec 2 élèves actifs + 1 désactivé, 1 classe d'un autre prof ---
  const { statusCode: scA, corps: classeA } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { nom: "4°A" },
  });
  const { statusCode: scAutre, corps: classeAutrePro } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "POST",
    headers: ENTETES_AUTRE_PROF,
    body: { nom: "Classe d'un autre prof" },
  });
  if (scA !== 201 || scAutre !== 201) throw new Error(`Création des classes attendue acceptée, obtenu ${scA}/${scAutre}`);

  tables.eleves.push({ id: "eleve-emma", nom: "Nguyen", prenom: "Emma", suffixe_affichage: null, actif: true });
  tables.eleves.push({ id: "eleve-hugo", nom: "Bernard", prenom: "Hugo", suffixe_affichage: null, actif: true });
  tables.eleves.push({ id: "eleve-desactive", nom: "Ancien", prenom: "Élève", suffixe_affichage: null, actif: false });
  tables.inscriptions.push({ eleve_id: "eleve-emma", classe_id: classeA.id });
  tables.inscriptions.push({ eleve_id: "eleve-hugo", classe_id: classeA.id });
  tables.inscriptions.push({ eleve_id: "eleve-desactive", classe_id: classeA.id });

  // --- GET /api/classes : effectif = 2 (les actifs seulement) ---
  const { statusCode: scListeClasses, corps: listeClasses } = await appeler("../lib/routes/classes", "gererClasses", {
    method: "GET",
    headers: ENTETES_PROF,
  });
  const classeARenvoyee = (listeClasses ?? []).find((c: any) => c.id === classeA.id);
  if (scListeClasses !== 200 || !classeARenvoyee || classeARenvoyee.nombre_eleves_actifs !== 2) {
    throw new Error(`GET /api/classes : nombre_eleves_actifs=2 attendu pour 4°A, obtenu ${JSON.stringify(classeARenvoyee)}`);
  }
  console.log("OK : GET /api/classes renvoie nombre_eleves_actifs=2 (élève désactivé exclu)");

  // --- POST /api/classes/renommer : succès pour le propriétaire ---
  const { statusCode: scRenommer, corps: renomme } = await appeler("../lib/routes/classes/renommer", "gererClassesRenommer", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { classe_id: classeA.id, nom: "4°A (renommée)" },
  });
  if (scRenommer !== 200 || renomme.nom !== "4°A (renommée)") {
    throw new Error(`POST /api/classes/renommer : succès attendu avec nouveau nom, obtenu statut ${scRenommer}, ${JSON.stringify(renomme)}`);
  }
  console.log("OK : POST /api/classes/renommer renomme la classe du prof authentifié");

  // --- POST /api/classes/renommer : 404 sur la classe d'un autre prof (jamais 403, cohérent avec regenerer-code) ---
  const { statusCode: scRenommerInterdit } = await appeler("../lib/routes/classes/renommer", "gererClassesRenommer", {
    method: "POST",
    headers: ENTETES_PROF,
    body: { classe_id: classeAutrePro.id, nom: "Tentative" },
  });
  if (scRenommerInterdit !== 404) {
    throw new Error(`POST /api/classes/renommer sur la classe d'un autre prof : 404 attendu, obtenu ${scRenommerInterdit}`);
  }
  console.log("OK : POST /api/classes/renommer refuse (404) la classe d'un autre prof");

  // --- Exercices + réponses : Emma très active (3 réponses, la plus récente il y a 1h), Hugo jamais répondu ---
  tables.exercices_assignes.push({ id: "exo-emma-1", tache_id: "tache-x", eleve_id: "eleve-emma", enonce: {}, solution: {} });
  tables.exercices_assignes.push({ id: "exo-emma-2", tache_id: "tache-y", eleve_id: "eleve-emma", enonce: {}, solution: {} });
  const maintenant = Date.now();
  const ilYA = (heures: number) => new Date(maintenant - heures * 3600_000).toISOString();
  tables.reponses.push({ id: "r1", exercice_assigne_id: "exo-emma-1", champ: "isolement", valeur_saisie: "x", statut: "correct", horodatage: ilYA(48) });
  tables.reponses.push({ id: "r2", exercice_assigne_id: "exo-emma-1", champ: "champ1", valeur_saisie: "x", statut: "correct", horodatage: ilYA(24) });
  tables.reponses.push({ id: "r3", exercice_assigne_id: "exo-emma-2", champ: "isolement", valeur_saisie: "x", statut: "correct", horodatage: ilYA(1) });

  const { statusCode: scListeEleves, corps: listeEleves } = await appeler("../lib/routes/eleves", "gererEleves", {
    method: "GET",
    query: { classe_id: classeA.id },
    headers: {},
  });
  if (scListeEleves !== 200) throw new Error(`GET /api/eleves?classe_id=... : 200 attendu, obtenu ${scListeEleves}`);

  const emma = listeEleves.find((e: any) => e.id === "eleve-emma");
  const hugo = listeEleves.find((e: any) => e.id === "eleve-hugo");
  if (!emma || emma.nb_reponses !== 3) {
    throw new Error(`Emma : nb_reponses=3 attendu, obtenu ${JSON.stringify(emma)}`);
  }
  if (emma.derniere_activite !== ilYA(1)) {
    throw new Error(`Emma : derniere_activite="il y a 1h" attendue (la plus récente des 3), obtenu ${emma.derniere_activite}`);
  }
  if (!hugo || hugo.nb_reponses !== 0 || hugo.derniere_activite !== null) {
    throw new Error(`Hugo (jamais répondu) : nb_reponses=0 et derniere_activite=null attendus, obtenu ${JSON.stringify(hugo)}`);
  }
  if (listeEleves.some((e: any) => e.id === "eleve-desactive")) {
    throw new Error("L'élève désactivé ne doit jamais apparaître dans GET /api/eleves?classe_id=...");
  }
  console.log("OK : GET /api/eleves?classe_id=... renvoie nb_reponses/derniere_activite corrects (Emma 3/plus récente, Hugo 0/jamais, désactivé absent)");

  console.log("\nTOUS LES TESTS REFONTE-ONGLET-CLASSES PASSENT");
}

main().catch((e) => {
  console.error("ÉCHEC :", e.message ?? e);
  process.exit(1);
});
