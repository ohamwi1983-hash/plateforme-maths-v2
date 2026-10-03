// OUTIL MANUEL (jamais lancé par les tests) — chronomètre la suppression d'une classe de test CHARGÉE (RAPPORT §61-H) : N élèves de test (20 par défaut), chacun avec plusieurs réponses, débuts d'écran
// et usages d'aide enregistrés par les VRAIES routes, puis `DELETE /api/admin/classes-test/:id` mesuré seul. Deux modes :
//   • CIBLE RÉELLE (aperçu Vercel ou production — la vraie base Supabase doit avoir reçu `supabase/migrations/cumulatif.sql`) :
//       BASE_URL=https://<aperçu>.vercel.app JETON_ADMIN=<access_token d'un professeur admin> npx tsx scripts/mesure-suppression-classe-test.ts
//     (JETON_ADMIN : `JSON.parse(localStorage["sb-<ref>-auth-token"]).access_token` dans la console du navigateur connecté à prof.html.) Crée sa propre classe de test, la supprime, ne touche à rien d'autre.
//   • LOCAL (défaut, sans réseau) : vrai `api/router.ts` sur la base en mémoire. Ne mesure PAS la latence réseau de Supabase : il COMPTE les requêtes émises par la suppression (une par `from(...)`, une par appel
//     Auth) ; la durée réelle ≈ requêtes de base × latence d'une requête + appels Auth séquentiels × latence d'un appel Auth (à lire sur la cible réelle).
// Variables : NB_ELEVES (20), NB_TACHES (3 : chaque tâche = 1 exercice gen9 = 2 écrans = 2 réponses par élève), AIDE (1 : aide + début d'écran).

export {}; // module

import { performance } from "node:perf_hooks";

const NB_ELEVES = Number(process.env.NB_ELEVES ?? 20);
const NB_TACHES = Number(process.env.NB_TACHES ?? 3);
const AVEC_AIDE = (process.env.AIDE ?? "1") !== "0";
const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "");
const JETON_ADMIN = process.env.JETON_ADMIN;

type Reponse = { statut: number; corps: any; ms: number };

