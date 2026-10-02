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

import { injecterGenerateurConfigurable, VARIANTE_CONFIGURABLE } from "./support/generateurConfigurable";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { demarrerServeur, stubSupabase } from "./support/serveurChromium";
import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase, type Scenario } from "./support/harnaisRouteur";
import {
  CHAMP_ALLURE, CHAMP_AXE, CHAMP_COEFFICIENTS, CHAMP_COURBE, CHAMP_DIVISEURS, CHAMP_EXTREMUM, CHAMP_IMAGE, CHAMP_PARITE, CHAMP_QUOTIENT, CHAMP_RACINES, CHAMP_SIGNES, CHAMP_SIGNES_VARIATION, CHAMP_SOMME,
  generateurTemoinTechnique as temoin, graineDeProfil, reponseBruteCorrecte, VARIANTE_TEMOIN, type ExerciceEtendu, type ExerciceTemoin,
} from "../src/generateurs/_temoinTechnique";

import { FAMILLES } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { rangeesTableauMD } from "../src/generateurs/analyseFonctionMotifDelta/tableauSignes";
import { projeterMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/cascade";
import { champsMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/ecrans";
import { fonctionEffective, fonctionVraie, type ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";

const RACINE = join(__dirname, "..");
const CAPTURES = process.env.CAPTURES_DIR ?? join(RACINE, "captures-chromium");
mkdirSync(CAPTURES, { recursive: true });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { chromium } = require("playwright");

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
      // Les crochets de l'intervalle mesurent 32px (référence validée) mais gardent une cible de 44px par pseudo-élément :
      // vérifié par elementFromPoint dans scripts/chromium-fidelite-design.ts.
      if (r.width > 0 && r.height > 0 && r.height < 43.5 && !el.classList.contains("moteur-bouton-crochet")) petits.push(el.className + " " + Math.round(r.height) + "px");
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
  await page.locator(`.moteur-choix:has(input[value="${mauvaiseParite}"])`).click();
  verifier(reponsesEnvoyees(journal) === avantQcm, `${l} : choisir un QCM n'envoie rien tant qu'on ne valide pas`);
  await page.screenshot({ path: join(CAPTURES, `${l}-05-qcm-choix.png`), fullPage: true });
  await verifierMiseEnPage(page, "qcm", largeur);
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-not_equivalent");
  verifier((await page.locator(".moteur-tentatives").innerText()).includes("1 essai"), `${l} : tentatives restantes affichées`);
  await page.screenshot({ path: join(CAPTURES, `${l}-06-qcm-not-equivalent.png`), fullPage: true });
  await page.locator(`.moteur-choix:has(input[value="${bonneParite}"])`).click();
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
  await page.locator(`.moteur-choix:has(input[value="${reponseBruteCorrecte(ex, CHAMP_PARITE)}"])`).click(); // juste
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
  if (indice === 1) await carte.locator(`.moteur-choix:has(input[value="${brute}"])`).click();
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
      // RAPPORT §43 : un écran déjà répondu (verrouillé) n'est plus une carte mais une LIGNE du rappel, dans la carte de l'écran courant : le verdict
      // « illisible » obtenu par l'API se lit donc sur la marque de sa ligne (ambre), pas sur une carte d'écran.
      // (Le DERNIER écran verrouillé termine l'exercice : plus d'écran courant, la relecture montre sa carte comme avant.)
      const ligneDuRappel = parApi && indice !== 3;
      const carte = ligneDuRappel ? page.locator(".moteur-ecran-courant") : page.locator(".moteur-ecran").filter({ hasText: consigne });

      if (etat === "selectionne") await agirSurComposant(page, ex, indice, "selectionne");
      if (etat === "correct" || etat === "not_equivalent" || (etat === "parse_error" && !parApi)) {
        await agirSurComposant(page, ex, indice, etat);
        await carte.locator(".moteur-bouton-principal").click();
        await page.waitForSelector(`.moteur-ecran:has-text("${consigne.slice(0, 12).replace(/"/g, "")}") .moteur-statut-${etat}`);
      }
      const nom = `${l}-matrice-${NOMS_TYPES[indice]}-${etat}`;
      await carte.screenshot({ path: join(CAPTURES, `${nom}.png`) });

      if (ligneDuRappel) {
        const marque = (await page.locator(".moteur-rappel-marque-parse_error").first().evaluate((el: unknown) => { const st = getComputedStyle(el); return { fond: st.backgroundColor }; })) as { fond: string };
        verifier(marque.fond === RGB.ambre, `${nom} : la ligne du rappel de l'écran « illisible » porte la marque ambre, obtenu ${marque.fond}`);
        const segment = (await page.locator(".moteur-segment-fait-parse_error").first().evaluate((el: unknown) => getComputedStyle(el).backgroundColor)) as string;
        verifier(segment === RGB.ambre, `${nom} : le segment de progression de cet écran est ambre, obtenu ${segment}`);
        const erreursApi = journal.erreursConsole.filter((m) => !/fonts\.g|net::ERR_FAILED/.test(m));
        verifier(journal.pageerrors.length === 0 && erreursApi.length === 0, `${nom} : erreurs JS/console : ${[...journal.pageerrors, ...erreursApi].join(" | ")}`);
        await contexte.close();
        continue;
      }
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
        // RAPPORT §44 : la carte est le bloc blanc de l'enveloppe (angles hauts droits, bord haut partagé avec le panneau gris, bord à bord sous 600 px) : seuls
        // l'ombre et le fond restent ceux de `.carte-tache` ; le rayon et le filet de la carte sont mesurés contre `enveloppe-exercice.html` (chromium-design).
        verifier(carteCourante.ombre === ombreCarteDashboard && carteCourante.fond === rayonCarteDashboard.split("|")[2], `${nom} : la carte d'écran doit avoir la même ombre et le même fond que .carte-tache du tableau de bord (${carteCourante.ombre} vs ${ombreCarteDashboard})`);
        verifier(carteCourante.ombre === "rgba(59, 20, 112, 0.3) 0px 10px 24px -18px", `${nom} : l'ombre doit résoudre à la valeur historique inchangée, obtenu ${carteCourante.ombre}`);
      }
      const erreursUtiles = journal.erreursConsole.filter((m) => !/fonts\.g|net::ERR_FAILED/.test(m));
      verifier(journal.pageerrors.length === 0 && erreursUtiles.length === 0, `${nom} : erreurs JS/console : ${[...journal.pageerrors, ...erreursUtiles].join(" | ")}`);
      await contexte.close();
    }
  }
}

