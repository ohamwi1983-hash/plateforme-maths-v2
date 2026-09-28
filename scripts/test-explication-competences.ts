// Test permanent — prompt "Bouton d'explication pédagogique par compétence (espace professeur)".
//
// Couche 1 (serveur, `lib/profilCompetences.ts`/`lib/explicationsCompetences.ts`) : la fonction PURE
// `calculerProfilCompetences` est testée directement, sans mock réseau (elle ne touche jamais
// Supabase). Le cas central exigé par le prompt — "un code présent dans DICTIONNAIRE_COMPETENCES
// mais absent d'EXPLICATIONS_COMPETENCES" — n'existe pas naturellement aujourd'hui (les 20 codes
// actuellement produits par de vrais détecteurs ont chacun reçu une entrée dans les deux fichiers,
// voir le commentaire de tête de `lib/explicationsCompetences.ts`) : reproduit ici en mockant
// `lib/explicationsCompetences` via `require.cache` pour qu'il expose un dictionnaire VIDE, exactement
// la même technique que `scripts/test-badge-serie.ts`/`scripts/test-gen8.ts` mockent `supabaseAdmin`
// — jamais une modification du vrai fichier de données pour les besoins du test.
//
// Couche 2 (client, `public/prof.html`) : `construireExplicationCompetence`/
// `construireFeuilleArbreCompetence` (arbre à indentation repliable, retour utilisateur — remplace
// l'ancienne `afficherCompetences`) sont extraites LITTÉRALEMENT du fichier réel (extraction robuste
// au décalage de lignes, jamais réimplémentées) et exécutées dans un bac à sable `vm` avec un faux
// DOM minimal — même technique que les scripts de diagnostic prof.html déjà utilisés dans ce dépôt.
// Vérifie qu'une compétence SANS `explication` ne produit aucun bouton et ne fait jamais planter le
// rendu.

export {};
import * as fs from "fs";
import * as path from "path";
import * as vm from "vm";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error("ECHEC : " + message);
}

/**
 * Extraction par bornes de lignes EN DUR devenue fragile — 2 fois cassée par un simple décalage de
 * lignes dans public/prof.html sans rapport avec ces fonctions (prompts "Catégorisation des
 * compétences (Option B)" puis "Liste des tâches"), à chaque fois la même classe de bug. Remplacée
 * ici par une extraction robuste au décalage : trouve `function nomFonction(` puis compte les
 * accolades caractère par caractère jusqu'à ce qu'elles s'équilibrent (valide pour du JS syntaxiquement
 * correct — une interpolation de gabarit `${...}` a toujours des accolades équilibrées en son sein,
 * vérifié sur le contenu réel des 3 fonctions extraites ci-dessous, aucune accolade isolée dans une
 * chaîne/un commentaire). Jamais réimplémentée : toujours le code réel du fichier.
 */
function extraireFonction(lignes: string[], nomFonction: string): string {
  const debut = lignes.findIndex((l) => l.includes(`function ${nomFonction}(`));
  if (debut === -1) throw new Error(`Fonction introuvable dans public/prof.html : ${nomFonction}`);
  let profondeur = 0;
  let ouverte = false;
  for (let i = debut; i < lignes.length; i++) {
    for (const car of lignes[i]) {
      if (car === "{") { profondeur++; ouverte = true; }
      else if (car === "}") profondeur--;
    }
    if (ouverte && profondeur === 0) return lignes.slice(debut, i + 1).join("\n");
  }
  throw new Error(`Accolade fermante introuvable pour la fonction : ${nomFonction}`);
}

const RACINE = path.resolve(__dirname, "..");

