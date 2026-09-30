// Validation Chromium (outil MANUEL, non lancé par les tests unitaires) — phase 2 : joue le générateur
// témoin technique de bout en bout dans un vrai navigateur, contre le VRAI `api/router.ts` et une base
// en mémoire (scripts/support/), en mobile (390px) puis desktop (1280px). Sert aussi à valider tout
// futur ajout de type d'écran (le témoin doit alors couvrir le nouveau type).
//
//   npx tsx scripts/chromium-temoin-technique.ts        # captures dans $CAPTURES_DIR (défaut : ./captures-chromium)
//
// Prérequis : `npm ci` (le paquet `playwright` est une devDependency, version épinglée) puis, hors de ce
// bac à sable, `npx playwright install chromium` (le navigateur n'est pas dans node_modules ; ici il est
// déjà fourni via PLAYWRIGHT_BROWSERS_PATH). Le seul CDN bloqué en bac à sable
// (`unpkg.com/@supabase/supabase-js`) est remplacé par un stub local de la seule API utilisée par
// les pages (`auth.getSession/setSession/signInWithPassword/signOut/updateUser`) ; aucun réseau réel.

export {}; // module

// Code exécuté DANS la page (fonctions passées à `locator.evaluate`) : le projet n'inclut pas la bibliothèque DOM.
declare const getComputedStyle: (el: unknown) => Record<string, string>;

import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase, type Scenario } from "./support/harnaisRouteur";
import {
  CHAMP_ALLURE, CHAMP_AXE, CHAMP_COEFFICIENTS, CHAMP_DIVISEURS, CHAMP_EXTREMUM, CHAMP_IMAGE, CHAMP_PARITE, CHAMP_QUOTIENT, CHAMP_RACINES, CHAMP_SIGNES, CHAMP_SIGNES_VARIATION, CHAMP_SOMME,
  generateurTemoinTechnique as temoin, graineDeProfil, reponseBruteCorrecte, VARIANTE_TEMOIN, type ExerciceEtendu, type ExerciceTemoin,
} from "../src/generateurs/_temoinTechnique";

const RACINE = join(__dirname, "..");
const CAPTURES = process.env.CAPTURES_DIR ?? join(RACINE, "captures-chromium");
mkdirSync(CAPTURES, { recursive: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright");

const TYPES_MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json", ".png": "image/png" };

function demarrerServeur(): Promise<{ serveur: Server; url: string }> {
  process.env.SUPABASE_URL = "http://supabase.invalide";
  process.env.SUPABASE_ANON_KEY = "anon-invalide";
  const serveur = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      if (url.pathname.startsWith("/api/")) {
        const corpsBrut = await new Promise<string>((ok) => {
          let d = "";
          req.on("data", (c) => (d += c));
          req.on("end", () => ok(d));
        });
        const { default: routeur } = require("../api/router");
        let statut = 200;
        let charge: unknown = null;
        // Les paramètres d'URL (`?classe_id=`, `?tache_id=`) atteignent le routeur comme sur Vercel.
        await routeur(
          { method: req.method, headers: req.headers, query: { path: url.pathname.slice(5), ...Object.fromEntries(url.searchParams) }, body: corpsBrut ? JSON.parse(corpsBrut) : {} },
          {
            status(c: number) {
              statut = c;
              return this;
            },
            json(o: unknown) {
              charge = o;
            },
            end() {},
          },
        );
        res.writeHead(statut, { "Content-Type": "application/json" }).end(JSON.stringify(charge));
        return;
      }
      const chemin = normalize(join(RACINE, "public", url.pathname === "/" ? "index.html" : url.pathname));
      if (!chemin.startsWith(join(RACINE, "public")) || !existsSync(chemin)) {
        res.writeHead(404).end("introuvable");
        return;
      }
      res.writeHead(200, { "Content-Type": TYPES_MIME[extname(chemin)] ?? "application/octet-stream" }).end(readFileSync(chemin));
    } catch (e) {
      res.writeHead(500).end(String(e));
    }
  });
  return new Promise((ok) => serveur.listen(0, "127.0.0.1", () => ok({ serveur, url: `http://127.0.0.1:${(serveur.address() as any).port}` })));
}

function stubSupabase(jeton: string, email: string): string {
  return `window.supabase = { createClient: () => ({ auth: {
    getSession: async () => ({ data: { session: { access_token: ${JSON.stringify(jeton)}, refresh_token: "r", user: { email: ${JSON.stringify(email)} } } } }),
    setSession: async () => ({ data: {}, error: null }), signInWithPassword: async () => ({ data: {}, error: null }),
    signOut: async () => ({ error: null }), updateUser: async () => ({ error: null }) } }) };`;
}

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

interface Journal {
  erreursConsole: string[];
  pageerrors: string[];
  requetes: { methode: string; url: string; corps: string | null }[];
  reponsesEnErreur: { statut: number; methode: string; url: string }[];
  /** Messages d'erreur AFFICHÉS à l'utilisateur au moment de la fermeture de la page (RAPPORT §27) : ni HTTP, ni console, ni exception non interceptée. */
  erreursInterface: string[];
}
const journauxOuverts: { journal: Journal; jeton: string }[] = [];

/** Code exécuté DANS la page : messages d'erreur visibles (erreur fatale du pilote ; échec de chargement de prof.html). */
const LECTURE_ERREURS_INTERFACE = `(() => {
  const sortie = [];
  const fatale = document.getElementById("erreur-fatale-pilote");
  if (fatale && fatale.textContent.trim() !== "") sortie.push("erreur fatale : " + fatale.textContent.trim().slice(0, 240));
  const statut = document.getElementById("statut-connexion");
  if (statut && /Impossible de charger|Erreur inattendue/.test(statut.textContent)) sortie.push("statut-connexion : " + statut.textContent.trim().slice(0, 240));
  return sortie;
})()`;

/** Réponse >= 400 qu'un scénario PROVOQUE volontairement : `motif` sur « MÉTHODE chemin », `pourquoi` obligatoire. */
interface ReponseHttpAttendue {
  statut: number;
  motif: RegExp;
  pourquoi: string;
}

/**
 * Contrôle des réponses HTTP >= 400 de toutes les pages ouvertes depuis le dernier appel (une page qui ne
 * ferme pas son contexte est contrôlée aussi). Une réponse d'erreur non déclarée fait échouer le scénario ;
 * une réponse déclarée attendue mais jamais vue aussi (sinon la liste d'attendus se périme sans bruit).
 * Origine : un `?tache_id=` perdu par le pont d'API du harnais faisait échouer des appels de `prof.html`
 * sans qu'aucune assertion ne le voie (RAPPORT §21).
 */
function evaluerReponsesHttp(etiquette: string, journaux: { journal: Journal; jeton: string }[], attendues: ReponseHttpAttendue[]): string[] {
  const problemes: string[] = [];
  const vues = new Set<ReponseHttpAttendue>();
  for (const { journal, jeton } of journaux) {
    for (const r of journal.reponsesEnErreur) {
      const cle = `${r.methode} ${r.url}`;
      const attendue = attendues.find((a) => a.statut === r.statut && a.motif.test(cle));
      if (attendue) vues.add(attendue);
      else problemes.push(`${etiquette} (${jeton}) : réponse HTTP inattendue ${r.statut} sur ${cle}`);
    }
  }
  for (const a of attendues) if (!vues.has(a)) problemes.push(`${etiquette} : réponse ${a.statut} attendue (${a.pourquoi}) jamais observée — liste d'attendus périmée ?`);
  return problemes;
}

function evaluerErreursInterface(etiquette: string, journaux: { journal: Journal; jeton: string }[]): string[] {
  return journaux.flatMap(({ journal, jeton }) => journal.erreursInterface.map((m) => `${etiquette} (${jeton}) : erreur affichée à l'écran — ${m}`));
}

function controlerReponsesHttp(etiquette: string, attendues: ReponseHttpAttendue[] = []): void {
  const ouverts = journauxOuverts.splice(0);
  for (const m of evaluerErreursInterface(etiquette, ouverts)) verifier(false, m);
  const problemes = evaluerReponsesHttp(etiquette, ouverts, attendues);
  for (const m of problemes) verifier(false, m);
  verifier(problemes.length === 0, `${etiquette} : réponses HTTP >= 400 conformes aux attendus déclarés`);
}

/** Le contrôle lui-même doit voir un 404 réel, refuser un 404 non déclaré, accepter un déclaré, signaler un attendu périmé. */
async function temoinControleHttp(navigateur: any, base: string) {
  const { page, contexte, journal } = await preparerPage(navigateur, base, 1280, 900, "eleve:eleve-1", "e1@x");
  await page.goto(base + "/page-inexistante.html");
  await contexte.close();
  const journaux = [{ journal, jeton: "temoin" }];
  journauxOuverts.splice(0);
  verifier(journal.reponsesEnErreur.length === 1 && journal.reponsesEnErreur[0].statut === 404 && journal.reponsesEnErreur[0].url === "/page-inexistante.html", `témoin du contrôle : un vrai 404 doit être journalisé (${JSON.stringify(journal.reponsesEnErreur)})`);
  const declaree: ReponseHttpAttendue = { statut: 404, motif: /^GET \/page-inexistante\.html$/, pourquoi: "témoin" };
  verifier(evaluerReponsesHttp("t", journaux, []).length === 1, "témoin du contrôle : un 404 non déclaré doit être refusé");
  verifier(evaluerReponsesHttp("t", journaux, [declaree]).length === 0, "témoin du contrôle : un 404 déclaré doit être accepté");
  verifier(evaluerReponsesHttp("t", journaux, [{ ...declaree, statut: 409 }]).length === 2, "témoin du contrôle : un statut différent = réponse inattendue ET attendu périmé");
  verifier(evaluerReponsesHttp("t", [{ journal: { ...journal, reponsesEnErreur: [] }, jeton: "t" }], [declaree]).length === 1, "témoin du contrôle : un attendu jamais observé doit être signalé");
  // Erreur affichée à l'écran mais invisible pour HTTP / console / pageerror : la lecture à la fermeture doit la voir.
  {
    const { page: p2, contexte: c2, journal: j2 } = await preparerPage(navigateur, base, 1280, 900, "eleve:eleve-1", "e1@x");
    await p2.setContent('<p id="statut-connexion">Impossible de charger la configuration : Cannot read properties of undefined (reading \'slice\')</p>');
    await c2.close();
    journauxOuverts.splice(0);
    verifier(j2.reponsesEnErreur.length === 0 && j2.erreursConsole.length === 0 && j2.pageerrors.length === 0, "témoin interface : cette panne n'a AUCUN signal HTTP / console / pageerror");
    verifier(j2.erreursInterface.length === 1 && evaluerErreursInterface("t", [{ journal: j2, jeton: "t" }]).length === 1, `témoin interface : l'erreur affichée est lue à la fermeture (${JSON.stringify(j2.erreursInterface)})`);
  }
}

async function preparerPage(navigateur: any, url: string, largeur: number, hauteur: number, jeton: string, email: string, avantChargement?: string) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, hasTouch: largeur < 600 });
  const page = await contexte.newPage();
  const journal: Journal = { erreursConsole: [], pageerrors: [], requetes: [], reponsesEnErreur: [], erreursInterface: [] };
  journauxOuverts.push({ journal, jeton });
  // Un chargement qui échoue dans un try/catch de la page (ex. `init` de prof.html : « Impossible de charger la configuration : … »)
  // n'est NI une réponse HTTP >= 400, NI une erreur console, NI un `pageerror` : seul l'écran le dit. On le lit à la fermeture.
  const fermerContexte = contexte.close.bind(contexte);
  contexte.close = async () => {
    for (const p of contexte.pages()) {
      try {
        journal.erreursInterface.push(...((await p.evaluate(LECTURE_ERREURS_INTERFACE)) as string[]));
      } catch {
        /* page déjà fermée ou sans document : rien à lire */
      }
    }
    await fermerContexte();
  };
  page.on("pageerror", (e: Error) => journal.pageerrors.push(e.message));
  page.on("console", (m: any) => {
    if (m.type() === "error") journal.erreursConsole.push(m.text());
  });
  page.on("request", (r: any) => journal.requetes.push({ methode: r.method(), url: r.url(), corps: r.postData() }));
  // Toute réponse HTTP >= 400 est notée (URL, méthode, statut), qu'un test l'attende ou non : c'est
  // `controlerReponsesHttp` qui tranche, en fin de scénario, contre une liste d'attendus DÉCLARÉE.
  page.on("response", (r: any) => {
    if (r.status() >= 400) journal.reponsesEnErreur.push({ statut: r.status(), methode: r.request().method(), url: new URL(r.url()).pathname });
  });
  await page.route("**/unpkg.com/@supabase/supabase-js**", (r: any) => r.fulfill({ contentType: "text/javascript", body: stubSupabase(jeton, email) }));
  await page.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
  await page.route("**/fonts.gstatic.com/**", (r: any) => r.abort());
  if (avantChargement) await page.addInitScript(avantChargement);
  return { page, contexte, journal, url };
}

const reponsesEnvoyees = (journal: { requetes: { methode: string; url: string }[] }) => journal.requetes.filter((r) => r.methode === "POST" && r.url.endsWith("/api/reponses")).length;

async function verifierMiseEnPage(page: any, etiquette: string, largeur: number) {
  // Code exécuté DANS la page : fourni en chaîne (le projet n'inclut pas la bibliothèque DOM de TypeScript).
  const mesures = (await page.evaluate(`(() => {
    const trop = document.documentElement.scrollWidth > window.innerWidth;
    const petits = [];
    for (const el of document.querySelectorAll("#conteneur-moteur .moteur-bouton, #conteneur-moteur .moteur-case-signe, #conteneur-moteur .moteur-choix, #conteneur-moteur .moteur-champ")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.height < 43.5) petits.push(el.className + " " + Math.round(r.height) + "px");
    }
    const titre = document.querySelector("#conteneur-moteur .moteur-titre");
    return { debordement: trop, petits, titreLisible: !titre || titre.getBoundingClientRect().width >= 100 };
  })()`)) as { debordement: boolean; petits: string[]; titreLisible: boolean };
  verifier(mesures.titreLisible, `${etiquette} (${largeur}px) : le titre de la tâche est écrasé (largeur < 100px)`);
  verifier(!mesures.debordement, `${etiquette} (${largeur}px) : défilement horizontal de la page`);
  verifier(mesures.petits.length === 0, `${etiquette} (${largeur}px) : zones tactiles < 44px : ${mesures.petits.join(", ")}`);
}