/** Nouvelle tentative après `not_equivalent` (essais restants) : la nouvelle sélection reste VIOLETTE, jamais rouge — la carte garde le verdict précédent. */
/** RAPPORT §42 : « Afficher la réponse attendue » commande la solution d'un champ épuisé (correction immédiate, 1 essai) : mesuré dans le navigateur. */
async function scenarioReponseVisible(navigateur: any, base: string, largeur: number) {
  for (const visible of [false, true]) {
    imposerProfilAssignation("base");
    const l = `${largeur}`;
    const s: Scenario = creerScenario();
    installerBase(s.base);
    const tacheId = creerTache(s, { nom: `Réponse ${visible ? "visible" : "masquée"}`, feedback_immediat: true, reponse_visible: visible, tentatives_supplementaires: 0, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
    await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
    const ligne = s.base.table("exercices_assignes").find((x) => x.eleve_id === "eleve-1")!;
    const ex = temoin.generer(Number(ligne.graine));
    const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
    await page.goto(base + "/eleve.html");
    await page.waitForSelector(".carte-tache");
    await page.locator(".carte-tache").click();
    await page.waitForSelector(".moteur-ecran-courant");
    await page.locator(".moteur-ecran-courant .moteur-champ").fill(String(ex.a - ex.b)); // fausse ; 1 seul essai : le champ est épuisé
    await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
    await page.waitForSelector(".moteur-statut-not_equivalent");
    const nom = visible ? "case cochée" : "case décochée";
    await page.getByRole("button", { name: "Question suivante" }).waitFor({ state: "visible" });
    verifier((await page.locator(".moteur-statut-not_equivalent").count()) >= 1, `${l} ${nom} : le verdict est montré dans les deux cas`);
    verifier((await page.locator(".moteur-solution").count()) === (visible ? 1 : 0), `${l} ${nom} : « Réponse attendue » ${visible ? "affichée" : "ABSENTE"} (obtenu ${await page.locator(".moteur-solution").count()})`);
    verifier(!(await page.locator("body").innerText()).includes(String(ex.a + ex.b)) || visible, `${l} ${nom} : la somme attendue ${ex.a + ex.b} n'apparaît nulle part dans la page`);
    await page.screenshot({ path: join(CAPTURES, `${l}-reponse-visible-${visible ? "cochee" : "decochee"}.png`), fullPage: true });
    verifier(journal.pageerrors.length === 0, `${l} ${nom} : erreurs JS non interceptées : ${journal.pageerrors.join(" | ")}`);
    await contexte.close();
  }
}

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
  await page.locator(`.moteur-choix:has(input[value="${mauvaise}"])`).click();
  await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
  await page.waitForSelector(".moteur-statut-not_equivalent");
  await page.locator(`.moteur-choix:has(input[value="${autre}"])`).click(); // nouvelle sélection en attente de validation
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
  verifier(rapport.actifs.length === 10 && rapport.actifs.includes("af_motif_aucune_racine") && rapport.actifs.includes("af_delta_racines_irrationnelles") && !rapport.actifs.some((v: string) => ["af_mise_en_evidence", "af_binome_conjugue", "af_produit_remarquable", "af_irreductible"].includes(v)), `${l} prof : les 10 variantes gen7 motif/delta sont actives (non disabled) et les 4 anciennes ne sont plus proposées, obtenu ${JSON.stringify(rapport.actifs)}`);
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

  // Retour en arrière (RAPPORT §37) : grisé sous correction immédiate ET avec un chrono « par écran » (réciproquement, « Par écran » est
  // grisé tant que le retour est coché) ; décoché de force quand il devient impossible ; envoyé au serveur ; relu à la modification.
  {
    const lireRetour = async () => (await page.evaluate(`(() => { const c = document.getElementById("autoriser-retour-arriere"); const o = document.querySelector('#chrono-mode option[value="par_ecran"]'); return { coche: c.checked, desactive: c.disabled, opacite: Number(getComputedStyle(c).opacity), parEcranDesactive: o.disabled }; })()`)) as { coche: boolean; desactive: boolean; opacite: number; parEcranDesactive: boolean };
    let r = await lireRetour();
    verifier(r.desactive && !r.coche && r.opacite < 1, `${l} prof : sous correction immédiate, le retour en arrière est grisé et décoché (${JSON.stringify(r)})`);
    await page.locator("#feedback-immediat").uncheck({ force: true });
    r = await lireRetour();
    verifier(!r.desactive && !r.coche && !r.parEcranDesactive, `${l} prof : correction coupée : le retour est disponible (décoché), « Par écran » l'est aussi (${JSON.stringify(r)})`);
    await page.locator("#autoriser-retour-arriere").check({ force: true });
    r = await lireRetour();
    verifier(r.coche && r.parEcranDesactive, `${l} prof : retour coché -> l'option chrono « Par écran » est grisée (${JSON.stringify(r)})`);
    await page.locator("#autoriser-retour-arriere").uncheck({ force: true });
    await page.locator("#chrono-mode").selectOption("par_ecran");
    r = await lireRetour();
    verifier(r.desactive && !r.coche, `${l} prof : chrono « Par écran » -> le retour est grisé et décoché (${JSON.stringify(r)})`);
    await page.locator("#chrono-mode").selectOption("global");
    r = await lireRetour();
    verifier(!r.desactive, `${l} prof : chrono « Global » : le retour reste disponible (${JSON.stringify(r)})`);
    await page.locator("#autoriser-retour-arriere").check({ force: true });
    await page.locator("#feedback-immediat").check({ force: true });
    r = await lireRetour();
    verifier(r.desactive && !r.coche, `${l} prof : recocher la correction immédiate décoche et grise le retour (${JSON.stringify(r)})`);
    await page.locator("#chrono-mode").selectOption("aucun");
  }

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
  // RAPPORT §44 : sous 600 px la carte est bord à bord (le tableau en touche donc les bords, sans les dépasser) ; sur bureau il sort de la carte des deux côtés.
  if (largeur <= 600) verifier(ok(m.g, m.carteG) && ok(m.d, m.carteD), `${etiquette} (${largeur}px) : le tableau fait la largeur de la carte bord à bord (${m.g}→${m.d} contre ${m.carteG}→${m.carteD})`);
  else verifier(m.g < m.carteG && m.d > m.carteD, `${etiquette} (${largeur}px) : le tableau sort de la carte des deux côtés`);
  verifier(m.titreG === null || ok(m.titreG, m.consG), `${etiquette} (${largeur}px) : les titres de ligne s'alignent sur le texte de la carte (${Math.round(m.titreG)} contre ${Math.round(m.consG)}) malgré le plein-bord`);
  const paddingCarte = largeur <= 600 ? 16 : 24; // RAPPORT §44 : carte bord à bord à 16 px de padding sous 600 px
  verifier(m.consG - m.carteG >= paddingCarte && m.carteD - m.consD >= paddingCarte, `${etiquette} (${largeur}px) : le reste de la carte GARDE son padding (consigne à ${m.consG - m.carteG}px du bord gauche, ${m.carteD - m.consD}px du droit)`);
}

/** RAPPORT §46 : dans l'état de relecture / récapitulatif (cartes d'écran terminées, panneau de remise, « Exercice terminé »), chaque bloc enfant de `.moteur-exercice` fait la largeur de l'ÉCRAN sous 600 px (sur bureau : celle de la colonne). */
async function verifierBlocsRelecturePleineLargeur(page: any, etiquette: string, largeur: number) {
  const blocs = (await page.evaluate(`[...document.querySelectorAll(".moteur-exercice > .moteur-ecran-termine, .moteur-exercice > .moteur-fin, .moteur-exercice > .moteur-message")].map((el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el); return { classe: el.className, g: r.left, d: r.right, fenetre: window.innerWidth, rayon: st.borderTopLeftRadius, bordG: st.borderLeftWidth, bordD: st.borderRightWidth }; })`)) as { classe: string; g: number; d: number; fenetre: number; rayon: string; bordG: string; bordD: string }[];
  verifier(blocs.length > 0, `${etiquette} (${largeur}px) : des blocs de relecture sont présents`);
  for (const b of blocs) {
    if (largeur <= 600) {
      verifier(b.g <= 1 && b.d >= b.fenetre - 1, `${etiquette} (${largeur}px) : « ${b.classe} » fait la largeur de l'ÉCRAN (${b.g}→${b.d} sur ${b.fenetre})`);
      verifier(b.rayon === "0px" && b.bordG === "0px" && b.bordD === "0px", `${etiquette} (${largeur}px) : « ${b.classe} » est sans arrondi ni bord latéral (rayon ${b.rayon}, bords ${b.bordG}/${b.bordD})`);
    } else verifier(Math.abs(b.d - b.g - (blocs[0]!.d - blocs[0]!.g)) <= 1, `${etiquette} (${largeur}px) : « ${b.classe} » a la largeur de la colonne (${b.d - b.g})`);
  }
}

/**
 * RAPPORT §48 : « Modifier ma réponse » n'est plus un gros bouton mais un CRAYON (modèle A du propriétaire : pastille ronde `--violet-clair` de 32 px, à droite)
 * à côté de chaque réponse — dans le rappel gris (une ligne par écran répondu) et dans la relecture (à droite du bloc « Ta réponse »). Mesuré sur le style CALCULÉ :
 * le bouton global du site (`min-height: 44px`, padding 9×18, ombre violette, survol `brightness`) ne doit RIEN laisser filtrer.
 */
async function verifierCrayons(page: any, etiquette: string, largeur: number, endroit: "rappel" | "relecture") {
  await page.mouse.move(0, 0); // état NEUTRE : un crayon survolé prend (voulu) le fond plein --violet-vif
  await page.waitForTimeout(300);
  const m = (await page.evaluate(`(() => {
    const sonde = (prop, valeur) => { const e = document.createElement("i"); e.style[prop] = valeur; document.body.appendChild(e); const v = getComputedStyle(e)[prop]; e.remove(); return v; };
    const violetClair = sonde("backgroundColor", "var(--violet-clair)"), violetVif = sonde("color", "var(--violet-vif)"), violetVifFond = sonde("backgroundColor", "var(--violet-vif)");
    const racine = ${endroit === "rappel" ? `".moteur-rappel"` : `".moteur-ecran-termine"`};
    const crayons = [...document.querySelectorAll(racine + " .moteur-crayon")].map((b) => {
      const r = b.getBoundingClientRect(), st = getComputedStyle(b), svg = b.querySelector("svg"), sr = svg ? svg.getBoundingClientRect() : null;
      const hote = b.closest(${endroit === "rappel" ? `".moteur-rappel"` : `".moteur-ecran-termine"`}).getBoundingClientRect();
      const voisin = ${endroit === "rappel" ? `b.closest(".moteur-rappel-ligne")` : `b.closest(".moteur-ecran-termine")`};
      const reponse = ${endroit === "rappel" ? `b.closest(".moteur-rappel-ligne").querySelector(".moteur-rappel-corps")` : `b.closest(".moteur-ecran-termine").querySelector(".moteur-reponse-eleve")`};
      const rr = reponse ? reponse.getBoundingClientRect() : null;
      return { l: r.width, h: r.height, x: r.left, droite: r.right, haut: r.top + window.scrollY, bas: r.bottom + window.scrollY, hoteDroite: hote.right,
        rayon: st.borderTopLeftRadius, fond: st.backgroundColor, couleur: st.color, ombre: st.boxShadow, bord: st.borderTopWidth, margeBas: st.marginBottom, minH: st.minHeight,
        svgL: sr ? sr.width : null, label: b.getAttribute("aria-label"), titre: b.getAttribute("title"), type: b.getAttribute("type"), tag: b.tagName,
        aDroiteDeLaReponse: rr ? r.left >= rr.right - 1 : null, chevauche: rr ? (r.top < rr.bottom && r.bottom > rr.top) : null, ligneH: voisin ? voisin.getBoundingClientRect().height : null,
        classeLigne: voisin ? voisin.className : "" };
    });
    return { violetClair, violetVif, violetVifFond, crayons, gros: document.querySelectorAll(".moteur-bouton-modifier").length };
  })()`)) as any;
  verifier(m.gros === 0, `${etiquette} (${largeur}px) : plus aucun gros bouton « Modifier ma réponse » (.moteur-bouton-modifier : ${m.gros})`);
  verifier(m.crayons.length > 0, `${etiquette} (${largeur}px) : au moins un crayon dans ${endroit}`);
  let precedentBas = -Infinity;
  for (const [i, c] of m.crayons.entries()) {
    const e = `${etiquette} (${largeur}px) crayon ${i + 1}`;
    verifier(c.tag === "BUTTON" && c.type === "button", `${e} : un vrai <button type="button">`);
    verifier(c.l === 32 && c.h === 32, `${e} : 32 × 32 px (obtenu ${c.l} × ${c.h}) : le \`min-height: 44px\` du bouton global ne filtre pas`);
    verifier(c.rayon === "16px" || c.rayon === "50%", `${e} : rond (rayon ${c.rayon})`);
    verifier(c.fond === m.violetClair && c.couleur === m.violetVif, `${e} : fond --violet-clair et icône --violet-vif (${c.fond} / ${c.couleur})`);
    verifier(c.ombre === "none" && c.bord === "0px" && c.margeBas === "0px" && c.minH === "0px", `${e} : ni ombre, ni bord, ni marge, ni hauteur mini hérités (${c.ombre} / ${c.bord} / ${c.margeBas} / ${c.minH})`);
    verifier(c.svgL === 16, `${e} : icône SVG de 16 px (${c.svgL})`);
    verifier(typeof c.label === "string" && /^Modifier ma réponse à l'écran « .+ »$/.test(c.label) && c.titre === "Modifier", `${e} : libellé accessible explicite + infobulle (« ${c.label} » / « ${c.titre} »)`);
    verifier(c.haut >= precedentBas - 0.5, `${e} : ne chevauche pas le crayon précédent (haut ${c.haut} ≥ bas précédent ${precedentBas})`);
    precedentBas = c.bas;
    if (endroit === "rappel") {
      verifier(/moteur-rappel-ligne-modifiable/.test(c.classeLigne) && c.ligneH >= 32, `${e} : sa ligne est « modifiable » et fait au moins 32 px (${c.ligneH})`);
      const retrait = c.hoteDroite - c.droite; // bord (1 px bureau, 0 mobile) + padding de 16 px
      verifier(retrait >= 15 && retrait <= 17.5, `${e} : aligné à droite du panneau gris, à ${retrait} px du bord`);
    } else {
      verifier(c.aDroiteDeLaReponse === true && c.chevauche === true, `${e} : à droite du bloc « Ta réponse », à la même hauteur`);
    }
  }
  // Survol : fond plein --violet-vif, icône --surface, et le `filter: brightness` du bouton global ne s'applique pas.
  const premier = page.locator(`${endroit === "rappel" ? ".moteur-rappel" : ".moteur-ecran-termine"} .moteur-crayon`).first();
  await premier.hover();
  const h = (await premier.evaluate((el: unknown) => { const st = getComputedStyle(el); return { fond: st.backgroundColor, couleur: st.color, filtre: st.filter }; })) as { fond: string; couleur: string; filtre: string };
  verifier(h.fond === m.violetVifFond && h.couleur === "rgb(255, 255, 255)" && h.filtre === "none", `${etiquette} (${largeur}px) : survol = fond --violet-vif, icône blanche, aucun filtre (${JSON.stringify(h)})`);
  await page.mouse.move(0, 0);
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
  const tacheId = creerTache(s, { nom: "Tâche témoin étendu", aide_activee: true, aide_penalite_pourcent: 25, tentatives_supplementaires: 1, feedback_immediat: true, reponse_visible: true, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }] });
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
  // KaTeX 0.18.9 (RAPPORT §33) : rendu RÉEL, une seule formule assemblée, aucune couleur venue d'un texte, repli en source jamais rouge.
  await page.evaluate("document.fonts.ready");
  verifier((await courant.locator(".moteur-formule .katex").count()) === 1 && (await courant.locator(".moteur-formule .moteur-math-source").count()) === 0, `${l} étendu : formule_coloree = UNE formule KaTeX assemblée (jamais un fragment par segment)`);
  verifier((await courant.locator(".moteur-consigne .katex").count()) >= 4 && (await page.locator(".moteur-math-source").count()) === 0, `${l} étendu : la consigne est rendue par KaTeX, aucun repli en source sur la page`);
  verifier((await page.locator(".moteur-consigne .katex [style*='color']").count()) === 0 && (await page.locator(".moteur-formule .katex [style*='color']").count()) === 0, `${l} étendu : aucune couleur en ligne dans le rendu (la couleur d'un coefficient vient de la classe, donc du token)`);
  verifier(await page.evaluate(`document.fonts.check("1em KaTeX_Main") && document.fonts.check("1em KaTeX_Math")`) as boolean, `${l} étendu : les polices KaTeX vendorées (woff2) sont chargées`);
  // La ponctuation qui suit une formule lui est collée (jamais renvoyée seule à la ligne) et le texte reste inchangé.
  {
    const groupes = (await page.evaluate(`[...document.querySelectorAll(".moteur-consigne .moteur-insecable")].map((g) => ({ signe: g.lastChild.textContent, math: g.firstChild.classList.contains("moteur-math"), nowrap: getComputedStyle(g).whiteSpace }))`)) as { signe: string; math: boolean; nowrap: string }[];
    verifier(groupes.length >= 1 && groupes.every((g) => g.math && g.nowrap === "nowrap" && /^[,.;:!?)]$/.test(g.signe)), `${l} étendu : la ponctuation suivant une formule est collée à elle (${JSON.stringify(groupes)})`);
    const consigne = (await courant.locator(".moteur-consigne").first().innerText()).replace(/\s+/g, " ");
    verifier(!/\s[,;.:!?]/.test(consigne), `${l} étendu : aucune ponctuation isolée par une espace dans la consigne rendue (« ${consigne.slice(0, 120)} »)`);
  }
  const CAS_MATH = { ordinaire: "x^2 + 1", href: "\\href{http://exemple.test}{x}", classeEtrangere: "\\htmlClass{moteur-coef-a}{3}", rolesOk: "\\htmlClass{moteur-coef-a}{3}", rolesEtranger: "\\htmlClass{evil}{3}", invalide: "\\frac{1" };
  const repli = (await page.evaluate(`((cas) => (async () => {
    const { rendreMath, rendreTexte } = await import("/moteur/rendreTexte.js");
    const rendu = (latex, options) => { const el = document.createElement("span"); document.body.appendChild(el); rendreMath(el, latex, options); const r = { source: el.classList.contains("moteur-math-source"), texte: el.textContent, katex: el.querySelector(".katex") !== null, rouge: el.innerHTML.includes("cc0000") || el.innerHTML.includes("rgb(204, 0, 0)") }; el.remove(); return r; };
    const sortie = {
      ordinaire: rendu(cas.ordinaire),
      href: rendu(cas.href),
      classeEtrangere: rendu(cas.classeEtrangere),
      rolesOk: rendu(cas.rolesOk, { roles: true }),
      rolesEtranger: rendu(cas.rolesEtranger, { roles: true }),
      invalide: rendu(cas.invalide),
    };
    const sauve = globalThis.katex;
    delete globalThis.katex;
    sortie.sansKatex = rendu(cas.ordinaire);
    globalThis.katex = sauve;
    const eleve = document.createElement("p");
    rendreTexte(eleve, "$x^2$ tapé par un élève");
    sortie.eleve = { texte: eleve.textContent, katex: eleve.querySelector(".katex") !== null };
    return sortie;
  })())(${JSON.stringify(CAS_MATH)})`)) as Record<string, { source?: boolean; texte: string; katex: boolean; rouge?: boolean }>;
  verifier(repli.ordinaire.katex && !repli.ordinaire.source, `${l} étendu : rendreMath ordinaire = KaTeX`);
  verifier(["href", "classeEtrangere", "rolesEtranger", "invalide", "sansKatex"].every((k) => repli[k].source !== false && !repli[k].katex && repli[k].rouge !== true), `${l} étendu : commande refusée, classe étrangère, LaTeX invalide ou KaTeX absent -> source en texte brut, jamais de rendu rouge (${JSON.stringify(repli)})`);
  verifier(repli.sansKatex.texte === CAS_MATH.ordinaire && repli.href.texte === CAS_MATH.href, `${l} étendu : le repli montre la source LaTeX telle quelle`);
  verifier(repli.rolesOk.katex && !repli.rolesOk.source && !repli.rolesOk.rouge, `${l} étendu : roles -> \\htmlClass{moteur-coef-a} accepté`);
  verifier(repli.eleve.texte === "$x^2$ tapé par un élève" && !repli.eleve.katex, `${l} étendu : un texte d'élève (sans option math) n'est jamais interprété`);
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
  await courant.locator('.moteur-choix:has(input[name="mc-allure-signeA"][value="+"])').click();
  verifier((await courant.locator(".moteur-illustration .croquis-courbe-neutre").count()) === 1 && (await points()) === neutre, `${l} étendu : un seul choix : l'illustration reste neutre`);
  await courant.locator('.moteur-choix:has(input[name="mc-allure-signeAB"][value="-"])').click();
  const droite = await points();
  verifier((await courant.locator(".moteur-illustration .croquis-courbe-neutre").count()) === 0 && droite !== neutre && (await svgAllure().getAttribute("aria-label"))!.includes("à droite"), `${l} étendu : deux choix (a>0, ab<0) : l'illustration montre le sommet à droite`);
  await page.screenshot({ path: cap("04-allure-illustration-droite"), fullPage: true });
  await courant.locator('.moteur-choix:has(input[name="mc-allure-signeAB"][value="+"])').click();
  verifier((await points()) !== droite && (await svgAllure().getAttribute("aria-label"))!.includes("à gauche"), `${l} étendu : l'illustration suit un changement de choix (sommet à gauche)`);
  await courant.locator('.moteur-choix:has(input[name="mc-allure-signeA"][value="-"])').click();
  verifier((await svgAllure().getAttribute("aria-label"))!.includes("ouverte vers le bas"), `${l} étendu : a<0 : parabole ouverte vers le bas`);
  verifier(reponsesEnvoyees(journal) === av2, `${l} étendu : l'illustration ne déclenche AUCUNE requête (état local d'édition)`);
  verifier((await page.locator(".moteur-illustration").innerText()).length < 200 && (await courant.locator(".moteur-statut").count()) === 0, `${l} étendu : l'illustration n'affiche aucun verdict`);
  verifier((await page.getByRole("button", { name: "Besoin d'un indice ?" }).count()) === 0, `${l} étendu : l'illustration n'est PAS une aide (aucun indice sur l'écran d'allure)`);
  await verifierMiseEnPage(page, "allure", largeur);
  const allureJuste = JSON.parse(reponseBruteCorrecte(U(exA), CHAMP_ALLURE));
  for (const [id, valeur] of Object.entries(allureJuste)) await courant.locator(`.moteur-choix:has(input[name="mc-allure-${id}"][value="${valeur}"])`).click();
  await valider().click();
  await page.waitForSelector(".moteur-statut-correct");
  await suivante().click();

  // ── Écran 3 : qcm à libellés mathématiques ──
  await page.waitForSelector('input[name="qcm-extremum"]'); // (l'écran d'allure utilise aussi `.moteur-qcm` : attendre CE champ)
  verifier((await courant.locator(".moteur-choix .moteur-math").count()) === 2, `${l} étendu : les libellés du QCM sont rendus comme mathématiques`);
  await courant.locator(`.moteur-choix:has(input[value="${reponseBruteCorrecte(U(exA), CHAMP_EXTREMUM)}"])`).click();
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
  await valider().click(); // 2e et dernière tentative : verrouillage, révélation (correction immédiate active ET « Afficher la réponse attendue » cochée, RAPPORT §42)
  // Sous « Afficher la réponse attendue », un écran RÉUSSI montre aussi sa solution : attendre celle de l'écran COURANT (jamais une solution déjà à l'écran).
  await courant.locator(".moteur-solution").waitFor({ state: "visible" });
  verifier((await courant.locator(".moteur-solution .moteur-math").count()) >= 3, `${l} étendu : « Réponse attendue » (texte d'auteur) rend ses mathématiques`);
  await page.screenshot({ path: cap("06-axe-verrouille-revele"), fullPage: true });
  await suivante().click();
  // RAPPORT §43 : l'écran verrouillé est désormais une LIGNE du « Ce qu'on sait déjà » ; sa valeur est la réponse d'ÉLÈVE, rendue comme avant.
  await page.waitForSelector(".moteur-rappel-ligne:has(.moteur-rappel-nom)");
  const resume = page.locator(".moteur-rappel-ligne").filter({ hasText: "Axe" }).locator(".moteur-rappel-valeur");
  verifier((await resume.innerText()).includes("$x$"), `${l} étendu : la ligne du rappel affiche le « $x$ » tapé par l'élève tel quel`);
  verifier((await resume.locator(".moteur-math").count()) === 3, `${l} étendu : dans la ligne du rappel, seuls les 3 libellés d'auteur sont mathématiques ; le texte de l'élève ne l'est jamais`);

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
  // On attend l'exercice 2 lui-même (et non « un tableau à 7 colonnes » : la solution dessinée du quotient de l'exercice 1, RAPPORT §53, en est un aussi et peut encore être à l'écran).
  await page.waitForFunction(`/EXERCICE 2 SUR/.test(document.querySelector(".moteur-suivi")?.textContent ?? "") && document.querySelectorAll(".moteur-ecran-courant .moteur-table-structure col").length === 7`);
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


// ══ gen7 « motif / delta » : aides communes aux scénarios (le VRAI registre, joué dans le navigateur) ══

const NOMS_SYMBOLES_GEN7: Record<string, string> = { "⌣": "minimum (en creux)", "⌢": "maximum (en bosse)", "↗": "croissante", "↘": "décroissante" };

/** Consigne de l'écran courant, KaTeX remplacé par sa source LaTeX (`$…$`) : comparable au texte d'auteur (l'innerText de KaTeX répète chaque formule en MathML). */
async function lireConsigneGen7(page: any): Promise<string> {
  return (await page.evaluate(`(() => {
    const el = document.querySelector(".moteur-ecran-courant .moteur-consigne");
    const copie = el.cloneNode(true);
    for (const k of copie.querySelectorAll(".katex")) k.replaceWith("$" + (k.querySelector("annotation")?.textContent ?? "") + "$");
    return copie.textContent;
  })()`)) as string;
}

/** Clique « Valider », attend l'apparition du bouton de suite, le clique et attend l'écran suivant (sauf à la fin de l'exercice). */
async function validerEtSuivreGen7(page: any, options: { verdict?: boolean; entre?: () => Promise<void> } = {}): Promise<void> {
  const avant = (await page.evaluate(`document.querySelector(".moteur-ecran-courant .moteur-consigne").textContent`)) as string;
  await page.locator(".moteur-ecran-courant").getByRole("button", { name: "Valider", exact: true }).click();
  if (options.verdict !== false) await page.waitForSelector(".moteur-statut-correct");
  else await page.waitForSelector(".moteur-statut");
  if (options.entre) await options.entre();
  await page.getByRole("button", { name: /Question suivante|Voir la fin/ }).click();
  await page.waitForFunction(`(() => { const c = document.querySelector(".moteur-ecran-courant .moteur-consigne"); return document.querySelector(".moteur-fin") !== null || (c !== null && c.textContent !== ${JSON.stringify(avant)}); })()`);
}

/** Ouvre la première tâche de l'élève et rend le moteur prêt. */
async function ouvrirTacheGen7(navigateur: any, base: string, largeur: number, s: Scenario) {
  const ctx = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
  await ctx.page.goto(base + "/eleve.html");
  await ctx.page.waitForSelector(".carte-tache");
  await ctx.page.locator(".carte-tache").first().click();
  await ctx.page.waitForSelector(".moteur-ecran-courant");
  void s;
  return ctx;
}

/**
 * Assigne (API réelle) une tâche d'UNE variante gen7 « motif / delta » avec la graine voulue ; renvoie l'exercice régénéré. Le profil d'assignation du témoin est remis à
 * « aléatoire » : sinon le harnais remplacerait `Math.random` et la graine demandée serait ignorée.
 */
async function assignerMD(s: Scenario, variante: string, graine: number, options: { feedback?: boolean; tentatives?: number; retour?: boolean; visible?: boolean } = {}): Promise<{ ex: ExerciceMotifDelta; tacheId: string }> {
  imposerProfilAssignation("aleatoire");
  const tacheId = creerTache(s, { nom: `gen7 ${variante}`, autoriser_retour_arriere: options.retour ?? false, feedback_immediat: options.feedback ?? true, tentatives_supplementaires: options.tentatives ?? 0, reponse_visible: options.visible ?? false, variantes: [{ variante_id: variante, nombre_exercices: 1 }] });
  const origine = Math.random;
  Math.random = () => graine / 2 ** 32;
  try {
    const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
    verifier(a.statut === 201, `gen7 ${variante} : assignation : ${a.statut} ${JSON.stringify(a.corps)}`);
  } finally {
    Math.random = origine;
  }
  const ligne = s.base.table("exercices_assignes").find((x) => x.tache_id === tacheId)!;
  return { ex: genererExerciceMD(variante as ExerciceMotifDelta["famille"], Number(ligne.graine)), tacheId };
}

