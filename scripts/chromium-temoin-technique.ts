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
import { appeler, creerScenario, creerTache, installerBase, type Scenario } from "./support/harnaisRouteur";
import { CHAMP_DIVISEURS, CHAMP_PARITE, CHAMP_SIGNES, CHAMP_SOMME, generateurTemoinTechnique as temoin, reponseBruteCorrecte, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";

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
        await routeur(
          { method: req.method, headers: req.headers, query: { path: url.pathname.slice(5) }, body: corpsBrut ? JSON.parse(corpsBrut) : {} },
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

async function preparerPage(navigateur: any, url: string, largeur: number, hauteur: number, jeton: string, email: string, avantChargement?: string) {
  const contexte = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, hasTouch: largeur < 600 });
  const page = await contexte.newPage();
  const journal = { erreursConsole: [] as string[], pageerrors: [] as string[], requetes: [] as { methode: string; url: string; corps: string | null }[] };
  page.on("pageerror", (e: Error) => journal.pageerrors.push(e.message));
  page.on("console", (m: any) => {
    if (m.type() === "error") journal.erreursConsole.push(m.text());
  });
  page.on("request", (r: any) => journal.requetes.push({ methode: r.method(), url: r.url(), corps: r.postData() }));
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

async function main() {
  const { serveur, url } = await demarrerServeur();
  const navigateur = await chromium.launch();
  try {
    for (const largeur of [390, 1280]) {
      await scenarioEleve(navigateur, url, largeur);
      await scenarioSansCorrection(navigateur, url, largeur);
      await matriceVisuelle(navigateur, url, largeur);
      await scenarioRetentative(navigateur, url, largeur);
      await scenarioProf(navigateur, url, largeur);
    }
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