async function main(): Promise<void> {
  let racine = BASE_URL ?? "";
  let jetonAdmin = JETON_ADMIN ?? "";
  let arreter: () => void = () => {};
  let compteurs: { requetesBase: number; appelsAuth: number } | null = null;

  if (!BASE_URL) {
    // Mode local : serveur HTTP sur le vrai routeur, base en mémoire dont on COMPTE les requêtes.
    const { demarrerServeur } = await import("./support/serveurChromium");
    const { creerScenario, installerBase } = await import("./support/harnaisRouteur");
    const s = creerScenario();
    for (const p of s.base.table("profs")) p.est_admin = p.id === "prof-1";
    installerBase(s.base);
    const compte = { requetesBase: 0, appelsAuth: 0 };
    const from = s.base.from.bind(s.base);
    s.base.from = ((nom: string) => {
      compte.requetesBase++;
      return from(nom);
    }) as typeof s.base.from;
    const suppr = s.base.auth.admin.deleteUser.bind(s.base.auth.admin);
    s.base.auth.admin.deleteUser = async (id: string) => {
      compte.appelsAuth++;
      return suppr(id);
    };
    compteurs = compte;
    const { serveur, url } = await demarrerServeur();
    racine = url;
    jetonAdmin = "prof:prof-1";
    arreter = () => serveur.close();
  }
  if (!jetonAdmin) throw new Error("JETON_ADMIN manquant (mode cible réelle).");

  const appel = async (methode: string, chemin: string, jeton: string | null, corps?: unknown): Promise<Reponse> => {
    const t0 = performance.now();
    const r = await fetch(`${racine}/api/${chemin}`, { method: methode, headers: { "Content-Type": "application/json", ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}) }, body: corps === undefined ? undefined : JSON.stringify(corps) });
    let json: any = null;
    try {
      json = await r.json();
    } catch {
      /* corps vide */
    }
    return { statut: r.status, corps: json, ms: performance.now() - t0 };
  };
  const exiger = (r: Reponse, attendu: number, quoi: string): Reponse => {
    if (r.statut !== attendu) throw new Error(`${quoi} : HTTP ${r.statut} ${JSON.stringify(r.corps)}`);
    return r;
  };

  console.log(`Cible : ${BASE_URL ?? "LOCAL (base en mémoire)"} — ${NB_ELEVES} élèves, ${NB_TACHES} tâche(s) gen9 chacun (${NB_TACHES * 2} réponses par élève), aide ${AVEC_AIDE ? "oui" : "non"}`);
  const classe = exiger(await appel("POST", "admin/classes-test", jetonAdmin, { nom: `Mesure suppression ${new Date().toISOString()}` }), 201, "création de la classe").corps;
  const eleves = exiger(await appel("POST", `admin/classes-test/${classe.id}/eleves`, jetonAdmin, { nombre: NB_ELEVES }), 201, "création des élèves");
  const { mot_de_passe: motDePasse, eleves: liste } = eleves.corps as { mot_de_passe: string; eleves: { id: string; nom: string; prenom: string }[] };
  console.log(`Création de ${liste.length} élèves : ${Math.round(eleves.ms)} ms`);

  const tacheIds: string[] = [];
  for (let t = 0; t < NB_TACHES; t++) {
    const tache = exiger(await appel("POST", "taches", jetonAdmin, { nom: `Mesure ${t}`, feedback_immediat: true, reponse_visible: true, tentatives_supplementaires: 0, aide_activee: AVEC_AIDE, composition: [{ variante_id: "completion_du_carre", nombre_exercices: 1, configuration: { actives: ["TH"] } }] }), 201, "création d'une tâche").corps;
    tacheIds.push(tache.id as string);
    exiger(await appel("POST", "assignations", jetonAdmin, { tache_id: tache.id, classe_id: classe.id }), 201, "assignation");
  }

  let reponses = 0;
  for (const e of liste) {
    const connexion = exiger(await appel("POST", "connexion-eleve", null, { nom: e.nom, prenom: e.prenom, motDePasse }), 200, `connexion de ${e.prenom}`).corps;
    const jeton = connexion.access_token as string;
    const exercices = exiger(await appel("GET", "exercices", jeton), 200, "liste des exercices").corps as { id: string }[];
    for (const ex of exercices) {
      if (AVEC_AIDE) {
        await appel("POST", "reponses/debut-ecran", jeton, { exercice_assigne_id: ex.id, champ: "forme" });
        await appel("POST", "reponses/aide", jeton, { exercice_assigne_id: ex.id, champ: "forme" });
      }
      // Réponses volontairement fausses mais lisibles : l'écran 1 se termine (un seul essai), l'écran 2 est alors servi.
      exiger(await appel("POST", "reponses", jeton, { exercice_assigne_id: ex.id, champ: "forme", reponse_brute: "2(x-1)^2+3" }), 200, "réponse écran 1");
      reponses++;
      exiger(await appel("POST", "reponses", jeton, { exercice_assigne_id: ex.id, champ: "chaine", reponse_brute: JSON.stringify({ etapes: [{ expression: "(x-1)^2", transformation: "TH", valeur: "1" }] }) }), 200, "réponse écran 2");
      reponses++;
    }
  }
  console.log(`Données créées : ${liste.length} élèves × ${NB_TACHES} exercice(s), ${reponses} réponses.`);

  const avant = compteurs ? { ...compteurs } : null;
  const suppression = await appel("DELETE", `admin/classes-test/${classe.id}`, jetonAdmin);
  console.log(`\nSUPPRESSION : HTTP ${suppression.statut} en ${Math.round(suppression.ms)} ms — ${JSON.stringify(suppression.corps)}`);
  if (compteurs && avant) {
    const base = compteurs.requetesBase - avant.requetesBase;
    const auth = compteurs.appelsAuth - avant.appelsAuth;
    console.log(`Requêtes émises par la suppression : ${base} requêtes de base de données (séquentielles) + ${auth} appels Auth (par lots de 10 en parallèle depuis RAPPORT §63).`);
    console.log("Durée réelle ≈ requêtes de base × latence d'une requête + ⌈appels Auth / 10⌉ × latence d'un appel Auth — à mesurer sur une cible réelle (BASE_URL + JETON_ADMIN).");
  }
  // Nettoyage : les tâches créées par l'outil ne sont plus assignées une fois la classe supprimée, donc supprimables (elles ne doivent pas rester dans la liste du compte utilisé).
  let tachesSupprimees = 0;
  for (const id of tacheIds) if ((await appel("DELETE", `taches/${id}`, jetonAdmin)).statut === 200) tachesSupprimees++;
  console.log(`Nettoyage : ${tachesSupprimees}/${tacheIds.length} tâche(s) de mesure supprimée(s).`);
  arreter();
  if (suppression.statut !== 200) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