// f(x) = x² + 3x − 4 (af_delta_racines_rationnelles, graine 4242) : racines −4 et 1, sommet (−3/2 ; −25/4). Coefficients FAUX confirmés a = −1, b = 3, c = 4 : f_élève(x) = −x² + 3x + 4,
// racines −1 et 4, sommet (3/2 ; 25/4), parabole vers le bas, sommet à droite de l'axe Oy.
const VARIANTE_REPERE = "af_delta_racines_rationnelles";
const GRAINE_REPERE = 4242;
const COEF_FAUX_REPERE = { a: "-1", b: "3", c: "4" };
/** L'exercice tel que l'élève le voit après avoir confirmé de faux coefficients : ses réponses justes pour SA fonction s'obtiennent par `reponseBruteCorrecteMotifDelta`. */
const exerciceDeLEleve = (ex: ExerciceMotifDelta): ExerciceMotifDelta =>
  projeterMotifDelta(ex, [{ champ: "coefficients", reponseBrute: JSON.stringify(COEF_FAUX_REPERE), statut: "not_equivalent" }], { correctionImmediate: false, solutionMontree: false });

/**
 * Correction COUPÉE et cascade : de FAUX coefficients confirmés deviennent la fonction de tous les écrans suivants (méthode juste sur donnée fausse = réussite), le tableau
 * montre x₁, x_S, x₂ sans valeur numérique, et RIEN n'est révélé (ni verdict, ni panneau, ni score) avant la fin ; à la fin de la TÂCHE, tout l'est d'un coup.
 */
async function scenarioGen7Coupe(navigateur: any, base: string, largeur: number) {
  const l = `${largeur}`;
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const { ex } = await assignerMD(s, VARIANTE_REPERE, GRAINE_REPERE, { feedback: false });
  const exEleve = exerciceDeLEleve(ex);
  const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
  const courant = page.locator(".moteur-ecran-courant");
  const sansVerdict = async () => (await page.locator(".moteur-statut-correct, .moteur-statut-not_equivalent, .moteur-statut-parse_error, .moteur-solution").count()) === 0;
  // Entre « Valider » et « Question suivante » : la réponse est enregistrée, mais ni verdict ni solution ne sont visibles — sauf pour la
  // réponse qui TERMINE la tâche (`derniere`), qui la révèle (règle de révélation, CLAUDE.md).
  const passer = (etape: string, derniere = false) =>
    validerEtSuivreGen7(page, { verdict: false, entre: async () => void verifier(derniere ? !(await sansVerdict()) : await sansVerdict(), `${l} gen7 coupé / ${etape} : ${derniere ? "la réponse qui termine la tâche la révèle" : "aucun verdict ni solution affiché"}`) });
  const marquesDeVerdict = ".moteur-rappel-marque-correct, .moteur-rappel-marque-not_equivalent, .moteur-rappel-marque-parse_error, .moteur-rappel-score, .moteur-rappel-total, .moteur-recap";
  for (const k of ["a", "b", "c"] as const) await courant.locator(`#mc-coefficients-${k}`).fill(COEF_FAUX_REPERE[k]);
  await passer("coefficients");
  for (const champ of ["allure", "axeSommet", "domaineImage", "racines"]) {
    const consigne = await lireConsigneGen7(page);
    verifier(consigne.includes("d'après les coefficients que tu as donnés") && /-\s?x\^2/.test(consigne), `${l} gen7 coupé / ${champ} : l'énoncé est celui de la fonction de l'élève, et rien de plus (« ${consigne.slice(0, 110)} »)`);
    verifier((await page.locator(marquesDeVerdict).count()) === 0, `${l} gen7 coupé / ${champ} : le rappel ne porte aucune marque de verdict ni aucun score`);
    await repondreMD(page, exEleve, champ);
    await passer(champ);
  }
  await page.waitForSelector(".moteur-table-structure");
  const annotations = (await courant.locator(".moteur-table-structure .katex-mathml annotation").allTextContents()).map((t: string) => t.trim());
  const symboles = annotations.filter((t: string) => /^x_(1|2|S)$/.test(t)).length;
  verifier(symboles >= 3 && annotations.every((t: string) => !/\d/.test(t.replace(/x_[12]/, "x_"))), `${l} gen7 coupé : le tableau montre x_1, x_S, x_2 (${symboles}) et aucune valeur numérique de x (${JSON.stringify(annotations)})`);
  verifier((await sansVerdict()) && (await page.locator(".moteur-rappel-marque-neutre").count()) === 5 && (await page.locator(marquesDeVerdict).count()) === 0, `${l} gen7 coupé : rappel neutre (5 marques •), aucun verdict ni score avant la fin`);
  await page.screenshot({ path: join(CAPTURES, `${l}-gen7-coupe-tableau-symbolique.png`), fullPage: true });
  await repondreMD(page, exEleve, "tableauSignes");
  await passer("tableauSignes", true);
  await page.waitForSelector(".moteur-fin");
  // Parties fausses (RAPPORT §52) : JAMAIS sous correction coupée — même à la fin, quand tous les verdicts sont révélés d'un coup.
  verifier((await page.locator(".moteur-partie-fausse, .moteur-piece-fausse").count()) === 0, `${l} gen7 coupé : aucune partie fausse surlignée, même à la fin de la tâche`);
  // La tâche ENTIÈRE est terminée : tout est révélé d'un coup, scores compris (tableau final seulement : le rappel n'existe plus).
  const rangees: string[] = await page.locator(".moteur-fin .moteur-recap-table tbody tr").allInnerTexts();
  verifier(rangees.length === 7 && /^Coefficients\s+0 \/ 1 pt$/.test(rangees[0]!) && /^Total\s+10 \/ 11 pts$/.test(rangees[6]!), `${l} gen7 coupé : à la fin de la tâche, le tableau final révèle les scores : coefficients faux = 0, le reste juste pour SA fonction, total 10 / 11 (${JSON.stringify(rangees)})`);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.waitForSelector("#tableau-de-bord:not([hidden])");
  const rep = s.base.table("reponses");
  verifier(rep.find((r) => r.champ === "coefficients")?.statut === "not_equivalent", `${l} gen7 coupé : les coefficients faux sont enregistrés comme faux (côté serveur seulement)`);
  verifier(["allure", "axeSommet", "domaineImage", "racines", "tableauSignes"].every((c) => rep.find((r) => r.champ === c)?.statut === "correct"), `${l} gen7 coupé : tout le reste est correct pour la fonction de l'élève (${rep.map((r) => `${r.champ}:${r.statut}`).join()})`);
  verifier(journal.pageerrors.length === 0, `${l} gen7 coupé : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();
}

/**
 * Cascade des coefficients (RAPPORT §38), jouée dans le navigateur dans les DEUX régimes (immédiat sans « Afficher la réponse attendue », et coupé) : de faux coefficients confirmés,
 * puis une ordonnée du sommet fausse (0) : les écrans suivants affichent SA fonction et SON ordonnée, et l'ensemble-image ]−∞ ; 0] est accepté (verdict « Bonne réponse » sous
 * correction immédiate, rien de visible sous correction coupée). Avec la case cochée, c'est §45 qui s'applique (`scripts/test-cascade-revelee.ts`).
 */
async function scenarioGen7Cascade(navigateur: any, base: string, largeur: number) {
  for (const feedback of [true, false]) {
    const l = `${largeur} gen7 cascade ${feedback ? "immédiat" : "coupé"}`;
    const s: Scenario = creerScenario();
    installerBase(s.base);
    const { ex } = await assignerMD(s, VARIANTE_REPERE, GRAINE_REPERE, { feedback, visible: false });
    const exEleve = exerciceDeLEleve(ex);
    const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
    const courant = page.locator(".moteur-ecran-courant");
    /** « Valider », attend le retour serveur, puis renvoie le geste « suite » (à appeler pour passer à l'écran suivant). */
    const valider = async () => {
      const avant = (await page.evaluate(`document.querySelector(".moteur-ecran-courant .moteur-consigne").textContent`)) as string;
      await courant.getByRole("button", { name: "Valider", exact: true }).click();
      await page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
      return async () => {
        await page.getByRole("button", { name: /Question suivante|Voir la fin/ }).click();
        await page.waitForFunction(`(() => { const c = document.querySelector(".moteur-ecran-courant .moteur-consigne"); return document.querySelector(".moteur-fin") !== null || (c !== null && c.textContent !== ${JSON.stringify(avant)}); })()`);
      };
    };
    // 1. coefficients FAUX
    for (const k of ["a", "b", "c"] as const) await courant.locator(`#mc-coefficients-${k}`).fill(COEF_FAUX_REPERE[k]);
    await (await valider())();
    // 2. allure (vers le bas, sommet à droite) : la consigne annonce SA fonction
    const consigneAllure = await lireConsigneGen7(page);
    verifier(consigneAllure.includes("d'après les coefficients que tu as donnés") && /-\s?x\^2/.test(consigneAllure) && consigneAllure.includes("3x"), `${l} : l'écran allure affiche SA fonction (« ${consigneAllure.slice(0, 110)} »)`);
    await repondreMD(page, exEleve, "allure");
    await (await valider())();
    // 3. axeSommet : xS = 3/2 cohérent, yS = 0 faux même pour ses coefficients (vrai : 25/4)
    await courant.locator("#mc-axeSommet-axeTexte").fill("x = 3/2");
    await courant.locator("#mc-axeSommet-xS").fill("3/2");
    await courant.locator("#mc-axeSommet-yS").fill("0");
    await (await valider())();
    // 4. domaineImage : ]−∞ ; 0]
    const consigneImage = await lireConsigneGen7(page);
    verifier(/-\s?x\^2/.test(consigneImage) && !consigneImage.includes("y_S"), `${l} : domaineImage rappelle SA fonction mais JAMAIS l'ordonnée du sommet (RAPPORT §53) (« ${consigneImage.slice(0, 200).replace(/\n/g, " / ")} »)`);
    const ligne = courant.locator(".moteur-intervalle-ligne");
    for (const cote of ["gauche", "droite"]) {
      const bouton = ligne.getByRole("button", { name: new RegExp(`Crochet de ${cote}`) });
      for (let k = 0; k < 2 && (await bouton.textContent()) !== "]"; k++) await bouton.click();
    }
    await ligne.getByRole("button", { name: "Borne de gauche : moins l'infini" }).click();
    await ligne.getByLabel("Borne de droite", { exact: true }).fill("0");
    await valider();
    if (feedback) verifier((await courant.locator(".moteur-statut-correct").count()) === 1, `${l} : ]−∞ ; 0] est accepté (« Bonne réponse »)`);
    else verifier((await courant.locator(".moteur-statut-correct, .moteur-statut-not_equivalent, .moteur-solution").count()) === 0, `${l} : aucun verdict visible avant la fin de la tâche`);
    verifier((await page.locator(".moteur-rappel-score, .moteur-rappel-total").count()) === 0, `${l} : aucun score (le score suit la solution, absente ici)`);
    await page.screenshot({ path: join(CAPTURES, `${largeur}-gen7-cascade-${feedback ? "immediat" : "coupe"}-image.png`), fullPage: true });
    const rep = s.base.table("reponses");
    const statut = (champ: string) => rep.find((r) => r.champ === champ)?.statut;
    verifier(statut("coefficients") === "not_equivalent" && statut("allure") === "correct" && statut("axeSommet") === "not_equivalent" && statut("domaineImage") === "correct", `${l} : statuts enregistrés (${["coefficients", "allure", "axeSommet", "domaineImage"].map((c) => statut(c)).join()})`);
    verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
    await contexte.close();
  }
}

/**
 * Retour en arrière (RAPPORT §37), joué dans le navigateur sur gen7 « motif / delta » (cascade axeSommet -> domaineImage / tableau) :
 * « Modifier ma réponse » sur chaque écran (champs multiples, intervalle, liste, tableau pré-remplis ; qcm et champ texte : `scenarioRetourArriereTemoin`, aller-retour sans altération : re-valider sans changer
 * = « inchangée », aucune ligne écrite), modification de axeSommet qui périme domaineImage ET le tableau, remise explicite,
 * révélation d'un coup APRÈS la remise seulement ; et le réglage sans effet sous correction immédiate.
 */
async function scenarioRetourArriere(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} retour`;
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const { ex, tacheId } = await assignerMD(s, VARIANTE_REPERE, GRAINE_REPERE, { feedback: false, retour: true }); // f = x² + 3x − 4
  const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
  const courant = page.locator(".moteur-ecran-courant");
  const lignes = () => s.base.table("reponses").length;
  const sansVerdict = async () => (await page.locator(".moteur-statut-correct, .moteur-statut-not_equivalent, .moteur-statut-parse_error, .moteur-solution").count()) === 0;
  /** « Valider » puis le bouton de suite ; renvoie le message affiché entre les deux. */
  const validerRetour = async (suite: RegExp): Promise<string> => {
    await courant.getByRole("button", { name: "Valider", exact: true }).click();
    await page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
    const message = ((await courant.locator(".moteur-retour .moteur-statut").textContent()) ?? "").replace(/\s+/g, " ").trim();
    await courant.getByRole("button", { name: suite }).click();
    return message;
  };
  const carte = (champ: string) => page.locator(`.moteur-ecran:has(.moteur-consigne)`).nth(ORDRE_GEN7.indexOf(champ));
  const ORDRE_GEN7 = champsMotifDelta();

  // ── Parcours des 6 écrans ; jamais de verdict, jamais de « Question suivante » : un écran répondu reste modifiable ──
  for (const [i, champ] of ORDRE_GEN7.entries()) {
    await page.waitForFunction(`document.querySelectorAll(".moteur-ecran-courant").length === 1`);
    await repondreMD(page, ex, champ);
    const message = await validerRetour(i === ORDRE_GEN7.length - 1 ? /Revoir mes réponses/ : /Écran suivant/);
    verifier(message === "Réponse enregistrée.", `${l} / ${champ} : message neutre (« ${message} »)`);
    verifier(await sansVerdict(), `${l} / ${champ} : aucun verdict ni solution`);
  }
  await page.waitForSelector(".moteur-remise");
  verifier((await page.getByRole("button", { name: "Modifier ma réponse" }).count()) === 6, `${l} : « Modifier ma réponse » sur chacun des 6 écrans`);
  await verifierCrayons(page, `${l} relecture`, largeur, "relecture");
  verifier((await page.locator(".moteur-ecran-termine .moteur-crayon").count()) === 6, `${l} relecture : un crayon par carte (6)`);
  verifier(/crayon/i.test((await page.locator(".moteur-remise .moteur-message").innerText()) ?? ""), `${l} : le panneau de remise parle du CRAYON, plus d'un bouton « Modifier ma réponse »`);
  // Clavier : Entrée sur le crayon (vrai <button>) rouvre l'écran, comme un clic.
  await page.locator(".moteur-ecran-termine .moteur-crayon").first().focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".moteur-ecran-courant");
  verifier((await page.getByRole("button", { name: "Annuler" }).count()) === 1, `${l} relecture : Entrée sur le crayon ouvre l'écran à modifier (« Annuler » proposé)`);
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.waitForSelector(".moteur-remise");
  verifier((await page.locator(".moteur-ecran-courant").count()) === 0 && (await sansVerdict()), `${l} : panneau « Rendre » affiché, rien de corrigé`);
  await page.screenshot({ path: join(CAPTURES, `${l}-01-panneau-remise.png`), fullPage: true });

  // ── Chaque composant est pré-rempli, et re-valider sans changer n'écrit RIEN (round-trip exact de la réponse) ──
  const avantTout = lignes();
  for (const champ of ORDRE_GEN7) {
    await carte(champ).getByRole("button", { name: "Modifier ma réponse" }).click();
    await page.waitForFunction(`document.querySelectorAll(".moteur-ecran-courant").length === 1`);
    verifier((await page.locator(".moteur-remise").count()) === 0 && (await page.getByRole("button", { name: "Annuler" }).count()) === 1, `${l} / ${champ} : un seul formulaire ouvert, avec « Annuler », sans panneau de remise`);
    const valider = courant.getByRole("button", { name: "Valider", exact: true });
    verifier(await valider.isEnabled(), `${l} / ${champ} : l'écran s'ouvre pré-rempli (« Valider » actif sans rien toucher)`);
    if (champ === "coefficients") {
      const attendu = JSON.parse(reponseBruteCorrecteMotifDelta(ex, "coefficients"));
      const lus = { a: await courant.locator("#mc-coefficients-a").inputValue(), b: await courant.locator("#mc-coefficients-b").inputValue(), c: await courant.locator("#mc-coefficients-c").inputValue() };
      verifier(JSON.stringify(lus) === JSON.stringify(attendu), `${l} : champs_multiples pré-rempli (attendu ${JSON.stringify(attendu)}, lu ${JSON.stringify(lus)})`);
    }
    if (champ === "allure") verifier((await courant.locator(".moteur-choix input:checked").count()) === 2, `${l} : champs_multiples à choix pré-rempli (deux choix cochés)`);
    if (champ === "racines") verifier((await courant.locator(".moteur-liste-ligne .moteur-champ").count()) === 2, `${l} : liste_valeurs pré-rempli (2 valeurs)`);
    if (champ === "domaineImage") verifier((await courant.locator(".moteur-apercu").textContent()) !== "?… ; …?" && (await courant.locator(".moteur-bouton-crochet").first().textContent()) !== "?", `${l} : intervalle pré-rempli`);
    if (champ === "tableauSignes") verifier((await courant.locator(".moteur-case-renseignee").count()) === (await courant.locator(".moteur-case-signe").count()), `${l} : tableau_signes pré-rempli (toutes les cases renseignées)`);
    if (champ === "racines") {
      await page.screenshot({ path: join(CAPTURES, `${l}-02-modification-prerempli.png`), fullPage: true });
      // RAPPORT §48 : pendant la modification d'un écran, le rappel gris porte un crayon par AUTRE écran répondu (5 sur 6), jamais un gros bouton.
      await verifierCrayons(page, `${l} rappel`, largeur, "rappel");
      verifier((await page.locator(".moteur-rappel .moteur-crayon").count()) === 5, `${l} rappel : un crayon pour chacun des 5 autres écrans répondus`);
    }
    const message = await validerRetour(/Revoir mes réponses|Continuer/);
    verifier(message.includes("Réponse inchangée."), `${l} / ${champ} : re-valider sans changer = « inchangée » (« ${message} »)`);
    await page.waitForSelector(".moteur-remise");
  }
  verifier(lignes() === avantTout, `${l} : aller-retour exact des composants : AUCUNE ligne écrite (${avantTout} -> ${lignes()})`);

  // ── Annuler ──
  await carte("allure").getByRole("button", { name: "Modifier ma réponse" }).click();
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.waitForSelector(".moteur-remise");
  verifier(lignes() === avantTout, `${l} : « Annuler » n'écrit rien`);

  // ── Modifier axeSommet : domaineImage ET le tableau sont périmés ; le panneau disparaît ──
  await carte("axeSommet").getByRole("button", { name: "Modifier ma réponse" }).click();
  await courant.locator("#mc-axeSommet-axeTexte").fill("x = -1.5"); // même valeur que « x = -3/2 », chaîne DIFFÉRENTE : c'est une modification
  const message = await validerRetour(/Continuer/);
  verifier(message.includes("Réponse modifiée.") && message.includes("à refaire (2)"), `${l} : la modification annonce 2 écrans à refaire (« ${message} »)`);
  await page.waitForSelector(".moteur-ecran-courant");
  verifier((await page.locator(".moteur-message-succes").first().textContent())?.includes("2 écrans qui en dépendent") === true, `${l} : la notice de tête le rappelle`);
  verifier((await lireConsigneGen7(page)).includes("ensemble-image") && !(await lireConsigneGen7(page)).includes("y_S"), `${l} : domaineImage est re-servi (sans ordonnée du sommet dans l'énoncé)`);
  verifier((await page.locator(".moteur-remise").count()) === 0 && (await page.getByRole("button", { name: "Modifier ma réponse" }).count()) === 4, `${l} : plus de « Rendre » ; 4 écrans intacts restent modifiables`);
  verifier((await page.locator(".moteur-table-structure").count()) === 0, `${l} : le tableau (aval) n'est pas affiché : un seul écran à la fois`);
  await page.screenshot({ path: join(CAPTURES, `${l}-03-aval-perime.png`), fullPage: true });
  await repondreMD(page, ex, "domaineImage");
  await validerRetour(/Écran suivant/);
  await page.waitForSelector(".moteur-table-structure");
  await repondreMD(page, ex, "tableauSignes");
  await validerRetour(/Revoir mes réponses/);
  await page.waitForSelector(".moteur-remise");
  await verifierBlocsRelecturePleineLargeur(page, `${l} relecture avant la remise`, largeur);
  verifier(await sansVerdict(), `${l} : toujours rien de corrigé avant la remise`);
  verifier(s.base.table("exercices_assignes")[0]!.remis_le === null, `${l} : pas encore rendu`);

  // ── Remise : confirmation en deux clics, puis TOUT est révélé d'un coup ──
  await page.getByRole("button", { name: "Rendre cet exercice" }).click();
  verifier(s.base.table("exercices_assignes")[0]!.remis_le === null, `${l} : le premier clic ne rend pas (confirmation demandée)`);
  await page.getByRole("button", { name: /Confirmer : après avoir rendu/ }).click();
  await page.waitForSelector(".moteur-fin:has-text('Exercice terminé')");
  await verifierBlocsRelecturePleineLargeur(page, `${l} récapitulatif après la remise`, largeur);
  verifier(s.base.table("exercices_assignes")[0]!.remis_le !== null, `${l} : remis_le écrit`);
  verifier((await page.getByRole("button", { name: "Modifier ma réponse" }).count()) === 0, `${l} : plus aucun « Modifier » après la remise`);
  {
    const [justes, faux] = [await page.locator(".moteur-statut-correct").count(), await page.locator(".moteur-statut-not_equivalent").count()];
    verifier(justes === 6 && faux === 0, `${l} : après la remise, les 6 verdicts sont révélés d'un coup (dernières réponses, toutes justes) : ${justes} justes, ${faux} faux ${JSON.stringify(s.base.table("reponses").slice(6).map((r) => [r.champ, r.statut]))}`);
  }
  await page.screenshot({ path: join(CAPTURES, `${l}-04-apres-remise.png`), fullPage: true });
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.waitForSelector("#tableau-de-bord:not([hidden])");
  verifier(s.base.table("reponses").length === avantTout + 3, `${l} : les anciennes lignes sont conservées (${s.base.table("reponses").length})`);
  verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();

  // ── Réglage sans effet sous correction immédiate ──
  {
    const s2: Scenario = creerScenario();
    installerBase(s2.base);
    const { ex: ex2 } = await assignerMD(s2, VARIANTE_REPERE, GRAINE_REPERE, { feedback: true, retour: true });
    const c2 = await ouvrirTacheGen7(navigateur, base, largeur, s2);
    await repondreMD(c2.page, ex2, "coefficients");
    await c2.page.locator(".moteur-ecran-courant").getByRole("button", { name: "Valider", exact: true }).click();
    await c2.page.waitForSelector(".moteur-statut-correct");
    verifier((await c2.page.getByRole("button", { name: "Question suivante" }).count()) === 1 && (await c2.page.getByRole("button", { name: /Modifier ma réponse/ }).count()) === 0, `${l} : sous correction immédiate le réglage est sans effet (verdict, « Question suivante », aucun « Modifier »)`);
    await c2.contexte.close();
  }
  void tacheId;
}