async function scenarioEleve(navigateur: any, base: string, largeur: number) {
  imposerProfilAssignation("base"); // scénario d'ORIGINE : les 4 écrans du profil « base »
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const tacheId = creerTache(s, { nom: "Tâche témoin technique", aide_activee: true, aide_penalite_pourcent: 50, tentatives_supplementaires: 1, chrono_mode: "par_ecran", chrono_duree_secondes: 300, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, classe_id: s.classeId } });
  verifier(a.statut === 201, `assignation préalable : ${a.statut}`);
  const ligne = s.base.table("exercices_assignes").find((l) => l.eleve_id === "eleve-1")!;
  const ex = temoin.generer(Number(ligne.graine));
  const l = `${largeur}`;

  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
  await page.goto(base + "/eleve.html");
  await page.waitForSelector(".carte-tache");
  verifier((await page.locator(".carte-tache").count()) === 1, `${l} : la tâche assignée doit apparaître dans « Mes tâches »`);
  await page.screenshot({ path: join(CAPTURES, `${l}-01-mes-taches.png`), fullPage: true });
  await page.locator(".carte-tache").click();
  await page.waitForSelector(".moteur-ecran-courant");

  // ── Écran 1 : champ_expression ──
  verifier((await page.locator(".moteur-ecran-courant .moteur-consigne").innerText()) === `Calcule ${ex.a} + ${ex.b}.`, `${l} : consigne de l'écran 1`);
  const avant = reponsesEnvoyees(journal);
  await page.locator(".moteur-ecran-courant .moteur-champ").fill("12+");
  verifier(reponsesEnvoyees(journal) === avant, `${l} : aucune requête /api/reponses pendant la frappe (état d'édition ≠ réponse)`);
  verifier((await page.locator(".moteur-retour .moteur-statut").count()) === 0, `${l} : aucun marquage pendant la frappe`);
  await page.screenshot({ path: join(CAPTURES, `${l}-02-champ-expression-edition.png`), fullPage: true });
  await verifierMiseEnPage(page, "champ_expression", largeur);
  // Aide : le texte n'est pas dans le DOM avant la demande, l'usage est enregistré côté serveur.
  verifier(!(await page.content()).includes("Additionne les deux nombres."), `${l} : le texte d'aide ne doit pas être dans la page avant la demande`);
  await page.getByRole("button", { name: "Besoin d'un indice ?" }).click();
  await page.getByRole("button", { name: /Confirmer/ }).click();
  await page.waitForSelector(".moteur-aide-texte:not([hidden])");
  verifier((await page.locator(".moteur-aide-texte").innerText()).includes("Additionne"), `${l} : texte d'aide affiché après confirmation`);
  verifier(s.base.table("aides_utilisees").length === 1, `${l} : usage d'aide enregistré côté serveur`);
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-parse_error");
  verifier((await page.locator(".moteur-message-syntaxe").count()) === 1, `${l} : message pédagogique de parse_error affiché`);
  await page.screenshot({ path: join(CAPTURES, `${l}-03-champ-expression-parse-error.png`), fullPage: true });
  await page.locator(".moteur-ecran-courant .moteur-champ").fill(String(ex.a + ex.b));
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-correct");
  await page.screenshot({ path: join(CAPTURES, `${l}-04-champ-expression-correct.png`), fullPage: true });
  await page.getByRole("button", { name: "Question suivante" }).click();

  // ── Écran 2 : qcm ──
  await page.waitForSelector(".moteur-qcm");
  const bonneParite = reponseBruteCorrecte(ex, CHAMP_PARITE);
  const mauvaiseParite = bonneParite === "pair" ? "impair" : "pair";
  verifier((await page.locator(".moteur-ecran-courant .moteur-bouton-principal").isDisabled()), `${l} : « Valider » désactivé tant que rien n'est choisi`);
  const avantQcm = reponsesEnvoyees(journal);
  await page.locator(`.moteur-qcm input[value="${mauvaiseParite}"]`).check();
  verifier(reponsesEnvoyees(journal) === avantQcm, `${l} : choisir un QCM n'envoie rien tant qu'on ne valide pas`);
  await page.screenshot({ path: join(CAPTURES, `${l}-05-qcm-choix.png`), fullPage: true });
  await verifierMiseEnPage(page, "qcm", largeur);
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-not_equivalent");
  verifier((await page.locator(".moteur-tentatives").innerText()).includes("1 essai"), `${l} : tentatives restantes affichées`);
  await page.screenshot({ path: join(CAPTURES, `${l}-06-qcm-not-equivalent.png`), fullPage: true });
  await page.locator(`.moteur-qcm input[value="${bonneParite}"]`).check();
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-correct");
  await page.getByRole("button", { name: "Question suivante" }).click();

  // ── Écran 3 : liste_valeurs ──
  await page.waitForSelector(".moteur-liste-valeurs");
  const diviseurs: string[] = JSON.parse(reponseBruteCorrecte(ex, CHAMP_DIVISEURS));
  const avantListe = reponsesEnvoyees(journal);
  await page.locator(".moteur-liste-ligne .moteur-champ").first().fill(diviseurs[0]);
  for (const d of diviseurs.slice(1)) {
    await page.getByRole("button", { name: "Ajouter un diviseur" }).click();
    await page.locator(".moteur-liste-ligne .moteur-champ").last().fill(d);
  }
  await page.getByRole("button", { name: "Ajouter un diviseur" }).click();
  await page.locator(".moteur-liste-ligne").last().getByRole("button", { name: "Retirer cette valeur" }).click(); // ajout puis retrait : ne change rien à la réponse
  verifier(reponsesEnvoyees(journal) === avantListe, `${l} : ajouter/retirer des lignes n'envoie rien (état d'édition ≠ réponse)`);
  verifier((await page.locator(".moteur-liste-ligne").count()) === diviseurs.length, `${l} : liste de taille variable (${diviseurs.length} lignes)`);
  await page.screenshot({ path: join(CAPTURES, `${l}-07-liste-valeurs.png`), fullPage: true });
  await verifierMiseEnPage(page, "liste_valeurs", largeur);
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-correct");
  await page.getByRole("button", { name: "Question suivante" }).click();

  // ── Écran 4 : tableau_signes ──
  await page.waitForSelector(".moteur-table-signes");
  const signes = JSON.parse(reponseBruteCorrecte(ex, CHAMP_SIGNES)) as Record<string, Record<string, string>>;
  const avantTableau = reponsesEnvoyees(journal);
  const remplir = async () => {
    for (const [ligneId, colonnes] of Object.entries(signes)) {
      const idxLigne = Object.keys(signes).indexOf(ligneId);
      for (const [colonneId, signe] of Object.entries(colonnes)) {
        const idxCol = Number(colonneId.slice(1));
        const cellule = page.locator(".moteur-table-signes tbody tr").nth(idxLigne).locator("td").nth(idxCol).locator("button");
        for (let i = 0; i < 4 && (await cellule.innerText()) !== signe; i++) await cellule.click();
      }
    }
  };
  await page.locator(".moteur-table-signes tbody tr").first().locator("td button").first().click();
  verifier((await page.locator(".moteur-ecran-courant .moteur-bouton-principal").isDisabled()), `${l} : « Valider » désactivé tant que le tableau est incomplet`);
  await remplir();
  verifier(reponsesEnvoyees(journal) === avantTableau, `${l} : remplir le tableau n'envoie rien tant qu'on ne valide pas`);
  await page.screenshot({ path: join(CAPTURES, `${l}-08-tableau-signes.png`), fullPage: true });
  await verifierMiseEnPage(page, "tableau_signes", largeur);
  // Tableau HÉRITÉ (5 colonnes) : les règles transversales s'appliquent aussi (plein-bord, jamais de retour à « ? »).
  await verifierPleinBord(page, `${l} tableau hérité`, largeur);
  const cycleHerite = await cycler(page.locator(".moteur-table-signes tbody tr").first().locator("td button").first());
  verifier(cycleHerite.slice(1).every((v: string) => v !== "vide") && new Set(cycleHerite.slice(1)).size === 3, `${l} : tableau hérité : le cycle (+ - 0) ne revient jamais à « ? » : ${JSON.stringify(cycleHerite)}`);
  await remplir();
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-correct");
  await page.getByRole("button", { name: "Voir la fin" }).click();
  await page.waitForSelector(".moteur-fin");
  await page.screenshot({ path: join(CAPTURES, `${l}-09-fin-exercice.png`), fullPage: true });
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.waitForSelector("#tableau-de-bord:not([hidden])");
  await page.waitForFunction(`document.querySelector("#badge-mt-effectuees")?.textContent === "1"`);
  await page.screenshot({ path: join(CAPTURES, `${l}-10-retour-tableau-de-bord.png`), fullPage: true });

  // Bilan : toutes les réponses viennent bien d'un clic sur « Valider », jamais d'une frappe.
  const posts = journal.requetes.filter((r) => r.methode === "POST" && r.url.endsWith("/api/reponses"));
  verifier(posts.length === 6, `${l} : 6 réponses envoyées attendues (parse_error, correct, qcm faux, qcm juste, liste, tableau), obtenu ${posts.length}`);
  verifier(posts.every((p) => Object.keys(JSON.parse(p.corps ?? "{}")).sort().join() === "champ,exercice_assigne_id,reponse_brute"), `${l} : chaque réponse n'a que les 3 clés du contrat`);
  verifier(s.base.table("reponses").length === 6, `${l} : 6 lignes reponses en base`);
  verifier(journal.pageerrors.length === 0, `${l} : erreurs JS non interceptées : ${journal.pageerrors.join(" | ")}`);
  const erreursUtiles = journal.erreursConsole.filter((m) => !/fonts\.g|net::ERR_FAILED/.test(m));
  verifier(erreursUtiles.length === 0, `${l} : erreurs console : ${erreursUtiles.join(" | ")}`);
  await contexte.close();
}

