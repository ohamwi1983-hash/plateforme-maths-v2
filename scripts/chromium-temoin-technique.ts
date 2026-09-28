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

import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { appeler, creerScenario, creerTache, installerBase, type Scenario } from "./support/harnaisRouteur";
import { CHAMP_DIVISEURS, CHAMP_PARITE, CHAMP_SIGNES, generateurTemoinTechnique as temoin, reponseBruteCorrecte, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";

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