/**
 * Retour en arrière (RAPPORT §37) sur le TÉMOIN technique : les composants que le nouveau gen7 n'utilise plus (champ texte, qcm) gardent leur aller-retour exact dans le navigateur.
 * Les quatre écrans du profil « base » sont répondus par l'API (rien à prouver sur la saisie ici) ; la page s'ouvre sur le panneau « Rendre » ; pour chaque écran, le crayon rouvre
 * l'écran PRÉ-REMPLI et re-valider sans changer écrit zéro ligne (« Réponse inchangée. »).
 */
async function scenarioRetourArriereTemoin(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} retour témoin`;
  imposerProfilAssignation("base");
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const tacheId = creerTache(s, { nom: "Retour témoin", feedback_immediat: false, autoriser_retour_arriere: true, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
  verifier(a.statut === 201, `${l} : assignation ${a.statut}`);
  const ligne = s.base.table("exercices_assignes").find((x) => x.tache_id === tacheId)!;
  const ex = temoin.generer(Number(ligne.graine));
  const champs = [CHAMP_SOMME, CHAMP_PARITE, CHAMP_DIVISEURS, CHAMP_SIGNES];
  for (const champ of champs) {
    const r = await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: reponseBruteCorrecte(ex, champ) } });
    verifier(r.statut === 200, `${l} : préparation ${champ} : ${r.statut}`);
  }
  // Tout est répondu : la page s'ouvre sur le panneau « Rendre », sans écran courant (donc pas `ouvrirTacheGen7`, qui attend un écran courant).
  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, "eleve:eleve-1", "e1@x", `localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
  await page.goto(base + "/eleve.html");
  await page.waitForSelector(".carte-tache");
  await page.locator(".carte-tache").first().click();
  await page.waitForSelector(".moteur-remise");
  const courant = page.locator(".moteur-ecran-courant");
  const avant = s.base.table("reponses").length;
  for (const [i, champ] of champs.entries()) {
    await page.locator(".moteur-ecran-termine").nth(i).getByRole("button", { name: "Modifier ma réponse" }).click();
    await page.waitForFunction(`document.querySelectorAll(".moteur-ecran-courant").length === 1`);
    verifier(await courant.getByRole("button", { name: "Valider", exact: true }).isEnabled(), `${l} / ${champ} : l'écran s'ouvre pré-rempli (« Valider » actif sans rien toucher)`);
    if (champ === CHAMP_SOMME) verifier((await courant.locator(".moteur-champ").first().inputValue()) === reponseBruteCorrecte(ex, champ), `${l} : champ texte pré-rempli à l'identique`);
    if (champ === CHAMP_PARITE) verifier((await courant.locator(".moteur-choix input:checked").count()) === 1, `${l} : qcm pré-rempli (un choix coché)`);
    if (champ === CHAMP_DIVISEURS) verifier((await courant.locator(".moteur-liste-ligne .moteur-champ").count()) >= 1, `${l} : liste pré-remplie`);
    await courant.getByRole("button", { name: "Valider", exact: true }).click();
    await page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
    const message = ((await courant.locator(".moteur-retour .moteur-statut").textContent()) ?? "").replace(/\s+/g, " ").trim();
    verifier(message.includes("Réponse inchangée."), `${l} / ${champ} : re-valider sans changer = « inchangée » (« ${message} »)`);
    await courant.getByRole("button", { name: /Revoir mes réponses|Continuer/ }).click();
    await page.waitForSelector(".moteur-remise");
  }
  verifier(s.base.table("reponses").length === avant, `${l} : aller-retour exact (champ texte, qcm, liste, tableau) : AUCUNE ligne écrite (${avant} -> ${s.base.table("reponses").length})`);
  verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();
}

/**
 * PARTIES FAUSSES surlignées en rouge (RAPPORT §52), jouées dans le navigateur sur gen7 (f = x² + 3x − 4) sous correction IMMÉDIATE avec essais supplémentaires : pour chaque type de composant
 * (champs multiples texte et choix, intervalle, liste de racines, tableau), une réponse fausse sur UNE partie surligne exactement cette partie (classe + `aria-invalid` / `aria-description`),
 * modifier cette partie retire sa marque (jamais de marquage pendant la frappe) ; puis, essais épuisés, la relecture (rappel gris et écran récapitulatif) surligne le morceau faux de « Ta réponse ».
 * Sans « Afficher la réponse attendue » : le surlignage est le MÊME (il ne dépend que de la correction immédiate). Sous correction coupée : jamais, y compris à la fin (`scenarioGen7Coupe`).
 */
async function scenarioPartiesFausses(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} parties fausses`;
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const { ex } = await assignerMD(s, VARIANTE_REPERE, GRAINE_REPERE, { feedback: true, visible: false, tentatives: 3 });
  const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
  const courant = page.locator(".moteur-ecran-courant");
  const FAUSSE = ".moteur-partie-fausse";
  const valider = async () => {
    await courant.getByRole("button", { name: "Valider", exact: true }).click();
    await page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
  };
  const suite = async () => {
    const avant = (await page.evaluate(`document.querySelector(".moteur-ecran-courant .moteur-consigne").textContent`)) as string;
    await page.getByRole("button", { name: /Question suivante|Voir la fin/ }).click();
    await page.waitForFunction(`(() => { const c = document.querySelector(".moteur-ecran-courant .moteur-consigne"); return document.querySelector(".moteur-fin") !== null || (c !== null && c.textContent !== ${JSON.stringify(avant)}); })()`);
  };
  const nbMarques = () => courant.locator(FAUSSE).count();

  // 1. coefficients : champs texte (b faux) — le champ désigné, et lui seul
  await courant.locator("#mc-coefficients-a").fill("1");
  await courant.locator("#mc-coefficients-b").fill("997");
  await courant.locator("#mc-coefficients-c").fill("-4");
  verifier((await nbMarques()) === 0, `${l} / coefficients : aucune marque avant « Valider » (jamais de marquage pendant la frappe)`);
  await valider();
  verifier((await courant.locator("#mc-coefficients-b.moteur-partie-fausse").count()) === 1 && (await nbMarques()) === 1, `${l} / coefficients : seul « b » est surligné (${await nbMarques()} marque(s))`);
  verifier((await courant.locator("#mc-coefficients-b").getAttribute("aria-invalid")) === "true" && (await courant.locator("#mc-coefficients-a").getAttribute("aria-invalid")) === null, `${l} / coefficients : aria-invalid sur « b » seulement`);
  await page.screenshot({ path: join(CAPTURES, `${l}-01-coefficients.png`), fullPage: true });
  await courant.locator("#mc-coefficients-b").fill("3");
  verifier((await nbMarques()) === 0, `${l} / coefficients : modifier « b » retire sa marque`);
  await valider();
  verifier((await courant.locator(".moteur-statut-correct").count()) === 1 && (await nbMarques()) === 0, `${l} / coefficients : réponse juste, aucune marque`);
  await suite();

  // 2. allure : champs multiples à CHOIX (sens faux) — c'est l'option cochée qui est surlignée
  await courant.locator('.moteur-choix:has(input[name="mc-allure-concavite"][value="-"])').click();
  await courant.locator('.moteur-choix:has(input[name="mc-allure-positionSommet"][value="gauche"])').click();
  await valider();
  verifier((await courant.locator('.moteur-choix.moteur-partie-fausse:has(input[name="mc-allure-concavite"])').count()) === 1 && (await nbMarques()) === 1, `${l} / allure : seule l'option « Vers le bas » est surlignée`);
  verifier((await courant.locator('.moteur-choix.moteur-partie-fausse input').getAttribute("aria-invalid")) === "true", `${l} / allure : aria-invalid sur l'option surlignée`);
  await courant.locator('.moteur-choix:has(input[name="mc-allure-concavite"][value="+"])').click();
  verifier((await nbMarques()) === 0, `${l} / allure : choisir une autre option retire la marque`);
  await valider();
  await suite();

  // 3. axeSommet : x_S seul faux (axe et y_S justes)
  await courant.locator("#mc-axeSommet-axeTexte").fill("x = -3/2");
  await courant.locator("#mc-axeSommet-xS").fill("997");
  await courant.locator("#mc-axeSommet-yS").fill("-25/4");
  await valider();
  verifier((await courant.locator("#mc-axeSommet-xS.moteur-partie-fausse").count()) === 1 && (await nbMarques()) === 1, `${l} / axeSommet : seul « x_S » est surligné (${await nbMarques()})`);
  await courant.locator("#mc-axeSommet-xS").fill("-3/2");
  await valider();
  await suite();

  // 4. domaineImage : intervalle — crochet de gauche faux (borne et autre crochet justes)
  const ligne = courant.locator(".moteur-intervalle-ligne");
  const cycler = async (cote: string, voulu: string) => {
    const bouton = ligne.getByRole("button", { name: new RegExp(`Crochet de ${cote}`) });
    for (let k = 0; k < 2 && (await bouton.textContent()) !== voulu; k++) await bouton.click();
  };
  await cycler("gauche", "]"); // faux : attendu « [ »
  await ligne.getByLabel("Borne de gauche", { exact: true }).fill("-25/4");
  await ligne.getByRole("button", { name: "Borne de droite : plus l'infini" }).click();
  await cycler("droite", "[");
  await valider();
  verifier((await ligne.locator(".moteur-bouton-crochet.moteur-partie-fausse").count()) === 1 && (await nbMarques()) === 1, `${l} / domaineImage : seul le crochet de gauche est surligné (${await nbMarques()})`);
  verifier((await ligne.locator(".moteur-bouton-crochet.moteur-partie-fausse").first().getAttribute("aria-description")) === "Réponse incorrecte", `${l} / domaineImage : aria-description « Réponse incorrecte » sur le crochet`);
  await page.screenshot({ path: join(CAPTURES, `${l}-04-intervalle.png`), fullPage: true });
  await ligne.getByRole("button", { name: /Crochet de gauche/ }).click();
  verifier((await nbMarques()) === 0, `${l} / domaineImage : modifier le crochet retire sa marque`);
  await cycler("gauche", "[");
  await valider();
  await suite();

  // 5. racines : liste — la 1re valeur est fausse ; puis « Pas de racine » (bouton de mode) alors qu'il y en a
  await courant.getByRole("radio", { name: "Au moins une racine" }).click();
  await courant.locator(".moteur-liste-ligne .moteur-champ").first().fill("997");
  await courant.locator(".moteur-liste-zone > .moteur-bouton-secondaire").click();
  await courant.locator(".moteur-liste-ligne .moteur-champ").nth(1).fill("1");
  await valider();
  verifier((await courant.locator(".moteur-liste-ligne .moteur-champ.moteur-partie-fausse").count()) === 1 && (await courant.locator(".moteur-liste-ligne").nth(0).locator(FAUSSE).count()) === 1 && (await nbMarques()) === 1, `${l} / racines : seule la 1re ligne (997) est surlignée (${await nbMarques()})`);
  await courant.locator(".moteur-liste-ligne .moteur-champ").first().fill("-4");
  verifier((await nbMarques()) === 0, `${l} / racines : corriger la ligne retire sa marque`);
  await courant.getByRole("radio", { name: "Pas de racine" }).click();
  await valider();
  verifier((await courant.locator(".moteur-bouton-mode.moteur-partie-fausse").count()) === 1 && (await nbMarques()) === 1, `${l} / racines : « Pas de racine » est surligné (il y a des racines)`);
  await courant.getByRole("radio", { name: "Au moins une racine" }).click();
  verifier((await nbMarques()) === 0, `${l} / racines : changer de mode retire la marque`);
  await valider();
  await suite();

  // 6. tableauSignes : une case fausse
  await repondreMD(page, ex, "tableauSignes");
  const premiereCase = courant.locator(".moteur-ligne-tableau").first().locator("td button").first();
  await premiereCase.click(); // une valeur de plus dans le cycle : fausse
  await valider();
  verifier((await courant.locator(".moteur-case-signe.moteur-partie-fausse").count()) === 1 && (await nbMarques()) === 1, `${l} / tableau : une seule case surlignée (${await nbMarques()})`);
  verifier((await premiereCase.evaluate((e: any) => e.classList.contains("moteur-partie-fausse"))) === true, `${l} / tableau : c'est la case modifiée`);
  await page.screenshot({ path: join(CAPTURES, `${l}-06-tableau.png`), fullPage: true });
  await premiereCase.click();
  verifier((await nbMarques()) === 0, `${l} / tableau : modifier la case retire sa marque`);
  await repondreMD(page, ex, "tableauSignes");
  await valider();
  await suite();
  await page.waitForSelector(".moteur-fin");
  verifier((await page.locator(FAUSSE + ", .moteur-piece-fausse").count()) === 0, `${l} : exercice entièrement juste en fin de parcours : aucune marque nulle part`);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.waitForSelector("#tableau-de-bord:not([hidden])");
  verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();

  // ── Relecture : essais épuisés (0 essai supplémentaire), un coefficient faux (c = 0) ; la fonction de l'élève est x² + 3x ──
  for (const visible of [false, true]) {
    const lv = `${l} relecture ${visible ? "avec" : "sans"} la case`;
    const s2: Scenario = creerScenario();
    installerBase(s2.base);
    const { ex: ex2 } = await assignerMD(s2, VARIANTE_REPERE, GRAINE_REPERE, { feedback: true, visible, tentatives: 0 });
    const exEleve = projeterMotifDelta(ex2, [{ champ: "coefficients", reponseBrute: JSON.stringify({ a: "1", b: "3", c: "0" }), statut: "not_equivalent" }], { correctionImmediate: true, solutionMontree: visible });
    const c2 = await ouvrirTacheGen7(navigateur, base, largeur, s2);
    const cur = c2.page.locator(".moteur-ecran-courant");
    for (const k of ["a", "b", "c"] as const) await cur.locator(`#mc-coefficients-${k}`).fill({ a: "1", b: "3", c: "0" }[k]);
    await cur.getByRole("button", { name: "Valider", exact: true }).click();
    await c2.page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
    verifier((await cur.locator("#mc-coefficients-c.moteur-partie-fausse").count()) === 1 && (await cur.locator("#mc-coefficients-c").isDisabled()), `${lv} : essais épuisés, le champ verrouillé « c » reste surligné (${await cur.locator(FAUSSE).count()})`);
    await c2.page.getByRole("button", { name: "Question suivante" }).click();
    await c2.page.waitForFunction(`document.querySelector(".moteur-rappel-ligne-courant") !== null && document.querySelector(".moteur-question-titre").textContent === "Question 2 sur 6"`);
    const piece = c2.page.locator(".moteur-rappel .moteur-piece-fausse");
    verifier((await piece.count()) === 1 && ((await piece.innerText()) === "0"), `${lv} : le rappel gris surligne le seul morceau faux de « Ta réponse » (« ${await piece.allInnerTexts()} »)`);
    await c2.page.screenshot({ path: join(CAPTURES, `${l}-07-rappel-${visible ? "case" : "sans-case"}.png`), fullPage: true });
    if (visible) {
      await c2.contexte.close();
      continue;
    }
    // La suite du parcours (juste pour SA fonction) jusqu'à l'écran récapitulatif.
    for (const champ of ["allure", "axeSommet", "domaineImage", "racines", "tableauSignes"]) {
      await repondreMD(c2.page, exEleve, champ);
      await validerEtSuivreGen7(c2.page);
    }
    await c2.page.waitForSelector(".moteur-fin");
    const pieces = c2.page.locator(".moteur-ecran-termine .moteur-piece-fausse");
    verifier((await pieces.count()) === 1 && ((await pieces.innerText()) === "0") && (await c2.page.locator(".moteur-ecran-termine").nth(0).locator(".moteur-piece-fausse").count()) === 1, `${lv} : l'écran récapitulatif surligne ce même morceau, dans la 1re carte seulement (${await pieces.count()})`);
    verifier((await c2.page.locator(".moteur-ecran-termine .moteur-etiquette", { hasText: "Ta réponse" }).first().evaluate((e: any) => e.classList.contains("moteur-piece-fausse"))) === false, `${lv} : l'étiquette « Ta réponse : » n'est jamais surlignée`);
    await c2.page.screenshot({ path: join(CAPTURES, `${l}-08-recapitulatif.png`), fullPage: true });
    await c2.contexte.close();
  }
}