async function scenarioSansCorrection(navigateur: any, base: string, largeur: number) {
  imposerProfilAssignation("base"); // scénario d'ORIGINE : les 4 écrans du profil « base »
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const l = `${largeur}`;
  const tacheId = creerTache(s, { nom: "Sans correction immédiate", feedback_immediat: false, tentatives_supplementaires: 2, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
  const ligne = s.base.table("exercices_assignes").find((x) => x.eleve_id === "eleve-1")!;
  const ex = temoin.generer(Number(ligne.graine));
  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
  await page.goto(base + "/eleve.html");
  await page.waitForSelector(".carte-tache");
  await page.locator(".carte-tache").click();
  await page.waitForSelector(".moteur-ecran-courant");

  // Une réponse fausse et une juste doivent produire EXACTEMENT le même retour, sans verdict ni solution.
  const retours: string[] = [];
  const valider = async (masque = true) => {
    await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
    await page.waitForSelector(".moteur-statut");
    if (!masque) return; // la réponse qui TERMINE la tâche la révèle : vérifié séparément
    retours.push((await page.locator(".moteur-retour").innerText()).replace(/\s+/g, " ").trim());
    verifier((await page.locator(".moteur-solution").count()) === 0 && (await page.locator(".moteur-statut-correct, .moteur-statut-not_equivalent, .moteur-statut-parse_error").count()) === 0, `${l} sans correction : aucun verdict ni solution visible après une réponse`);
  };
  await page.locator(".moteur-ecran-courant .moteur-champ").fill(String(ex.a - ex.b)); // fausse
  await valider();
  await page.screenshot({ path: join(CAPTURES, `${l}-13-sans-correction-reponse-fausse.png`), fullPage: true });
  await page.getByRole("button", { name: "Question suivante" }).click();
  await page.waitForSelector(".moteur-qcm");
  await page.locator(`.moteur-qcm input[value="${reponseBruteCorrecte(ex, CHAMP_PARITE)}"]`).check(); // juste
  await valider();
  await page.getByRole("button", { name: "Question suivante" }).click();
  await page.waitForSelector(".moteur-liste-valeurs");
  const diviseurs: string[] = JSON.parse(reponseBruteCorrecte(ex, CHAMP_DIVISEURS));
  await page.locator(".moteur-liste-ligne .moteur-champ").first().fill(diviseurs[0]);
  for (const d of diviseurs.slice(1)) {
    await page.getByRole("button", { name: "Ajouter un diviseur" }).click();
    await page.locator(".moteur-liste-ligne .moteur-champ").last().fill(d);
  }
  await valider(); // juste
  await page.getByRole("button", { name: "Question suivante" }).click();
  await page.waitForSelector(".moteur-table-signes");
  for (const b of await page.locator(".moteur-table-signes tbody button").all()) await b.click(); // 1 clic = « + » partout : faux
  await valider(false);
  verifier(retours.length === 3 && (await page.locator(".moteur-ecran-courant .moteur-statut-not_equivalent").count()) === 1, `${l} sans correction : la réponse qui termine la tâche la révèle`);
  verifier(new Set(retours.map((r) => r.replace(/Question suivante|Voir la fin/g, "").trim())).size === 1, `${l} sans correction : réponses fausses et justes de même apparence — obtenu ${JSON.stringify(retours)}`);
  // Fin de tâche : la révélation a lieu maintenant, pour tous les champs.
  await page.getByRole("button", { name: "Voir la fin" }).click();
  await page.waitForSelector(".moteur-fin");
  verifier((await page.locator(".moteur-statut-not_equivalent").count()) === 2 && (await page.locator(".moteur-statut-correct").count()) === 2, `${l} sans correction : à la fin de la tâche, 2 échecs et 2 réussites révélés (obtenu ${await page.locator(".moteur-statut-not_equivalent").count()} / ${await page.locator(".moteur-statut-correct").count()})`);
  verifier((await page.locator(".moteur-solution").count()) === 4, `${l} sans correction : à la fin de la tâche, les 4 solutions sont montrées`);
  await page.screenshot({ path: join(CAPTURES, `${l}-14-sans-correction-fin-de-tache-revelee.png`), fullPage: true });
  const erreursUtiles = journal.erreursConsole.filter((m) => !/fonts\.g|net::ERR_FAILED/.test(m));
  verifier(journal.pageerrors.length === 0 && erreursUtiles.length === 0, `${l} sans correction : erreurs JS/console : ${[...journal.pageerrors, ...erreursUtiles].join(" | ")}`);
  await contexte.close();
}

// ── Matrice visuelle : 4 composants × états (défaut, sélectionné, correct, not_equivalent, parse_error) ──
const RGB = {
  vert: "rgb(21, 143, 82)", vertClair: "rgb(228, 246, 236)", danger: "rgb(179, 38, 30)", dangerClair: "rgb(251, 234, 232)",
  ambre: "rgb(224, 138, 46)", ambreClair: "rgb(253, 241, 226)", violetVif: "rgb(124, 58, 237)", violetClair: "rgb(241, 235, 252)",
};
const CHAMPS_ORDRE = [CHAMP_SOMME, CHAMP_PARITE, CHAMP_DIVISEURS, CHAMP_SIGNES];
const NOMS_TYPES = ["champ_expression", "qcm", "liste_valeurs", "tableau_signes"];
type EtatVisuel = "defaut" | "selectionne" | "correct" | "not_equivalent" | "parse_error";

/** Réponses brutes envoyées directement à l'API (états impossibles à produire par l'interface : `parse_error` du QCM et du tableau). */
function reponseApi(ex: ReturnType<typeof temoin.generer>, indice: number, etat: "correct" | "not_equivalent" | "parse_error"): string {
  const champ = CHAMPS_ORDRE[indice];
  if (etat === "correct") return reponseBruteCorrecte(ex, champ);
  if (etat === "parse_error") return ["12+", "inexistant", "pas du json", "[]"][indice];
  const tousPlus = JSON.stringify(Object.fromEntries(["facteur1", "facteur2", "produit"].map((l) => [l, Object.fromEntries(["c0", "c1", "c2", "c3", "c4"].map((c) => [c, "+"]))])));
  return [String(ex.a - ex.b), (ex.a + ex.b) % 2 === 0 ? "impair" : "pair", JSON.stringify(["1"]), tousPlus][indice];
}

async function agirSurComposant(page: any, ex: ReturnType<typeof temoin.generer>, indice: number, etat: "selectionne" | "correct" | "not_equivalent" | "parse_error") {
  const brute = etat === "selectionne" ? reponseApi(ex, indice, "not_equivalent") : reponseApi(ex, indice, etat);
  const carte = page.locator(".moteur-ecran-courant");
  if (indice === 0) await carte.locator(".moteur-champ").fill(brute);
  if (indice === 1) await carte.locator(`.moteur-qcm input[value="${brute}"]`).check();
  if (indice === 2) {
    const valeurs: string[] = etat === "parse_error" ? ["a"] : JSON.parse(brute);
    await carte.locator(".moteur-liste-ligne .moteur-champ").first().fill(valeurs[0]);
    for (const v of valeurs.slice(1)) {
      await carte.getByRole("button", { name: "Ajouter un diviseur" }).click();
      await carte.locator(".moteur-liste-ligne .moteur-champ").last().fill(v);
    }
  }
  if (indice === 3) {
    const signes = JSON.parse(brute) as Record<string, Record<string, string>>;
    const lignes = Object.keys(signes);
    for (const [i, ligne] of lignes.entries()) {
      for (const [colonne, signe] of Object.entries(signes[ligne])) {
        const cellule = carte.locator("tbody tr").nth(i).locator("td").nth(Number(colonne.slice(1))).locator("button");
        for (let k = 0; k < 4 && (await cellule.innerText()) !== signe; k++) await cellule.click();
      }
    }
  }
}

async function matriceVisuelle(navigateur: any, base: string, largeur: number) {
  imposerProfilAssignation("base"); // scénario d'ORIGINE : les 4 écrans du profil « base »
  const l = `${largeur}`;
  let ombreCarteDashboard = "";
  let rayonCarteDashboard = "";
  for (let indice = 0; indice < 4; indice++) {
    const etats: EtatVisuel[] = ["defaut", ...(indice === 1 || indice === 3 || indice === 0 || indice === 2 ? (["selectionne"] as EtatVisuel[]) : []), "correct", "not_equivalent", "parse_error"];
    for (const etat of etats) {
      const s: Scenario = creerScenario();
      installerBase(s.base);
      const tacheId = creerTache(s, { nom: "Matrice visuelle", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
      await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
      const ligne = s.base.table("exercices_assignes").find((x) => x.eleve_id === "eleve-1")!;
      const ex = temoin.generer(Number(ligne.graine));
      const api = (champ: string, brute: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: brute } });
      for (let i = 0; i < indice; i++) await api(CHAMPS_ORDRE[i], reponseBruteCorrecte(ex, CHAMPS_ORDRE[i])); // atteindre l'écran visé
      // `parse_error` du QCM et du tableau : impossible par l'interface (choix inconnu / tableau incomplet bloqués côté client)
      // -> appel DIRECT à l'API, puis l'écran verrouillé est relu par le moteur.
      const parApi = etat === "parse_error" && (indice === 1 || indice === 3);
      if (parApi) verifier((await api(CHAMPS_ORDRE[indice], reponseApi(ex, indice, "parse_error"))).corps.statut === "parse_error", `${l} ${NOMS_TYPES[indice]} : l'appel direct doit produire parse_error`);

      const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
      await page.goto(base + "/eleve.html");
      await page.waitForSelector(".carte-tache", { state: "attached" });
      if (!ombreCarteDashboard) {
        const c = (await page.evaluate(`(() => { const e = document.querySelector(".carte-tache"); const st = getComputedStyle(e); return { ombre: st.boxShadow, rayon: st.borderRadius, filet: st.borderTopColor + " " + st.borderTopWidth, fond: st.backgroundColor }; })()`)) as { ombre: string; rayon: string; filet: string; fond: string };
        ombreCarteDashboard = c.ombre;
        rayonCarteDashboard = `${c.rayon}|${c.filet}|${c.fond}`;
      }
      if (await page.locator(".carte-tache").first().isVisible()) {
        await page.locator(".carte-tache").click();
      } else {
        // Tâche terminée (dernier écran fermé par l'appel direct) : consultation depuis « Effectuées ».
        await page.locator("#entete-mt-effectuees").click();
        await page.locator(".carte-tache-exercices a").first().click();
      }
      await page.waitForSelector(".moteur-ecran");
      const consigne = temoin.ecrans(ex)[indice].consigne;
      const carte = page.locator(".moteur-ecran").filter({ hasText: consigne });

      if (etat === "selectionne") await agirSurComposant(page, ex, indice, "selectionne");
      if (etat === "correct" || etat === "not_equivalent" || (etat === "parse_error" && !parApi)) {
        await agirSurComposant(page, ex, indice, etat);
        await carte.locator(".moteur-bouton-principal").click();
        await page.waitForSelector(`.moteur-ecran:has-text("${consigne.slice(0, 12).replace(/"/g, "")}") .moteur-statut-${etat}`);
      }
      const nom = `${l}-matrice-${NOMS_TYPES[indice]}-${etat}`;
      await carte.screenshot({ path: join(CAPTURES, `${nom}.png`) });

      // ── Assertions de style calculé sur la carte concernée ──
      const style = (await carte.evaluate((el: unknown) => { const st = getComputedStyle(el); return { filet: st.borderTopColor, fond: st.backgroundColor, largeurFilet: st.borderTopWidth, rayon: st.borderRadius, ombre: st.boxShadow }; })) as { filet: string; fond: string; largeurFilet: string; rayon: string; ombre: string };
      const attendu: Record<string, [string, string] | null> = { correct: [RGB.vert, RGB.vertClair], not_equivalent: [RGB.danger, RGB.dangerClair], parse_error: [RGB.ambre, RGB.ambreClair] };
      if (etat === "correct" || etat === "not_equivalent" || etat === "parse_error") {
        verifier(style.filet === attendu[etat]![0] && style.fond === attendu[etat]![1], `${nom} : carte attendue ${attendu[etat]!.join(" / ")}, obtenu ${style.filet} / ${style.fond}`);
      } else {
        verifier(![RGB.vert, RGB.danger, RGB.ambre].includes(style.filet) && ![RGB.vertClair, RGB.dangerClair, RGB.ambreClair].includes(style.fond), `${nom} : jamais de couleur de verdict avant la réponse du serveur (obtenu ${style.filet} / ${style.fond})`);
      }
      // Sélection : violet avant validation, jamais vert/rouge.
      if (etat === "selectionne" && indice === 1) {
        const o = (await carte.locator(".moteur-choix:has(input:checked)").evaluate((el: unknown) => { const st = getComputedStyle(el); return { filet: st.borderTopColor, fond: st.backgroundColor, poids: st.fontWeight }; })) as { filet: string; fond: string; poids: string };
        verifier(o.filet === RGB.violetVif && o.fond === RGB.violetClair && o.poids === "600", `${nom} : option sélectionnée attendue violet-vif / violet-clair / 600, obtenu ${JSON.stringify(o)}`);
      }
      if (etat === "selectionne" && indice === 3) {
        const cellules = (await carte.locator(".moteur-case-signe").evaluateAll((els: unknown[]) => els.map((el) => { const st = getComputedStyle(el); return st.borderTopColor + "|" + st.backgroundColor; }))) as string[];
        verifier(cellules.every((c) => c === `${RGB.violetVif}|${RGB.violetClair}`), `${nom} : toutes les cases remplies attendues violet avant validation, obtenu ${[...new Set(cellules)].join(" ; ")}`);
      }
      // Verdict, tableau de signes : coloré EN ENTIER (toutes les cases identiques), jamais case par case.
      if (indice === 3 && (etat === "correct" || etat === "not_equivalent")) {
        const cellules = (await carte.locator(".moteur-case-signe").evaluateAll((els: unknown[]) => els.map((el) => { const st = getComputedStyle(el); return st.borderTopColor + "|" + st.backgroundColor; }))) as string[];
        verifier(new Set(cellules).size === 1 && cellules[0].startsWith(attendu[etat]![0]), `${nom} : toutes les cases doivent avoir la couleur du verdict, obtenu ${[...new Set(cellules)].join(" ; ")}`);
      }
      // Cohérence avec les cartes existantes (carte de tâche du tableau de bord = `.item-liste`) : même ombre, même rayon.
      if (etat === "defaut" && (await page.locator(".moteur-ecran-courant").count()) > 0) {
        const carteCourante = (await page.locator(".moteur-ecran-courant").evaluate((el: unknown) => { const st = getComputedStyle(el); return { ombre: st.boxShadow, rayon: st.borderRadius, filet: st.borderTopColor + " " + st.borderTopWidth, fond: st.backgroundColor }; })) as { ombre: string; rayon: string; filet: string; fond: string };
        verifier(carteCourante.ombre === ombreCarteDashboard && `${carteCourante.rayon}|${carteCourante.filet}|${carteCourante.fond}` === rayonCarteDashboard, `${nom} : la carte d'écran doit avoir la même ombre/rayon/filet/fond que .carte-tache du tableau de bord (${carteCourante.ombre} vs ${ombreCarteDashboard})`);
        verifier(carteCourante.ombre === "rgba(59, 20, 112, 0.3) 0px 10px 24px -18px", `${nom} : l'ombre doit résoudre à la valeur historique inchangée, obtenu ${carteCourante.ombre}`);
      }
      const erreursUtiles = journal.erreursConsole.filter((m) => !/fonts\.g|net::ERR_FAILED/.test(m));
      verifier(journal.pageerrors.length === 0 && erreursUtiles.length === 0, `${nom} : erreurs JS/console : ${[...journal.pageerrors, ...erreursUtiles].join(" | ")}`);
      await contexte.close();
    }
  }
}

/** Nouvelle tentative après `not_equivalent` (essais restants) : la nouvelle sélection reste VIOLETTE, jamais rouge — la carte garde le verdict précédent. */
async function scenarioRetentative(navigateur: any, base: string, largeur: number) {
  imposerProfilAssignation("base"); // scénario d'ORIGINE : les 4 écrans du profil « base »
  const l = `${largeur}`;
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const tacheId = creerTache(s, { nom: "Retentative", tentatives_supplementaires: 1, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
  const ligne = s.base.table("exercices_assignes").find((x) => x.eleve_id === "eleve-1")!;
  const ex = temoin.generer(Number(ligne.graine));
  await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ: CHAMP_SOMME, reponse_brute: reponseBruteCorrecte(ex, CHAMP_SOMME) } });
  const { page, contexte } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
  await page.goto(base + "/eleve.html");
  await page.waitForSelector(".carte-tache");
  await page.locator(".carte-tache").click();
  await page.waitForSelector(".moteur-qcm");
  const mauvaise = reponseApi(ex, 1, "not_equivalent");
  const autre = (ex.a + ex.b) % 2 === 0 ? "pair" : "impair";
  await page.locator(`.moteur-qcm input[value="${mauvaise}"]`).check();
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-not_equivalent");
  await page.locator(`.moteur-qcm input[value="${autre}"]`).check(); // nouvelle sélection en attente de validation
  const etat = (await page.evaluate(`(() => { const carte = document.querySelector(".moteur-ecran-courant"); const opt = document.querySelector(".moteur-choix:has(input:checked)"); return { carte: getComputedStyle(carte).borderTopColor, option: getComputedStyle(opt).borderTopColor, fond: getComputedStyle(opt).backgroundColor }; })()`)) as { carte: string; option: string; fond: string };
  verifier(etat.carte === RGB.danger, `${l} retentative : la carte garde le verdict précédent (rouge), obtenu ${etat.carte}`);
  verifier(etat.option === RGB.violetVif && etat.fond === RGB.violetClair, `${l} retentative : la nouvelle sélection reste violette (jamais rouge avant la réponse du serveur), obtenu ${etat.option} / ${etat.fond}`);
  await page.locator(".moteur-ecran-courant").screenshot({ path: join(CAPTURES, `${l}-matrice-qcm-retentative-selection-violette.png`) });
  await contexte.close();
}

async function scenarioProf(navigateur: any, base: string, largeur: number) {
  const s = creerScenario();
  installerBase(s.base);
  const l = `${largeur}`;
  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, `prof:${s.profId}`, "p@x");
  await page.goto(base + "/prof.html");
  await page.waitForSelector('button[data-onglet="taches"]:visible');
  await page.locator('button[data-onglet="taches"]').click();
  await page.locator("#bouton-accordeon-creer").click();
  await page.waitForSelector("#composition-dynamique input.stepper-valeur", { state: "attached" });
  const rapport = (await page.evaluate(`(() => {
    const champs = [...document.querySelectorAll("#composition-dynamique input.stepper-valeur")];
    const actifs = champs.filter((c) => !c.disabled && c.dataset.varianteId);
    const inactifs = champs.filter((c) => c.disabled);
    const badgesSurInactifs = inactifs.filter((c) => c.closest(".stepper")?.querySelector(".etiquette-bientot-disponible")).length;
    const badgesSurActifs = actifs.filter((c) => c.closest(".stepper")?.querySelector(".etiquette-bientot-disponible")).length;
    return { total: champs.length, actifs: actifs.map((c) => c.dataset.varianteId), nbInactifs: inactifs.length, badgesSurInactifs, badgesSurActifs, contientTemoin: document.body.innerHTML.includes("temoin") };
  })()`)) as { total: number; actifs: string[]; nbInactifs: number; badgesSurInactifs: number; badgesSurActifs: number; contientTemoin: boolean };
  verifier(rapport.actifs.length === 4 && rapport.actifs.includes("af_mise_en_evidence"), `${l} prof : les 4 variantes gen7 doivent rester actives (non disabled), obtenu ${JSON.stringify(rapport.actifs)}`);
  verifier(rapport.nbInactifs > 0 && rapport.badgesSurInactifs === rapport.nbInactifs, `${l} prof : chaque entrée non câblée porte l'étiquette « bientôt disponible » (${rapport.badgesSurInactifs}/${rapport.nbInactifs})`);
  verifier(rapport.badgesSurActifs === 0, `${l} prof : aucune étiquette sur une entrée câblée`);
  verifier(!rapport.contientTemoin, `${l} prof : aucune trace du témoin technique dans la page professeur`);
  const cat = (await page.evaluate(`fetch("/api/catalogue-generateurs", { headers: { Authorization: "Bearer prof:prof-1" } }).then((r) => r.text())`)) as string;
  verifier(!cat.includes("temoin"), `${l} prof : GET /api/catalogue-generateurs n'expose pas le témoin`);
  // Option A : « Tentatives supplémentaires » est verrouillé et remis à 0 sans correction immédiate.
  const lireTentatives = async () => (await page.evaluate(`(() => { const i = document.getElementById("tentatives-supplementaires"); return { valeur: i.value, inputDesactive: i.disabled, boutonsDesactives: [...document.querySelectorAll('[data-stepper-cible="tentatives-supplementaires"]')].map((b) => b.disabled) }; })()`)) as { valeur: string; inputDesactive: boolean; boutonsDesactives: boolean[] };
  let t = await lireTentatives();
  verifier(!t.inputDesactive && t.boutonsDesactives.every((d) => !d), `${l} prof : tentatives actives par défaut (correction immédiate cochée)`);
  await page.locator('[data-stepper-cible="tentatives-supplementaires"][data-stepper-delta="1"]').click();
  await page.locator('[data-stepper-cible="tentatives-supplementaires"][data-stepper-delta="1"]').click();
  verifier((await lireTentatives()).valeur === "2", `${l} prof : le stepper de tentatives fonctionne quand il est actif`);
  await page.locator("#feedback-immediat").uncheck({ force: true });
  t = await lireTentatives();
  verifier(t.inputDesactive && t.boutonsDesactives.every((d) => d) && t.valeur === "0", `${l} prof : sans correction immédiate, tentatives verrouillées ET remises à 0 (${JSON.stringify(t)})`);
  await page.locator("#feedback-immediat").scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(CAPTURES, `${l}-12-prof-tentatives-verrouillees.png`), fullPage: false });
  await page.locator("#feedback-immediat").check({ force: true });
  t = await lireTentatives();
  verifier(!t.inputDesactive && t.boutonsDesactives.every((d) => !d), `${l} prof : recocher la correction immédiate déverrouille les tentatives`);

  // Un champ DÉSACTIVÉ doit se voir : le grisage était écrit champ par champ (`#aide-penalite-pourcent:disabled`), le champ
  // « Durée (secondes) » du chrono en était resté dépourvu (RAPPORT §29). On vérifie ici les deux états sur le rendu réel.
  {
    const style = async (id: string) => (await page.evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); const c = getComputedStyle(e); return { desactive: e.disabled, opacite: Number(c.opacity), curseur: c.cursor }; })()`)) as { desactive: boolean; opacite: number; curseur: string };
    await page.locator("#chrono-mode").selectOption("aucun");
    await page.locator("#aide-activee").uncheck({ force: true });
    const [dureeOff, penaliteOff] = [await style("chrono-duree-secondes"), await style("aide-penalite-pourcent")];
    verifier(dureeOff.desactive && penaliteOff.desactive, `${l} prof : durée du chrono et pénalité d'aide désactivées (chrono « aucun », aide décochée)`);
    verifier(penaliteOff.opacite < 1 && penaliteOff.curseur === "not-allowed", `${l} prof : la pénalité d'aide désactivée est grisée (${JSON.stringify(penaliteOff)})`);
    verifier(dureeOff.opacite < 1 && dureeOff.curseur === "not-allowed", `${l} prof : la durée du chrono désactivée est GRISÉE comme la pénalité d'aide (${JSON.stringify(dureeOff)})`);
    await page.locator("#chrono-mode").selectOption("global");
    await page.locator("#aide-activee").check({ force: true });
    const [dureeOn, penaliteOn] = [await style("chrono-duree-secondes"), await style("aide-penalite-pourcent")];
    verifier(!dureeOn.desactive && !penaliteOn.desactive && dureeOn.opacite === 1 && penaliteOn.opacite === 1, `${l} prof : réactivés, les deux champs retrouvent l'aspect normal (${JSON.stringify([dureeOn, penaliteOn])})`);
    // Garde générale : AUCUN champ désactivé du formulaire de tâche ne doit avoir l'aspect d'un champ actif.
    await page.locator("#chrono-mode").selectOption("aucun");
    await page.locator("#aide-activee").uncheck({ force: true });
    await page.locator("#feedback-immediat").uncheck({ force: true });
    const invisibles = (await page.evaluate(`[...document.querySelectorAll("#onglet-taches input:disabled")].filter((e) => Number(getComputedStyle(e).opacity) >= 1 && getComputedStyle(e).cursor !== "not-allowed").map((e) => e.id || e.className)`)) as string[];
    verifier(invisibles.length === 0, `${l} prof : champs désactivés SANS aucun signe visuel : ${JSON.stringify(invisibles)}`);
    await page.locator("#ligne-chrono-duree").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(CAPTURES, `${l}-17-prof-champs-desactives-grises.png`), fullPage: false });
    await page.locator("#feedback-immediat").check({ force: true });
    await page.locator("#aide-activee").check({ force: true });
    await page.locator("#chrono-mode").selectOption("aucun");
  }

  await page.locator("#comp-recherche").fill("second degré");
  await page.waitForTimeout(300);
  await page.evaluate(`document.querySelectorAll("#composition-dynamique details").forEach((d) => { if (!d.hidden) d.open = true; })`);
  await page.locator("#composition-dynamique .stepper-valeur:disabled:visible").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(CAPTURES, `${l}-11-prof-catalogue-bientot-disponible.png`), fullPage: false });
  const debordement = (await page.evaluate(`document.documentElement.scrollWidth > window.innerWidth`)) as boolean;
  verifier(!debordement, `${l} prof : défilement horizontal de la page avec l'étiquette`);
  verifier(journal.pageerrors.length === 0, `${l} prof : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();
}


/** Enveloppe un exercice étendu en exercice du témoin unique (seuls `profil` et `etendu` comptent pour ses écrans et sa vérification). */
const U = (e: ExerciceEtendu): ExerciceTemoin => ({ a: 11, b: 11, n: 12, r1: 0, r2: 1, profil: "etendu", etendu: e });
const genE = (graine: number): ExerciceEtendu => {
  const ex = temoin.generer(graine);
  if (!ex.etendu) throw new Error(`graine ${graine} : profil « ${ex.profil} », étendu attendu`);
  return ex.etendu;
};

/** Le tableau plein-bord (RAPPORT §30) touche les bords de la colonne de contenu, et le reste de la carte garde son padding. */
async function verifierPleinBord(page: any, etiquette: string, largeur: number) {
  const m = (await page.evaluate(`(() => {
    const carteEl = document.querySelector(".moteur-ecran-courant");
    const t = carteEl.querySelector(".moteur-tableau-signes").getBoundingClientRect();
    const corps = document.body.getBoundingClientRect();
    const carte = carteEl.getBoundingClientRect();
    const consigne = carteEl.querySelector(".moteur-consigne").getBoundingClientRect();
    const titre = carteEl.querySelector(".moteur-titre-ligne");
    const titreG = titre ? titre.getBoundingClientRect().left + parseFloat(getComputedStyle(titre).paddingLeft) : null;
    return { titreG, g: t.left, d: t.right, corpsG: corps.left, corpsD: corps.right, fenetre: window.innerWidth, carteG: carte.left, carteD: carte.right, consG: consigne.left, consD: consigne.right };
  })()`)) as Record<string, number>;
  const ok = (a: number, b: number) => Math.abs(a - b) <= 1;
  verifier(ok(m.g, m.corpsG) && ok(m.d, m.corpsD), `${etiquette} (${largeur}px) : le tableau touche les bords de la colonne de contenu (tableau ${m.g}→${m.d}, colonne ${m.corpsG}→${m.corpsD})`);
  if (largeur <= 720) verifier(m.g <= 1 && m.d >= m.fenetre - 1, `${etiquette} (${largeur}px) : sur mobile le tableau touche les bords de l'ÉCRAN (${m.g}→${m.d} sur ${m.fenetre})`);
  else verifier(ok(m.d - m.g, 720), `${etiquette} (${largeur}px) : sur bureau le tableau fait la largeur de la colonne (720px), pas de l'écran (${m.d - m.g})`);
  verifier(m.g < m.carteG && m.d > m.carteD, `${etiquette} (${largeur}px) : le tableau sort de la carte des deux côtés`);
  verifier(m.titreG === null || ok(m.titreG, m.consG), `${etiquette} (${largeur}px) : les titres de ligne s'alignent sur le texte de la carte (${Math.round(m.titreG)} contre ${Math.round(m.consG)}) malgré le plein-bord`);
  verifier(m.consG - m.carteG >= 24 && m.carteD - m.consD >= 24, `${etiquette} (${largeur}px) : le reste de la carte GARDE son padding (consigne à ${m.consG - m.carteG}px du bord gauche, ${m.carteD - m.consD}px du droit)`);
}

