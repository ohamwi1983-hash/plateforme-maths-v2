// Test permanent — bug réel trouvé en production (diagnostic "pas assez de données" pour toutes
// les variantes, prof à plus de 1000 réponses réelles cumulées sur 35 tâches) : PostgREST/Supabase
// plafonne silencieusement toute requête `select` à 1000 lignes par défaut, sans jamais renvoyer
// d'erreur. `calculerTempsParVarianteProf` (lib/routes/profs/tableau-de-bord.ts) paginait avant
// correctif un simple `.select()...in()` sans `.range()` sur `reponses` ET `exercices_assignes` —
// une variante réelle avec 7 occurrences authentiques retombait sous
// `SEUIL_MIN_OCCURRENCES_TEMPS_VARIANTE` dès que la requête tronquait le volume réel.
//
// Ce test simule fidèlement la limite PostgREST elle-même (pas seulement en supposant que le code
// demande toujours des fenêtres <= 1000) : la fausse base plafonne CHAQUE page renvoyée à 1000
// lignes maximum, quelle que soit la taille de fenêtre demandée par `.range()` — exactement le
// comportement réel documenté de Supabase (`db-max-rows`). Si `recupererToutesLesLignes`
// (tableau-de-bord.ts) ne rappelait pas `.range()` en boucle jusqu'à épuisement, ce test échouerait.

export {};

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
const PROF_ID = "prof-uuid-tdb-pagination";
const TACHE_ID = "tache-pagination";
const LIMITE_POSTGREST = 1000;

type Ligne = Record<string, any>;

function creerBaseEnMemoire() {
  const tables: Record<string, Ligne[]> = {
    classes: [],
    eleves: [],
    inscriptions: [],
    taches: [],
    taches_assignations: [],
    exercices_assignes: [],
    reponses: [],
  };

  function construireAdmin() {
    return {
      from(table: string) {
        if (!(table in tables)) throw new Error("Table non simulée dans ce test : " + table);
        const filtres: ((ligne: Ligne) => boolean)[] = [];
        let embedEleves = false;
        const materialiser = (lignes: Ligne[]): Ligne[] =>
          embedEleves && table === "inscriptions" ? lignes.map((l) => ({ ...l, eleves: tables.eleves.find((e) => e.id === l.eleve_id) ?? null })) : lignes;
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
          // Simule le VRAI plafond PostgREST (`db-max-rows`) : la page renvoyée ne dépasse JAMAIS
          // 1000 lignes, même si la fenêtre demandée (fin - debut + 1) est plus large — exactement
          // ce qui rendait l'ancienne requête non paginée silencieusement tronquée en production.
          range: (debut: number, fin: number) => {
            const tranche = lignesFiltrees().slice(debut, fin + 1).slice(0, LIMITE_POSTGREST);
            return Promise.resolve({ data: tranche, error: null });
          },
          then: (resolve: any) => resolve({ data: lignesFiltrees().slice(0, LIMITE_POSTGREST), error: null }),
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

async function appeler(): Promise<any> {
  const cheminHandler = "../lib/routes/profs/tableau-de-bord";
  delete require.cache[require.resolve(cheminHandler)];
  const handler = require(cheminHandler).gererProfsTableauDeBord;
  let corps: any = null;
  const res = {
    status() {
      return this;
    },
    json(objet: unknown) {
      corps = objet;
    },
  };
  await handler({ method: "GET", headers: { authorization: "Bearer prof" } }, res, {});
  return corps;
}

async function main() {
  tables.taches.push({ id: TACHE_ID, prof_id: PROF_ID, nom: "Tâche à gros volume", est_apercu: false });

  // 1200 exercices_assignes (> 1000 = la limite PostgREST), tous af_mise_en_evidence, chacun avec
  // exactly 1 réponse chronométrée -> 1200 réponses aussi (> 1000). Si l'une des 2 requêtes
  // (exercices_assignes OU reponses) n'était pas paginée, l'agrégation finale serait tronquée à
  // 1000 (ou moins, selon quelle requête tronque), pas 1200.
  const NB_EXERCICES = 1200;
  for (let i = 0; i < NB_EXERCICES; i++) {
    const id = `ex-${i}`;
    tables.exercices_assignes.push({ id, tache_id: TACHE_ID, eleve_id: "eleve-1", variante_id: "af_mise_en_evidence" });
    tables.reponses.push({
      id: `r-${i}`,
      exercice_assigne_id: id,
      champ: "coefficients",
      duree_ecoulee_secondes: 10,
      horodatage: `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}.${String(i).padStart(6, "0")}Z`,
      bug_detecte: null,
    });
  }

  console.log(`Fixture : ${tables.exercices_assignes.length} exercices_assignes, ${tables.reponses.length} reponses (les deux > limite PostgREST de ${LIMITE_POSTGREST}).`);

  const corps = await appeler();
  const entree = (corps.tempsParVariante as any[]).find((e) => e.variante_id === "af_mise_en_evidence");

  if (!entree) {
    throw new Error(`Attendu : "af_mise_en_evidence" présente avec ${NB_EXERCICES} occurrences. Obtenu : absente -> ${JSON.stringify(corps.tempsParVariante)}`);
  }
  if (entree.occurrences !== NB_EXERCICES) {
    throw new Error(
      `Attendu : occurrences=${NB_EXERCICES} (aucune troncature malgré le dépassement de la limite PostgREST de ${LIMITE_POSTGREST}). Obtenu : ${entree.occurrences} — la pagination ne récupère pas tout.`,
    );
  }
  console.log(`OK : ${entree.occurrences} occurrences récupérées malgré ${NB_EXERCICES} lignes réelles sur les 2 tables (> limite PostgREST de ${LIMITE_POSTGREST}) — pagination .range() en boucle confirmée sur exercices_assignes ET reponses.`);

  console.log("TOUS LES TESTS DE PAGINATION (TABLEAU DE BORD PROF) PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