/**
 * PARTIES FAUSSES sur le TÉMOIN (RAPPORT §52) : le champ texte et le QCM, que gen7 n'utilise plus, gardent leur marquage dans le navigateur. (1) Avec essais supplémentaires : la réponse
 * fausse surligne le champ / l'option cochée (classe + aria), la modifier retire la marque. (2) Sans essai : le champ verrouillé reste surligné, puis le RAPPORT gris surligne les morceaux
 * faux de « Ta réponse » (texte brut pour le champ, libellé d'auteur pour l'option).
 */
async function scenarioPartiesFaussesTemoin(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} parties fausses témoin`;
  const FAUSSE = ".moteur-partie-fausse";
  for (const tentatives of [2, 0]) {
    imposerProfilAssignation("base");
    const s: Scenario = creerScenario();
    installerBase(s.base);
    const tacheId = creerTache(s, { nom: "Parties fausses témoin", feedback_immediat: true, tentatives_supplementaires: tentatives, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
    const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
    verifier(a.statut === 201, `${l} : assignation ${a.statut}`);
    const ex = temoin.generer(Number(s.base.table("exercices_assignes")[0]!.graine));
    const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
    const courant = page.locator(".moteur-ecran-courant");
    const valider = async () => {
      await courant.getByRole("button", { name: "Valider", exact: true }).click();
      await page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
    };
    const suivante = async () => {
      const avant = (await page.evaluate(`document.querySelector(".moteur-ecran-courant .moteur-consigne").textContent`)) as string;
      await page.getByRole("button", { name: /Question suivante/ }).click();
      await page.waitForFunction(`document.querySelector(".moteur-ecran-courant .moteur-consigne").textContent !== ${JSON.stringify(avant)}`);
    };
    const e = `${l} (${tentatives} essai${tentatives > 1 ? "s" : ""} en plus)`;

    // Écran 1 : champ texte (somme) faux
    await courant.locator(".moteur-champ").fill(String(ex.a + ex.b + 1));
    await valider();
    verifier((await courant.locator(".moteur-champ.moteur-partie-fausse").count()) === 1 && (await courant.locator(".moteur-champ").getAttribute("aria-invalid")) === "true", `${e} / somme : le champ texte est surligné (aria-invalid)`);
    if (tentatives > 0) {
      await courant.locator(".moteur-champ").fill(String(ex.a + ex.b));
      verifier((await courant.locator(FAUSSE).count()) === 0, `${e} / somme : modifier le texte retire la marque`);
      await valider();
    }
    await suivante();

    // Écran 2 : QCM (parité) — l'option « ni l'un ni l'autre » est fausse dans tous les cas
    await courant.locator('.moteur-choix:has(input[value="ni"])').click();
    await valider();
    verifier((await courant.locator(".moteur-choix.moteur-partie-fausse").count()) === 1 && (await courant.locator('.moteur-choix.moteur-partie-fausse input[value="ni"]').count()) === 1, `${e} / parité : seule l'option cochée est surlignée`);
    if (tentatives > 0) {
      await courant.locator('.moteur-choix:has(input[value="pair"])').click();
      verifier((await courant.locator(FAUSSE).count()) === 0, `${e} / parité : choisir une autre option retire la marque`);
      await courant.locator('.moteur-choix:has(input[value="' + ((ex.a + ex.b) % 2 === 0 ? "pair" : "impair") + '"])').click();
      await valider();
    }
    await suivante();

    if (tentatives === 0) {
      // Relecture : le rappel gris surligne les morceaux faux de « Ta réponse » (texte d'élève ; libellé d'auteur d'une option)
      const pieces: string[] = await page.locator(".moteur-rappel .moteur-piece-fausse").allInnerTexts();
      verifier(pieces.length === 2 && pieces[0] === String(ex.a + ex.b + 1), `${e} : le rappel gris surligne la somme fausse ET l'option fausse (${JSON.stringify(pieces)})`);
      verifier((await page.locator(".moteur-rappel .moteur-piece-fausse").first().evaluate((el: any) => getComputedStyle(el).textDecorationLine)) === "underline", `${e} : morceau faux souligné (la couleur ne suffit pas)`);
      await page.screenshot({ path: join(CAPTURES, `${l}-rappel.png`), fullPage: true });
    }
    verifier(journal.pageerrors.length === 0, `${e} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
    await contexte.close();
  }
}

/**
 * « Réponse attendue » dessinée (RAPPORT §53) sur le TÉMOIN (deux tableaux structurés consécutifs) : un tableau de signes faux sous « Afficher la réponse attendue » → le tableau rempli s'affiche sous
 * « Valider », PUIS reste dans le rappel gris de l'écran suivant (chemin `ligneFaite`, inaccessible avec gen7 dont le tableau est le dernier écran). Sans la case : jamais de tableau.
 */
async function scenarioSolutionTableauTemoin(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} solution tableau témoin`;
  for (const visible of [true, false]) {
    imposerProfilAssignation("etendu");
    const s: Scenario = creerScenario();
    installerBase(s.base);
    const tacheId = creerTache(s, { nom: "Solution tableau témoin", feedback_immediat: true, reponse_visible: visible, tentatives_supplementaires: 0, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
    const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
    verifier(a.statut === 201, `${l} : assignation ${a.statut}`);
    const ligne = s.base.table("exercices_assignes")[0]!;
    const graine = graineDeProfil("etendu", 0, { large: true });
    ligne.graine = graine;
    const ex = genE(graine);
    for (const champ of [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_EXTREMUM, CHAMP_AXE, CHAMP_IMAGE, CHAMP_RACINES]) {
      const r = await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: reponseBruteCorrecte(U(ex), champ) } });
      verifier(r.statut === 200, `${l} : préparation ${champ} : ${r.statut}`);
    }
    const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
    const courant = page.locator(".moteur-ecran-courant");
    const e = `${l} (réponse attendue ${visible ? "affichée" : "NON affichée"})`;
    await page.waitForSelector(".moteur-ecran-courant .moteur-table-signes");
    const cases = courant.locator(".moteur-ligne-tableau td button");
    const n = await cases.count();
    for (let k = 0; k < n; k++) await cases.nth(k).click();
    await courant.getByRole("button", { name: "Valider", exact: true }).click();
    await page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
    if (visible) {
      await page.waitForSelector(".moteur-retour .moteur-tableau-solution");
      const attendu = JSON.parse(reponseBruteCorrecte(U(ex), CHAMP_SIGNES_VARIATION)) as Record<string, Record<string, string>>;
      const nbAttendu = Object.values(attendu).reduce((t, c) => t + Object.keys(c).length, 0);
      const vus = (await page.evaluate(`[...document.querySelectorAll(".moteur-retour .moteur-tableau-solution .moteur-case-signe")].map((b) => b.getAttribute("aria-label"))`)) as string[];
      verifier(vus.length === nbAttendu && vus.every((v) => !v.includes("vide") && !v.includes("Toucher")), `${e} : tableau rempli et en lecture seule sous « Valider » (${vus.length} cases attendues ${nbAttendu})`);
      const valeursSolution = Object.values(attendu).flatMap((c) => Object.values(c)).filter((v) => !["↗", "↘"].includes(v)).map((v) => (v === "-" ? "moins" : v));
      verifier(valeursSolution.length > 0, `${e} : (sanité) la solution contient des valeurs`);
      await page.screenshot({ path: join(CAPTURES, `${l}-${visible ? "visible" : "masquee"}-direct.png`), fullPage: true });
      await page.getByRole("button", { name: /Question suivante/ }).click();
      await page.waitForFunction(`document.querySelectorAll(".moteur-rappel .moteur-tableau-solution").length === 1`);
      const dansRappel = (await page.evaluate(`(() => { const t = document.querySelector(".moteur-rappel .moteur-rappel-ligne .moteur-tableau-solution"); const p = document.querySelector(".moteur-rappel").getBoundingClientRect(), r = t.getBoundingClientRect(); return { dedans: r.left >= p.left - 0.5 && r.right <= p.right + 0.5, debordePage: document.documentElement.scrollWidth > window.innerWidth, lignes: document.querySelectorAll(".moteur-rappel .moteur-tableau-solution").length }; })()`)) as { dedans: boolean; debordePage: boolean; lignes: number };
      verifier(dansRappel.dedans && !dansRappel.debordePage && dansRappel.lignes === 1, `${e} : dans le rappel gris le tableau rempli reste DANS le panneau, sans défilement horizontal (${JSON.stringify(dansRappel)})`);
      await page.screenshot({ path: join(CAPTURES, `${l}-rappel.png`), fullPage: true });
    } else {
      verifier((await page.locator(".moteur-tableau-solution").count()) === 0 && (await courant.locator(".moteur-retour .moteur-solution").count()) === 0, `${e} : ni tableau ni phrase de solution (case décochée)`);
    }
    verifier(journal.pageerrors.length === 0, `${e} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
    await contexte.close();
  }
}

/**
 * « Aperçu » d'une tâche AVEC retour en arrière (RAPPORT §39) : le professeur décoche la correction immédiate, coche « Autoriser le retour en
 * arrière », clique « Aperçu » ; dans l'onglet élève, après une réponse, l'écran reste modifiable (« Modifier ma réponse ») et rien n'est corrigé.
 * Sans la case cochée : comportement d'origine (« Question suivante »).
 */
async function scenarioApercuRetour(navigateur: any, base: string, largeur: number) {
  for (const retour of [true, false]) {
    const l = `${largeur} aperçu ${retour ? "avec" : "sans"} retour`;
    const s: Scenario = creerScenario();
    installerBase(s.base);
    const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, `prof:${s.profId}`, "p@x");
    await contexte.route("**/unpkg.com/@supabase/supabase-js**", (r: any) => r.fulfill({ contentType: "text/javascript", body: stubSupabase(`prof:${s.profId}`, "p@x") }));
    await contexte.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
    await contexte.route("**/fonts.gstatic.com/**", (r: any) => r.abort());
    await page.goto(base + "/prof.html");
    await page.waitForSelector('button[data-onglet="taches"]:visible');
    await page.locator('button[data-onglet="taches"]').click();
    await page.locator("#bouton-accordeon-creer").click();
    await page.waitForSelector("#composition-dynamique input.stepper-valeur", { state: "attached" });
    await page.evaluate(`(() => { const i = document.querySelector('#composition-dynamique input[data-variante-id="af_motif_racine_double_rationnelle"]'); i.value = "1"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()`);
    // La case « retour en arrière » est visible mais GRISÉE tant que la correction immédiate est cochée.
    verifier(await page.locator("#autoriser-retour-arriere").isDisabled(), `${l} : case grisée sous correction immédiate`);
    await page.locator("#feedback-immediat").uncheck({ force: true });
    verifier(await page.locator("#autoriser-retour-arriere").isEnabled(), `${l} : case active une fois la correction immédiate décochée`);
    if (retour) await page.locator("#autoriser-retour-arriere").check({ force: true });
    await page.locator("#autoriser-retour-arriere").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(CAPTURES, `${largeur}-apercu-retour-${retour ? "avec" : "sans"}-formulaire.png`), fullPage: false });
    const [popup] = await Promise.all([contexte.waitForEvent("page"), page.locator("#btn-apercu-tache").click()]);
    popup.on("pageerror", (e: Error) => journal.pageerrors.push("aperçu : " + e.message));
    popup.on("response", (r: any) => { if (r.status() >= 400) journal.reponsesEnErreur.push({ statut: r.status(), methode: r.request().method(), url: new URL(r.url()).pathname }); });
    await popup.waitForSelector("#bandeau-mode-apercu:not([hidden])");
    await popup.waitForSelector(".moteur-ecran-courant");
    const bandeau = await popup.locator("#bandeau-reglages-apercu").innerText();
    verifier(bandeau.includes("correction immédiate coupée") && bandeau.includes(retour ? "retour en arrière activé" : "retour en arrière désactivé (case"), `${l} : le bandeau de l'aperçu annonce les réglages effectifs (« ${bandeau} »)`);
    const tache = s.base.table("taches")[0]!;
    verifier(tache.est_apercu === true && tache.feedback_immediat === false && tache.autoriser_retour_arriere === retour, `${l} : la tâche d'aperçu reprend le formulaire (retour = ${String(tache.autoriser_retour_arriere)})`);
    const premier = s.base.table("exercices_assignes")[0]!;
    const ex = genererExerciceMD("af_motif_racine_double_rationnelle", Number(premier.graine));
    await repondreMD(popup, ex, "coefficients");
    await popup.locator(".moteur-ecran-courant").getByRole("button", { name: "Valider", exact: true }).click();
    await popup.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
    if (retour) {
      await popup.getByRole("button", { name: "Écran suivant" }).click();
      // RAPPORT §43 : l'écran répondu est une ligne du rappel (marque neutre sous correction coupée) portant « Modifier ma réponse ».
      await popup.waitForFunction(`document.querySelectorAll(".moteur-rappel-ligne-neutre").length === 1`);
      verifier((await popup.getByRole("button", { name: "Modifier ma réponse" }).count()) === 1, `${l} : dans l'aperçu, l'écran répondu propose « Modifier ma réponse »`);
      await popup.screenshot({ path: join(CAPTURES, `${largeur}-apercu-retour-modifier.png`), fullPage: true });
    } else {
      verifier((await popup.getByRole("button", { name: "Question suivante" }).count()) === 1 && (await popup.getByRole("button", { name: /Modifier ma réponse/ }).count()) === 0, `${l} : sans le réglage, comportement d'origine`);
    }
    verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
    await contexte.close();
  }
}

/**
 * Écran « chaîne de transformations » (RAPPORT §56) sur le TÉMOIN (profil `graphe`) : étapes ajoutées / retirées dans les bornes, « Valider » inactif tant qu'une étape est incomplète,
 * réponse envoyée = UNE chaîne JSON exacte, parties fausses par étape (retirées dès qu'on modifie l'étape), restauration sans altération (retour en arrière), relecture.
 */
async function scenarioChaineTransformations(navigateur: any, base: string, largeur: number) {
  for (const tentatives of [2, 0]) {
    const l = `${largeur} chaîne (${tentatives} essai${tentatives > 1 ? "s" : ""} en plus)`;
    imposerProfilAssignation("graphe");
    const s: Scenario = creerScenario();
    installerBase(s.base);
    const tacheId = creerTache(s, { nom: "Chaîne", feedback_immediat: true, tentatives_supplementaires: tentatives, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
    const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
    verifier(a.statut === 201, `${l} : assignation ${a.statut}`);
    const ex = temoin.generer(Number(s.base.table("exercices_assignes")[0]!.graine));
    const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
    const courant = page.locator(".moteur-ecran-courant");
    const valider = courant.getByRole("button", { name: "Valider", exact: true });
    // Écran 1 (courbe) : réponse juste, puis écran suivant.
    await courant.locator(".moteur-champ").fill(reponseBruteCorrecte(ex, CHAMP_COURBE));
    await valider.click();
    await page.waitForSelector(".moteur-statut-correct");
    await page.getByRole("button", { name: /Question suivante/ }).click();
    await page.waitForSelector(".moteur-chaine");
    const etapes = courant.locator(".moteur-chaine-etape");
    const ajouter = courant.getByRole("button", { name: "Ajouter une étape" });
    const retirer = courant.getByRole("button", { name: "Retirer la dernière étape" });
    verifier((await etapes.count()) === 1 && (await retirer.isDisabled()) && (await valider.isDisabled()), `${l} : une étape au départ ; ni retrait ni validation possibles`);
    verifier((await courant.locator(".moteur-chaine-choix").first().locator(".moteur-choix").count()) === 5, `${l} : le menu a toujours cinq transformations`);
    for (let k = 0; k < 4; k++) await ajouter.click();
    verifier((await etapes.count()) === 5 && (await ajouter.isDisabled()), `${l} : cinq étapes au plus (« Ajouter » désactivé)`);
    for (let k = 0; k < 3; k++) await retirer.click();
    verifier((await etapes.count()) === 2 && (await ajouter.isEnabled()), `${l} : retrait de la dernière étape`);
    // Étape incomplète : pas de validation.
    await etapes.nth(0).locator(".moteur-champ").fill("(x-1)^2");
    await etapes.nth(0).locator('.moteur-choix:has(input[value="TH"])').click();
    await etapes.nth(1).locator(".moteur-champ").fill("(x-1)^2+1");
    verifier(await valider.isDisabled(), `${l} : une étape sans transformation : « Valider » reste inactif`);
    await etapes.nth(1).locator('.moteur-choix:has(input[value="EV"])').click(); // fausse : TV attendue
    verifier(await valider.isEnabled(), `${l} : toutes les étapes complètes : « Valider » actif`);
    const avantEnvoi = reponsesEnvoyees(journal);
    await valider.click();
    await page.waitForSelector(".moteur-retour .moteur-statut");
    verifier(reponsesEnvoyees(journal) === avantEnvoi + 1, `${l} : une seule requête pour la validation (étapes et frappes restent locales)`);
    const envoye = JSON.parse(journal.requetes.filter((r: any) => r.methode === "POST" && r.url.endsWith("/api/reponses")).slice(-1)[0].corps ?? "{}");
    verifier(Object.keys(envoye).sort().join() === "champ,exercice_assigne_id,reponse_brute" && envoye.reponse_brute === '{"etapes":[{"expression":"(x-1)^2","transformation":"TH"},{"expression":"(x-1)^2+1","transformation":"EV"}]}', `${l} : réponse envoyée = UNE chaîne JSON exacte (${envoye.reponse_brute})`);
    verifier((await courant.locator(".moteur-statut-not_equivalent").count()) === 1, `${l} : verdict négatif`);
    // Restauration sans altération (retour en arrière) : le composant relit sa propre réponse et la reproduit à l'identique.
    const restaure = await page.evaluate(`(async () => { const { COMPOSANTS_ECRAN } = await import("/moteur/ecrans/index.js"); const ecran = { champ: "chaine", type: "chaine_transformations", choix: ${JSON.stringify(["TH", "TV", "EV", "CV", "SOX"].map((id) => ({ id, libelle: id })))}, etapesMin: 1, etapesMax: 5, depart: "x", consigne: "c" }; const brute = ${JSON.stringify(envoye.reponse_brute)}; const v = COMPOSANTS_ECRAN.chaine_transformations.creer(ecran, { surSoumission() {}, surChangement() {}, valeurInitiale: brute }); return v.lireReponse() === brute; })()`);
    verifier(restaure === true, `${l} : valeurInitiale restaurée SANS altération`);
    if (tentatives > 0) {
      verifier((await courant.locator(".moteur-chaine-etape input.moteur-partie-fausse").count()) === 1 && (await etapes.nth(1).locator("input.moteur-champ").getAttribute("aria-invalid")) === "true" && (await etapes.nth(0).locator("input.moteur-champ").getAttribute("aria-invalid")) === null, `${l} : seule l'étape 2 est marquée fausse (aria-invalid)`);
      verifier((await etapes.nth(1).locator(".moteur-choix.moteur-partie-fausse").count()) === 1 && (await etapes.nth(0).locator(".moteur-choix.moteur-partie-fausse").count()) === 0, `${l} : la transformation choisie à l'étape 2 est marquée`);
      await etapes.nth(1).locator('.moteur-choix:has(input[value="TV"])').click();
      verifier((await courant.locator(".moteur-partie-fausse").count()) === 0, `${l} : modifier l'étape retire sa marque`);
      await valider.click();
      await page.waitForSelector(".moteur-statut-correct");
      verifier((await courant.locator(".moteur-chaine-etape input").first().isDisabled()) && (await ajouter.isDisabled()) && (await retirer.isDisabled()), `${l} : après la réussite, tout est verrouillé`);
    } else {
      // Plus d'essai : verrouillé, relecture avec l'étape fausse surlignée.
      await page.getByRole("button", { name: /Voir la fin/ }).click();
      await page.waitForSelector(".moteur-ecran-termine");
      const pieces: string[] = await page.locator(".moteur-ecran-termine .moteur-piece-fausse").allInnerTexts();
      verifier(pieces.length === 1 && pieces[0] === "(x-1)^2+1 (EV)", `${l} : relecture : l'étape 2 est surlignée (${JSON.stringify(pieces)})`);
      verifier((await page.locator(".moteur-ecran-termine .moteur-reponse-eleve").last().innerText()).includes("(x-1)^2 (TH) ; (x-1)^2+1 (EV)"), `${l} : relecture : « Ta réponse » en texte d'élève`);
    }
    await page.screenshot({ path: join(CAPTURES, `${l.replace(/[ ()]/g, "-")}.png`), fullPage: true });
    verifier(!(await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")), `${l} : pas de défilement horizontal`);
    verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
    await contexte.close();
  }
  imposerProfilAssignation("aleatoire");
}

/**
 * Graphique d'écran et aide PAR PALIERS (RAPPORT §56) sur le TÉMOIN (profil `graphe`) : le graphique est servi sans annotation ; l'aide à deux paliers pose S puis A et les vecteurs SUR ce
 * graphique ; recharger la page efface les annotations (état local) et « Revoir l'indice » rejoue le palier ATTEINT sans nouvelle pénalité ; en relecture le graphique reste, sans annotation.
 */
async function scenarioFigureAidePaliers(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} figure aide paliers`;
  imposerProfilAssignation("graphe");
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const tacheId = creerTache(s, { nom: "Figure et paliers", aide_activee: true, aide_penalite_pourcent: 25, reponse_visible: true, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] });
  const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
  verifier(a.statut === 201, `${l} : assignation ${a.statut}`);
  const ligne = s.base.table("exercices_assignes")[0]!;
  const ex = temoin.generer(Number(ligne.graine));
  const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
  const courant = page.locator(".moteur-ecran-courant");
  const SVG = ".moteur-ecran-courant .figure-svg";
  await page.waitForSelector(SVG);
  verifier((await page.locator(`${SVG} .figure-annotations > *`).count()) === 0 && (await page.locator(".moteur-aide-texte").isHidden()), `${l} : graphique sans annotation, zone d'aide fermée`);
  const demander = async () => {
    const bouton = courant.locator(".moteur-aide button");
    await bouton.click();
    if ((await bouton.innerText()).startsWith("Confirmer")) await bouton.click();
  };
  await demander();
  await page.waitForSelector(`${SVG} .figure-point-annote`, { state: "attached" });
  verifier((await page.locator(`${SVG} .figure-point-annote`).count()) === 1, `${l} : palier 1 : S sur le graphique`);
  await courant.locator(".moteur-aide button").click();
  await page.waitForSelector(`${SVG} .figure-vecteur`, { state: "attached" });
  verifier((await page.locator(`${SVG} .figure-point-annote`).count()) === 2 && (await page.locator(`${SVG} .figure-vecteur`).count()) === 2, `${l} : palier 2 : A et deux vecteurs en plus de S`);
  verifier(journal.requetes.filter((r: any) => r.url.endsWith("/api/reponses/aide")).map((r: any) => JSON.parse(r.corps ?? "{}").palier).join() === ",2", `${l} : première demande SANS palier (le serveur choisit), la suivante palier 2 (${journal.requetes.filter((r: any) => r.url.endsWith("/api/reponses/aide")).map((r: any) => r.corps).join(" | ")})`);
  // Rechargement : les annotations sont un état local, elles disparaissent ; « Revoir l'indice » rejoue le palier atteint (2), gratuitement.
  await page.reload();
  await page.waitForSelector(".carte-tache");
  await page.locator(".carte-tache").click();
  await page.waitForSelector(SVG);
  verifier((await page.locator(`${SVG} .figure-annotations > *`).count()) === 0, `${l} : après rechargement, aucune annotation (état local)`);
  verifier(/Revoir l'indice/.test(await courant.locator(".moteur-aide button").innerText()), `${l} : « Revoir l'indice » proposé (l'usage est enregistré côté serveur)`);
  await courant.locator(".moteur-aide button").click();
  await page.waitForSelector(`${SVG} .figure-vecteur`, { state: "attached" });
  verifier((await page.locator(`${SVG} .figure-point-annote`).count()) === 2 && (await courant.locator(".moteur-aide button:visible").count()) === 0, `${l} : « Revoir » rejoue le palier ATTEINT (2) ; plus d'indice à proposer`);
  verifier(s.base.table("aides_utilisees").length === 1 && s.base.table("aides_utilisees")[0]!.palier === 2, `${l} : une seule ligne d'usage, palier 2`);
  // Réponse juste.
  await courant.locator(".moteur-champ").fill(reponseBruteCorrecte(ex, CHAMP_COURBE));
  await courant.getByRole("button", { name: "Valider", exact: true }).click();
  await page.waitForSelector(".moteur-statut-correct");
  await page.screenshot({ path: join(CAPTURES, `${l}-reponse.png`), fullPage: true });
  // Écran suivant (la chaîne) : la MÊME figure, SANS les annotations de l'écran 1 (l'aide est par écran) ; puis fin de l'exercice.
  await page.getByRole("button", { name: /Question suivante/ }).click();
  await page.waitForSelector(".moteur-chaine");
  verifier((await page.locator(`${SVG}`).count()) === 1 && (await page.locator(`${SVG} .figure-annotations > *`).count()) === 0, `${l} : écran suivant : même graphique, sans annotation`);
  const etapes = courant.locator(".moteur-chaine-etape");
  await courant.getByRole("button", { name: "Ajouter une étape" }).click();
  await etapes.nth(0).locator(".moteur-champ").fill("(x-1)^2");
  await etapes.nth(0).locator('.moteur-choix:has(input[value="TH"])').click();
  await etapes.nth(1).locator(".moteur-champ").fill("(x-1)^2+1");
  await etapes.nth(1).locator('.moteur-choix:has(input[value="TV"])').click();
  await courant.getByRole("button", { name: "Valider", exact: true }).click();
  await page.waitForSelector(".moteur-statut-correct");
  await page.getByRole("button", { name: /Voir la fin/ }).click();
  await page.waitForSelector(".moteur-ecran-termine");
  verifier((await page.locator(".moteur-ecran-termine .figure-svg").count()) === 2 && (await page.locator(".moteur-ecran-termine .figure-annotations > *").count()) === 0, `${l} : relecture : le graphique reste sous chaque énoncé, sans annotation`);
  verifier(!(await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")), `${l} : pas de défilement horizontal`);
  verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();
  imposerProfilAssignation("aleatoire");
}

/**
 * Configuration PAR LIGNE de composition (RAPPORT §55) dans le formulaire du professeur, avec le générateur de TEST à configuration (scripts/support/generateurConfigurable.ts) :
 * il n'est ni dans le catalogue réel ni dans l'arbre JSON, donc injecté ici au registre/catalogue du serveur ET dans la page (arbre JSON + table de correspondance, par interception).
 * Vérifie : lignes ajoutées/retirées, nouvelle ligne VIDE (jamais pré-cochée), message et bouton « Créer » désactivé, cases exclusives, doublons signalés, envoi et stockage de la
 * configuration, restauration par liste ordonnée (Modifier / Dupliquer), aucun champ gen7 touché.
 */
async function scenarioConfigurationLigne(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} config ligne`;
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const retirer = injecterGenerateurConfigurable();
  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, `prof:${s.profId}`, "p@x");
  // Arbre JSON et correspondance : un générateur « 999 » de test au niveau 5e_4h, relié à la variante injectée.
  await page.route("**/catalogue-generateurs-complet.json", async (route: any) => {
    const reponse = await route.fetch();
    const json = await reponse.json();
    // Niveau « 5e_4h » : son regroupement suit le champ du JSON (le niveau « 4e » est rangé par une table de numéros qui ignorerait ce générateur de test).
    json["5e_4h"].push({ ...json["5e_4h"][0], numero: 999, libelle: "999. Générateur configurable (test)", variantes: [{ axe: "variante", label: "Variante configurable (test)", exemple: "Exemple de test." }] });
    await route.fulfill({ response: reponse, json });
  });
  await page.route("**/prof.html", async (route: any) => {
    const reponse = await route.fetch();
    const texte = (await reponse.text()).replace("const CORRESPONDANCE_JSON_VERS_PILOTE = {", `const CORRESPONDANCE_JSON_VERS_PILOTE = { "5e_4h:999": [{ index: 0, variante_id: "${VARIANTE_CONFIGURABLE}" }],`);
    await route.fulfill({ response: reponse, body: texte });
  });
  await page.goto(base + "/prof.html");
  await page.waitForSelector('button[data-onglet="taches"]:visible');
  await page.locator('button[data-onglet="taches"]').click();
  await page.locator("#bouton-accordeon-creer").click();
  await page.waitForSelector("#composition-dynamique input.stepper-valeur", { state: "attached" });
  await page.evaluate("document.querySelectorAll('#composition-dynamique details').forEach((d) => { d.open = true; })");
  const bloc = `#composition-dynamique [data-config-variante-id="${VARIANTE_CONFIGURABLE}"]`;
  verifier((await page.locator(bloc).count()) === 1 && (await page.locator(`${bloc} .ligne-config`).count()) === 0, `${l} : la variante à configuration est un BLOC de lignes, sans ligne au départ`);
  verifier((await page.locator(`${bloc} input[data-variante-id]`).count()) === 0, `${l} : aucun champ « nombre d'exercices » unique pour cette variante`);
  // gen7 : toujours un champ unique, non désactivé (discipline de câblage).
  verifier((await page.locator('#composition-dynamique input[data-variante-id="af_motif_racine_nulle_rationnelle"]').count()) === 1, `${l} : gen7 garde son champ unique`);
  await page.locator("#nom-tache").fill("Tâche configurée");

  // Nouvelle ligne : VIDE, jamais pré-cochée ; « Créer » refusé tant qu'une ligne demandée est vide.
  await page.locator(`${bloc} .ajouter-ligne-config`).click();
  await page.locator(`${bloc} .ajouter-ligne-config`).click();
  const lignes = page.locator(`${bloc} .ligne-config`);
  verifier((await lignes.count()) === 2, `${l} : deux lignes ajoutées`);
  verifier((await page.locator(`${bloc} input[data-case-id]:checked`).count()) === 0, `${l} : une nouvelle ligne naît VIDE (aucune case pré-cochée)`);
  verifier((await lignes.nth(0).locator("input[data-variante-id]").inputValue()) === "1", `${l} : une nouvelle ligne demande 1 exercice`);
  verifier((await page.locator(`${bloc} .message-config:visible`).count()) === 2 && (await page.locator(`${bloc} .message-config`).first().innerText()).trim() === "Sélectionnez au moins une case pour cette ligne.", `${l} : message explicite sous chaque ligne vide`);
  verifier(await page.locator("#btn-creer-tache").isDisabled(), `${l} : « Créer » désactivé tant qu'une ligne demandée n'a aucune case`);

  const cocher = async (ligne: number, id: string) => lignes.nth(ligne).locator(`.case-config:has(input[data-case-id="${id}"])`).click();
  await cocher(0, "A");
  await cocher(0, "B");
  verifier((await page.locator(`${bloc} .message-config:visible`).count()) === 1, `${l} : le message disparaît quand une case est cochée (reste sur l'autre ligne)`);
  // Cases exclusives B / C : cocher C décoche B.
  await cocher(1, "B");
  await cocher(1, "C");
  verifier(!(await lignes.nth(1).locator('input[data-case-id="B"]').isChecked()) && (await lignes.nth(1).locator('input[data-case-id="C"]').isChecked()), `${l} : cases exclusives (cocher C décoche B)`);
  verifier(await page.locator("#btn-creer-tache").isEnabled(), `${l} : « Créer » actif quand chaque ligne demandée a une case`);
  // Doublon signalé : ligne 2 devient A + C ... puis identique à la ligne 1 (A + B).
  await cocher(1, "A");
  await cocher(1, "B");
  verifier((await page.locator(`${bloc} .note-doublon-config:visible`).count()) === 2, `${l} : deux lignes identiques : note de fusion sur les deux`);
  await cocher(1, "C");
  verifier((await page.locator(`${bloc} .note-doublon-config:visible`).count()) === 0, `${l} : lignes différentes : plus de note`);
  // Libellé de sélection (onglet « Sélection ») : la configuration y figure.
  await page.locator('.onglet-composition[data-vue-composition="selection"]').click();
  const selection = await page.locator("#composition-selection-contenu").innerText();
  verifier(selection.includes("[Case A, Case B]") && selection.includes("[Case A, Case C]"), `${l} : la vue Sélection distingue les deux lignes par leur configuration (${selection.replace(/\n/g, " | ").slice(0, 160)})`);
  await page.locator('.onglet-composition[data-vue-composition="parcourir"]').click();
  await lignes.nth(1).locator("input[data-variante-id]").fill("3");
  await page.screenshot({ path: join(CAPTURES, `${largeur}-config-ligne-formulaire.png`), fullPage: false });
  verifier(!(await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")), `${l} : pas de défilement horizontal de la page`);

  // Envoi : la configuration part avec chaque ligne, stockée CANONIQUE.
  await page.locator("#btn-creer-tache").click();
  await page.waitForFunction(`document.getElementById("nom-tache").value === ""`);
  const composition = s.base.table("taches_composition");
  verifier(composition.length === 2 && composition.every((c) => c.variante_id === VARIANTE_CONFIGURABLE), `${l} : deux lignes de composition créées (${composition.length})`);
  verifier(JSON.stringify(composition.map((c) => c.configuration)) === '[{"actives":["A","B"]},{"actives":["A","C"]}]' && JSON.stringify(composition.map((c) => c.nombre_exercices)) === "[1,3]", `${l} : configurations et nombres stockés (${JSON.stringify(composition.map((c) => [c.configuration, c.nombre_exercices]))})`);
  verifier((await page.locator(`${bloc} .ligne-config`).count()) === 0, `${l} : après création le formulaire repart SANS ligne`);

  // Restauration (Modifier / Dupliquer) par liste ordonnée, depuis ce que renvoie GET /api/taches.
  const restaure = composition.map((c) => ({ variante_id: c.variante_id, nombre_exercices: c.nombre_exercices, chrono_duree_secondes: c.chrono_duree_secondes ?? null, configuration: c.configuration, id: c.id }));
  await page.evaluate(`remplirFormulaireComposition(${JSON.stringify(restaure)})`);
  const etat = await page.evaluate(`[...document.querySelectorAll('#composition-dynamique .ligne-config')].map((l) => ({ cases: [...l.querySelectorAll('input[data-case-id]:checked')].map((c) => c.dataset.caseId), n: l.querySelector('input[data-variante-id]').value }))`);
  verifier(JSON.stringify(etat) === '[{"cases":["A","B"],"n":"1"},{"cases":["A","C"],"n":"3"}]', `${l} : restauration des deux lignes dans l'ordre (${JSON.stringify(etat)})`);
  await page.evaluate("remplirFormulaireComposition([])");
  verifier((await page.locator(`${bloc} .ligne-config`).count()) === 0, `${l} : restaurer une composition vide retire les lignes`);
  // Retirer une ligne.
  await page.locator(`${bloc} .ajouter-ligne-config`).click();
  await page.locator(`${bloc} .retirer-ligne-config`).click();
  verifier((await page.locator(`${bloc} .ligne-config`).count()) === 0, `${l} : « Retirer la ligne »`);

  verifier(journal.pageerrors.length === 0, `${l} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  retirer();
  await contexte.close();
}

/** Le professeur COMPOSE une tâche gen7 dans prof.html (champs actifs, création réelle), puis l'assigne ; l'élève la reçoit. */
async function scenarioGen7Prof(navigateur: any, base: string, largeur: number) {
  const l = `${largeur}`;
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, `prof:${s.profId}`, "p@x");
  await page.goto(base + "/prof.html");
  await page.waitForSelector('button[data-onglet="taches"]:visible');
  await page.locator('button[data-onglet="taches"]').click();
  await page.locator("#bouton-accordeon-creer").click();
  await page.waitForSelector("#composition-dynamique input.stepper-valeur", { state: "attached" });
  // Discipline de câblage (CLAUDE.md) : les DIX variantes ont leur champ « nombre d'exercices » ET il n'est pas `disabled` (CORRESPONDANCE_JSON_VERS_PILOTE) ; les 4 anciennes n'existent plus dans l'arbre.
  const variantes: string[] = FAMILLES.map((f) => f.id);
  const retirees = ["af_mise_en_evidence", "af_binome_conjugue", "af_produit_remarquable", "af_irreductible"];
  const etat = (await page.evaluate(`(${JSON.stringify([...variantes, ...retirees])}).map((v) => { const i = document.querySelector('#composition-dynamique input[data-variante-id="' + v + '"]'); return i ? { v, desactive: i.disabled } : { v, absent: true }; })`)) as { v: string; desactive?: boolean; absent?: boolean }[];
  verifier(etat.filter((e) => variantes.includes(e.v)).every((e) => !e.absent && e.desactive === false), `${l} prof gen7 : les 10 champs « nombre d'exercices » existent et ne sont PAS disabled (${JSON.stringify(etat.filter((e) => variantes.includes(e.v)))})`);
  verifier(etat.filter((e) => retirees.includes(e.v)).every((e) => e.absent === true), `${l} prof gen7 : les 4 anciennes variantes ne sont plus proposées (${JSON.stringify(etat.filter((e) => retirees.includes(e.v)))})`);
  // Présentation (RAPPORT §53) : DEUX variantes (sous-groupes repliables « Sans / Avec discriminant ») contenant chacune leurs sous-variantes, sans préfixe « [axe] » répété sur chaque ligne.
  const arbre = (await page.evaluate(`(() => { const g = [...document.querySelectorAll("#composition-dynamique details.arbre-generateur")].find((d) => d.querySelector('input[data-variante-id="af_motif_racine_double_irrationnelle"]')); if (!g) return null; return { groupes: [...g.querySelectorAll(":scope > details.arbre-famille")].map((f) => ({ titre: f.querySelector(":scope > summary").textContent.trim(), ids: [...f.querySelectorAll("input[data-variante-id]")].map((i) => i.dataset.varianteId), prefixes: [...f.querySelectorAll(".ligne-variante")].filter((l) => l.textContent.trim().startsWith("[")).length })), directes: g.querySelectorAll(":scope > .ligne-variante").length }; })()`)) as { groupes: { titre: string; ids: string[]; prefixes: number }[]; directes: number } | null;
  verifier(arbre !== null && arbre.directes === 0 && arbre.groupes.map((g) => g.titre).join("|") === "Sans discriminant|Avec discriminant", `${l} prof gen7 : deux sous-groupes « Sans discriminant » puis « Avec discriminant », aucune ligne hors groupe (${JSON.stringify(arbre)})`);
  verifier(arbre !== null && arbre.groupes[0]?.ids.join() === variantes.slice(0, 7).join() && arbre.groupes[1]?.ids.join() === variantes.slice(7).join(), `${l} prof gen7 : les sept « motif » dans le premier groupe, les trois « delta » dans le second`);
  verifier(arbre !== null && arbre.groupes.every((g) => g.prefixes === 0), `${l} prof gen7 : aucune ligne ne répète « [sans/avec discriminant] » devant son libellé`);
  await page.locator("#nom-tache").fill("Étude de fonctions");
  const choisies = ["af_motif_racine_double_irrationnelle", "af_delta_aucune_racine"];
  for (const v of choisies) {
    await page.evaluate(`(() => { const i = document.querySelector('#composition-dynamique input[data-variante-id="${v}"]'); i.value = "1"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()`);
  }
  verifier(await page.locator("#btn-creer-tache").isEnabled(), `${l} prof gen7 : « Créer » est actif dès que le nom et un exercice gen7 sont saisis`);
  await page.locator("#btn-creer-tache").click();
  await page.waitForFunction(`document.getElementById("nom-tache").value === ""`);
  const composition = s.base.table("taches_composition");
  verifier(composition.length === 2 && composition.every((c) => c.generateur_id === "gen7") && composition.map((c) => c.variante_id).sort().join() === [...choisies].sort().join(), `${l} prof gen7 : la tâche créée par l'interface contient les 2 variantes choisies (${composition.map((c) => c.variante_id).join()})`);
  const tacheId = s.base.table("taches").find((t) => t.nom === "Étude de fonctions")!.id as string;
  // Assignation par la route réelle (la même que le bouton « Assigner »), puis l'élève reçoit deux exercices de deux sous-variantes.
  const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
  verifier(a.statut === 201 && a.corps.nombre_exercices_generes === 2, `${l} prof gen7 : assignation de la tâche créée : ${a.statut} ${JSON.stringify(a.corps)}`);
  const lignes = s.base.table("exercices_assignes").filter((x) => x.tache_id === tacheId);
  verifier(lignes.map((x) => x.variante_id as string).sort().join() === [...choisies].sort().join() && lignes.every((x) => x.generateur_id === "gen7"), `${l} prof gen7 : les exercices assignés portent les bonnes variantes`);
  await page.screenshot({ path: join(CAPTURES, `${l}-gen7-prof-tache-creee.png`), fullPage: false });
  verifier(journal.pageerrors.length === 0, `${l} prof gen7 : erreurs JS : ${journal.pageerrors.join(" | ")}`);
  await contexte.close();

  // L'élève résout le PREMIER exercice de la tâche composée par le professeur.
  const premiere = lignes[0]!;
  const ex = genererExerciceMD(premiere.variante_id as ExerciceMotifDelta["famille"], Number(premiere.graine));
  const { page: p2, contexte: c2 } = await ouvrirTacheGen7(navigateur, base, largeur, s);
  const courant = p2.locator(".moteur-ecran-courant");
  verifier((await courant.locator(".moteur-consigne").innerText()).startsWith("Étudie la fonction suivante :") && (await courant.locator(".moteur-consigne .katex").count()) >= 1, `${l} prof gen7 : l'élève voit l'énoncé de la tâche composée par le professeur, rendu par KaTeX`);
  await repondreMD(p2, ex, "coefficients");
  await courant.getByRole("button", { name: "Valider", exact: true }).click();
  await p2.waitForSelector(".moteur-statut-correct");
  await c2.close();
}

// ══ gen7 « motif / delta » (RAPPORT §49) : les DIX sous-variantes, jouées au clic dans le navigateur (vrai routeur, vraie base en mémoire) ══

/** Réponse à un écran de gen7 « motif / delta » par l'interface (même gestes qu'un élève). */
async function repondreMD(page: any, ex: ExerciceMotifDelta, champ: string): Promise<void> {
  const courant = page.locator(".moteur-ecran-courant");
  const brute = reponseBruteCorrecteMotifDelta(ex, champ);
  if (champ === "coefficients") {
    const v = JSON.parse(brute);
    for (const k of ["a", "b", "c"]) await courant.locator(`#mc-coefficients-${k}`).fill(v[k]);
  } else if (champ === "allure") {
    for (const [id, valeur] of Object.entries(JSON.parse(brute))) await courant.locator(`.moteur-choix:has(input[name="mc-allure-${id}"][value="${valeur}"])`).click();
  } else if (champ === "axeSommet") {
    const v = JSON.parse(brute);
    await courant.locator("#mc-axeSommet-axeTexte").fill(v.axeTexte);
    await courant.locator("#mc-axeSommet-xS").fill(v.xS);
    await courant.locator("#mc-axeSommet-yS").fill(v.yS);
  } else if (champ === "domaineImage") {
    const v = JSON.parse(brute);
    const ligne = courant.locator(".moteur-intervalle-ligne");
    for (const [cote, crochet] of [["gauche", v.crochetGauche], ["droite", v.crochetDroit]]) {
      const bouton = ligne.getByRole("button", { name: new RegExp(`Crochet de ${cote}`) });
      for (let k = 0; k < 2 && (await bouton.textContent()) !== crochet; k++) await bouton.click();
    }
    if (v.borneGauche === "-inf") await ligne.getByRole("button", { name: "Borne de gauche : moins l'infini" }).click();
    else await ligne.getByLabel("Borne de gauche", { exact: true }).fill(v.borneGauche);
    if (v.borneDroite === "+inf") await ligne.getByRole("button", { name: "Borne de droite : plus l'infini" }).click();
    else await ligne.getByLabel("Borne de droite", { exact: true }).fill(v.borneDroite);
  } else if (champ === "racines") {
    const valeurs = JSON.parse(brute) as string[];
    if (valeurs.length === 0) {
      await courant.getByRole("radio", { name: "Pas de racine" }).click();
    } else {
      await courant.getByRole("radio", { name: "Au moins une racine" }).click();
      for (const [i, valeur] of valeurs.entries()) {
        if ((await courant.locator(".moteur-liste-ligne").count()) <= i) await courant.locator(".moteur-liste-zone > .moteur-bouton-secondaire").click();
        await courant.locator(".moteur-liste-ligne .moteur-champ").nth(i).fill(valeur);
      }
    }
  } else if (champ === "tableauSignes") {
    const lignes = page.locator(".moteur-ecran-courant .moteur-ligne-tableau");
    const sol = JSON.parse(brute) as Record<string, Record<string, string>>;
    for (const [i, rangee] of rangeesTableauMD(fonctionEffective(ex)).entries()) {
      const boutons = lignes.nth(i).locator("td button");
      for (const [c, cellule] of rangee.cellules.entries()) {
        const attendu = (sol[rangee.ligne] as Record<string, string>)[cellule.ancre] as string;
        const nom = Object.hasOwn(NOMS_SYMBOLES_GEN7, attendu) ? NOMS_SYMBOLES_GEN7[attendu] : attendu;
        for (let k = 0; k < 6 && (await valeurDeCase(boutons.nth(c))) !== nom; k++) await boutons.nth(c).click();
      }
    }
  } else {
    throw new Error(`champ gen7 motif/delta inconnu « ${champ} »`);
  }
}

/**
 * Une partie COMPLÈTE par sous-variante (10 × 2 largeurs), au clic : six écrans, mathématiques (dont les racines carrées) rendues par KaTeX sans repli en source ; sur l'écran d'allure,
 * les DEUX réglages (sens de la parabole, position du sommet) pilotent le même croquis en direct ; sur l'ensemble-image, l'aperçu « im f = » est AU-DESSUS de la saisie et suit la frappe, sans aide ; aide
 * combinée de l'allure (ni le tableau ni l'ensemble-image n'ont d'aide, RAPPORT §53) ; tableau à 3 ou 7 colonnes selon le nombre de racines ; six réponses correctes enregistrées.
 */
async function scenarioGen7MotifDelta(navigateur: any, base: string, largeur: number) {
  const l = `${largeur}`;
  /** « Besoin d'un indice ? » : avec une pénalité, un premier clic demande confirmation (« Confirmer : l'indice réduit ton score de 10 % »), un second sert l'indice. */
  const demanderIndice = async (courant: any) => {
    const bouton = courant.locator(".moteur-aide button");
    await bouton.click();
    if (/^Confirmer/.test(await bouton.innerText())) await bouton.click();
  };
  for (const [i, fam] of FAMILLES.entries()) {
    const s: Scenario = creerScenario();
    installerBase(s.base);
    // RAPPORT §50 : le score suit la solution. La 1re sous-variante est jouée AVEC « Afficher la réponse attendue » et une pénalité d'indice de 10 % (scores visibles) ;
    // les neuf autres SANS la case (verdict seul : aucun score, ni ligne, ni total, ni tableau final).
    const avecScores = i === 0;
    const tacheId = creerTache(s, { nom: `md ${fam.numero}`, variantes: [{ variante_id: fam.id, nombre_exercices: 1 }], aide_activee: true, reponse_visible: avecScores, aide_penalite_pourcent: avecScores ? 10 : 0 });
    const origine = Math.random;
    Math.random = () => (7001 + 13 * i) / 2 ** 32;
    try {
      const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tacheId, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `${l} md ${fam.numero} : assignation ${a.statut}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((x) => x.tache_id === tacheId)!;
    const ex = genererExerciceMD(fam.id, Number(ligne.graine));
    const f = fonctionVraie(ex);
    const e = `${l} md ${fam.numero} ${fam.id}`;
    const { page, contexte, journal } = await ouvrirTacheGen7(navigateur, base, largeur, s);
    const courant = page.locator(".moteur-ecran-courant");
    const champs = ["coefficients", "allure", "axeSommet", "domaineImage", "racines", "tableauSignes"];
    const cap = (nom: string) => join(CAPTURES, `${l}-md-${fam.numero}-${nom}.png`);
    for (const [k, champ] of champs.entries()) {
      await page.waitForFunction(`document.querySelectorAll(".moteur-ecran-courant").length === 1`);
      const consigne: string = await lireConsigneGen7(page);
      verifier(consigne.startsWith("Étudie la fonction suivante") && (await courant.locator(".moteur-consigne .katex").count()) >= 1 && (await page.locator(".moteur-math-source").count()) === 0, `${e} / ${champ} : énoncé rendu par KaTeX, aucun repli en source (« ${consigne.slice(0, 50)} »)`);
      verifier((await page.locator(".moteur-question-titre").innerText()) === `Question ${k + 1} sur 6` && (await page.locator(".moteur-rappel-ligne-correct").count()) === k, `${e} / ${champ} : « Question ${k + 1} sur 6 », ${k} ligne(s) de rappel validée(s)`);
      if (champ === "coefficients") await page.screenshot({ path: cap("01-coefficients"), fullPage: true });
      // Scores (RAPPORT §50) : une valeur par ligne répondue et un total UNIQUEMENT quand la solution est montrée ; sinon rien, sur aucun écran.
      const nbScores = await page.locator(".moteur-rappel-score").count();
      if (avecScores) {
        verifier(nbScores === k && (await page.locator(".moteur-rappel-total").count()) === (k === 0 ? 0 : 1), `${e} / ${champ} : ${k} valeur(s) de score dans le rappel et ${k === 0 ? "pas de" : "une ligne de"} total (${nbScores})`);
        if (k === 2) verifier(JSON.stringify(await page.locator(".moteur-rappel-score").allInnerTexts()) === JSON.stringify(["1 / 1 pt", "0,9 / 1 pt"]) && (await page.locator(".moteur-rappel-total-points").innerText()) === "1,9 / 10 pts", `${e} : l'indice demandé sur l'allure coûte 10 % (« 0,9 / 1 pt ») et le total est la somme des lignes sur les 10 points de TOUS les écrans`);
        if (k === 5) verifier((await page.locator(".moteur-rappel-total-points").innerText()) === "6,9 / 10 pts", `${e} : total avant le tableau « 6,9 / 10 pts » (${await page.locator(".moteur-rappel-total-points").innerText()})`);
      } else {
        verifier(nbScores === 0 && (await page.locator(".moteur-rappel-total, .moteur-recap").count()) === 0, `${e} / ${champ} : sans « Afficher la réponse attendue », aucun score`);
      }

      if (champ === "allure") {
        // Deux réglages réactifs : un seul dessin, deux commandes indépendantes.
        const dessin = () => page.evaluate(`(() => { const v = document.querySelector(".moteur-ecran-courant .moteur-illustration svg"); return { label: v.getAttribute("aria-label"), courbe: v.querySelector("polyline").getAttribute("points") }; })()`) as Promise<{ label: string; courbe: string }>;
        const choisir = (id: string, valeur: string) => courant.locator(`.moteur-choix:has(input[name="mc-allure-${id}"][value="${valeur}"])`).click();
        const initial = await dessin();
        await choisir("concavite", "+");
        await choisir("positionSommet", "gauche");
        const gauche = await dessin();
        await choisir("positionSommet", "axe");
        const axe = await dessin();
        await choisir("positionSommet", "droite");
        const droite = await dessin();
        await choisir("concavite", "-");
        const bas = await dessin();
        verifier(new Set([gauche.courbe, axe.courbe, droite.courbe]).size === 3, `${e} : la position du sommet pilote le croquis (3 dessins distincts)`);
        verifier(bas.courbe !== droite.courbe && bas.label !== droite.label, `${e} : le sens de la parabole pilote le même croquis`);
        verifier(initial.courbe !== gauche.courbe && initial.label !== gauche.label, `${e} : avant tout choix, le croquis est neutre`);
        // aide combinée : un seul bouton, un seul texte qui couvre les deux questions
        verifier((await courant.locator(".moteur-aide button").count()) === 1, `${e} : une seule aide sur l'écran d'allure`);
        await demanderIndice(courant);
        await page.waitForSelector(".moteur-ecran-courant .moteur-aide-texte:not([hidden])");
        const aide: string = await courant.locator(".moteur-aide-texte").innerText();
        verifier(/parabole/.test(aide) && (await courant.locator(".moteur-aide-texte .katex").count()) >= 2, `${e} : l'aide d'allure (sens ET position) est rendue par KaTeX`);
        await page.screenshot({ path: cap("02-allure-aide"), fullPage: true });
      }
      if (champ === "domaineImage") {
        const apercu = courant.locator(".moteur-apercu-dessus");
        verifier((await apercu.count()) === 1 && /im\s*f/.test(await apercu.innerText()), `${e} : l'aperçu « im f = » est présent`);
        const yApercu = (await apercu.boundingBox()).y;
        const yLigne = (await courant.locator(".moteur-intervalle-ligne").boundingBox()).y;
        verifier(yApercu < yLigne, `${e} : l'aperçu est AU-DESSUS de la saisie (${yApercu.toFixed(0)} < ${yLigne.toFixed(0)})`);
        verifier((await courant.locator(".moteur-aide").count()) === 0, `${e} : aucune aide sur l'ensemble-image`);
        await courant.locator(".moteur-intervalle-ligne").getByLabel("Borne de gauche", { exact: true }).fill("7$x");
        verifier((await apercu.innerText()).includes("7$x") && (await apercu.locator(".moteur-apercu-valeur .katex").count()) === 0, `${e} : l'aperçu reprend la saisie de l'élève sans l'interpréter`);
        await courant.locator(".moteur-intervalle-ligne").getByLabel("Borne de gauche", { exact: true }).fill("");
      }
      if (champ === "tableauSignes") {
        const n = f.racines.length === 2 ? 7 : 3;
        verifier((await courant.locator(".moteur-ligne-tableau").first().locator("td button").count()) === n, `${e} : la ligne de signe compte ${n} cases`);
        // Sans « Afficher la réponse attendue » (réglage de ce scénario), les valeurs de x restent SYMBOLIQUES : x_S seul (racine double ou aucune), x_1, x_S, x_2 sinon (RAPPORT §42).
        const symboles = (await courant.locator(".moteur-table-structure .katex-mathml annotation").allTextContents()).map((t: string) => t.trim()).filter((t: string) => /^x_(1|2|S)$/.test(t));
        verifier(symboles.length >= (n === 7 ? 3 : 1) && (await courant.locator(".moteur-table-structure .moteur-math-source").count()) === 0, `${e} : valeurs de x symboliques rendues par KaTeX (${symboles.join(",")})`);
        const noms: string[] = await page.locator(".moteur-rappel-ligne-correct .moteur-rappel-nom").allInnerTexts();
        verifier(noms.length === 5 && noms[0]!.startsWith("Coefficients") && noms.some((x) => x.startsWith("Racines")), `${e} : le rappel liste les 5 écrans précédents (${noms.join(" | ")})`);
        verifier((await courant.locator(".moteur-aide").count()) === 0, `${e} : aucune aide sur le tableau (RAPPORT §53)`);
        await verifierPleinBord(page, `${e} : tableau`, largeur);
        await page.screenshot({ path: cap("06-tableau"), fullPage: true });
      }
      await repondreMD(page, ex, champ);
      if (champ === "racines") await page.screenshot({ path: cap("05-racines"), fullPage: true });
      await validerEtSuivreGen7(page);
    }
    await page.waitForSelector(".moteur-fin");
    if (avecScores) {
      const rangees: string[] = await page.locator(".moteur-fin .moteur-recap-table tbody tr").allInnerTexts();
      verifier(rangees.length === 7 && /Total\s+9,9 \/ 10 pts/.test(rangees[6]!) && /Tableau de signes\s+3 \/ 3 pts/.test(rangees[5]!) && /Allure\s+0,9 \/ 1 pt/.test(rangees[1]!), `${e} : tableau final : 6 écrans + total « 9,9 / 10 pts » (${JSON.stringify(rangees)})`);
      await page.screenshot({ path: cap("07-fin-resultat"), fullPage: true });
    } else {
      verifier((await page.locator(".moteur-recap").count()) === 0, `${e} : pas de tableau final sans « Afficher la réponse attendue »`);
    }
    await page.getByRole("button", { name: "Terminer" }).click();
    await page.waitForSelector("#tableau-de-bord:not([hidden])");
    const lignes = s.base.table("reponses");
    verifier(lignes.length === 6 && lignes.every((r) => r.statut === "correct"), `${e} : 6 réponses enregistrées, toutes correctes (${lignes.map((r) => `${r.champ}:${r.statut}`).join()})`);
    verifier(s.base.table("aides_utilisees").length === 1, `${e} : une seule aide enregistrée (allure ; ni tableau ni ensemble-image) : ${s.base.table("aides_utilisees").length}`);
    verifier(journal.pageerrors.length === 0, `${e} : erreurs JS : ${journal.pageerrors.join(" | ")}`);
    verifier(journal.erreursConsole.filter((m) => !/fonts\.g|net::ERR_FAILED/.test(m)).length === 0, `${e} : erreurs console : ${journal.erreursConsole.join(" | ")}`);
    await contexte.close();
  }
}


/**
 * « Aperçu » du formulaire de tâche (RAPPORT §36), au clic, sur une tâche gen7 composée dans l'interface : le bouton n'est actif que si la
 * composition est non vide ET exécutable (`executable`, dérivé du registre) ; le clic ouvre un onglet `eleve.html?apercu=1` où le
 * professeur voit la tâche comme l'élève (bandeau, pas de navigation, KaTeX, correction selon les réglages), sans rien créer de réel.
 */
async function scenarioApercu(navigateur: any, base: string, largeur: number) {
  const l = `${largeur} aperçu`;
  const s: Scenario = creerScenario();
  installerBase(s.base);
  const { page, contexte, journal } = await preparerPage(navigateur, base, largeur, largeur < 600 ? 800 : 900, `prof:${s.profId}`, "p@x");
  // Routes du CONTEXTE : le stub Supabase et les polices doivent aussi servir l'onglet ouvert par « Aperçu ».
  await contexte.route("**/unpkg.com/@supabase/supabase-js**", (r: any) => r.fulfill({ contentType: "text/javascript", body: stubSupabase(`prof:${s.profId}`, "p@x") }));
  await contexte.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
  await contexte.route("**/fonts.gstatic.com/**", (r: any) => r.abort());
  await page.goto(base + "/prof.html");
  await page.waitForSelector('button[data-onglet="taches"]:visible');
  await page.locator('button[data-onglet="taches"]').click();
  await page.locator("#bouton-accordeon-creer").click();
  await page.waitForSelector("#composition-dynamique input.stepper-valeur", { state: "attached" });
  const bouton = page.locator("#btn-apercu-tache");
  const quantite = (variante: string, valeur: number) => page.evaluate(`(() => { const i = document.querySelector('#composition-dynamique input[data-variante-id="${variante}"]'); i.value = "${valeur}"; i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); })()`);

  verifier(await bouton.isDisabled() && /au moins un exercice/.test((await bouton.getAttribute("title")) ?? ""), `${l} : sans exercice, « Aperçu » est inactif et dit pourquoi`);
  await quantite("af_motif_aucune_racine", 1);
  await quantite("af_delta_aucune_racine", 1);
  verifier(await bouton.isEnabled() && /comme l'élève/.test((await bouton.getAttribute("title")) ?? ""), `${l} : composition gen7 non vide -> « Aperçu » actif SANS nom de tâche saisi`);

  // Garde par le registre : une variante composée sans générateur exécutable rend le bouton inactif, avec la raison.
  const registre = require("../lib/registreGenerateurs").REGISTRE_GENERATEURS as { variante_id: string }[];
  const rang = registre.findIndex((g) => g.variante_id === "af_delta_aucune_racine");
  const [retire] = registre.splice(rang, 1);
  try {
    await page.reload();
    await page.waitForSelector('button[data-onglet="taches"]:visible');
    await page.locator('button[data-onglet="taches"]').click();
    await page.locator("#bouton-accordeon-creer").click();
    await page.waitForSelector("#composition-dynamique input.stepper-valeur", { state: "attached" });
    await quantite("af_motif_aucune_racine", 1);
    verifier(await bouton.isEnabled(), `${l} : variante exécutable seule -> actif même si une autre est retirée du registre`);
    await quantite("af_delta_aucune_racine", 1);
    verifier(await bouton.isDisabled() && /af_delta_aucune_racine/.test((await bouton.getAttribute("title")) ?? ""), `${l} : variante sans générateur composée -> inactif et nommée dans l'infobulle (${await bouton.getAttribute("title")})`);
    await quantite("af_delta_aucune_racine", 0);
    verifier(await bouton.isEnabled(), `${l} : la variante retirée de la composition, le bouton se réactive`);
  } finally {
    registre.splice(rang, 0, retire!);
  }
  await page.reload();
  await page.waitForSelector('button[data-onglet="taches"]:visible');
  await page.locator('button[data-onglet="taches"]').click();
  await page.locator("#bouton-accordeon-creer").click();
  await page.waitForSelector("#composition-dynamique input.stepper-valeur", { state: "attached" });
  await quantite("af_motif_aucune_racine", 1);
  await quantite("af_delta_aucune_racine", 1);
  await page.locator("#feedback-immediat").uncheck({ force: true }); // correction coupée : le réglage doit se retrouver dans l'aperçu
  await page.screenshot({ path: join(CAPTURES, `${largeur}-apercu-01-formulaire.png`), fullPage: false });

  // ── Clic : un onglet s'ouvre sur eleve.html?apercu=1 ──
  const [popup] = await Promise.all([contexte.waitForEvent("page"), bouton.click()]);
  popup.on("pageerror", (e: Error) => journal.pageerrors.push("aperçu : " + e.message));
  popup.on("console", (m: any) => { if (m.type() === "error") journal.erreursConsole.push("aperçu : " + m.text()); });
  popup.on("response", (r: any) => { if (r.status() >= 400) journal.reponsesEnErreur.push({ statut: r.status(), methode: r.request().method(), url: new URL(r.url()).pathname }); });
  await popup.waitForSelector("#bandeau-mode-apercu:not([hidden])");
  await popup.waitForSelector(".moteur-ecran-courant");
  verifier(popup.url().endsWith("/eleve.html?apercu=1"), `${l} : l'onglet est eleve.html?apercu=1 (${popup.url()})`);
  verifier((await popup.locator("#bandeau-mode-apercu").innerText()).includes("Mode aperçu"), `${l} : bandeau « Mode aperçu » visible`);
  verifier(await popup.locator("#onglets-nav").isHidden() && (await popup.locator("#salutation-eleve").innerText()) === "Aperçu professeur", `${l} : pas de navigation élève, salutation « Aperçu professeur »`);
  verifier((await popup.evaluate(`localStorage.getItem("apercu_session")`)) === null && (await page.evaluate(`localStorage.getItem("apercu_session")`)) === null, `${l} : la session d'aperçu est retirée du stockage dès le chargement`);
  verifier((await page.locator("#statut-creer-tache").innerText()).includes("Aperçu ouvert"), `${l} : le formulaire annonce « Aperçu ouvert dans un nouvel onglet »`);
  const consigne: string = await popup.locator(".moteur-ecran-courant .moteur-consigne").innerText();
  verifier(consigne.includes("Étudie la fonction suivante") && (await popup.locator(".moteur-ecran-courant .moteur-consigne .katex").count()) >= 1, `${l} : l'énoncé gen7 est rendu par KaTeX dans l'aperçu`);
  await popup.screenshot({ path: join(CAPTURES, `${largeur}-apercu-02-onglet-eleve.png`), fullPage: true });

  // Le fantôme, le professeur et la base : un aperçu, pas une tâche.
  const fantome = s.base.table("profs").find((p) => p.id === s.profId)!.eleve_apercu_id as string;
  const taches = s.base.table("taches");
  verifier(taches.length === 1 && taches[0]!.est_apercu === true && taches[0]!.feedback_immediat === false && typeof fantome === "string", `${l} : UNE tâche d'aperçu (correction coupée reprise du formulaire), aucune vraie tâche créée`);
  verifier(!s.base.table("inscriptions").some((i) => i.eleve_id === fantome) && s.base.table("exercices_assignes").length === 2 && s.base.table("exercices_assignes").every((e) => e.eleve_id === fantome), `${l} : 2 exercices pour le seul fantôme, hors de toute classe`);

  // Le moteur, tel quel : première réponse juste (réglage « correction coupée » : aucun verdict affiché).
  const premier = s.base.table("exercices_assignes")[0]!;
  const ex = genererExerciceMD(premier.variante_id as ExerciceMotifDelta["famille"], Number(premier.graine));
  await repondreMD(popup, ex, "coefficients");
  await popup.locator(".moteur-ecran-courant").getByRole("button", { name: "Valider", exact: true }).click();
  await popup.waitForSelector(".moteur-statut");
  verifier((await popup.locator(".moteur-statut-correct, .moteur-statut-not_equivalent, .moteur-statut-parse_error").count()) === 0, `${l} : correction coupée du formulaire respectée dans l'aperçu (aucun verdict affiché)`);
  verifier(s.base.table("reponses").length === 1 && s.base.table("reponses")[0]!.exercice_assigne_id === premier.id, `${l} : la réponse est écrite comme pour un élève (exclue des vues professeur par est_apercu)`);

  // Un rechargement de l'onglet d'aperçu échoue proprement (session consommée).
  await popup.reload();
  await popup.waitForFunction(`(document.getElementById("erreur-fatale-pilote")?.textContent ?? "").includes("Session d'aperçu introuvable")`);
  verifier(true, `${l} : rechargement -> « Session d'aperçu introuvable » (jamais une session périmée rejouée)`);
  await popup.evaluate(`document.getElementById("erreur-fatale-pilote").textContent = ""`); // attendu ici : ne pas le compter comme panne à la fermeture

  // Le professeur n'a rien perdu : sa page, sa session, sa liste de tâches.
  verifier((await page.locator("#nom-tache").count()) === 1 && !(await page.evaluate(`document.body.innerText`) as string).includes("Impossible de charger"), `${l} : la page professeur est intacte`);
  const liste = (await page.evaluate(`fetch("/api/taches", { headers: { Authorization: "Bearer prof:${s.profId}" } }).then((r) => r.json())`)) as unknown[];
  verifier(liste.length === 0, `${l} : GET /api/taches ne liste aucun aperçu (${liste.length})`);

  // « Fermer cet onglet » ferme l'onglet d'aperçu ; un 2e aperçu remplace le 1er.
  const [popup2] = await Promise.all([contexte.waitForEvent("page"), bouton.click()]);
  await popup2.waitForSelector("#bandeau-mode-apercu:not([hidden])");
  await popup2.waitForSelector(".moteur-ecran-courant");
  verifier(s.base.table("taches").length === 1 && s.base.table("reponses").length === 0 && s.base.table("eleves").length === 3, `${l} : 2e aperçu -> même fantôme, ancien aperçu et ses réponses supprimés`);
  const fermeture = popup2.waitForEvent("close");
  // Le clic FERME l'onglet (`window.close()`) : Playwright peut signaler cette fermeture pendant le clic lui-même (« Target page … has been closed »),
  // ce qui n'est pas un échec — seule une autre erreur l'est ; la fermeture est vérifiée juste après.
  await popup2.locator("#btn-quitter-apercu").click().catch((e: Error) => {
    if (!/has been closed/i.test(e.message)) throw e;
  });
  await fermeture;
  verifier(popup2.isClosed(), `${l} : « Fermer cet onglet » ferme l'onglet d'aperçu`);
  await popup.close();
  await contexte.close();
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
      await scenarioReponseVisible(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} réponse visible`);
      await scenarioEtendu(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} étendu`);
      await scenarioProf(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} prof`);
      await scenarioAdmin(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} admin`, [{ statut: 403, motif: /^GET \/api\/admin\/profs$/, pourquoi: "un prof non admin appelle l'API admin à la main : refus serveur attendu (403)" }]);
      await scenarioPoids(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} poids`);
      await scenarioGen7Coupe(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} gen7 coupé`);
      await scenarioGen7Prof(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} gen7 prof`);
      await scenarioConfigurationLigne(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} config ligne`);
      await scenarioFigureAidePaliers(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} figure aide paliers`);
      await scenarioChaineTransformations(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} chaîne`);
      await scenarioPartiesFausses(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} parties fausses`);
      await scenarioPartiesFaussesTemoin(navigateur, url, largeur);
      await scenarioSolutionTableauTemoin(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} parties fausses (témoin)`);
      await scenarioGen7MotifDelta(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} gen7 motif/delta`);
      await scenarioGen7Cascade(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} gen7 cascade`);
      await scenarioApercu(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} aperçu`);
      await scenarioApercuRetour(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} aperçu retour`);
      await scenarioRetourArriere(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} retour en arrière`);
      await scenarioRetourArriereTemoin(navigateur, url, largeur);
      controlerReponsesHttp(`${largeur} retour en arrière (témoin)`);
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