/** Valeur courante lue dans l'`aria-label` d'une case (« … : + . Toucher pour changer. ») ; « vide » = `?`. */
const valeurDeCase = async (bouton: any) => ((await bouton.getAttribute("aria-label")) ?? "").replace(/^.*: ([^:]*)\. Toucher pour changer\.$/, "$1");

/** Clique 9 fois et relève la suite des valeurs : [état initial, 1er clic, 2e clic, …]. */
async function cycler(bouton: any): Promise<string[]> {
  const suite = [await valeurDeCase(bouton)];
  for (let k = 0; k < 9; k++) {
    await bouton.click();
    suite.push(await valeurDeCase(bouton));
  }
  return suite;
}

/**
 * Depuis « ? » le 1er clic donne la 1re valeur du cycle ; depuis une valeur, la suivante. Dans tous les cas : jamais de retour à « ? »
 * et le cycle se referme sur sa première valeur. `obtenu[0]` est l'état AVANT le premier clic.
 */
function verifierCycle(etiquette: string, obtenu: string[], cycle: string[]) {
  const depart = obtenu[0] === "vide" ? 0 : cycle.indexOf(obtenu[0]) + 1;
  const attendu = depart === 0 && obtenu[0] !== "vide" ? [] : [obtenu[0], ...Array.from({ length: 9 }, (_, k) => cycle[(depart + k) % cycle.length])];
  verifier(JSON.stringify(obtenu) === JSON.stringify(attendu), `${etiquette} : cycle ${cycle.length} valeurs [${cycle.join(" ")}] (départ « ${obtenu[0]} »), JAMAIS de retour à « ? » — obtenu ${JSON.stringify(obtenu)}`);
}

/**
 * Audit d'un tableau STRUCTURÉ (RAPPORT §30) : colonnes alternées sans −∞/+∞, colonnes de valeur en --violet-clair sur toutes les
 * lignes, bande de symboles, alignement des cases (fusions comprises), boutons de même taille quel que soit le nombre de lignes,
 * pas de colspan sur les lignes de signe, titres sans text-transform. Renvoie la largeur d'un bouton.
 */