async function testerCoucheServeur() {
  // --- 1. Données réelles : un code du dictionnaire AVEC une explication réelle (cas normal) ---
  const { calculerProfilCompetences } = require(`${RACINE}/lib/profilCompetences`);
  const { DICTIONNAIRE_COMPETENCES } = require(`${RACINE}/lib/dictionnaireCompetences`);
  const { EXPLICATIONS_COMPETENCES } = require(`${RACINE}/lib/explicationsCompetences`);

  const profilReel = calculerProfilCompetences(["C04", "C04"]);
  assert(profilReel.length === 1, "C04×2 doit produire une seule entrée de profil");
  const c04 = profilReel[0];
  assert(c04.libelle === DICTIONNAIRE_COMPETENCES.C04.libelle, "libellé C04 doit venir du dictionnaire réel");
  assert(c04.explication === EXPLICATIONS_COMPETENCES.C04.explication, "explication C04 doit venir du fichier réel");
  assert(c04.exemple === EXPLICATIONS_COMPETENCES.C04.exemple, "exemple C04 doit venir du fichier réel");
  console.log("OK: code réel du dictionnaire avec entrée EXPLICATIONS_COMPETENCES réelle -> explication/exemple bien résolus");

  // --- 2. Tous les codes RÉELLEMENT détectés par le serveur ont une explication (couverture actuelle) ---
  const codesDictionnaire = Object.keys(DICTIONNAIRE_COMPETENCES);
  const codesSansExplication = codesDictionnaire.filter((code) => !EXPLICATIONS_COMPETENCES[code]);
  assert(
    codesSansExplication.length === 0,
    `tous les codes de DICTIONNAIRE_COMPETENCES devraient avoir une entrée EXPLICATIONS_COMPETENCES à ce jour, manquants : ${codesSansExplication.join(", ")}`,
  );
  console.log(`OK: les ${codesDictionnaire.length} codes de DICTIONNAIRE_COMPETENCES ont chacun une entrée EXPLICATIONS_COMPETENCES (couverture actuelle complète)`);

  // --- 3. Cas exigé par le prompt : code présent dans DICTIONNAIRE_COMPETENCES, ABSENT d'EXPLICATIONS_COMPETENCES ---
  // Mock `require.cache` pour que `lib/explicationsCompetences` expose un dictionnaire vide, puis
  // force un nouveau `require` de `lib/profilCompetences` (jamais réutilisé depuis le cache déjà
  // rempli plus haut) pour qu'il recharge ses dépendances avec le mock en place.
  const cheminExplications = require.resolve(`${RACINE}/lib/explicationsCompetences`);
  const cheminProfil = require.resolve(`${RACINE}/lib/profilCompetences`);
  const ancienModuleExplications = require.cache[cheminExplications];
  delete require.cache[cheminProfil];
  require.cache[cheminExplications] = {
    id: cheminExplications,
    filename: cheminExplications,
    loaded: true,
    exports: { EXPLICATIONS_COMPETENCES: {} },
  } as any;

  const { calculerProfilCompetences: calculerProfilCompetencesSansExplications } = require(`${RACINE}/lib/profilCompetences`);
  const profilSansExplication = calculerProfilCompetencesSansExplications(["C04", "C04"]);
  assert(profilSansExplication.length === 1, "C04×2 doit toujours produire une seule entrée de profil, mock ou pas");
  const c04SansExplication = profilSansExplication[0];
  assert(c04SansExplication.libelle === DICTIONNAIRE_COMPETENCES.C04.libelle, "le libellé réel du dictionnaire reste résolu même si EXPLICATIONS_COMPETENCES est vide");
  assert(c04SansExplication.description === DICTIONNAIRE_COMPETENCES.C04.description, "la description réelle du dictionnaire reste résolue même si EXPLICATIONS_COMPETENCES est vide");
  assert(c04SansExplication.statut === "non_maitrisee", "le statut ne doit jamais dépendre de la présence d'une explication");
  assert(c04SansExplication.explication === undefined, "explication doit être undefined (jamais une chaîne vide ni une erreur) pour un code sans entrée");
  assert(c04SansExplication.exemple === undefined, "exemple doit être undefined pour un code sans entrée");
  console.log("OK: code présent dans DICTIONNAIRE_COMPETENCES mais absent d'EXPLICATIONS_COMPETENCES (mocké) -> libellé/description réels conservés, explication/exemple undefined, aucun crash");

  // Restaure le cache tel qu'il était avant le mock (jamais laisser un module mocké fuiter vers
  // d'autres scripts exécutés dans le même process — cette suite tourne seule via `npx tsx`, mais la
  // discipline reste la même que les autres mocks `require.cache` de ce dépôt).
  if (ancienModuleExplications) require.cache[cheminExplications] = ancienModuleExplications;
  else delete require.cache[cheminExplications];
  delete require.cache[cheminProfil];

  // --- 4. Code totalement inconnu (absent des 2 fichiers) : déjà couvert par smoke-test.ts, revérifié ici pour les 2 nouveaux champs spécifiquement ---
  const profilInconnu = calculerProfilCompetences(["CODE_JAMAIS_VU_EXPLICATION", "CODE_JAMAIS_VU_EXPLICATION"]);
  assert(profilInconnu.length === 1 && profilInconnu[0].explication === undefined && profilInconnu[0].exemple === undefined, "code totalement inconnu -> explication/exemple undefined, jamais un crash");
  console.log("OK: code absent des 2 fichiers -> explication/exemple undefined, aucun crash (complète la couverture de smoke-test.ts sur ces 2 nouveaux champs)");
}

function creerFakeElement(tag: string): any {
  const el: any = {
    tagName: tag.toUpperCase(),
    className: "",
    textContent: "",
    hidden: false,
    type: "",
    children: [] as any[],
    listeners: {} as Record<string, Array<() => void>>,
    attributs: {} as Record<string, string>,
    appendChild(enfant: any) {
      this.children.push(enfant);
      return enfant;
    },
    setAttribute(k: string, v: string) {
      this.attributs[k] = v;
    },
    addEventListener(evenement: string, gestionnaire: () => void) {
      (this.listeners[evenement] ??= []).push(gestionnaire);
    },
    click() {
      for (const g of this.listeners["click"] ?? []) g();
    },
  };
  return el;
}

