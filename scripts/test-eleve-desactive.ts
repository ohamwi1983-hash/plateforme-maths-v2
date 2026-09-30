// Test permanent — un élève désactivé par son professeur perd l'accès à l'API À CHAQUE requête (RAPPORT §35), pas seulement à la
// connexion. Deux niveaux :
//  1. le VRAI `eleveAuthentifie` (lib/supabaseAdmin.ts), avec un faux client `admin` injecté ;
//  2. le VRAI `api/router.ts` (harnais partagé, qui applique la même règle `eleveDepuisLigne`) : les 7 routes élève, la désactivation
//     par la route professeur, puis la réactivation en base.
// Lancer : `npm run test-eleve-desactive`. Sans réseau.

export {}; // module

import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

/** Faux `admin` minimal pour `eleveAuthentifie` : `auth.getUser` + `from("eleves").select().eq().maybeSingle()`. */
function fauxAdmin(options: { utilisateur: string | null; ligne: Record<string, unknown> | null; erreurLigne?: boolean }) {
  return {
    auth: { getUser: async () => (options.utilisateur ? { data: { user: { id: options.utilisateur } }, error: null } : { data: { user: null }, error: { message: "jwt" } }) },
    from: (table: string) => {
      if (table !== "eleves") throw new Error(`table inattendue « ${table} »`);
      const chaine: any = {
        select: (colonnes: string) => {
          verifier(colonnes.split(",").map((c) => c.trim()).includes("actif"), "eleveAuthentifie doit LIRE la colonne actif");
          return chaine;
        },
        eq: () => chaine,
        maybeSingle: async () => (options.erreurLigne ? { data: null, error: { message: "panne" } } : { data: options.ligne, error: null }),
      };
      return chaine;
    },
  } as any;
}

async function main(): Promise<void> {
  // ── 1. Le vrai `eleveAuthentifie` ──
  const { eleveAuthentifie } = require("../lib/supabaseAdmin") as typeof import("../lib/supabaseAdmin");
  const entete = "Bearer jeton";
  verifier((await eleveAuthentifie(entete, fauxAdmin({ utilisateur: "e1", ligne: { id: "e1", actif: true } })))?.id === "e1", "élève actif : accepté");
  verifier((await eleveAuthentifie(entete, fauxAdmin({ utilisateur: "e1", ligne: { id: "e1", actif: false } }))) === null, "élève DÉSACTIVÉ : refusé (null -> 401 partout)");
  verifier((await eleveAuthentifie(entete, fauxAdmin({ utilisateur: "e1", ligne: { id: "e1" } })))?.id === "e1", "colonne actif absente : pas un refus (seul actif === false désactive)");
  verifier((await eleveAuthentifie(entete, fauxAdmin({ utilisateur: "e1", ligne: { id: "e1", actif: null } })))?.id === "e1", "actif null : pas un refus");
  verifier((await eleveAuthentifie(entete, fauxAdmin({ utilisateur: "e1", ligne: null }))) === null, "aucune ligne eleves : refusé");
  verifier((await eleveAuthentifie(entete, fauxAdmin({ utilisateur: "e1", ligne: { id: "e1", actif: true }, erreurLigne: true }))) === null, "erreur de lecture : refusé (jamais accepté par défaut)");
  verifier((await eleveAuthentifie(entete, fauxAdmin({ utilisateur: null, ligne: { id: "e1", actif: true } }))) === null, "jeton invalide : refusé");
  verifier((await eleveAuthentifie(undefined, fauxAdmin({ utilisateur: "e1", ligne: { id: "e1", actif: true } }))) === null, "sans en-tête : refusé");

  // ── 2. Le vrai routeur ──
  imposerProfilAssignation("base");
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  const tache = creerTache(s, { nom: "Tâche" });
  const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
  verifier(a.statut === 201, `assignation préalable : ${a.statut}`);
  const exercice = s.base.table("exercices_assignes").find((l) => l.eleve_id === "eleve-1")!;
  const id = exercice.id as string;
  const appelsEleve: [string, "GET" | "POST", Record<string, unknown> | undefined][] = [
    ["eleves/tableau-de-bord", "GET", undefined],
    ["eleves/mes-resultats", "GET", undefined],
    ["exercices", "GET", undefined],
    [`exercices/${id}`, "GET", undefined],
    ["reponses", "POST", { exercice_assigne_id: id, champ: "somme", reponse_brute: "1" }],
    ["reponses/aide", "POST", { exercice_assigne_id: id, champ: "somme" }],
    ["reponses/debut-ecran", "POST", { exercice_assigne_id: id, champ: "somme" }],
  ];
  const statuts = async () => Promise.all(appelsEleve.map(async ([chemin, methode, corps]) => (await appeler(chemin, methode, { jeton: jetonEleve, corps })).statut));

  const avant = await statuts();
  verifier(avant.every((c) => c !== 401), `élève actif : aucune des 7 routes ne répond 401 (${avant.join()})`);

  // Désactivation PAR LA ROUTE professeur (le vrai chemin de production) : le même jeton, déjà émis, ne passe plus.
  const desactivation = await appeler("profs/desactiver-eleve", "POST", { jeton: jetonProf, corps: { eleve_id: "eleve-1" } });
  verifier(desactivation.statut === 200 && s.base.table("eleves").find((e) => e.id === "eleve-1")?.actif === false, `désactivation par la route professeur : ${desactivation.statut}`);
  const apres = await statuts();
  verifier(apres.every((c) => c === 401), `élève DÉSACTIVÉ : les 7 routes répondent 401 avec le jeton déjà émis (${apres.join()})`);
  const nbReponses = s.base.table("reponses").length;
  await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ: "somme", reponse_brute: "1" } });
  verifier(s.base.table("reponses").length === nbReponses, "une réponse envoyée avec le jeton d'un élève désactivé n'écrit rien");

  // L'autre élève de la classe n'est pas touché ; ses données restent intactes.
  const autre = await appeler("eleves/tableau-de-bord", "GET", { jeton: "eleve:eleve-2" });
  verifier(autre.statut !== 401, `l'autre élève de la classe garde son accès (${autre.statut})`);
  verifier(s.base.table("exercices_assignes").some((l) => l.id === id), "les données de l'élève désactivé restent intactes");

  // Réactivation (SQL par le propriétaire) : l'accès revient immédiatement, sans nouveau jeton.
  s.base.table("eleves").find((e) => e.id === "eleve-1")!.actif = true;
  const reactive = await statuts();
  verifier(reactive.every((c) => c !== 401), `élève réactivé : l'accès revient avec le même jeton (${reactive.join()})`);

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (eleveAuthentifie réel + 7 routes élève du vrai routeur : désactivé = 401 avec un jeton déjà émis, réactivation immédiate)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