async function auditerTableau(page: any, etiquette: string, largeur: number, attendu: { colonnes: number; fusions: number[]; lignesSigne: number; symboles: number } /* fusions vide = pas de ligne de variations */): Promise<number> {
  const m = (await page.evaluate(`(() => {
    const t = document.querySelector(".moteur-ecran-courant .moteur-table-structure");
    const r = (el) => { const b = el.getBoundingClientRect(); return { g: b.left, d: b.right, h: b.height, l: b.width }; };
    const caption = t.querySelector("caption");
    return {
      cols: [...t.querySelectorAll("col")].map((c) => ({ valeur: c.classList.contains("moteur-col-valeur"), fond: getComputedStyle(c).backgroundColor })),
      x: [...t.querySelectorAll(".moteur-rangee-x td")].map((td) => ({ ...r(td), texte: td.innerText, valeur: td.classList.contains("moteur-cellule-valeur") })),
      symboles: [...t.querySelectorAll(".moteur-rangee-symboles td")].map((td) => ({ ...r(td), texte: td.innerText, fond: getComputedStyle(td).backgroundColor, math: td.querySelectorAll(".moteur-math").length })),
      lignes: [...t.querySelectorAll(".moteur-ligne-tableau")].map((tb) => ({
        titre: tb.querySelector("th").innerText,
        transformTitre: getComputedStyle(tb.querySelector("th")).textTransform,
        variation: tb.querySelector("tr.moteur-rangee-variation") !== null,
        cellules: [...tb.querySelectorAll("tr:not(.moteur-rangee-titre) td")].map((td) => {
          const b = td.querySelector("button");
          const st = getComputedStyle(b);
          return { ...r(td), span: td.colSpan, bouton: r(b), nu: st.borderTopWidth === "0px" && st.borderRightWidth === "0px" && st.boxShadow === "none" && st.backgroundColor === "rgba(0, 0, 0, 0)" };
        }),
      })),
      titre: caption ? { texte: caption.innerText, transform: getComputedStyle(caption).textTransform } : null,
      texte: t.innerText,
      tableau: r(t),
    };
  })()`)) as any;
  const ok = (a: number, b: number) => Math.abs(a - b) <= 1;
  const e = `${etiquette} (${largeur}px)`;
  verifier(m.cols.length === attendu.colonnes && m.x.length === attendu.colonnes, `${e} : ${attendu.colonnes} colonnes (2N+1), obtenu ${m.cols.length}`);
  verifier(!m.texte.includes("∞"), `${e} : aucune colonne −∞/+∞`);
  verifier(m.cols.every((c: any, i: number) => c.valeur === (i % 2 === 1)) && m.x.every((c: any, i: number) => c.valeur === (i % 2 === 1)), `${e} : les colonnes alternent intervalle, valeur, …, intervalle`);
  verifier(m.cols.filter((c: any) => c.valeur).every((c: any) => c.fond === "rgb(241, 235, 252)") && m.cols.filter((c: any) => !c.valeur).every((c: any) => c.fond === "rgba(0, 0, 0, 0)"), `${e} : colonnes de valeur en --violet-clair (rgb(241, 235, 252)), colonnes « < » sans fond`);
  verifier(m.x.filter((c: any) => !c.valeur).every((c: any) => c.texte.trim() === "") && m.x.filter((c: any) => c.valeur).every((c: any) => c.texte.trim() !== ""), `${e} : ligne des x : une valeur par colonne de valeur, colonnes d'intervalle vides (rendu de référence)`);
  verifier(m.x.every((c: any, i: number) => (i === 0 || ok(c.g, m.x[i - 1].d)) && ok(c.l, m.x[0].l)), `${e} : colonnes contiguës et de même largeur (${m.x.map((c: any) => Math.round(c.l)).join(",")})`);
  verifier(ok(m.x[0].g, m.tableau.g) && ok(m.x[m.x.length - 1].d, m.tableau.d), `${e} : les colonnes occupent toute la largeur du tableau (aucun défilement)`);
  verifier(m.symboles.length === attendu.colonnes && m.symboles.filter((c: any) => c.math > 0).length === attendu.symboles && m.symboles.filter((c: any) => c.math === 0).every((c: any) => c.texte.trim() === ""), `${e} : bande de symboles : ${attendu.symboles} symboles (KaTeX), rien au-dessus des colonnes d'intervalle`);
  verifier(m.symboles.every((c: any) => c.fond === "rgb(246, 243, 251)"), `${e} : toute la bande de symboles est en --surface-sunken (rgb(246, 243, 251))`);
  const avecVariations = attendu.fusions.length > 0;
  verifier(m.lignes.length === attendu.lignesSigne + (avecVariations ? 1 : 0) && m.lignes[m.lignes.length - 1].variation === avecVariations, `${e} : ${attendu.lignesSigne} ligne(s) de signe empilée(s)${avecVariations ? " puis la ligne des variations" : " (aucune ligne de variations)"}`);
  const largeursBoutons = new Set<number>();
  m.lignes.forEach((ligne: any, i: number) => {
    const spans = ligne.cellules.map((c: any) => c.span);
    verifier(ligne.variation ? JSON.stringify(spans) === JSON.stringify(attendu.fusions) : spans.every((sp: number) => sp === 1) && spans.length === attendu.colonnes, `${e} : ligne ${i} « ${ligne.titre} » : colspan ${JSON.stringify(spans)} (${ligne.variation ? "variations FUSIONNÉES " + JSON.stringify(attendu.fusions) : "une case par colonne, jamais de fusion sur un signe"})`);
    let debut = 0;
    for (const c of ligne.cellules) {
      const fin = debut + c.span - 1;
      verifier(ok(c.g, m.x[debut].g) && ok(c.d, m.x[fin].d), `${e} : ligne ${i} : la case ${debut}-${fin} est alignée sur les colonnes de la ligne des x (${Math.round(c.g)}→${Math.round(c.d)} attendu ${Math.round(m.x[debut].g)}→${Math.round(m.x[fin].d)})`);
      verifier(c.bouton.l >= 43.5 && c.bouton.h >= (ligne.variation ? 55.5 : 47.5), `${e} : ligne ${i} : bouton ${Math.round(c.bouton.l)}×${Math.round(c.bouton.h)} (48px sur les signes, 56px sur les variations)`);
      verifier(c.nu, `${e} : ligne ${i} : case sans bordure, sans ombre et sans fond individuels (simple cellule, rendu de référence)`);
      verifier(Math.abs(c.bouton.l - c.l) <= 6, `${e} : ligne ${i} : le bouton occupe toute la largeur de sa cellule (${Math.round(c.bouton.l)} dans ${Math.round(c.l)})`);
      if (!ligne.variation) largeursBoutons.add(Math.round(c.bouton.l * 10) / 10);
      debut = fin + 1;
    }
    verifier(debut === attendu.colonnes && ligne.transformTitre === "none" && /SIGNE DE|VARIATIONS/.test(ligne.titre) && !/F\(X\)/.test(ligne.titre), `${e} : titre de ligne « ${ligne.titre} » : casse écrite dans le contenu, text-transform: ${ligne.transformTitre}`);
  });
  // Les filets fins (border-collapse) font varier la largeur d'une cellule de moins d'un pixel : tolérance 1,5px.
  const largeurs = [...largeursBoutons];
  verifier(Math.max(...largeurs) - Math.min(...largeurs) <= 1.5, `${e} : tous les boutons de signe ont la même largeur, quel que soit le nombre de lignes empilées (${largeurs.join(", ")})`);
  verifier(m.titre === null, `${e} : aucun titre « TABLEAU DE SIGNES » (absent de la référence validée)`);
  return Math.round(Math.min(...largeurs));
}

/**
 * Phase 3b-1 — profil ÉTENDU du témoin unique joué de bout en bout dans un vrai navigateur : champs_multiples (avec et sans
 * illustration), intervalle, liste_valeurs.permetAucune, tableau_signes étendu (3 PUIS 7 colonnes sur deux
 * exercices consécutifs de la même tâche : l'état local d'édition doit être réinitialisé), aides typées,
 * et le balisage mathématique dans chaque champ de texte d'auteur — jamais dans le texte tapé par l'élève.
 */