async function testerCoucheClient() {
  const html = fs.readFileSync(`${RACINE}/public/prof.html`, "utf-8");
  const lignes = html.split("\n");
  // Extraction robuste au décalage de lignes — voir la doc-comment d'`extraireFonction` ci-dessus
  // (remplace l'ancien historique de bornes en dur, cassé à répétition par des ajouts sans rapport
  // ailleurs dans public/prof.html).
  // Retour utilisateur ("je remplacerai le profil de compétences complet de l'élève par l'arbre à
  // indentation repliable, avec le '?' qui donne l'explication de la compétence") —
  // `construireCarteCompetence`/`afficherCompetences` (listes plates) retirées de public/prof.html,
  // remplacées par `construireFeuilleArbreCompetence` (une feuille d'arbre par compétence, même
  // bouton "?" réutilisé tel quel via `construireExplicationCompetence`).
  const code = [
    extraireFonction(lignes, "construireExplicationCompetence"),
    extraireFonction(lignes, "construireFeuilleArbreCompetence"),
  ].join("\n\n");

  const conteneurs: Record<string, any> = {};
  const fakeDocument = {
    createElement: (tag: string) => creerFakeElement(tag),
    createTextNode: (texte: string) => ({ tagName: "#text", texte }),
    getElementById: (id: string) => {
      if (!conteneurs[id]) conteneurs[id] = creerFakeElement("div");
      return conteneurs[id];
    },
  };
  const sandbox: any = { document: fakeDocument, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "prof.html-extrait-explication.js" });

  // Une compétence AVEC explication (cas normal) et une SANS (code du dictionnaire mais absent
  // d'EXPLICATIONS_COMPETENCES, exactement le cas exigé par le prompt) — appelées séparément (une
  // feuille d'arbre à la fois, `construireFeuilleArbreCompetence` ne prend qu'une compétence),
  // jamais un conteneur intermédiaire type "afficherCompetences" (retiré de public/prof.html).
  const competenceAvec = { code: "C04", statut: "non_maitrisee", libelle: "Signe en mise en évidence", description: "Distribuer un signe négatif en mise en évidence", occurrences: 3, explication: "Texte d'explication réel.", exemple: "Un exemple réel." };
  const competenceSans = { code: "FUTUR_CODE_SANS_EXPLICATION", statut: "en_observation", libelle: "Futur code", description: "", occurrences: 2 }; // explication/exemple absents (undefined), comme le renverrait le serveur

  const feuilleAvec = sandbox.construireFeuilleArbreCompetence(competenceAvec);
  const ligneLibelleAvec = feuilleAvec.children.find((c: any) => c.className === "corps-feuille-arbre-competence").children.find((c: any) => c.className === "ligne-libelle-competence");
  const boutonAvec = ligneLibelleAvec.children.find((c: any) => c.className === "btn-explication-competence");
  assert(!!boutonAvec, "la compétence AVEC explication doit avoir un bouton '?' ");
  const panneauAvec = feuilleAvec.children.find((c: any) => c.className === "corps-feuille-arbre-competence").children.find((c: any) => c.className === "explication-competence");
  assert(!!panneauAvec && panneauAvec.hidden === true, "le panneau doit exister et être masqué avant tout clic");
  boutonAvec.click();
  assert(panneauAvec.hidden === false, "le panneau doit se déplier après un clic sur le bouton '?'");
  boutonAvec.click();
  assert(panneauAvec.hidden === true, "le panneau doit se replier après un 2e clic (bascule)");
  console.log("OK (client) : feuille d'arbre avec explication -> bouton '?' présent, panneau replié par défaut, bascule au clic");

  const feuilleSans = sandbox.construireFeuilleArbreCompetence(competenceSans);
  const corpsSans = feuilleSans.children.find((c: any) => c.className === "corps-feuille-arbre-competence");
  const ligneLibelleSans = corpsSans.children.find((c: any) => c.className === "ligne-libelle-competence");
  const boutonSans = ligneLibelleSans.children.find((c: any) => c.className === "btn-explication-competence");
  const panneauSans = corpsSans.children.find((c: any) => c.className === "explication-competence");
  assert(!boutonSans, "la compétence SANS explication (code du dictionnaire non couvert par EXPLICATIONS_COMPETENCES) ne doit produire AUCUN bouton");
  assert(!panneauSans, "la compétence SANS explication ne doit produire AUCUN panneau");
  console.log("OK (client) : feuille d'arbre sans explication (code présent dans le dictionnaire mais absent d'EXPLICATIONS_COMPETENCES) -> aucun bouton, aucun panneau, aucun crash");
}

async function main() {
  await testerCoucheServeur();
  await testerCoucheClient();
  console.log("\nTOUS LES TESTS DU BOUTON D'EXPLICATION PEDAGOGIQUE PAR COMPETENCE PASSENT.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