async function scenarioEtendu(navigateur: any, base: string, largeur: number) {
  imposerProfilAssignation("etendu"); // profil des exercices assignés : les 7 écrans de l'extension
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const l = `${largeur}`;
  const tacheId = creerTache(s, { nom: "Tâche témoin étendu", aide_activee: true, aide_penalite_pourcent: 25, tentatives_supplementaires: 1, feedback_immediat: true, reponse_visible: false, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }] });
  const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
  verifier(a.statut === 201, `${l} étendu : assignation préalable : ${a.statut}`);

  // Deux exercices consécutifs de formes DIFFÉRENTES : 1er = racine double (3 colonnes), 2e = deux racines (7 colonnes).
  const graineEtroite = graineDeProfil("etendu", 0, { large: false });
  const graineLarge = graineDeProfil("etendu", 0, { large: true });
  const tdb = await appeler("eleves/tableau-de-bord", "GET", { jeton: "eleve:eleve-1" });
  const ordre: string[] = tdb.corps.en_cours.find((t: any) => t.tache_id === tacheId).exercices.map((e: any) => e.id);
  const ligneA = s.base.table("exercices_assignes").find((x) => x.id === ordre[0])!;
  const ligneB = s.base.table("exercices_assignes").find((x) => x.id === ordre[1])!;
  ligneA.graine = graineEtroite;
  ligneB.graine = graineLarge;
  const exA = genE(graineEtroite);
  const exB = genE(graineLarge);
  // Le 2e exercice est répondu (via l'API) jusqu'au tableau : il s'ouvrira directement sur le tableau à 7 colonnes.
  for (const champ of [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_EXTREMUM, CHAMP_AXE, CHAMP_IMAGE, CHAMP_RACINES]) {
    const r = await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligneB.id, champ, reponse_brute: reponseBruteCorrecte(U(exB), champ) } });
    verifier(r.statut === 200 && r.corps.statut === "correct", `${l} étendu : préparation de l'exercice 2 (${champ}) : ${JSON.stringify(r.corps)}`);
  }

  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
  await page.goto(base + "/eleve.html");
  await page.waitForSelector(".carte-tache");
  await page.locator(".carte-tache").click();
  await page.waitForSelector(".moteur-ecran-courant");
  const courant = page.locator(".moteur-ecran-courant");
  const valider = () => courant.getByRole("button", { name: "Valider", exact: true });
  const suivante = () => page.getByRole("button", { name: "Question suivante" });
  const cap = (nom: string) => join(CAPTURES, `${l}-etendu-${nom}.png`);
  const nbMath = (sel: string) => courant.locator(`${sel} .moteur-math`).count();
  const ouvrirAide = async () => {
    await page.getByRole("button", { name: "Besoin d'un indice ?" }).click();
    await page.getByRole("button", { name: /Confirmer/ }).click();
  };
  const NOMS_SYMBOLES: Record<string, string> = { "⌣": "minimum (en creux)", "⌢": "maximum (en bosse)", "↗": "croissante", "↘": "décroissante" };

  // ── Écran 1 : champs_multiples (3 sous-champs texte) + aide formule_coloree ──
  verifier((await nbMath(".moteur-consigne")) >= 4, `${l} étendu : la consigne rend ses segments $…$ (f(x), a, b, c)`);
  verifier((await courant.locator(".moteur-sous-champ-libelle .moteur-math").count()) === 3, `${l} étendu : les 3 libellés de sous-champ sont rendus comme mathématiques`);
  verifier(!(await courant.locator("#mc-coefficients-a").getAttribute("placeholder"))!.includes("$"), `${l} étendu : le placeholder est un attribut en texte brut (aucun « $ »)`);
  await page.screenshot({ path: cap("01-champs-multiples-initial"), fullPage: true });
  await verifierMiseEnPage(page, "champs_multiples", largeur);
  verifier(await valider().isDisabled(), `${l} étendu : « Valider » désactivé tant que rien n'est rempli`);
  const av1 = reponsesEnvoyees(journal);
  await courant.locator("#mc-coefficients-a").fill("$x$"); // texte d'élève : jamais interprété
  await courant.locator("#mc-coefficients-b").fill(String(exA.b));
  verifier(await valider().isDisabled(), `${l} étendu : « Valider » désactivé tant qu'UN sous-champ est vide (jamais lu comme 0)`);
  await courant.locator("#mc-coefficients-c").fill(String(exA.c));
  verifier(await valider().isEnabled(), `${l} étendu : « Valider » actif quand tous les sous-champs sont remplis`);
  verifier(reponsesEnvoyees(journal) === av1, `${l} étendu : aucune requête /api/reponses pendant l'édition des champs multiples`);
  // Aide typée « formule colorée » : absente du DOM avant la demande.
  verifier((await courant.locator(".moteur-formule").count()) === 0 && !(await page.content()).includes("moteur-coef-a"), `${l} étendu : aucune aide typée dans la page avant la demande`);
  await ouvrirAide();
  await page.waitForSelector(".moteur-aide-typee .moteur-formule");
  verifier(s.base.table("aides_utilisees").length === 1, `${l} étendu : usage de l'aide typée enregistré côté serveur`);
  const couleurs = (await page.evaluate(`(() => {
    const lum = (rgb) => { const c = rgb.match(/\\d+/g).slice(0, 3).map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const rapport = (x, y) => { const [a, b] = [lum(x), lum(y)]; return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const zone = document.querySelector(".moteur-aide-typee");
    const fond = getComputedStyle(zone).backgroundColor;
    const r = { fond, roles: {} };
    for (const role of ["a", "b", "c"]) {
      const el = zone.querySelector(".moteur-coef-" + role);
      if (el) { const couleur = getComputedStyle(el).color; r.roles[role] = { couleur, contraste: rapport(couleur, fond), texte: el.textContent }; }
    }
    r.aria = zone.querySelector(".moteur-formule").getAttribute("aria-label");
    return r;
  })()`)) as { fond: string; roles: Record<string, { couleur: string; contraste: number; texte: string }>; aria: string };
  const attendus: Record<string, string> = { a: "rgb(191, 34, 128)", b: "rgb(17, 55, 208)", c: "rgb(121, 91, 21)" };
  for (const role of Object.keys(couleurs.roles)) {
    verifier(couleurs.roles[role].couleur === attendus[role], `${l} étendu : le coefficient ${role} prend la couleur de son token (${couleurs.roles[role].couleur} ≠ ${attendus[role]})`);
    verifier(couleurs.roles[role].contraste >= 4.5, `${l} étendu : contraste réel du coefficient ${role} (${couleurs.roles[role].contraste.toFixed(2)}:1) sous 4,5:1`);
  }
  verifier(Object.keys(couleurs.roles).length >= 2 && couleurs.aria.startsWith("Formule : f(x) = "), `${l} étendu : formule colorée : rôles présents et alternative textuelle (${JSON.stringify(Object.keys(couleurs.roles))})`);
  await page.screenshot({ path: cap("02-aide-formule-coloree"), fullPage: true });
  // Trois déficiences visuelles émulées (les teintes doivent rester distinguables ; ordre a, b, c = indice non chromatique).
  const cdp = await contexte.newCDPSession(page);
  for (const type of ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"]) {
    await cdp.send("Emulation.setEmulatedVisionDeficiency", { type });
    await courant.locator(".moteur-formule").screenshot({ path: cap(`03-vision-${type}`) });
  }
  await cdp.send("Emulation.setEmulatedVisionDeficiency", { type: "none" });
  await verifierMiseEnPage(page, "champs_multiples + aide", largeur);
  // 1re tentative : texte illisible → parse_error, message d'AUTEUR rendu avec ses mathématiques ; le « $x$ » tapé part tel quel.
  await valider().click();
  await page.waitForSelector(".moteur-statut-parse_error");
  verifier((await courant.locator(".moteur-message-syntaxe .moteur-math").count()) >= 1, `${l} étendu : le message d'erreur (texte d'auteur) rend ses mathématiques`);
  const dernierPost = () => JSON.parse(journal.requetes.filter((r) => r.methode === "POST" && r.url.endsWith("/api/reponses")).at(-1)!.corps ?? "{}");
  verifier(JSON.parse(dernierPost().reponse_brute).a === "$x$", `${l} étendu : ce que l'élève a tapé (« $x$ ») part tel quel, jamais transformé`);
  await courant.locator("#mc-coefficients-a").fill(String(exA.a));
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  await suivante().click();

  // ── Écran 2 : champs_multiples (2 choix) + illustration qui suit les choix LOCAUX ──
  await page.waitForSelector(".moteur-illustration svg");
  const svgAllure = () => courant.locator(".moteur-illustration svg");
  const points = () => courant.locator(".moteur-illustration .croquis-courbe").getAttribute("points");
  verifier((await svgAllure().getAttribute("aria-label"))!.includes("fais tes deux choix") && (await courant.locator(".moteur-illustration .croquis-courbe-neutre").count()) === 1, `${l} étendu : illustration neutre (pointillés) tant qu'aucun choix n'est fait`);
  verifier((await courant.locator(".moteur-sous-champ-choix .moteur-choix .moteur-math").count()) === 5, `${l} étendu : les 5 libellés de choix des sous-champs sont rendus comme mathématiques`);
  const av2 = reponsesEnvoyees(journal);
  const neutre = await points();
  await courant.locator('input[name="mc-allure-signeA"][value="+"]').check();
  verifier((await courant.locator(".moteur-illustration .croquis-courbe-neutre").count()) === 1 && (await points()) === neutre, `${l} étendu : un seul choix : l'illustration reste neutre`);
  await courant.locator('input[name="mc-allure-signeAB"][value="-"]').check();
  const droite = await points();
  verifier((await courant.locator(".moteur-illustration .croquis-courbe-neutre").count()) === 0 && droite !== neutre && (await svgAllure().getAttribute("aria-label"))!.includes("à droite"), `${l} étendu : deux choix (a>0, ab<0) : l'illustration montre le sommet à droite`);
  await page.screenshot({ path: cap("04-allure-illustration-droite"), fullPage: true });
  await courant.locator('input[name="mc-allure-signeAB"][value="+"]').check();
  verifier((await points()) !== droite && (await svgAllure().getAttribute("aria-label"))!.includes("à gauche"), `${l} étendu : l'illustration suit un changement de choix (sommet à gauche)`);
  await courant.locator('input[name="mc-allure-signeA"][value="-"]').check();
  verifier((await svgAllure().getAttribute("aria-label"))!.includes("ouverte vers le bas"), `${l} étendu : a<0 : parabole ouverte vers le bas`);
  verifier(reponsesEnvoyees(journal) === av2, `${l} étendu : l'illustration ne déclenche AUCUNE requête (état local d'édition)`);
  verifier((await page.locator(".moteur-illustration").innerText()).length < 200 && (await courant.locator(".moteur-statut").count()) === 0, `${l} étendu : l'illustration n'affiche aucun verdict`);
  verifier((await page.getByRole("button", { name: "Besoin d'un indice ?" }).count()) === 0, `${l} étendu : l'illustration n'est PAS une aide (aucun indice sur l'écran d'allure)`);
  await verifierMiseEnPage(page, "allure", largeur);
  const allureJuste = JSON.parse(reponseBruteCorrecte(U(exA), CHAMP_ALLURE));
  for (const [id, valeur] of Object.entries(allureJuste)) await courant.locator(`input[name="mc-allure-${id}"][value="${valeur}"]`).check();
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  await suivante().click();

  // ── Écran 3 : qcm à libellés mathématiques ──
  await page.waitForSelector('input[name="qcm-extremum"]'); // (l'écran d'allure utilise aussi `.moteur-qcm` : attendre CE champ)
  verifier((await courant.locator(".moteur-choix .moteur-math").count()) === 2, `${l} étendu : les libellés du QCM sont rendus comme mathématiques`);
  await courant.locator(`.moteur-qcm input[value="${reponseBruteCorrecte(U(exA), CHAMP_EXTREMUM)}"]`).check();
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  await suivante().click();

  // ── Écran 4 : champs_multiples (axe) + aide croquis_parabole (marque S seule) + « $ » d'élève jamais interprété ──
  await page.waitForSelector("#mc-axe-axeTexte");
  verifier(!(await courant.locator("#mc-axe-axeTexte").getAttribute("placeholder"))!.includes("$"), `${l} étendu : placeholder de l'axe sans « $ »`);
  await ouvrirAide();
  await page.waitForSelector(".moteur-aide-croquis svg.moteur-croquis");
  verifier((await courant.locator(".moteur-aide-croquis .croquis-etiquette-sommet").textContent()) === "S" && (await courant.locator(".croquis-surlignage").count()) === 0 && (await courant.locator(".croquis-etiquette-petite").count()) === 0, `${l} étendu : aide de l'axe : S marqué, pas de surlignage ni de marques sur Ox`);
  verifier((await courant.locator(".moteur-aide-croquis svg").getAttribute("aria-label"))!.startsWith("Croquis de la parabole d'équation y = "), `${l} étendu : croquis : alternative textuelle`);
  await page.screenshot({ path: cap("05-aide-croquis-axe"), fullPage: true });
  await verifierMiseEnPage(page, "axe + croquis", largeur);
  const axeJuste = JSON.parse(reponseBruteCorrecte(U(exA), CHAMP_AXE));
  await courant.locator("#mc-axe-axeTexte").fill(axeJuste.xS); // valeur juste SANS « x = »
  await courant.locator("#mc-axe-xS").fill(axeJuste.xS);
  await courant.locator("#mc-axe-yS").fill(axeJuste.yS);
  await valider().click();
  await page.waitForSelector(".moteur-statut-parse_error");
  verifier((await courant.locator(".moteur-message-syntaxe .moteur-math").count()) >= 1 && s.base.table("reponses").some((r) => r.champ === CHAMP_AXE && r.bug_detecte === "TEMOIN_AXE_NOTATION"), `${l} étendu : « valeur juste sans x = » : parse_error, message balisé, code de compétence stocké`);
  await courant.locator("#mc-axe-axeTexte").fill("x = 999");
  await courant.locator("#mc-axe-xS").fill("$x$"); // texte d'élève contenant des délimiteurs
  await valider().click(); // 2e et dernière tentative : verrouillage, révélation (correction immédiate active)
  await page.waitForSelector(".moteur-solution");
  verifier((await courant.locator(".moteur-solution .moteur-math").count()) >= 3, `${l} étendu : « Réponse attendue » (texte d'auteur) rend ses mathématiques`);
  await page.screenshot({ path: cap("06-axe-verrouille-revele"), fullPage: true });
  await suivante().click();
  await page.waitForSelector(".moteur-ecran-termine");
  const resume = page.locator(".moteur-ecran-termine").filter({ hasText: "Donne l'axe de symétrie" }).locator(".moteur-valeur");
  verifier((await resume.innerText()).includes("$x$"), `${l} étendu : « Ta réponse » affiche le « $x$ » tapé par l'élève tel quel`);
  verifier((await resume.locator(".moteur-math").count()) === 3, `${l} étendu : dans « Ta réponse », seuls les 3 libellés d'auteur sont mathématiques ; le texte de l'élève ne l'est jamais`);

  // ── Écran 5 : intervalle ──
  await page.waitForSelector(".moteur-intervalle");
  verifier(await valider().isDisabled(), `${l} étendu : intervalle : « Valider » désactivé au départ`);
  const av5 = reponsesEnvoyees(journal);
  const image = JSON.parse(reponseBruteCorrecte(U(exA), CHAMP_IMAGE));
  const ligneI = courant.locator(".moteur-intervalle-ligne");
  await ligneI.getByRole("button", { name: /Crochet de gauche/ }).click();
  await ligneI.getByRole("button", { name: /Crochet de droite/ }).click();
  await ligneI.getByLabel("Borne de gauche", { exact: true }).fill("$x$"); // texte d'élève
  verifier((await courant.locator(".moteur-apercu").innerText()).includes("$x$") && (await courant.locator(".moteur-apercu .moteur-math").count()) === 0, `${l} étendu : l'aperçu affiche le texte de l'élève tel quel, sans jamais l'interpréter`);
  await ligneI.getByRole("button", { name: "Borne de droite : plus l'infini" }).click();
  verifier(await ligneI.getByLabel("Borne de droite", { exact: true }).isDisabled() && (await ligneI.getByRole("button", { name: "Borne de droite : plus l'infini" }).getAttribute("aria-pressed")) === "true", `${l} étendu : « +∞ » désactive la borne de droite`);
  await ligneI.getByLabel("Borne de gauche", { exact: true }).fill(image.borneGauche);
  verifier((await courant.locator(".moteur-apercu").innerText()) === `[${image.borneGauche} ; +∞[`, `${l} étendu : aperçu « [${image.borneGauche} ; +∞[ » (obtenu « ${await courant.locator(".moteur-apercu").innerText()} »)`);
  verifier(reponsesEnvoyees(journal) === av5, `${l} étendu : construire l'intervalle n'envoie rien`);
  await ouvrirAide();
  await page.waitForSelector(".moteur-aide-croquis svg.moteur-croquis");
  verifier((await courant.locator(".croquis-surlignage").count()) === 1, `${l} étendu : aide de l'image : surlignage de l'ensemble-image`);
  await page.screenshot({ path: cap("07-intervalle-aide"), fullPage: true });
  await verifierMiseEnPage(page, "intervalle", largeur);
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  const corpsIntervalle = JSON.parse(dernierPost().reponse_brute);
  verifier(Object.keys(corpsIntervalle).sort().join() === "borneDroite,borneGauche,crochetDroit,crochetGauche" && corpsIntervalle.borneDroite === "+inf", `${l} étendu : réponse d'intervalle : 4 clés, sentinelle « +inf » (${JSON.stringify(corpsIntervalle)})`);
  await suivante().click();

  // ── Écran 6 : liste_valeurs avec « aucune valeur » + aide en chaîne à mathématiques ──
  await page.waitForSelector(".moteur-choix-mode");
  verifier((await courant.locator(".moteur-liste-zone").isHidden()) && (await valider().isDisabled()), `${l} étendu : avant le choix « aucune / au moins une » : liste masquée, rien à valider`);
  verifier((await courant.locator(".moteur-choix-mode .moteur-bouton").count()) === 2, `${l} étendu : deux choix proposés`);
  await courant.getByRole("radio", { name: "Pas de racine" }).click();
  verifier(await valider().isEnabled(), `${l} étendu : « Pas de racine » suffit à valider`);
  await page.screenshot({ path: cap("08-liste-aucune"), fullPage: true });
  await verifierMiseEnPage(page, "liste_valeurs permetAucune", largeur);
  await valider().click(); // faux (f a une racine) : 1re tentative, non verrouillante
  await page.waitForSelector(".moteur-statut-not_equivalent");
  verifier(dernierPost().reponse_brute === "[]", `${l} étendu : « Pas de racine » envoie exactement "[]"`);
  await courant.getByRole("radio", { name: "Au moins une racine" }).click();
  verifier(await courant.locator(".moteur-liste-zone").isVisible() && (await valider().isDisabled()), `${l} étendu : « au moins une racine » : liste visible, vide donc non validable`);
  await courant.locator(".moteur-liste-ligne .moteur-champ").first().fill(String(exA.r1));
  await ouvrirAide();
  await page.waitForSelector(".moteur-aide-texte:not([hidden])");
  verifier((await courant.locator(".moteur-aide-texte .moteur-math").count()) >= 2, `${l} étendu : l'aide en chaîne rend ses mathématiques`);
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  await suivante().click();

  // ── Écran 7 (exercice 1) : tableau STRUCTURÉ à 3 colonnes (racine double) ──
  const remplir = async (sol: Record<string, Record<string, string>>) => {
    const lignes = courant.locator(".moteur-ligne-tableau");
    for (const [i, id] of Object.keys(sol).entries()) {
      const boutons = lignes.nth(i).locator("td button");
      for (const [c, attendu] of Object.values(sol[id]).entries()) {
        const bouton = boutons.nth(c);
        for (let k = 0; k < 6; k++) {
          // Égalité EXACTE : « décroissante » contient « croissante » (une comparaison par sous-chaîne prenait ↘ pour ↗).
          const ok = (await valeurDeCase(bouton)) === (Object.hasOwn(NOMS_SYMBOLES, attendu) ? NOMS_SYMBOLES[attendu] : attendu);
          if (ok) break;
          await bouton.click();
        }
      }
    }
  };
  /** Cycle attendu, écrit à la main d'après la spécification (jamais dérivé du code testé). */
  const S2 = ["+", "-"], S3 = ["+", "-", "0"], S4 = ["+", "-", "0", "∅"];
  const V_INTERVALLE = ["croissante", "décroissante"], V_SOMMET = ["maximum (en bosse)", "minimum (en creux)"];
  const cyclerTout = async (etiquette: string, attendus: string[][][]) => {
    const lignes = courant.locator(".moteur-ligne-tableau");
    for (const [i, ligne] of attendus.entries()) {
      const boutons = lignes.nth(i).locator("td button");
      verifier((await boutons.count()) === ligne.length, `${etiquette} ligne ${i} : ${ligne.length} cases, obtenu ${await boutons.count()}`);
      for (const [c, cycle] of ligne.entries()) {
        const obtenu = await cycler(boutons.nth(c));
        // Variations : l'ordre des symboles est celui de l'alphabet servi (↗ ↘ / ⌢ ⌣) ; on compare les noms accessibles.
        verifierCycle(`${etiquette} ligne ${i} case ${c}`, obtenu, cycle);
      }
    }
  };
  await page.waitForSelector(".moteur-table-structure");
  const av7 = reponsesEnvoyees(journal);
  const largeurUn = await auditerTableau(page, `${l} étendu : tableau 3 colonnes`, largeur, { colonnes: 3, fusions: [1, 1, 1], lignesSigne: 1, symboles: 1 });
  await verifierPleinBord(page, `${l} étendu : tableau 3 colonnes`, largeur);
  verifier((await courant.locator("tbody td button").count()) === 6, `${l} étendu : tableau à 3 colonnes (6 cases de réponse)`);
  verifier((await courant.locator(".moteur-titre-ligne .moteur-math").count()) === 1 && (await courant.locator(".moteur-titre-ligne").nth(1).innerText()) === "VARIATIONS", `${l} étendu : titre « SIGNE DE $f(x)$ » rendu par rendreTexte (f(x) en mathématiques, casse conservée)`);
  await courant.locator(".moteur-rangee-variation td button").first().click();
  const fleche = async () => (await page.evaluate(`(() => {
    const f = document.querySelector(".moteur-ecran-courant .moteur-rangee-variation .moteur-fleche");
    if (!f) return null;
    const m = new DOMMatrix(getComputedStyle(f).transform);
    return { angle: Math.atan2(m.b, m.a) * 180 / Math.PI, longueur: parseFloat(f.style.width), pointe: f.querySelectorAll("svg.moteur-fleche-pointe path").length, texte: f.parentElement.textContent.trim(), boite: f.parentElement.getBoundingClientRect().width };
  })()`)) as { angle: number; longueur: number; pointe: number; texte: string; boite: number } | null;
  const f1 = await fleche();
  verifier(f1 !== null && f1.pointe === 1 && f1.texte === "" && f1.angle < -3 && f1.angle > -45, `${l} étendu : 1er clic = flèche montante DESSINÉE (trait + pointe, aucun caractère), pivotée vers le haut : ${JSON.stringify(f1)}`);
  verifier(f1 !== null && f1.longueur > 0.6 * f1.boite && f1.longueur < f1.boite, `${l} étendu : la longueur du trait suit la largeur réelle de la case (${f1?.longueur} pour ${f1?.boite})`);
  verifier((await valeurDeCase(courant.locator(".moteur-rangee-variation td button").first())) === "croissante", `${l} étendu : la flèche montante est nommée « croissante »`);
  await courant.locator(".moteur-rangee-variation td button").first().click();
  const f2 = await fleche();
  verifier(f2 !== null && f2.angle > 3 && f2.angle < 45 && Math.abs(f2.angle + (f1?.angle ?? 0)) < 0.5, `${l} étendu : 2e clic = même flèche pivotée vers le bas (${f2?.angle} contre ${f1?.angle})`);
  await courant.locator(".moteur-rangee-variation td button").first().click();
  verifier((await fleche())?.angle === f1?.angle, `${l} étendu : 3e clic : retour à la flèche montante (jamais à « ? »)`);
  // Redimensionnement : la flèche est redessinée d'après la nouvelle largeur de case.
  if (largeur < 720) {
    await page.setViewportSize({ width: largeur - 40, height: 800 });
    await page.waitForTimeout(250);
    const f3 = await fleche();
    verifier(f3 !== null && f3.longueur < (f1?.longueur ?? 0) && f3.boite < (f1?.boite ?? 0), `${l} étendu : redimensionnement → flèche redessinée (${f1?.longueur} → ${f3?.longueur})`);
    await page.setViewportSize({ width: largeur, height: 800 });
    await page.waitForTimeout(250);
  }
  verifier((await courant.locator(".moteur-rangee-variation td button").nth(1).innerText()) === "?" , `${l} étendu : la case du sommet est encore vide (glyphe ⌢ ⌣ au clic, pas de flèche)`);
  await courant.locator(".moteur-rangee-variation td button").nth(1).click();
  verifier(["⌢", "⌣"].includes(await courant.locator(".moteur-rangee-variation td button").nth(1).innerText()) && (await courant.locator(".moteur-rangee-variation td button").nth(1).locator(".moteur-fleche").count()) === 0, `${l} étendu : le sommet affiche un glyphe ⌢/⌣ (texte), jamais une flèche`);
  verifier(reponsesEnvoyees(journal) === av7, `${l} étendu : cliquer les cases n'envoie rien`);
  await ouvrirAide();
  await page.waitForSelector(".moteur-aide-croquis svg.moteur-croquis");
  verifier((await courant.locator(".croquis-indice").count()) === 1 && (await courant.locator("text.croquis-etiquette-petite").count()) === 2, `${l} étendu : croquis (racine double) : UNE marque fusionnée portant l'indice x_S`);
  // Cycles de CHAQUE type de case (racine double : x_S est LA racine, donc 3 valeurs) — aucun retour à « ? ».
  await cyclerTout(`${l} étendu 3 colonnes`, [
    [S2, S3, S2],
    [V_INTERVALLE, V_SOMMET, V_INTERVALLE],
  ]);
  await remplir(JSON.parse(reponseBruteCorrecte(U(exA), CHAMP_SIGNES_VARIATION)));
  verifier(reponsesEnvoyees(journal) === av7, `${l} étendu : remplir le tableau n'envoie rien`);
  await page.screenshot({ path: cap("09-tableau-3-colonnes"), fullPage: true });
  await verifierMiseEnPage(page, "tableau étendu 3 colonnes", largeur);
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  const cases3 = JSON.parse(dernierPost().reponse_brute);
  verifier(Object.keys(cases3.signe).join() === "c0,c1,c2" && Object.keys(cases3.variation).join() === "c0,c1,c2", `${l} étendu : 3 cases de signe et 3 cases de variation (racine double : sommet seul au centre)`);
  await suivante().click();

  // ── Écran 8 (exercice 1) : tableau de QUOTIENT, 4 lignes empilées, « ∅ » au pôle ──
  await page.waitForSelector(".moteur-ecran-courant tbody.moteur-ligne-tableau:nth-of-type(5)"); // 4e ligne de signe : le tableau de QUOTIENT est affiché (et non le tableau précédent, terminé)
  const pointsA = [...exA.quotient.racines, exA.quotient.pole].sort((u, v) => u - v);
  const colPoleA = 2 * pointsA.indexOf(exA.quotient.pole) + 1;
  const facteurs = [S2, S3, S2, S3, S2, S3, S2];
  const finale = (colPole: number) => facteurs.map((c, i) => (i === colPole ? S4 : c));
  const largeurQuotient = await auditerTableau(page, `${l} étendu : quotient`, largeur, { colonnes: 7, fusions: [], lignesSigne: 4, symboles: 3 });
  await verifierPleinBord(page, `${l} étendu : quotient`, largeur);
  verifier(largeurQuotient > 0 && largeurUn > 0, `${l} étendu : largeurs de boutons mesurées (3 colonnes : ${largeurUn}, quotient : ${largeurQuotient})`);
  await cyclerTout(`${l} étendu quotient`, [facteurs, facteurs, facteurs, finale(colPoleA)]);
  await remplir(JSON.parse(reponseBruteCorrecte(U(exA), CHAMP_QUOTIENT)));
  await page.screenshot({ path: cap("09b-quotient"), fullPage: true });
  await verifierMiseEnPage(page, "tableau de quotient", largeur);
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  const casesQ = JSON.parse(dernierPost().reponse_brute);
  verifier(Object.keys(casesQ).join() === "facteur1,facteur2,facteur3,quotient" && casesQ.quotient[`c${colPoleA}`] === "∅" && Object.values(casesQ.quotient).filter((v) => v === "0").length === 2, `${l} étendu : réponse du quotient à 4 lignes, « ∅ » au pôle (c${colPoleA}), deux « 0 »`);
  await page.getByRole("button", { name: "Voir la fin" }).click();
  await page.waitForSelector(".moteur-fin");
  await page.getByRole("button", { name: "Terminer" }).click();

  // ── Exercice 2 : le tableau passe de 3 à 7 colonnes — l'état local d'édition doit repartir de zéro ──
  await page.waitForSelector(".moteur-table-structure col:nth-of-type(7)", { state: "attached" });
  verifier((await courant.locator(".moteur-table-structure col").count()) === 7 && (await courant.locator("tbody td button").count()) === 10, `${l} étendu : 3 puis 7 colonnes : 7 cases de signe + 3 cases de variation FUSIONNÉES = 10 cases de réponse`);
  const etats = await courant.locator("tbody td button").allInnerTexts();
  verifier(etats.length === 10 && etats.every((e: string) => e === "?"), `${l} étendu : aucune case ne garde l'état de l'exercice précédent (${JSON.stringify(etats)})`);
  verifier((await valider().isDisabled()), `${l} étendu : « Valider » désactivé sur le nouveau tableau vide`);
  const largeurSept = await auditerTableau(page, `${l} étendu : tableau 7 colonnes`, largeur, { colonnes: 7, fusions: [3, 1, 3], lignesSigne: 1, symboles: 3 });
  await verifierPleinBord(page, `${l} étendu : tableau 7 colonnes`, largeur);
  // Toutes les cases sauf la dernière : « Valider » reste désactivé ; la dernière l'active.
  const boutonsSept = courant.locator("tbody td button");
  const nbSept = await boutonsSept.count();
  for (let i = 0; i < nbSept - 1; i++) await boutonsSept.nth(i).click();
  verifier(await valider().isDisabled(), `${l} étendu : 9 cases sur 10 renseignées : « Valider » reste désactivé (jamais soumissible incomplet)`);
  await boutonsSept.nth(nbSept - 1).click();
  verifier(!(await valider().isDisabled()), `${l} étendu : 10 cases sur 10 : « Valider » actif`);
  await ouvrirAide();
  await page.waitForSelector(".moteur-aide-croquis svg.moteur-croquis");
  verifier((await courant.locator(".croquis-indice").count()) === 1 && (await courant.locator("text.croquis-etiquette-petite").count()) === 4, `${l} étendu : croquis (deux racines) : 2 racines + le sommet, indice x_S`);
  // Deux racines : x_1 et x_2 (3 valeurs), x_S et les intervalles (2 valeurs) ; variations fusionnées (3 | 1 | 3).
  await cyclerTout(`${l} étendu 7 colonnes`, [
    [S2, S3, S2, S2, S2, S3, S2],
    [V_INTERVALLE, V_SOMMET, V_INTERVALLE],
  ]);
  await remplir(JSON.parse(reponseBruteCorrecte(U(exB), CHAMP_SIGNES_VARIATION)));
  await page.screenshot({ path: cap("10-tableau-7-colonnes"), fullPage: true });
  {
    // Capture de la CARTE seule, sur toute la largeur de la page (le tableau plein-bord dépasse la carte) : comparée à la référence validée.
    const boite = (await courant.boundingBox())!; // relative à la fenêtre : ajoutée au défilement, `clip` est en coordonnées de PAGE
    const defilement = (await page.evaluate("window.scrollY")) as number;
    await page.screenshot({ path: cap("10b-carte-tableau-7-colonnes"), fullPage: true, clip: { x: 0, y: boite.y + defilement, width: largeur, height: boite.height } });
  }
  await verifierMiseEnPage(page, "tableau étendu 7 colonnes", largeur);
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  const cases7 = JSON.parse(dernierPost().reponse_brute);
  verifier(Object.keys(cases7.signe).length === 7 && Object.keys(cases7.variation).join() === "c0,c3,c4", `${l} étendu : réponse à 7 cases de signe et 3 cases de variation (clés d'ancrage c0, c3, c4)`);
  await suivante().click();
  await page.waitForSelector(".moteur-ecran-courant tbody.moteur-ligne-tableau:nth-of-type(5)"); // 4e ligne de signe : le tableau de QUOTIENT est affiché (et non le tableau précédent, terminé)
  const largeurQuotientB = await auditerTableau(page, `${l} étendu : quotient (exercice 2)`, largeur, { colonnes: 7, fusions: [], lignesSigne: 4, symboles: 3 });
  verifier(Math.abs(largeurQuotientB - largeurSept) <= 1, `${l} étendu : les boutons du tableau à 4 lignes ont la MÊME largeur que ceux du tableau à 1 ligne (${largeurQuotientB} contre ${largeurSept})`);
  const pointsB = [...exB.quotient.racines, exB.quotient.pole].sort((u, v) => u - v);
  const colPoleB = 2 * pointsB.indexOf(exB.quotient.pole) + 1;
  await cyclerTout(`${l} étendu quotient 2`, [facteurs, facteurs, facteurs, finale(colPoleB)]);
  await remplir(JSON.parse(reponseBruteCorrecte(U(exB), CHAMP_QUOTIENT)));
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  await page.getByRole("button", { name: "Voir la fin" }).click();
  await page.waitForSelector(".moteur-fin");
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.waitForSelector("#tableau-de-bord:not([hidden])");

  // Bilan : chaque réponse vient d'un clic sur « Valider » et n'a que les 3 clés du contrat.
  const posts = journal.requetes.filter((r) => r.methode === "POST" && r.url.endsWith("/api/reponses"));
  verifier(posts.length === 13, `${l} étendu : 13 réponses envoyées par le navigateur attendues (2+1+1+2+1+2+1+1 sur l'exercice 1, 2 sur l'exercice 2), obtenu ${posts.length}`);
  verifier(posts.every((p) => Object.keys(JSON.parse(p.corps ?? "{}")).sort().join() === "champ,exercice_assigne_id,reponse_brute" && typeof JSON.parse(p.corps ?? "{}").reponse_brute === "string"), `${l} étendu : chaque réponse n'a que les 3 clés du contrat, `+`reponse_brute est une chaîne`);
  verifier(journal.requetes.filter((r) => r.url.includes("/api/reponses/aide")).length === 6, `${l} étendu : 6 demandes d'aide (coefficients, axe, image, racines, tableau des deux exercices)`);
  verifier(journal.pageerrors.length === 0, `${l} étendu : erreurs JS non interceptées : ${journal.pageerrors.join(" | ")}`);
  const erreursUtiles = journal.erreursConsole.filter((m) => !/fonts\.g|net::ERR_FAILED/.test(m));
  verifier(erreursUtiles.length === 0, `${l} étendu : erreurs console : ${erreursUtiles.join(" | ")}`);
  await contexte.close();
}

/**
 * Poids par écran (RAPPORT §17) dans les DEUX pages qui agrègent côté navigateur : `eleve.html` (tuile
 * « réussite ») et `prof.html` (Résultats : badge de l'élève et « Réussite moyenne »). Poids injectés par
 * enveloppe de test de `temoin.ecrans` (restaurée) : somme 3 ✔, parité 2 ✘, diviseurs 1 ✔, signes 4 ✔ →
 * 8/10 = 80 % pondéré (le comptage d'origine donnerait 3/4 = 75 %).
 */
/** Rôle admin-prof (RAPPORT §26) : l'onglet « Admin » n'existe que pour un compte que le SERVEUR déclare admin ; parcours réel dans prof.html. */
async function scenarioAdmin(navigateur: any, base: string, largeur: number) {
  const l = `${largeur}`;
  const hauteur = largeur < 600 ? 800 : 900;
  const UUID_BOB = "00000000-0000-4000-8000-0000000000b0";
  const UUID_CARL = "00000000-0000-4000-8000-0000000000c0";
  const UUID_DANA = "00000000-0000-4000-8000-0000000000d0";

  // --- 1. Prof NON admin : aucun onglet, et l'API admin refuse côté serveur (403) ---
  const ordinaire = creerScenario();
  installerBase(ordinaire.base);
  {
    const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, hauteur, `prof:${ordinaire.profId}`, "p@x");
    const moiRepondu = page.waitForResponse((r: any) => r.url().endsWith("/api/profs/moi"));
    await page.goto(base + "/prof.html");
    await page.waitForSelector('button[data-onglet="taches"]:visible');
    const moi = await (await moiRepondu).json();
    verifier(moi.est_admin === false, `${l} admin : /api/profs/moi d'un prof ordinaire doit dire est_admin=false (${JSON.stringify(moi)})`);
    await page.waitForTimeout(150);
    verifier(!(await page.locator("#onglet-bouton-admin").isVisible()) && !(await page.locator("#onglet-admin").isVisible()), `${l} admin : ni bouton ni panneau « Admin » pour un prof non admin`);
    const refus = (await page.evaluate(`fetch("/api/admin/profs", { headers: { Authorization: "Bearer prof:${ordinaire.profId}" } }).then(async (r) => ({ statut: r.status, corps: await r.json() }))`)) as { statut: number; corps: { erreur: string } };
    verifier(refus.statut === 403 && refus.corps.erreur === "Réservé aux administrateurs", `${l} admin : l'API admin refuse un prof non admin même appelée à la main (${JSON.stringify(refus)})`);
    verifier(journal.pageerrors.length === 0, `${l} admin (non admin) : erreurs JS : ${journal.pageerrors.join(" | ")}`);
    await contexte.close();
  }

  // --- 2. Prof admin : parcours complet ---
  const sc = creerScenario();
  const b = sc.base;
  const profsBase = b.table("profs");
  profsBase.splice(profsBase.findIndex((p) => p.id === sc.autreProfId), 1); // le 2e prof générique du scénario n'a ni nom ni compte Auth
  const ligneAdmin = b.table("profs").find((p) => p.id === sc.profId)!;
  Object.assign(ligneAdmin, { nom: "Alice Admin", est_admin: true, actif: true });
  b.utilisateursAuth.set(sc.profId, { id: sc.profId, email: "alice@ecole.be", password: "ancien", banni: null });
  for (const [id, nom, email, extra] of [
    [UUID_BOB, "Bob Ordinaire", "bob@ecole.be", { est_admin: false, actif: true }],
    [UUID_CARL, "Carl Autre-Admin", "carl@ecole.be", { est_admin: true, actif: true }],
    [UUID_DANA, "Dana Inactive", "dana@ecole.be", { est_admin: false, actif: false }],
  ] as [string, string, string, Record<string, unknown>][]) {
    b.inserer("profs", { id, nom, ...extra });
    b.utilisateursAuth.set(id, { id, email, password: "ancien", banni: null });
  }
  installerBase(b);
  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, hauteur, `prof:${sc.profId}`, "alice@ecole.be");
  page.on("dialog", (d: any) => d.accept());
  await page.goto(base + "/prof.html");
  await page.waitForSelector("#onglet-bouton-admin:visible");
  await page.locator("#onglet-bouton-admin").click();
  await page.waitForSelector("#onglet-admin:visible");
  await page.waitForFunction(`document.querySelectorAll("#liste-profs-admin li").length === 4`);
  const ligne = (nom: string) => page.locator("#liste-profs-admin li", { hasText: nom });
  verifier((await ligne("Bob").innerText()).includes("bob@ecole.be"), `${l} admin : l'email de Bob (issu de Supabase Auth) est affiché`);
  verifier((await ligne("Carl").innerText()).includes("Administrateur") && (await ligne("Carl").locator(".icone-action").count()) === 0, `${l} admin : un autre admin est signalé et n'a AUCUNE action`);
  verifier((await ligne("Alice").innerText()).includes("(vous)") && (await ligne("Alice").locator(".icone-action").count()) === 0, `${l} admin : sa propre ligne est marquée « vous » et sans action`);
  verifier((await ligne("Dana").innerText()).includes("Compte désactivé") && (await ligne("Dana").locator('[aria-label="Réactiver"]').count()) === 1, `${l} admin : un compte désactivé est signalé et proposé à la réactivation`);
  await page.screenshot({ path: join(CAPTURES, `${l}-13-admin-liste.png`), fullPage: false });

  // Mise en page : pas de défilement horizontal, barre de navigation à 5 onglets lisible, zones tactiles.
  const mesures = (await page.evaluate(`(() => {
    const boutons = [...document.querySelectorAll("#onglets-nav .onglet-bouton")].filter((b) => b.getBoundingClientRect().width > 0);
    const icones = [...document.querySelectorAll("#liste-profs-admin .icone-action")].map((i) => { const r = i.getBoundingClientRect(); return Math.round(Math.min(r.width, r.height)); });
    return { debordement: document.documentElement.scrollWidth > window.innerWidth, nbOnglets: boutons.length, largeurMin: Math.round(Math.min(...boutons.map((b) => b.getBoundingClientRect().width))), coupes: boutons.filter((b) => b.scrollWidth > b.clientWidth + 1).length, tailleIconeMin: Math.min(...icones) };
  })()`)) as { debordement: boolean; nbOnglets: number; largeurMin: number; coupes: number; tailleIconeMin: number };
  verifier(!mesures.debordement, `${l} admin : défilement horizontal de la page`);
  verifier(mesures.nbOnglets === 5 && mesures.coupes === 0, `${l} admin : 5 onglets visibles, aucun libellé coupé (${JSON.stringify(mesures)})`);

  // Création directe
  await page.locator("#btn-toggle-creer-prof").click();
  verifier(await page.locator("#btn-creer-prof").isDisabled(), `${l} admin : « Créer » désactivé tant que le formulaire est incomplet`);
  await page.locator("#creer-prof-nom").fill("Nina Nouvelle");
  await page.locator("#creer-prof-email").fill("nina@ecole.be");
  await page.locator("#creer-prof-mdp").fill("secret12");
  await page.screenshot({ path: join(CAPTURES, `${l}-14-admin-creation.png`), fullPage: false });
  await page.locator("#btn-creer-prof").click();
  await page.waitForFunction(`document.querySelectorAll("#liste-profs-admin li").length === 5`);
  const nina = b.table("profs").find((p) => p.nom === "Nina Nouvelle");
  verifier(!!nina && nina.est_admin !== true && [...b.utilisateursAuth.values()].some((u) => u.email === "nina@ecole.be"), `${l} admin : création directe = ligne profs non admin + compte Auth`);
  verifier((await page.locator("#statut-creer-prof").innerText()).includes("Compte créé"), `${l} admin : message de création`);

  // Code d'invitation lié à un e-mail
  await page.locator("#btn-toggle-inviter-prof").click();
  await page.locator("#inviter-prof-email").fill("Invitee@Ecole.be");
  await page.locator("#btn-inviter-prof").click();
  await page.waitForSelector("#resultat-invitation:visible");
  const code = (await page.locator("#resultat-invitation-code").textContent()) ?? "";
  verifier(code.length === 36, `${l} admin : code d'invitation affiché (36 caractères), obtenu « ${code} »`);
  const champCode = (await page.evaluate(`(() => { const i = document.getElementById("resultat-invitation-code"); return { tronque: i.scrollWidth > i.clientWidth + 1 }; })()`)) as { tronque: boolean };
  verifier(!champCode.tronque, `${l} admin : le code est affiché EN ENTIER dans son champ (36 caractères lisibles)`);
  const inv = b.table("invitations_prof").find((i) => i.code === code);
  verifier(!!inv && inv.email_cible === "invitee@ecole.be" && inv.cree_par === sc.profId, `${l} admin : code lié à l'e-mail et rattaché à l'admin (${JSON.stringify(inv)})`);
  await page.screenshot({ path: join(CAPTURES, `${l}-15-admin-code.png`), fullPage: false });

  // Désactivation, réactivation, réinitialisation
  await ligne("Bob").locator('[aria-label="Désactiver"]').click();
  await page.waitForFunction(`[...document.querySelectorAll("#liste-profs-admin li")].some((li) => li.textContent.includes("Bob") && li.textContent.includes("Compte désactivé"))`);
  verifier(b.table("profs").find((p) => p.id === UUID_BOB)!.actif === false && b.utilisateursAuth.get(UUID_BOB)!.banni === "876000h", `${l} admin : désactivation (actif=false + bannissement Auth)`);
  await ligne("Dana").locator('[aria-label="Réactiver"]').click();
  await page.waitForFunction(`![...document.querySelectorAll("#liste-profs-admin li")].some((li) => li.textContent.includes("Dana") && li.textContent.includes("Compte désactivé"))`);
  verifier(b.table("profs").find((p) => p.id === UUID_DANA)!.actif === true && b.utilisateursAuth.get(UUID_DANA)!.banni === null, `${l} admin : réactivation (actif=true, ban levé)`);
  await ligne("Bob").locator('[aria-label="Réinitialiser le mot de passe"]').click();
  await page.locator("#reset-prof-mdp").fill("nouveau-mdp-1");
  await page.screenshot({ path: join(CAPTURES, `${l}-16-admin-reset.png`), fullPage: false });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForFunction(`document.getElementById("statut-liste-profs-admin").textContent.includes("réinitialisé")`);
  verifier(b.utilisateursAuth.get(UUID_BOB)!.password === "nouveau-mdp-1", `${l} admin : mot de passe réinitialisé côté Auth`);
  verifier(!((await page.evaluate(`document.documentElement.scrollWidth > window.innerWidth`)) as boolean), `${l} admin : pas de défilement horizontal en fin de parcours`);
  if (largeur < 600) verifier(mesures.tailleIconeMin >= 30, `${l} admin : zones d'action lisibles (${mesures.tailleIconeMin}px, même composant que les élèves)`);
  verifier(journal.pageerrors.length === 0, `${l} admin : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();
}

async function scenarioPoids(navigateur: any, base: string, largeur: number) {
  imposerProfilAssignation("base");
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const l = `${largeur}`;
  const POIDS: Record<string, number> = { [CHAMP_SOMME]: 3, [CHAMP_PARITE]: 2, [CHAMP_DIVISEURS]: 1, [CHAMP_SIGNES]: 4 };
  const ecransOrigine = temoin.ecrans;
  temoin.ecrans = (ex) => ecransOrigine.call(temoin, ex).map((e) => ({ ...e, poids: POIDS[e.champ] }));
  try {
    const tacheId = creerTache(s, { nom: "Tâche pondérée", variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
    const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, classe_id: s.classeId } });
    verifier(a.statut === 201, `${l} poids : assignation ${a.statut}`);
    const ligne = s.base.table("exercices_assignes").find((x) => x.eleve_id === "eleve-1")!;
    const ex = temoin.generer(Number(ligne.graine));
    const fausseParite = reponseBruteCorrecte(ex, CHAMP_PARITE) === "pair" ? "impair" : "pair";
    for (const [champ, brute] of [[CHAMP_SOMME, reponseBruteCorrecte(ex, CHAMP_SOMME)], [CHAMP_PARITE, fausseParite], [CHAMP_DIVISEURS, reponseBruteCorrecte(ex, CHAMP_DIVISEURS)], [CHAMP_SIGNES, reponseBruteCorrecte(ex, CHAMP_SIGNES)]]) {
      const r = await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: brute } });
      verifier(r.statut === 200, `${l} poids : POST ${champ} ${r.statut}`);
    }

    // ── eleve.html : tuile « réussite » pondérée ──
    const eleve = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
    await eleve.page.goto(base + "/eleve.html");
    await eleve.page.waitForFunction(`/%/.test(document.getElementById("tdb-eleve-stat-reussite")?.textContent ?? "")`);
    const tuile = (await eleve.page.evaluate(`document.getElementById("tdb-eleve-stat-reussite").textContent`)) as string;
    verifier(tuile === "80%", `${l} poids : tuile « réussite » de eleve.html : 80% attendus (3/4 = 75 % sans poids), obtenu « ${tuile} »`);
    verifier(eleve.journal.pageerrors.length === 0, `${l} poids : erreurs JS eleve.html : ${eleve.journal.pageerrors.join(" | ")}`);
    await eleve.contexte.close();

    // ── prof.html : Résultats (badge de l'élève + réussite moyenne) ──
    // Un premier GET /api/classes génère le code de classe (branche paresseuse de la base en mémoire) : fait ICI, hors page.
    await appeler("classes", "GET", { jeton: `prof:${s.profId}` });
    const prof = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, `prof:${s.profId}`, "p@x");
    await prof.page.goto(base + "/prof.html");
    await prof.page.waitForSelector('button[data-onglet="resultats"]:visible');
    await prof.page.locator('button[data-onglet="resultats"]').click();
    await prof.page.waitForFunction(`[...document.querySelectorAll("#resultats-select-tache option")].some((o) => o.value === ${JSON.stringify(tacheId)})`);
    await prof.page.selectOption("#resultats-select-tache", tacheId);
    await prof.page.waitForFunction(`document.getElementById("resultats-stat-reussite").textContent.includes("%")`);
    const moyenne = (await prof.page.evaluate(`document.getElementById("resultats-stat-reussite").textContent`)) as string;
    verifier(moyenne.replace(/\s/g, "") === "80%", `${l} poids : « Réussite moyenne » de prof.html : 80 % attendus (75 % sans poids), obtenu « ${moyenne} »`);
    const badges = (await prof.page.evaluate(`[...document.querySelectorAll("#resultats-vue-eleve .badge")].map((b) => b.textContent.replace(/\s+/g, " ").trim())`)) as string[];
    verifier(badges.some((b) => b.includes("8/10") && b.includes("80%")), `${l} poids : badge de l'élève « 8/10 · 80% » attendu, obtenu ${JSON.stringify(badges)}`);
    verifier(prof.journal.pageerrors.length === 0, `${l} poids : erreurs JS prof.html : ${prof.journal.pageerrors.join(" | ")}`);
    await prof.page.screenshot({ path: join(CAPTURES, `${l}-13-prof-resultats-ponderes.png`), fullPage: false });
    await prof.contexte.close();
  } finally {
    temoin.ecrans = ecransOrigine;
  }
}

async function main() {
  const { serveur, url } = await demarrerServeur();
  const navigateur = await chromium.launch();
  try {
    await temoinControleHttp(navigateur, url);
    for (const largeur of [390, 1280]) {
      // Chaque scénario est suivi du contrôle de ses réponses HTTP >= 400 (attendus déclarés à part, s'il y en a).
      await scenarioEleve(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} élève`);
      await scenarioSansCorrection(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} sans correction`);
      await matriceVisuelle(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} matrice visuelle`);
      await scenarioRetentative(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} retentative`);
      await scenarioEtendu(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} étendu`);
      await scenarioProf(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} prof`);
      await scenarioAdmin(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} admin`, [{ statut: 403, motif: /^GET \/api\/admin\/profs$/, pourquoi: "un prof non admin appelle l'API admin à la main : refus serveur attendu (403)" }]);
      await scenarioPoids(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} poids`);
    }
  } catch (e) {
    // Un scénario qui plante (timeout d'attente d'un élément) ne passe jamais par `controlerReponsesHttp` :
    // les réponses >= 400 déjà vues sont donc affichées ici, c'est souvent la vraie cause du plantage.
    const vues = journauxOuverts.flatMap(({ journal, jeton }) => journal.reponsesEnErreur.map((r) => `${r.statut} ${r.methode} ${r.url} (${jeton})`));
    if (vues.length > 0) console.error(`Réponses HTTP >= 400 observées avant le plantage :\n - ${vues.join("\n - ")}`);
    throw e;
  } finally {
    await navigateur.close();
    serveur.close();
  }
  const utiles = echecs.filter((e) => e !== "");
  if (utiles.length > 0) {
    console.error(`ÉCHEC : ${utiles.length} vérification(s) sur ${nb}`);
    for (const e of utiles) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications Chromium (390px et 1280px), captures dans ${CAPTURES}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
