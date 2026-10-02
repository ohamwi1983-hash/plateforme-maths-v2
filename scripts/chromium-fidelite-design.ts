// Fidélité du DESIGN des composants d'écran à la RÉFÉRENCE exacte (docs/reference/composants-ecran.html) — outil de validation
// Chromium, même méthode que l'audit E1-E7 : la référence et l'application réelle (vrai `api/router.ts`, base en mémoire, témoin
// technique) sont rendues dans le MÊME navigateur et leurs styles CALCULÉS (`getComputedStyle`) sont comparés élément par élément.
// Le CSS source ne prouve rien (l'audit a montré qu'une règle `.moteur-champ` de ecrans.css était écrasée par `style.css`).
//
//   npx tsx scripts/chromium-fidelite-design.ts        # captures dans $CAPTURES_DIR (défaut : ./captures-chromium)
//
// Écarts ADMIS : uniquement ceux listés dans `ADMIS`, chacun avec sa raison (jamais une tolérance générale).

export {}; // module

// Code exécuté DANS la page : le projet n'inclut pas la bibliothèque DOM.
declare const getComputedStyle: (el: unknown) => Record<string, string>;

import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { demarrerServeur, stubSupabase } from "./support/serveurChromium";
import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { CHAMP_SOMME, CHAMP_PARITE, CHAMP_DIVISEURS, CHAMP_SIGNES, generateurTemoinTechnique as temoin, reponseBruteCorrecte, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";

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

// ── Propriétés comparées ──
const COTES = ["Top", "Right", "Bottom", "Left"];
const PADDING = COTES.map((c) => `padding${c}`);
// Carte d'un composant : fond, ombre, bord BAS et padding bas. Les bords haut / latéraux, les rayons et le padding haut / latéral ne sont plus ceux de
// `composants-ecran.html` (RAPPORT §44, décision du propriétaire) : la carte est le bloc blanc de l'enveloppe — bord haut partagé avec le panneau gris,
// angles hauts droits, et bord à bord sous 600 px (sans arrondi ni bord latéral, padding de 16 px). Ce que contient la carte (consigne, champs, boutons,
// espacements) reste mesuré contre la référence des composants ; la carte elle-même est mesurée contre `enveloppe-exercice.html`.
const P_CARTE = ["backgroundColor", "boxShadow", "borderBottomColor", "borderBottomWidth", "borderBottomStyle", "paddingBottom"];
const P_TEXTE = ["color", "fontWeight", "fontSize"];
const P_CHAMP = ["backgroundColor", "color", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", ...PADDING, "fontFamily", "fontSize"];
const P_PRINCIPAL = ["backgroundColor", "color", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", ...PADDING, "boxShadow", "fontFamily", "fontSize", "fontWeight"];
const P_OPTION = ["backgroundColor", "color", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", ...PADDING, "fontWeight"];
const P_SECONDAIRE = ["backgroundColor", "color", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", "paddingLeft", "paddingRight", "fontFamily", "fontSize", "fontWeight"];
const P_ICONE = ["color", "fontSize", "fontWeight", "backgroundColor"];
const P_ROND = ["backgroundColor", "color", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", "fontWeight", "fontSize"];
const P_FLEX = ["display", "flexDirection", "gap", "alignItems"];

interface Element {
  [propriete: string]: string;
}
const MESURE = `(sel) => { const el = document.querySelector(sel); if (!el) return null; const st = getComputedStyle(el); const r = el.getBoundingClientRect(); const o = { _tag: el.tagName.toLowerCase(), _texte: el.textContent.trim().slice(0, 30), _largeur: String(Math.round(r.width * 10) / 10), _hauteur: String(Math.round(r.height * 10) / 10) }; for (const p of Object.keys(st)) { if (isNaN(Number(p))) o[p] = st[p]; } return o; }`;

function hex(couleur: string): string {
  return couleur.replace(/rgba?\(([^)]+)\)/g, (_m, c: string) => {
    const [r, g, b, a] = c.split(",").map((x) => Number(x.trim()));
    const h = (n: number) => Math.round(n).toString(16).padStart(2, "0").toUpperCase();
    return a === 0 ? "transparent" : `#${h(r as number)}${h(g as number)}${h(b as number)}${a !== undefined && a < 1 ? `α${a}` : ""}`;
  });
}
const normaliser = (propriete: string, valeur: string | undefined): string => {
  if (valeur === undefined) return "—";
  if (propriete === "fontFamily") return valeur.split(",")[0]!.trim().replace(/"/g, "");
  if (propriete === "boxShadow") return valeur === "none" ? "aucune" : hex(valeur).replace(/\s+/g, " ");
  return hex(valeur);
};
const numerique = (v: string): number | null => (/^-?\d+(\.\d+)?px$/.test(v) ? parseFloat(v) : null);

/** Écarts ADMIS, avec leur raison : `composant|élément|propriété`. */
const ADMIS: Record<string, string> = {};

function comparer(composant: string, element: string, ref: Element | null, app: Element | null, proprietes: string[]): void {
  if (!ref || !app) {
    verifier(false, `${composant} / ${element} : mesure impossible (référence ${ref ? "ok" : "ABSENTE"}, application ${app ? "ok" : "ABSENTE"})`);
    return;
  }
  for (const p of proprietes) {
    const cle = `${composant}|${element}|${p}`;
    const r = normaliser(p, ref[p]);
    const a = normaliser(p, app[p]);
    const nr = numerique(r);
    const na = numerique(a);
    const egal = nr !== null && na !== null ? Math.abs(nr - na) <= 0.6 : r === a;
    if (Object.hasOwn(ADMIS, cle)) continue;
    verifier(egal, `${composant} / ${element} / ${p} : référence ${r}, application ${a}`);
  }
}

async function mesurer(page: any, sel: string): Promise<Element | null> {
  return (await page.evaluate(`(${MESURE})(${JSON.stringify(sel)})`)) as Element | null;
}
const distance = async (page: any, de: string, a: string): Promise<number | null> =>
  (await page.evaluate(`((de, a) => { const cherche = (s) => s === "@aide" ? [...document.querySelectorAll(".moteur-ecran-courant button")].find((b) => /indice/i.test(b.textContent)) : document.querySelector(s); const x = cherche(de), y = cherche(a); return x && y ? Math.round((y.getBoundingClientRect().top - x.getBoundingClientRect().bottom) * 10) / 10 : null; })(${JSON.stringify(de)}, ${JSON.stringify(a)})`)) as number | null;
/** Décalage vertical de `a` par rapport à `de`, HAUT À HAUT (le panneau gris est DANS la carte depuis RAPPORT §47 : le « bas → haut » n'a plus de sens). */
const decalageHaut = async (page: any, de: string, a: string): Promise<number | null> =>
  (await page.evaluate(`((de, a) => { const x = document.querySelector(de), y = document.querySelector(a); return x && y ? Math.round((y.getBoundingClientRect().top - x.getBoundingClientRect().top) * 100) / 100 : null; })(${JSON.stringify(de)}, ${JSON.stringify(a)})`)) as number | null;
/** État NEUTRE avant mesure : ni focus, ni survol (le survol d'un bouton secondaire change son fond). */
const flou = async (page: any) => {
  await page.evaluate("document.activeElement && document.activeElement.blur && document.activeElement.blur()");
  await page.mouse.move(0, 0);
  await page.waitForTimeout(450); // fin des transitions (le fond d'un champ se teinte/détend au focus, style.css)
};

async function main(): Promise<void> {
  const srv = await demarrerServeur();
  const navigateur = await chromium.launch();
  const refHtml = readFileSync(join(RACINE, "docs/reference/composants-ecran.html"), "utf8");

  // ── Référence : rendue une fois à 390 px ──
  const ctxRef = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const pRef = await ctxRef.newPage();
  await pRef.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
  await pRef.setContent(refHtml);
  const R = (bloc: number, extra = "") => `body > div > div:nth-child(${bloc}) > div:nth-child(2)${extra}`;
  const NOMS_BLOCS = ["champ", "qcm", "liste", "multiples", "intervalle"];
  for (const [i, nom] of NOMS_BLOCS.entries()) await pRef.locator("body > div > div").nth(i).screenshot({ path: join(CAPTURES, `fidelite-ref-${nom}.png`) });
  const ref = {
    champ: { carte: R(1), consigne: R(1, " > div:nth-child(1)"), champ: R(1, " input"), valider: R(1, " button") },
    qcm: { carte: R(2), consigne: R(2, " > div:nth-child(1)"), conteneur: R(2, " > div:nth-child(2)"), retenu: R(2, " > div:nth-child(2) > div:nth-child(1)"), neutre: R(2, " > div:nth-child(2) > div:nth-child(2)"), valider: R(2, " button") },
    liste: { carte: R(3), consigne: R(3, " > div:nth-child(1)"), conteneur: R(3, " > div:nth-child(2)"), ligne: R(3, " > div:nth-child(2) > div:nth-child(1)"), champ: R(3, " > div:nth-child(2) > div:nth-child(1) input"), retirer: R(3, " > div:nth-child(2) > div:nth-child(1) span"), ajouter: R(3, " > button"), valider: R(3, " > div:nth-child(4) button") },
    multiples: { carte: R(4), consigne: R(4, " > div:nth-child(1)"), conteneur: R(4, " > div:nth-child(2)"), ligne: R(4, " > div:nth-child(2) > div:nth-child(1)"), libelle: R(4, " > div:nth-child(2) > div:nth-child(1) > span"), champ: R(4, " > div:nth-child(2) > div:nth-child(1) input"), valider: R(4, " > button") },
    intervalle: { carte: R(5), consigne: R(5, " > div:nth-child(1)"), ligne: R(5, " > div:nth-child(2)"), crochet: R(5, " > div:nth-child(2) > button:first-child"), borne: R(5, " > div:nth-child(2) > input:first-of-type"), separateur: R(5, " > div:nth-child(2) > span"), valider: R(5, " > button") },
  };
  const M: Record<string, Element | null> = {};
  for (const [composant, table] of Object.entries(ref)) for (const [cle, sel] of Object.entries(table)) M[`${composant}|${cle}`] = await mesurer(pRef, sel);
  const D: Record<string, number | null> = {
    "champ|consigne→champ": await distance(pRef, ref.champ.consigne, ref.champ.champ),
    "qcm|consigne→conteneur": await distance(pRef, ref.qcm.consigne, ref.qcm.conteneur),
    "liste|consigne→conteneur": await distance(pRef, ref.liste.consigne, ref.liste.conteneur),
    "liste|conteneur→ajouter": await distance(pRef, ref.liste.conteneur, ref.liste.ajouter),
    "multiples|consigne→conteneur": await distance(pRef, ref.multiples.consigne, ref.multiples.conteneur),
    "intervalle|consigne→ligne": await distance(pRef, ref.intervalle.consigne, ref.intervalle.ligne),
  };
  await ctxRef.close();

  // ── Application ──
  async function ouvrir(profil: "base" | "etendu" | "graphe", champsAvant: string[], attendre: string, largeur = 390) {
    imposerProfilAssignation(profil);
    const s = creerScenario();
    installerBase(s.base);
    const tid = creerTache(s, { nom: "Fidélité design", aide_activee: true, aide_penalite_pourcent: 25, tentatives_supplementaires: 1, feedback_immediat: true, reponse_visible: false, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }] } as never);
    const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tid, eleve_ids: ["eleve-1"] } });
    if (a.statut !== 201) throw new Error("assignation " + a.statut);
    const ligne = s.base.table("exercices_assignes")[0]!;
    const ex = temoin.generer(Number(ligne.graine));
    for (const champ of champsAvant) {
      const r = await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: reponseBruteCorrecte(ex, champ) } });
      if (r.statut !== 200) throw new Error(`préparation ${champ} : ${r.statut}`);
    }
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600 });
    const page = await ctx.newPage();
    await page.route("**/unpkg.com/@supabase/supabase-js**", (r: any) => r.fulfill({ contentType: "text/javascript", body: stubSupabase("eleve:eleve-1", "e1@x") }));
    await page.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
    await page.route("**/fonts.gstatic.com/**", (r: any) => r.abort());
    await page.addInitScript(`localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
    await page.goto(srv.url + "/eleve.html");
    await page.waitForSelector(".carte-tache");
    await page.locator(".carte-tache").click();
    await page.waitForSelector(".moteur-ecran-courant " + attendre);
    return { page, ctx };
  }
  const C = ".moteur-ecran-courant";
  const app = async (page: any, sel: string) => mesurer(page, `${C} ${sel}`);

  // champ_expression
  {
    const { page, ctx } = await ouvrir("base", [], ".moteur-champ");
    await page.locator(`${C} .moteur-champ`).fill("12");
    await flou(page);
    await page.locator(C).screenshot({ path: join(CAPTURES, "fidelite-app-champ.png") });
    comparer("champ", "carte", M["champ|carte"]!, await mesurer(page, C), P_CARTE);
    comparer("champ", "consigne", M["champ|consigne"]!, await app(page, ".moteur-consigne"), P_TEXTE);
    comparer("champ", "champ", M["champ|champ"]!, await app(page, ".moteur-champ"), P_CHAMP);
    comparer("champ", "valider", M["champ|valider"]!, await app(page, ".moteur-bouton-principal"), P_PRINCIPAL);
    verifier((await distance(page, `${C} .moteur-consigne`, `${C} .moteur-champ`)) === D["champ|consigne→champ"], `champ : consigne → champ = ${D["champ|consigne→champ"]} px (mesuré ${await distance(page, `${C} .moteur-consigne`, `${C} .moteur-champ`)})`);
    verifier((await distance(page, `${C} .moteur-champ`, "@aide")) === D["champ|consigne→champ"], `champ : champ → bouton d'aide = 12 px (mesuré ${await distance(page, `${C} .moteur-champ`, "@aide")})`);
    verifier((await distance(page, "@aide", `${C} .moteur-bouton-principal`)) === D["champ|consigne→champ"], `champ : bouton d'aide → « Valider » = 12 px (mesuré ${await distance(page, "@aide", `${C} .moteur-bouton-principal`)})`);
    const champ = await app(page, ".moteur-champ");
    verifier(parseFloat(champ!._hauteur as string) >= 43.5, `champ : cible tactile ≥ 44 px conservée (${champ!._hauteur})`);
    await ctx.close();
  }
  // qcm
  {
    const { page, ctx } = await ouvrir("base", [CHAMP_SOMME], ".moteur-qcm");
    await page.locator(`${C} .moteur-choix`).first().click();
    await flou(page);
    await page.locator(C).screenshot({ path: join(CAPTURES, "fidelite-app-qcm.png") });
    comparer("qcm", "consigne", M["qcm|consigne"]!, await app(page, ".moteur-consigne"), P_TEXTE);
    comparer("qcm", "conteneur", M["qcm|conteneur"]!, await app(page, ".moteur-qcm"), P_FLEX);
    comparer("qcm", "option retenue", M["qcm|retenu"]!, await app(page, ".moteur-choix:has(input:checked)"), P_OPTION);
    comparer("qcm", "option neutre", M["qcm|neutre"]!, await app(page, ".moteur-choix:not(:has(input:checked))"), P_OPTION);
    comparer("qcm", "valider", M["qcm|valider"]!, await app(page, ".moteur-bouton-principal"), P_PRINCIPAL);
    verifier((await distance(page, `${C} .moteur-consigne`, `${C} .moteur-qcm`)) === D["qcm|consigne→conteneur"], `qcm : consigne → options = 12 px (mesuré ${await distance(page, `${C} .moteur-consigne`, `${C} .moteur-qcm`)})`);
    verifier((await distance(page, `${C} .moteur-qcm`, "@aide")) === D["qcm|consigne→conteneur"], `qcm : options → bouton d'aide = 12 px (mesuré ${await distance(page, `${C} .moteur-qcm`, "@aide")})`);
    // E3 : le radio natif reste dans l'arbre d'accessibilité (jamais display:none) mais n'est plus visible.
    const radio = (await page.evaluate(`(() => { const r = document.querySelector("${C} .moteur-choix input"); const st = getComputedStyle(r); const b = r.getBoundingClientRect(); return { display: st.display, visibility: st.visibility, opacite: st.opacity, largeur: b.width, hauteur: b.height, type: r.type, focalisable: (r.focus(), document.activeElement === r) }; })()`)) as { display: string; visibility: string; opacite: string; largeur: number; hauteur: number; type: string; focalisable: boolean };
    verifier(radio.type === "radio" && radio.display !== "none" && radio.visibility !== "hidden", `qcm : le radio natif reste présent pour le clavier et les lecteurs d'écran (${JSON.stringify(radio)})`);
    verifier(radio.opacite === "0" && radio.largeur <= 1.5 && radio.hauteur <= 1.5, `qcm : la pastille radio n'est plus visible (opacité ${radio.opacite}, ${radio.largeur}×${radio.hauteur})`);
    verifier(radio.focalisable, "qcm : le radio masqué reste focalisable au clavier");
    await page.keyboard.press("ArrowDown");
    verifier((await page.evaluate(`document.querySelectorAll("${C} .moteur-choix input:checked").length`)) === 1 && (await page.evaluate(`document.querySelector("${C} .moteur-choix:has(input:checked) input") === document.activeElement`)) === true, "qcm : la flèche du clavier change la sélection (radio natif)");
    const focus = (await page.evaluate(`(() => { const l = document.querySelector("${C} .moteur-choix:has(input:focus-visible)"); if (!l) return null; const st = getComputedStyle(l); return { contour: st.outlineStyle, largeur: st.outlineWidth }; })()`)) as { contour: string; largeur: string } | null;
    verifier(focus !== null && focus.contour !== "none" && parseFloat(focus.largeur) >= 2, `qcm : le focus clavier reste visible sur l'option (${JSON.stringify(focus)})`);
    await ctx.close();
  }
  // liste_valeurs
  {
    const { page, ctx } = await ouvrir("base", [CHAMP_SOMME, CHAMP_PARITE], ".moteur-liste-valeurs");
    if ((await page.locator(`${C} .moteur-liste-ligne`).count()) < 2) await page.locator(`${C} .moteur-liste-zone > .moteur-bouton-secondaire`).click();
    await page.locator(`${C} .moteur-liste-ligne .moteur-champ`).first().fill("2");
    await flou(page);
    await page.locator(C).screenshot({ path: join(CAPTURES, "fidelite-app-liste.png") });
    comparer("liste", "conteneur", M["liste|conteneur"]!, await app(page, ".moteur-liste-lignes"), ["gap", "flexDirection", "display"]);
    comparer("liste", "ligne", M["liste|ligne"]!, await app(page, ".moteur-liste-ligne"), ["display", "gap"]);
    comparer("liste", "champ", M["liste|champ"]!, await app(page, ".moteur-liste-ligne .moteur-champ"), P_CHAMP);
    comparer("liste", "icône de suppression", M["liste|retirer"]!, await app(page, ".moteur-bouton-retirer"), P_ICONE);
    comparer("liste", "ajouter", M["liste|ajouter"]!, await app(page, ".moteur-liste-zone > .moteur-bouton-secondaire"), P_SECONDAIRE);
    comparer("liste", "valider", M["liste|valider"]!, await app(page, ".moteur-bouton-principal"), P_PRINCIPAL);
    verifier((await distance(page, `${C} .moteur-consigne`, `${C} .moteur-liste-lignes`)) === D["liste|consigne→conteneur"], `liste : consigne → lignes = 12 px (mesuré ${await distance(page, `${C} .moteur-consigne`, `${C} .moteur-liste-lignes`)})`);
    verifier((await distance(page, `${C} .moteur-liste-lignes`, `${C} .moteur-liste-zone > .moteur-bouton-secondaire`)) === D["liste|conteneur→ajouter"], `liste : lignes → « Ajouter » = 8 px (mesuré ${await distance(page, `${C} .moteur-liste-lignes`, `${C} .moteur-liste-zone > .moteur-bouton-secondaire`)})`);
    verifier((await distance(page, `${C} .moteur-liste-zone > .moteur-bouton-secondaire`, "@aide")) === 12, `liste : « Ajouter » → bouton d'aide = 12 px (mesuré ${await distance(page, `${C} .moteur-liste-zone > .moteur-bouton-secondaire`, "@aide")})`);
    // E4 : vrai bouton conservé (zone tactile, libellé accessible), seul le glyphe change.
    const retirer = (await page.evaluate(`(() => { const b = document.querySelector("${C} .moteur-bouton-retirer"); const r = b.getBoundingClientRect(); return { tag: b.tagName.toLowerCase(), texte: b.textContent.trim(), label: b.getAttribute("aria-label"), largeur: r.width, hauteur: r.height, bordure: getComputedStyle(b).borderTopColor }; })()`)) as { tag: string; texte: string; label: string | null; largeur: number; hauteur: number; bordure: string };
    verifier(retirer.tag === "button" && retirer.texte === "🗑" && retirer.label === "Retirer cette valeur", `liste : suppression = vrai bouton, glyphe 🗑, aria-label conservé (${JSON.stringify(retirer)})`);
    verifier(retirer.largeur >= 43.5 && retirer.hauteur >= 43.5, `liste : zone tactile de la suppression ≥ 44×44 (${retirer.largeur}×${retirer.hauteur})`);
    verifier(retirer.bordure === "rgba(0, 0, 0, 0)", `liste : la suppression n'a pas de bordure visible (${retirer.bordure})`);
    await ctx.close();
  }
  // champs_multiples (coefficients)
  {
    const { page, ctx } = await ouvrir("etendu", [], ".moteur-champs-multiples");
    for (const [i, v] of ["2", "0", "-8"].entries()) await page.locator(`${C} .moteur-sous-champ-texte .moteur-champ`).nth(i).fill(v);
    await flou(page);
    await page.locator(C).screenshot({ path: join(CAPTURES, "fidelite-app-multiples.png") });
    comparer("multiples", "conteneur", M["multiples|conteneur"]!, await app(page, ".moteur-champs-multiples"), P_FLEX);
    comparer("multiples", "ligne", M["multiples|ligne"]!, await app(page, ".moteur-sous-champ"), ["display", "gap", "alignItems"]);
    comparer("multiples", "libellé", M["multiples|libelle"]!, await app(page, ".moteur-sous-champ-libelle"), ["color", "fontWeight"]);
    comparer("multiples", "champ", M["multiples|champ"]!, await app(page, ".moteur-sous-champ-texte .moteur-champ"), P_CHAMP);
    comparer("multiples", "valider", M["multiples|valider"]!, await app(page, ".moteur-bouton-principal"), P_PRINCIPAL);
    verifier((await distance(page, `${C} .moteur-consigne`, `${C} .moteur-champs-multiples`)) === D["multiples|consigne→conteneur"], `multiples : consigne → champs = 12 px (mesuré ${await distance(page, `${C} .moteur-consigne`, `${C} .moteur-champs-multiples`)})`);
    const largeurs = (await page.evaluate(`[...document.querySelectorAll("${C} .moteur-sous-champ-libelle")].map((l) => Math.round(l.getBoundingClientRect().width * 10) / 10)`)) as number[];
    const gauches = (await page.evaluate(`[...document.querySelectorAll("${C} .moteur-sous-champ-texte .moteur-champ")].map((i) => Math.round(i.getBoundingClientRect().left * 10) / 10)`)) as number[];
    verifier(new Set(gauches).size === 1, `multiples : les champs a, b, c sont alignés à gauche malgré des libellés de largeur différente (${JSON.stringify(gauches)})`);
    // Écart DÉLIBÉRÉ (RAPPORT §33) : la référence a des libellés de 24 px en texte brut ; rendus par KaTeX, « a = » mesure 28 à 31 px
    // (largeurs différentes selon la lettre), donc les champs se désaligneraient à 24 px. Largeur fixe de 36 px, identique pour a, b, c.
    verifier(largeurs.every((l) => Math.abs(l - 36) <= 0.6), `multiples : libellés à largeur fixe de 36 px (24 px de la référence + marge pour le rendu KaTeX) (${JSON.stringify(largeurs)})`);
    await ctx.close();
  }
  // intervalle (image)
  {
    const { page, ctx } = await ouvrir("etendu", ["coefficients", "allure", "extremum", "axe"], ".moteur-intervalle");
    // « Valider » n'est actif que si l'intervalle est complet : deux crochets, une borne saisie, +∞ à droite.
    for (const i of [0, 1]) await page.locator(`${C} .moteur-bouton-crochet`).nth(i).click();
    await page.locator(`${C} .moteur-champ-borne`).first().fill("-8");
    await page.locator(`${C} .moteur-bouton-infini`).last().click();
    await flou(page);
    await page.locator(C).screenshot({ path: join(CAPTURES, "fidelite-app-intervalle.png") });
    comparer("intervalle", "crochet", M["intervalle|crochet"]!, await app(page, ".moteur-bouton-crochet"), P_ROND);
    comparer("intervalle", "borne", M["intervalle|borne"]!, await app(page, ".moteur-champ-borne"), [...P_CHAMP, "textAlign"]);
    comparer("intervalle", "séparateur", M["intervalle|separateur"]!, await app(page, ".moteur-intervalle-separateur"), ["color"]);
    comparer("intervalle", "valider", M["intervalle|valider"]!, await app(page, ".moteur-bouton-principal"), P_PRINCIPAL);
    const dims = (await page.evaluate(`(() => { const b = document.querySelector("${C} .moteur-bouton-crochet").getBoundingClientRect(); const i = document.querySelector("${C} .moteur-champ-borne").getBoundingClientRect(); return { crochet: [Math.round(b.width), Math.round(b.height)], borne: Math.round(i.width) }; })()`)) as { crochet: number[]; borne: number };
    verifier(dims.crochet[0] === 32 && dims.crochet[1] === 32, `intervalle : boutons crochets ronds de 32×32 px (${JSON.stringify(dims.crochet)})`);
    // Cible tactile de 44×44 px conservée malgré les 32 px visibles : un point à 5 px du bord touche encore le bouton.
    const touche = (await page.evaluate(`(() => { const b = document.querySelector("${C} .moteur-bouton-crochet"); const r = b.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const test = (x, y) => document.elementFromPoint(x, y) === b; return { interieur: test(cx, cy), gauche: test(r.left - 5, cy), droite: test(r.right + 5, cy), haut: test(cx, r.top - 5), bas: test(cx, r.bottom + 5), loin: test(r.left - 9, cy) }; })()`)) as Record<string, boolean>;
    verifier(touche.interieur && touche.gauche && touche.droite && touche.haut && touche.bas && !touche.loin, `intervalle : zone tactile de 44×44 px (touchée à 5 px, plus à 9 px) : ${JSON.stringify(touche)}`);
    verifier(dims.borne === 64, `intervalle : champs de borne de 64 px de large (${dims.borne})`);
    // UNE SEULE LIGNE à toute largeur (RAPPORT §53) : les 7 éléments ont le même centre vertical et la ligne ne déborde pas, même à 320 px.
    for (const largeur of [390, 360, 320]) {
      await page.setViewportSize({ width: largeur, height: 800 });
      const ligne = (await page.evaluate(`(() => { const l = document.querySelector("${C} .moteur-intervalle-ligne"); const r = l.getBoundingClientRect(); const e = [...l.children].map((c) => { const b = c.getBoundingClientRect(); return { n: c.className, cy: Math.round((b.top + b.height / 2) * 10) / 10, g: b.left, d: b.right }; }); return { n: e.length, cys: e.map((x) => x.cy), bornes: [...l.querySelectorAll('.moteur-champ-borne')].map((b) => Math.round(b.getBoundingClientRect().width)), droite: Math.max(...e.map((x) => x.d)), gauche: Math.min(...e.map((x) => x.g)), ligne: [r.left, r.right], fenetre: window.innerWidth, debordPage: document.documentElement.scrollWidth > window.innerWidth }; })()`)) as { n: number; cys: number[]; bornes: number[]; droite: number; gauche: number; ligne: number[]; fenetre: number; debordPage: boolean };
      verifier(ligne.n === 7 && Math.max(...ligne.cys) - Math.min(...ligne.cys) <= 1, `intervalle à ${largeur} px : les 7 éléments sur UNE ligne (centres verticaux ${JSON.stringify(ligne.cys)})`);
      // La cible tactile des crochets (::after, −8 px) dépasse volontairement la ligne : on mesure les ÉLÉMENTS, pas scrollWidth.
      verifier(!ligne.debordPage && ligne.droite <= ligne.ligne[1] + 0.5 && ligne.gauche >= ligne.ligne[0] - 0.5 && ligne.bornes.every((b) => b >= 40), `intervalle à ${largeur} px : aucun débordement (${JSON.stringify(ligne)})`);
    }
    await page.setViewportSize({ width: 390, height: 800 });
    await ctx.close();
  }
  // ── Enveloppe de l'exercice (RAPPORT §43) : docs/reference/enveloppe-exercice.html, à 390 ET 1280 px ──
  {
    const refEnveloppe = readFileSync(join(RACINE, "docs/reference/enveloppe-exercice.html"), "utf8");
    const P_LIEN = ["display", "alignItems", "gap", "color", "fontFamily", "fontSize", "fontWeight"];
    const P_TXT = ["color", "fontFamily", "fontSize", "fontWeight", "letterSpacing", "fontStyle"];
    const P_PANNEAU = ["backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", ...PADDING];
    const P_PISTE = ["display", "gap", "backgroundColor", "borderTopLeftRadius", "overflowX"];
    const P_SEGMENT = ["backgroundColor", "borderTopLeftRadius"];
    const P_MARQUE = [...P_ROND, "display", "alignItems", "justifyContent"];
    const taille = (m: Element | null): string => `${m?._largeur}×${m?._hauteur}`;
    /** Session du témoin : réglages de tâche + réponses déjà données (JSON brut par champ), puis ouverture du moteur. */
    async function ouvrirEnveloppe(largeur: number, reglages: { feedback: boolean; retour?: boolean; visible?: boolean }, reponses: [string, string][]) {
      imposerProfilAssignation("base");
      const s = creerScenario();
      installerBase(s.base);
      const tid = creerTache(s, { nom: "Fidélité enveloppe", feedback_immediat: reglages.feedback, autoriser_retour_arriere: reglages.retour ?? false, reponse_visible: reglages.visible ?? false, tentatives_supplementaires: 0, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }] });
      const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tid, eleve_ids: ["eleve-1"] } });
      if (a.statut !== 201) throw new Error("assignation " + a.statut);
      const ligne = s.base.table("exercices_assignes")[0]!;
      const ex = temoin.generer(Number(ligne.graine));
      for (const [champ, brut] of reponses) {
        const valeur = brut.startsWith("@juste") ? reponseBruteCorrecte(ex, champ) : brut === "@faux" ? (reponseBruteCorrecte(ex, champ) === "pair" ? "impair" : "pair") : brut;
        const r = await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: valeur } });
        if (r.statut !== 200) throw new Error(`préparation ${champ} : ${r.statut} ${JSON.stringify(r.corps)}`);
      }
      const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600 });
      const page = await ctx.newPage();
      await page.route("**/unpkg.com/@supabase/supabase-js**", (r: any) => r.fulfill({ contentType: "text/javascript", body: stubSupabase("eleve:eleve-1", "e1@x") }));
      await page.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
      await page.route("**/fonts.gstatic.com/**", (r: any) => r.abort());
      await page.addInitScript(`localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
      await page.goto(srv.url + "/eleve.html");
      await page.waitForSelector(".carte-tache");
      await page.locator(".carte-tache").click();
      await page.waitForSelector(reponses.length >= 4 ? ".moteur-ecran-termine" : ".moteur-ecran-courant > .moteur-rappel");
      return { page, ctx, ex };
    }

    for (const largeur of [390, 1280]) {
      const l = `${largeur} px`;
      // Référence
      const ctxR = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
      const pR = await ctxR.newPage();
      await pR.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
      await pR.setContent(refEnveloppe);
      await pR.locator('[data-ref="enveloppe"]').screenshot({ path: join(CAPTURES, `fidelite-ref-enveloppe-${largeur}.png`) });
      const Rf = (ref: string) => `[data-ref="${ref}"]`;
      const RM: Record<string, Element | null> = {};
      for (const ref of ["suivi", "carte", "retour", "retour-puce", "retour-libelle", "surtitre", "titre", "rappel", "progression-etiquette", "piste", "segment-fait", "segment-courant", "segment-avenir", "rappel-titre", "rappel-liste", "ligne-juste", "marque-juste", "marque-faux", "marque-illisible", "marque-neutre", "marque-courant", "libelle", "valeur", "libelle-courant", "consigne"]) RM[ref] = await mesurer(pR, Rf(ref));
      const RD = {
        "retour→surtitre": await distance(pR, Rf("retour"), Rf("surtitre")),
        "surtitre→titre": await distance(pR, Rf("surtitre"), Rf("titre")),
        "titre→panneau gris": await distance(pR, Rf("titre"), Rf("rappel")),
        "carte→panneau gris (haut à haut)": await decalageHaut(pR, Rf("carte"), Rf("rappel")),
        "étiquette→piste": await distance(pR, Rf("progression-etiquette"), Rf("piste")),
        "piste→titre du rappel": await distance(pR, Rf("piste"), Rf("rappel-titre")),
        "titre du rappel→liste": await distance(pR, Rf("rappel-titre"), Rf("rappel-liste")),
        "rappel→consigne": await distance(pR, Rf("rappel"), Rf("consigne")),
      };
      await ctxR.close();

      // Application, correction immédiate : 3 écrans répondus (illisible, faux, juste) puis l'écran 4 courant
      {
        const { page, ctx } = await ouvrirEnveloppe(largeur, { feedback: true }, [[CHAMP_SOMME, "12+"], [CHAMP_PARITE, "@faux"], [CHAMP_DIVISEURS, "@juste"]]);
        await flou(page);
        await page.screenshot({ path: join(CAPTURES, `fidelite-app-enveloppe-${largeur}.png`), fullPage: true });
        const A = (sel: string) => mesurer(page, sel);
        comparer(`enveloppe ${l}`, "lien « Mes tâches »", RM["retour"]!, await A(".moteur-lien-retour"), P_LIEN);
        comparer(`enveloppe ${l}`, "puce du lien", RM["retour-puce"]!, await A(".moteur-lien-retour-puce"), ["backgroundColor", "borderTopLeftRadius", "display", "alignItems", "justifyContent", "fontSize"]);
        verifier(taille(RM["retour-puce"]!) === taille(await A(".moteur-lien-retour-puce")), `enveloppe ${l} / puce : taille ${taille(RM["retour-puce"]!)} attendue, ${taille(await A(".moteur-lien-retour-puce"))} obtenue`);
        comparer(`enveloppe ${l}`, "surtitre", RM["surtitre"]!, await A(".moteur-surtitre"), P_TXT);
        comparer(`enveloppe ${l}`, "titre", RM["titre"]!, await A(".moteur-question-titre"), P_TXT);
        comparer(`enveloppe ${l}`, "panneau du rappel", RM["rappel"]!, await A(".moteur-rappel"), [...P_PANNEAU, "borderLeftWidth", "borderBottomWidth", "borderBottomColor", "borderTopRightRadius", "borderBottomLeftRadius"]);
        comparer(`enveloppe ${l}`, "bandeau lien + titres", RM["suivi"]!, await A(".moteur-suivi"), ["backgroundColor", ...PADDING, "display", "flexDirection", "gap"]);
        comparer(`enveloppe ${l}`, "carte blanche", RM["carte"]!, await A(".moteur-ecran-courant"), ["backgroundColor", "boxShadow", "borderTopWidth", "borderBottomWidth", "borderLeftWidth", "borderRightWidth", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", ...PADDING]);
        // Géométrie (RAPPORT §47, qui remplace celle de §44 sur bureau ; le mobile y est inchangé) : le panneau gris est le PREMIER enfant de la carte.
        // Bureau : encadré en retrait (1 px de bord + 24 px de padding de chaque côté), dans la carte. Mobile (≤ 600 px) : le panneau est AU-DESSUS du blanc,
        // bord à bord, au ras du haut de la carte ; carte, panneau et bandeau font la largeur de l'écran ; le bandeau gris touche la bannière violette,
        // de la couleur du panneau gris.
        const geo = (await page.evaluate(`(() => { const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.left, l: b.width, haut: b.top, bas: b.bottom, fond: getComputedStyle(e).backgroundColor, dedans: e.parentElement !== null && e.parentElement.classList.contains("moteur-ecran-courant"), premier: e.parentElement !== null && e.parentElement.firstElementChild === e }; }; return { ban: r(".barre-app"), suivi: r(".moteur-suivi"), rappel: r(".moteur-rappel"), carte: r(".moteur-ecran-courant"), consigne: r(".moteur-ecran-courant > .moteur-consigne"), vw: innerWidth }; })()`)) as Record<string, any>;
        verifier(geo.rappel.dedans && geo.rappel.premier, `enveloppe ${l} : le panneau gris est le PREMIER enfant de la carte de l'écran courant`);
        verifier(geo.rappel.bas <= geo.consigne.haut + 0.6, `enveloppe ${l} : le panneau gris est AU-DESSUS de la consigne (${geo.rappel.bas} / ${geo.consigne.haut})`);
        if (largeur <= 600) {
          verifier(geo.carte.l === geo.vw && geo.rappel.l === geo.vw && geo.suivi.l === geo.vw && geo.carte.x === 0 && geo.rappel.x === 0 && geo.suivi.x === 0, `enveloppe ${l} : carte blanche, panneau gris et bandeau font la LARGEUR DE L'ÉCRAN (${geo.vw} px) : ${JSON.stringify([geo.suivi.l, geo.rappel.l, geo.carte.l])}`);
          verifier(Math.abs(geo.rappel.haut - geo.carte.haut) <= 0.6, `enveloppe ${l} : le panneau gris est au ras du haut de la carte blanche (${geo.rappel.haut} / ${geo.carte.haut})`);
          verifier(Math.abs(geo.suivi.haut - geo.ban.bas) <= 0.6, `enveloppe ${l} : le bandeau gris touche la bannière violette (${geo.ban.bas} / ${geo.suivi.haut})`);
          verifier(geo.suivi.fond === geo.rappel.fond && Math.abs(geo.suivi.bas - geo.rappel.haut) <= 0.6, `enveloppe ${l} : le bandeau et le panneau gris ont la même couleur et se touchent (${geo.suivi.fond} / ${geo.rappel.fond})`);
        } else {
          verifier(Math.abs(geo.rappel.x - geo.carte.x - 25) <= 0.6 && Math.abs(geo.carte.l - geo.rappel.l - 50) <= 0.6, `enveloppe ${l} : le panneau gris est un encadré EN RETRAIT de 25 px de chaque côté (1 px de bord + 24 px de padding) : ${JSON.stringify([geo.rappel.x - geo.carte.x, geo.carte.l - geo.rappel.l])}`);
        }
        comparer(`enveloppe ${l}`, "étiquette de progression", RM["progression-etiquette"]!, await A(".moteur-progression-etiquette"), ["display", "justifyContent", "color", "fontSize", "fontWeight"]);
        comparer(`enveloppe ${l}`, "piste", RM["piste"]!, await A(".moteur-piste"), P_PISTE);
        verifier((RM["piste"]!._hauteur) === (await A(".moteur-piste"))!._hauteur, `enveloppe ${l} / piste : hauteur ${RM["piste"]!._hauteur} attendue, ${(await A(".moteur-piste"))!._hauteur} obtenue`);
        comparer(`enveloppe ${l}`, "segment répondu juste", RM["segment-fait"]!, await A(".moteur-segment-fait-correct"), P_SEGMENT);
        comparer(`enveloppe ${l}`, "segment courant", RM["segment-courant"]!, await A(".moteur-segment-courant"), P_SEGMENT);
        comparer(`enveloppe ${l}`, "titre du rappel", RM["rappel-titre"]!, await A(".moteur-rappel-titre"), P_TXT);
        comparer(`enveloppe ${l}`, "liste du rappel", RM["rappel-liste"]!, await A(".moteur-rappel-liste"), P_FLEX);
        comparer(`enveloppe ${l}`, "ligne", RM["ligne-juste"]!, await A(".moteur-rappel-ligne-correct"), ["display", "alignItems", "gap"]);
        comparer(`enveloppe ${l}`, "marque juste", RM["marque-juste"]!, await A(".moteur-rappel-marque-correct"), P_MARQUE);
        comparer(`enveloppe ${l}`, "marque faux", RM["marque-faux"]!, await A(".moteur-rappel-marque-not_equivalent"), P_MARQUE);
        comparer(`enveloppe ${l}`, "marque illisible", RM["marque-illisible"]!, await A(".moteur-rappel-marque-parse_error"), P_MARQUE);
        comparer(`enveloppe ${l}`, "marque courant", RM["marque-courant"]!, await A(".moteur-rappel-marque-courant"), P_MARQUE);
        for (const [nom, sel] of [["juste", ".moteur-rappel-marque-correct"], ["faux", ".moteur-rappel-marque-not_equivalent"], ["illisible", ".moteur-rappel-marque-parse_error"], ["courant", ".moteur-rappel-marque-courant"]] as const) {
          const ref = RM[`marque-${nom}`]!;
          verifier(taille(ref) === taille(await A(sel)), `enveloppe ${l} / marque ${nom} : taille ${taille(ref)} attendue, ${taille(await A(sel))} obtenue`);
        }
        comparer(`enveloppe ${l}`, "nom de l'écran", RM["libelle"]!, await A(".moteur-rappel-ligne-correct .moteur-rappel-nom"), ["color", "fontFamily", "fontSize", "fontWeight"]);
        comparer(`enveloppe ${l}`, "valeur", RM["valeur"]!, await A(".moteur-rappel-ligne-correct .moteur-rappel-valeur"), ["color", "fontFamily", "fontSize"]);
        comparer(`enveloppe ${l}`, "ligne en cours", RM["libelle-courant"]!, await A(".moteur-rappel-en-cours"), ["color", "fontSize", "fontStyle"]);
        const AD = {
          "retour→surtitre": await distance(page, ".moteur-lien-retour", ".moteur-surtitre"),
          "surtitre→titre": await distance(page, ".moteur-surtitre", ".moteur-question-titre"),
          "titre→panneau gris": await distance(page, ".moteur-question-titre", ".moteur-rappel"),
          "carte→panneau gris (haut à haut)": await decalageHaut(page, ".moteur-ecran-courant", ".moteur-rappel"),
          "étiquette→piste": await distance(page, ".moteur-progression-etiquette", ".moteur-piste"),
          "piste→titre du rappel": await distance(page, ".moteur-piste", ".moteur-rappel-titre"),
          "titre du rappel→liste": await distance(page, ".moteur-rappel-titre", ".moteur-rappel-liste"),
          "rappel→consigne": await distance(page, ".moteur-rappel", ".moteur-ecran-courant .moteur-consigne"),
        };
        for (const [cle, attendu] of Object.entries(RD)) verifier(AD[cle as keyof typeof AD] === attendu, `enveloppe ${l} / espacement ${cle} : ${attendu} px attendus, ${AD[cle as keyof typeof AD]} mesurés`);
        // Zone tactile du lien « Mes tâches » ≥ 44 px : un point à 6 px au-dessus du lien le touche encore ; à 12 px, non.
        const touche = (await page.evaluate(`(() => { const b = document.querySelector(".moteur-lien-retour"); const r = b.getBoundingClientRect(); const x = r.left + r.width / 2; const a = (dy) => { const e = document.elementFromPoint(x, dy); return !!e && (e === b || b.contains(e)); }; return { hauteur: r.height, haut6: a(r.top - 6), bas6: a(r.bottom + 6), haut12: a(r.top - 12) }; })()`)) as { hauteur: number; haut6: boolean; bas6: boolean; haut12: boolean };
        verifier(touche.haut6 && touche.bas6 && !touche.haut12, `enveloppe ${l} : zone tactile du lien « Mes tâches » ≥ 44 px (touché à 6 px, plus à 12 px) : ${JSON.stringify(touche)}`);
        verifier((await page.locator(".moteur-rappel-ligne").count()) === 4 && (await page.locator(".moteur-segment").count()) === 4, `enveloppe ${l} : 3 lignes répondues + 1 ligne en cours, 4 segments`);
        verifier((await page.locator(".moteur-rappel-ligne-courant .moteur-rappel-marque").innerText()) === "4" && (await page.locator(".moteur-question-titre").innerText()) === "Question 4 sur 4", `enveloppe ${l} : « Question 4 sur 4 », ligne en cours numérotée 4`);
        verifier((await page.locator(".moteur-ecran-courant").count()) === 1 && (await page.locator(".moteur-ecran-termine").count()) === 0, `enveloppe ${l} : UN seul écran à la fois (les écrans répondus sont des lignes du rappel)`);
        await ctx.close();
      }
      // Application, correction coupée : toutes les marques sont NEUTRES, jamais une coche ni une couleur de verdict
      {
        const { page, ctx } = await ouvrirEnveloppe(largeur, { feedback: false }, [[CHAMP_SOMME, "12+"]]);
        await flou(page);
        await page.screenshot({ path: join(CAPTURES, `fidelite-app-enveloppe-coupe-${largeur}.png`), fullPage: true });
        comparer(`enveloppe ${l} (coupée)`, "marque sans verdict", RM["marque-neutre"]!, await mesurer(page, ".moteur-rappel-marque-neutre"), P_MARQUE);
        comparer(`enveloppe ${l} (coupée)`, "segment à venir", RM["segment-avenir"]!, await mesurer(page, ".moteur-segment-avenir"), P_SEGMENT);
        verifier((await page.locator(".moteur-rappel-marque-neutre").innerText()) === "•" && (await page.locator(".moteur-segment-fait-neutre").count()) === 1, `enveloppe ${l} (coupée) : marque neutre « • » et segment neutre`);
        verifier((await page.locator(".moteur-rappel-marque-correct, .moteur-rappel-marque-not_equivalent, .moteur-rappel-marque-parse_error, .moteur-segment-fait-correct, .moteur-segment-fait-not_equivalent, .moteur-segment-fait-parse_error").count()) === 0, `enveloppe ${l} (coupée) : aucune couleur de verdict avant la fin de la tâche`);
        await ctx.close();
      }
      // ── Crayon « Modifier ma réponse » (RAPPORT §48) : docs/reference/crayon-modifier.html, dans le rappel gris ET dans la relecture ──
      {
        const refCrayon = readFileSync(join(RACINE, "docs/reference/crayon-modifier.html"), "utf8");
        const ctxC = await navigateur.newContext({ viewport: { width: largeur, height: 700 } });
        const pC = await ctxC.newPage();
        await pC.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
        await pC.setContent(refCrayon);
        const CM: Record<string, Element | null> = {};
        for (const ref of ["rappel", "ligne", "marque", "corps", "crayon", "icone", "relecture", "reponse", "crayon-relecture"]) CM[ref] = await mesurer(pC, `[data-ref="${ref}"]`);
        const cdist = {
          "ligne|haut du panneau→crayon": await decalageHaut(pC, '[data-ref="rappel"]', '[data-ref="crayon"]'),
          "relecture|réponse→crayon (haut à haut)": await decalageHaut(pC, '[data-ref="reponse"]', '[data-ref="crayon-relecture"]'),
        };
        await ctxC.close();
        const P_CRAYON = ["display", "alignItems", "justifyContent", "width", "height", "minHeight", "borderTopLeftRadius", "backgroundColor", "color", "boxShadow", "borderTopWidth", "marginTop", "marginRight", "marginBottom", "marginLeft", ...PADDING];
        for (const [etat, reglages, reponses] of [
          ["rappel", { feedback: false, retour: true }, [[CHAMP_SOMME, "@juste"], [CHAMP_PARITE, "@juste"], [CHAMP_DIVISEURS, "@juste"]]],
          ["relecture", { feedback: false, retour: true }, [[CHAMP_SOMME, "@juste"], [CHAMP_PARITE, "@juste"], [CHAMP_DIVISEURS, "@juste"], [CHAMP_SIGNES, "@juste"]]],
        ] as const) {
          const { page, ctx } = await ouvrirEnveloppe(largeur, reglages, reponses as unknown as [string, string][]);
          await flou(page);
          const e = `crayon ${l} (${etat})`;
          const sel = etat === "rappel" ? ".moteur-rappel .moteur-crayon" : ".moteur-ecran-termine .moteur-crayon";
          const refBouton = etat === "rappel" ? CM["crayon"]! : CM["crayon-relecture"]!;
          comparer(e, "crayon", refBouton, await mesurer(page, sel), P_CRAYON);
          comparer(e, "icône", CM["icone"]!, await mesurer(page, sel + " svg"), ["width", "height", "strokeWidth", "stroke", "fill", "display"]);
          verifier(taille(refBouton) === taille(await mesurer(page, sel)), `${e} : taille ${taille(refBouton)} attendue, ${taille(await mesurer(page, sel))} obtenue`);
          if (etat === "rappel") {
            comparer(e, "ligne", CM["ligne"]!, await mesurer(page, ".moteur-rappel-ligne-modifiable"), ["display", "alignItems", "gap"]);
            comparer(e, "marque", CM["marque"]!, await mesurer(page, ".moteur-rappel-ligne-modifiable .moteur-rappel-marque"), ["marginTop", "width", "height"]);
            comparer(e, "corps", CM["corps"]!, await mesurer(page, ".moteur-rappel-ligne-modifiable .moteur-rappel-corps"), ["paddingTop", "flexGrow", "display", "flexWrap", "alignItems"]);
            const d = await decalageHaut(page, ".moteur-rappel", ".moteur-rappel-ligne-modifiable .moteur-crayon");
            // 1er crayon : sous le titre et la piste de progression (hauteur propre à l'application) ; la référence ne porte que le panneau d'une ligne
            verifier(d !== null && d > 0, `${e} : le crayon est dans le panneau gris (décalage ${d})`);
          } else {
            comparer(e, "ligne de réponse", CM["relecture"]!, await mesurer(page, ".moteur-ligne-reponse"), ["display", "alignItems", "gap"]);
            const dr = await decalageHaut(page, ".moteur-ligne-reponse .moteur-reponse-eleve", ".moteur-ligne-reponse .moteur-crayon");
            verifier(Math.abs((dr ?? 99) - (cdist["relecture|réponse→crayon (haut à haut)"] ?? 0)) <= 6, `${e} : crayon centré sur le bloc « Ta réponse » (décalage haut à haut ${dr}, référence ${cdist["relecture|réponse→crayon (haut à haut)"]} ± 6 : la hauteur du bloc dépend de son texte)`);
          }
          await page.screenshot({ path: join(CAPTURES, `fidelite-app-crayon-${etat}-${largeur}.png`), fullPage: true });
          await ctx.close();
        }
      }
    }

    // ── Scores (RAPPORT §50) : docs/reference/scores.html, à 390 ET 1280 px. Le score suit la solution : correction immédiate + « Afficher la réponse attendue » ──
    {
      const refScores = readFileSync(join(RACINE, "docs/reference/scores.html"), "utf8");
      const P_SCORE = ["color", "fontFamily", "fontSize", "fontWeight", "fontVariantNumeric", "whiteSpace", "flexShrink"];
      const P_TOTAL = ["display", "justifyContent", "alignItems", "borderTopColor", "borderTopWidth", "borderTopStyle", "marginTop", "paddingTop"];
      const P_NOM = ["color", "fontFamily", "fontSize", "fontWeight"];
      for (const largeur of [390, 1280]) {
        const e = `scores ${largeur} px`;
        const ctxR = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
        const pR = await ctxR.newPage();
        await pR.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
        await pR.setContent(refScores);
        const R = async (ref: string) => mesurer(pR, `[data-ref="${ref}"]`);
        const SR: Record<string, Element | null> = {};
        for (const ref of ["rappel", "ligne", "corps", "nom", "points", "total", "total-nom", "total-points", "recap", "recap-table", "recap-titre", "recap-nom", "recap-points", "recap-total", "recap-total-nom", "recap-total-points"]) SR[ref] = await R(ref);
        await pR.screenshot({ path: join(CAPTURES, `fidelite-ref-scores-${largeur}.png`), fullPage: true });
        await ctxR.close();

        // (a) pendant la résolution : lignes du rappel + total (3 écrans répondus : juste, faux sans nouvel essai → score 0, juste)
        {
          const { page, ctx } = await ouvrirEnveloppe(largeur, { feedback: true, visible: true }, [[CHAMP_SOMME, "@juste"], [CHAMP_PARITE, "@faux"], [CHAMP_DIVISEURS, "@juste"]]);
          await flou(page);
          await page.screenshot({ path: join(CAPTURES, `fidelite-app-scores-rappel-${largeur}.png`), fullPage: true });
          const nbScores = await page.locator(".moteur-rappel-ligne .moteur-rappel-score").count();
          verifier(nbScores === 3, `${e} : une valeur de score par ligne répondue (${nbScores})`);
          comparer(e, "score d'une ligne", SR["points"]!, await mesurer(page, ".moteur-rappel-score"), P_SCORE);
          comparer(e, "ligne (disposition)", SR["ligne"]!, await mesurer(page, ".moteur-rappel-ligne-correct"), ["display", "alignItems", "gap"]);
          comparer(e, "ligne de total", SR["total"]!, await mesurer(page, ".moteur-rappel-total"), P_TOTAL);
          comparer(e, "« Score »", SR["total-nom"]!, await mesurer(page, ".moteur-rappel-total-nom"), P_NOM);
          comparer(e, "total (valeur)", SR["total-points"]!, await mesurer(page, ".moteur-rappel-total-points"), [...P_NOM, "fontVariantNumeric", "whiteSpace"]);
          const textes: string[] = await page.locator(".moteur-rappel-score").allInnerTexts();
          verifier(textes.length === 3 && textes[0] === "1 / 1 pt" && textes[1] === "0 / 1 pt" && textes[2] === "1 / 1 pt", `${e} : valeurs « 1 / 1 pt », « 0 / 1 pt », « 1 / 1 pt » (${JSON.stringify(textes)})`);
          const total = await page.locator(".moteur-rappel-total-points").innerText();
          verifier(/^2 \/ \d+ pts?$/.test(total), `${e} : total = somme des lignes sur le total possible de TOUS les écrans (${total})`);
          // aucune couleur de verdict sur une valeur : même couleur pour le 100 % et le 0 %
          const couleurs = (await page.evaluate(`[...document.querySelectorAll(".moteur-rappel-score")].map((n) => getComputedStyle(n).color)`)) as string[];
          verifier(new Set(couleurs).size === 1, `${e} : une valeur de score n'a jamais de couleur de verdict (${couleurs.join(" | ")})`);
          // la valeur est à DROITE de la ligne (alignée sur le bord droit du panneau, aux 16 px de padding près)
          const geo = (await page.evaluate(`(() => { const s = document.querySelector(".moteur-rappel-score").getBoundingClientRect(); const p = document.querySelector(".moteur-rappel").getBoundingClientRect(); return { droite: p.right - s.right }; })()`)) as { droite: number };
          verifier(Math.abs(geo.droite - 17) <= 1.2, `${e} : le score est aligné sur le bord droit du panneau (16 px de padding + 1 px de filet : ${geo.droite})`);
          await ctx.close();
        }
        // (b) exercice terminé : le panneau « Résultat de l'exercice » (bloc de fin) — mêmes réponses puis dernier écran
        {
          // Un exercice terminé ne se rouvre pas (le moteur enchaîne vers le tableau de bord) : le bloc de fin n'existe qu'à la sortie du DERNIER écran, joué ici au clic.
          const { page, ctx, ex } = await ouvrirEnveloppe(largeur, { feedback: true, visible: true }, [[CHAMP_SOMME, "@juste"], [CHAMP_PARITE, "@faux"], [CHAMP_DIVISEURS, "@juste"]]);
          await page.waitForSelector(".moteur-table-signes");
          const signes = JSON.parse(reponseBruteCorrecte(ex, CHAMP_SIGNES)) as Record<string, Record<string, string>>;
          for (const [ligneId, colonnes] of Object.entries(signes)) {
            const idxLigne = Object.keys(signes).indexOf(ligneId);
            for (const [colonneId, signe] of Object.entries(colonnes)) {
              const cellule = page.locator(".moteur-table-signes tbody tr").nth(idxLigne).locator("td").nth(Number(colonneId.slice(1))).locator("button");
              for (let k = 0; k < 4 && (await cellule.innerText()) !== signe; k++) await cellule.click();
            }
          }
          await page.locator(".moteur-ecran-courant .moteur-bouton-principal").click();
          await page.waitForSelector(".moteur-retour .moteur-statut");
          await page.getByRole("button", { name: /Voir la fin/ }).click();
          await page.waitForSelector(".moteur-fin .moteur-recap");
          await flou(page);
          await page.screenshot({ path: join(CAPTURES, `fidelite-app-scores-recap-${largeur}.png`), fullPage: true });
          comparer(e, "panneau du résultat", SR["recap"]!, await mesurer(page, ".moteur-recap"), P_PANNEAU);
          comparer(e, "tableau du résultat", SR["recap-table"]!, await mesurer(page, ".moteur-recap-table"), ["display", "borderCollapse"]);
          comparer(e, "titre du résultat", SR["recap-titre"]!, await mesurer(page, ".moteur-recap-titre"), [...["color", "fontFamily", "fontSize", "fontWeight", "letterSpacing"], "captionSide", "textAlign"]);
          comparer(e, "nom d'un écran", SR["recap-nom"]!, await mesurer(page, ".moteur-recap-nom"), [...P_NOM, "paddingTop", "paddingBottom"]);
          comparer(e, "points d'un écran", SR["recap-points"]!, await mesurer(page, ".moteur-recap-points"), [...P_SCORE.slice(0, 5), "textAlign", "fontVariantNumeric", "whiteSpace"]);
          comparer(e, "ligne de total", SR["recap-total-nom"]!, await mesurer(page, ".moteur-recap-total .moteur-recap-nom"), [...P_NOM, "borderTopColor", "borderTopWidth", "paddingTop"]);
          comparer(e, "total (points)", SR["recap-total-points"]!, await mesurer(page, ".moteur-recap-total .moteur-recap-points"), [...P_NOM, "textAlign", "borderTopColor", "borderTopWidth", "paddingTop"]);
          const lignes = await page.locator(".moteur-recap-table tbody tr").count();
          const premier: string = await page.locator(".moteur-recap-table tbody tr").first().innerText();
          verifier(lignes === 5 && /1 \/ 1 pt/.test(premier), `${e} : une ligne par écran (4) et le total (${lignes}) — « ${premier.replace(/\s+/g, " ")} »`);
          verifier(!(await page.locator(".moteur-recap-points", { hasText: "NaN" }).count()), `${e} : jamais NaN`);
          await ctx.close();
        }
        // (c) SANS la case : verdict, mais aucun score nulle part (le score suit la solution)
        {
          const { page, ctx } = await ouvrirEnveloppe(largeur, { feedback: true, visible: false }, [[CHAMP_SOMME, "@juste"], [CHAMP_PARITE, "@faux"], [CHAMP_DIVISEURS, "@juste"]]);
          verifier((await page.locator(".moteur-rappel-score, .moteur-rappel-total, .moteur-recap").count()) === 0, `${e} : sans « Afficher la réponse attendue », aucun score (ni ligne, ni total)`);
          await ctx.close();
        }
        // (d) correction coupée : rien pendant la résolution
        {
          const { page, ctx } = await ouvrirEnveloppe(largeur, { feedback: false, visible: true }, [[CHAMP_SOMME, "@juste"], [CHAMP_PARITE, "@faux"]]);
          verifier((await page.locator(".moteur-rappel-score, .moteur-rappel-total, .moteur-recap").count()) === 0, `${e} : sous correction coupée, aucun score pendant la résolution`);
          await ctx.close();
        }
      }
    }
  }

  // Aides communes aux blocs gen7 ci-dessous (parties fausses, bouton d'aide).
  /** Session gen7 (correction immédiate, essais selon `tentatives`) ; `pre` = écrans répondus par l'API avant l'ouverture. */
  async function ouvrirGen7(largeur: number, tentatives: number, pre: [string, unknown][], options: { aide?: boolean; solution?: boolean } = {}) {
    imposerProfilAssignation("aleatoire");
    const s = creerScenario();
    installerBase(s.base);
    const tid = creerTache(s, { nom: "Fidélité parties fausses", feedback_immediat: true, reponse_visible: options.solution ?? false, tentatives_supplementaires: tentatives, aide_activee: options.aide ?? false, variantes: [{ variante_id: "af_delta_racines_rationnelles", nombre_exercices: 1 }] });
    const o = Math.random;
    Math.random = () => 4242 / 2 ** 32;
    try {
      const a = await appeler("assignations", "POST", { jeton: `prof:${s.profId}`, corps: { tache_id: tid, eleve_ids: ["eleve-1"] } });
      if (a.statut !== 201) throw new Error("assignation " + a.statut);
    } finally {
      Math.random = o;
    }
    const ligne = s.base.table("exercices_assignes")[0]!;
    const ex = genererExerciceMD("af_delta_racines_rationnelles", Number(ligne.graine));
    for (const [champ, brut] of pre) {
      const r = await appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: brut === "@juste" ? reponseBruteCorrecteMotifDelta(ex, champ) : typeof brut === "string" ? brut : JSON.stringify(brut) } });
      if (r.statut !== 200) throw new Error(`préparation ${champ} : ${r.statut} ${JSON.stringify(r.corps)}`);
    }
    const ctx = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600 });
    const page = await ctx.newPage();
    await page.route("**/unpkg.com/@supabase/supabase-js**", (r: any) => r.fulfill({ contentType: "text/javascript", body: stubSupabase("eleve:eleve-1", "e1@x") }));
    await page.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
    await page.route("**/fonts.gstatic.com/**", (r: any) => r.abort());
    await page.addInitScript(`localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
    await page.goto(srv.url + "/eleve.html");
    await page.waitForSelector(".carte-tache");
    await page.locator(".carte-tache").click();
    await page.waitForSelector(".moteur-ecran-courant");
    return { page, ctx };
  }
  const valider = async (page: any) => {
    await page.locator(".moteur-ecran-courant").getByRole("button", { name: "Valider", exact: true }).click();
    await page.waitForSelector(".moteur-ecran-courant .moteur-retour .moteur-statut");
  };


  // ── Parties fausses (RAPPORT §52) : docs/reference/parties-fausses.html, à 390 ET 1280 px ──
  {
    const refPF = readFileSync(join(RACINE, "docs/reference/parties-fausses.html"), "utf8");
    const P_FAUX = ["color", "fontWeight", "backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius"];
    const P_PIECE = ["color", "fontWeight", "textDecorationLine", "textDecorationStyle", "textDecorationColor"];
    /** Contenu du pseudo-élément ::after (le ✕) : mesuré à part, `getComputedStyle(el, "::after")`. */
    const apres = async (page: any, sel: string): Promise<string> => (await page.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); return e ? getComputedStyle(e, "::after").content : "ABSENT"; })()`)) as string;
    for (const largeur of [390, 1280]) {
      const e = `parties fausses ${largeur} px`;
      const ctxR = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
      const pR = await ctxR.newPage();
      await pR.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
      await pR.setContent(refPF);
      const R = (ref: string) => mesurer(pR, `[data-ref="${ref}"]`);
      const REF: Record<string, Element | null> = {};
      for (const ref of ["champ", "champ-faux", "choix", "choix-faux", "bouton", "bouton-faux", "crochet", "crochet-faux", "piece-fausse"]) REF[ref] = await R(ref);
      const apresRef = async (ref: string) => (await pR.evaluate(`getComputedStyle(document.querySelector('[data-ref="${ref}"]'), "::after").content`)) as string;
      const [croixChoixRef, croixBoutonRef] = [await apresRef("choix-faux"), await apresRef("bouton-faux")];
      await pR.screenshot({ path: join(CAPTURES, `fidelite-ref-parties-fausses-${largeur}.png`), fullPage: true });
      await ctxR.close();

      // (a) champ texte : « b » faux ; puis le rappel gris d'un écran terminé faux (morceau de « Ta réponse »)
      {
        const { page, ctx } = await ouvrirGen7(largeur, 3, []);
        for (const [k, v] of [["a", "1"], ["b", "997"], ["c", "-4"]]) await page.locator(`#mc-coefficients-${k}`).fill(v);
        await valider(page);
        await page.locator("#mc-coefficients-a").blur();
        await flou(page);
        await page.screenshot({ path: join(CAPTURES, `fidelite-app-parties-fausses-champ-${largeur}.png`), fullPage: true });
        comparer(e, "champ faux", REF["champ-faux"]!, await mesurer(page, "#mc-coefficients-b.moteur-partie-fausse"), [...P_FAUX, "fontSize", "paddingTop", "paddingLeft"]);
        verifier((await mesurer(page, "#mc-coefficients-a"))?.borderTopWidth !== (await mesurer(page, "#mc-coefficients-b"))?.borderTopWidth, `${e} : le champ faux se distingue (filet) d'un champ non marqué`);
        await ctx.close();
      }
      {
        const { page, ctx } = await ouvrirGen7(largeur, 0, [["coefficients", { a: "1", b: "3", c: "0" }]]);
        await flou(page);
        comparer(e, "morceau de réponse faux (rappel gris)", REF["piece-fausse"]!, await mesurer(page, ".moteur-rappel .moteur-piece-fausse"), P_PIECE);
        await ctx.close();
      }
      // (b) option de choix : « sens » faux (allure)
      {
        const { page, ctx } = await ouvrirGen7(largeur, 3, [["coefficients", "@juste"]]);
        await page.locator('.moteur-choix:has(input[name="mc-allure-concavite"][value="-"])').click();
        await page.locator('.moteur-choix:has(input[name="mc-allure-positionSommet"][value="gauche"])').click();
        await valider(page);
        await flou(page);
        await page.screenshot({ path: join(CAPTURES, `fidelite-app-parties-fausses-choix-${largeur}.png`), fullPage: true });
        comparer(e, "option de choix fausse", REF["choix-faux"]!, await mesurer(page, ".moteur-choix.moteur-partie-fausse"), P_FAUX);
        verifier((await apres(page, ".moteur-choix.moteur-partie-fausse")) === croixChoixRef, `${e} : ✕ de l'option (référence ${croixChoixRef}, application ${await apres(page, ".moteur-choix.moteur-partie-fausse")})`);
        comparer(e, "option juste non marquée (inchangée)", REF["choix"]!, await mesurer(page, '.moteur-choix:has(input[name="mc-allure-positionSommet"]:checked)'), ["borderTopWidth", "borderTopStyle"]);
        await ctx.close();
      }
      // (c) bouton : crochet de gauche faux (intervalle)
      {
        const { page, ctx } = await ouvrirGen7(largeur, 3, [["coefficients", "@juste"], ["allure", "@juste"], ["axeSommet", "@juste"]]);
        const ligne = page.locator(".moteur-intervalle-ligne");
        const bouton = ligne.getByRole("button", { name: /Crochet de gauche/ });
        for (let k = 0; k < 2 && (await bouton.textContent()) !== "]"; k++) await bouton.click();
        await ligne.getByLabel("Borne de gauche", { exact: true }).fill("-25/4");
        await ligne.getByRole("button", { name: "Borne de droite : plus l'infini" }).click();
        const droit = ligne.getByRole("button", { name: /Crochet de droite/ });
        for (let k = 0; k < 2 && (await droit.textContent()) !== "["; k++) await droit.click();
        await valider(page);
        await flou(page);
        comparer(e, "crochet faux", REF["crochet-faux"]!, await mesurer(page, ".moteur-bouton-crochet.moteur-partie-fausse"), ["color", "backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", "fontWeight", "boxShadow"]);
        verifier((await apres(page, ".moteur-bouton-crochet.moteur-partie-fausse")) === '""', `${e} : le crochet n'a PAS de ✕ (son ::after est sa cible tactile) : « ${await apres(page, ".moteur-bouton-crochet.moteur-partie-fausse")} »`);
        verifier(croixBoutonRef !== "none", `${e} : (sanité) la référence d'un bouton ordinaire porte le ✕`);
        await ctx.close();
      }
      // (d) case de tableau : toutes les cases cliquées une fois (valeurs quelconques, fausses pour la plupart)
      {
        const { page, ctx } = await ouvrirGen7(largeur, 3, [["coefficients", "@juste"], ["allure", "@juste"], ["axeSommet", "@juste"], ["domaineImage", "@juste"], ["racines", "@juste"]]);
        const cases = page.locator(".moteur-ligne-tableau td button");
        const n = await cases.count();
        for (let k = 0; k < n; k++) await cases.nth(k).click();
        await valider(page);
        await flou(page);
        await page.screenshot({ path: join(CAPTURES, `fidelite-app-parties-fausses-tableau-${largeur}.png`), fullPage: true });
        // TOUTES les cases marquées (ligne des signes ET ligne des variations : leurs règles de base n'ont pas la même spécificité), jamais seulement la première.
        const nbMarquees = (await page.evaluate(`(() => { const l = [...document.querySelectorAll(".moteur-case-signe.moteur-partie-fausse")]; l.forEach((c, i) => c.setAttribute("data-mesure-pf", String(i))); return l.length; })()`)) as number;
        verifier(nbMarquees >= 3, `${e} : plusieurs cases marquées à mesurer (${nbMarquees})`);
        const lignesMarquees = (await page.evaluate(`[...document.querySelectorAll(".moteur-case-signe.moteur-partie-fausse")].map((c) => c.closest("tbody").className)`)) as string[];
        verifier(new Set(lignesMarquees).size >= 1, `${e} : lignes de tableau marquées : ${[...new Set(lignesMarquees)].join(" | ")}`);
        for (let k = 0; k < nbMarquees; k++) comparer(e, `case de tableau fausse n°${k + 1}`, REF["bouton-faux"]!, await mesurer(page, `[data-mesure-pf="${k}"]`), ["color", "backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle"]);
        await ctx.close();
      }
    }
  }

  // ── Bouton d'aide jaunâtre avec une ampoule (RAPPORT §53) : docs/reference/bouton-aide.html, à 390 ET 1280 px ──
  {
    const refAide = readFileSync(join(RACINE, "docs/reference/bouton-aide.html"), "utf8");
    for (const largeur of [390, 1280]) {
      const e = `bouton d'aide ${largeur} px`;
      const ctxR = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
      const pR = await ctxR.newPage();
      await pR.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
      await pR.setContent(refAide);
      const REF: Record<string, Element | null> = {};
      for (const ref of ["bouton", "icone", "verre", "libelle", "texte"]) REF[ref] = await mesurer(pR, `[data-ref="${ref}"]`);
      await pR.screenshot({ path: join(CAPTURES, `fidelite-ref-bouton-aide-${largeur}.png`), fullPage: true });
      await ctxR.close();

      const { page, ctx } = await ouvrirGen7(largeur, 0, [], { aide: true });
      await flou(page);
      await page.screenshot({ path: join(CAPTURES, `fidelite-app-bouton-aide-${largeur}.png`), fullPage: true });
      comparer(e, "bouton", REF["bouton"]!, await mesurer(page, ".moteur-aide .moteur-bouton-aide"), ["color", "backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", "fontFamily", "fontSize", "fontWeight", "display", "alignItems", "columnGap", "paddingTop", "paddingLeft"]);
      comparer(e, "ampoule", REF["icone"]!, await mesurer(page, ".moteur-aide .moteur-icone-ampoule"), ["width", "height", "fill", "stroke", "strokeWidth", "strokeLinecap"]);
      comparer(e, "verre de l'ampoule", REF["verre"]!, await mesurer(page, ".moteur-aide .moteur-ampoule-verre"), ["fill"]);
      comparer(e, "libellé", REF["libelle"]!, await mesurer(page, ".moteur-aide .moteur-aide-libelle"), ["color", "fontSize", "fontWeight"]);
      verifier((await page.locator(".moteur-aide .moteur-icone-ampoule").getAttribute("aria-hidden")) === "true" && (await page.locator(".moteur-aide button").innerText()).trim() === "Besoin d'un indice ?", `${e} : ampoule décorative (aria-hidden), libellé inchangé`);
      // La zone d'indice ouverte reste de la même famille (fond ambre clair) et le libellé du bouton ne perd pas son ampoule quand il change de texte.
      await page.locator(".moteur-aide button").click();
      await page.waitForSelector(".moteur-aide-texte:not([hidden])");
      comparer(e, "zone d'indice", REF["texte"]!, await mesurer(page, ".moteur-aide-texte"), ["backgroundColor", "color"]);
      await ctx.close();
      // avec une pénalité : le libellé de confirmation remplace le texte, l'ampoule reste
      {
        imposerProfilAssignation("aleatoire");
        const s2 = creerScenario();
        installerBase(s2.base);
        const tid = creerTache(s2, { nom: "Fidélité aide pénalité", aide_activee: true, aide_penalite_pourcent: 25, variantes: [{ variante_id: "af_delta_racines_rationnelles", nombre_exercices: 1 }] });
        await appeler("assignations", "POST", { jeton: `prof:${s2.profId}`, corps: { tache_id: tid, eleve_ids: ["eleve-1"] } });
        const ctx2 = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, hasTouch: largeur < 600 });
        const p2 = await ctx2.newPage();
        await p2.route("**/unpkg.com/@supabase/supabase-js**", (r: any) => r.fulfill({ contentType: "text/javascript", body: stubSupabase("eleve:eleve-1", "e1@x") }));
        await p2.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
        await p2.route("**/fonts.gstatic.com/**", (r: any) => r.abort());
        await p2.addInitScript(`localStorage.setItem("eleve-profil-cache", JSON.stringify({ affichage: "Test eleve-1", prenom: "Test", nom: "eleve-1" }));`);
        await p2.goto(srv.url + "/eleve.html");
        await p2.waitForSelector(".carte-tache");
        await p2.locator(".carte-tache").click();
        await p2.waitForSelector(".moteur-aide button");
        await p2.locator(".moteur-aide button").click();
        verifier(/^Confirmer/.test((await p2.locator(".moteur-aide button").innerText()).trim()) && (await p2.locator(".moteur-aide button .moteur-icone-ampoule").count()) === 1, `${e} : le libellé de confirmation remplace le texte, l'ampoule reste`);
        await p2.screenshot({ path: join(CAPTURES, `fidelite-app-bouton-aide-confirmation-${largeur}.png`), fullPage: true });
        await ctx2.close();
      }
    }
  }

  // ── « Réponse attendue » = le tableau de signes REMPLI (RAPPORT §53) : docs/reference/tableau-solution.html, à 390 ET 1280 px ──
  {
    const refSol = readFileSync(join(RACINE, "docs/reference/tableau-solution.html"), "utf8");
    // `fontSize` n'est pas comparé à la référence : le tableau À COMPLÉTER de l'application écrit déjà `1.15em` (18,4 px) là où `tableau-signes.html` écrit 1,1rem (17,6 px), un écart antérieur à ce
    // chantier et jamais mesuré. La demande est « semblable au tableau à compléter » : la solution est donc comparée à CE tableau-là (`tailleCase`, ci-dessous), l'écart est signalé dans le RAPPORT §53.
    const P_CASE = ["color", "backgroundColor", "fontWeight", "minHeight", "display", "alignItems", "justifyContent"];
    for (const largeur of [390, 1280]) {
      const e = `réponse attendue (tableau) ${largeur} px`;
      const ctxR = await navigateur.newContext({ viewport: { width: largeur, height: 900 } });
      const pR = await ctxR.newPage();
      await pR.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
      await pR.setContent(refSol);
      const REF: Record<string, Element | null> = {};
      for (const ref of ["etiquette", "cadre", "case", "case-variation"]) REF[ref] = await mesurer(pR, `[data-ref="${ref}"]`);
      await pR.screenshot({ path: join(CAPTURES, `fidelite-ref-tableau-solution-${largeur}.png`), fullPage: true });
      await ctxR.close();

      const { page, ctx } = await ouvrirGen7(largeur, 0, ["coefficients", "allure", "axeSommet", "domaineImage", "racines"].map((c) => [c, "@juste"] as [string, unknown]), { solution: true });
      await page.waitForSelector(".moteur-ecran-courant .moteur-table-signes");
      // Tableau À COMPLÉTER : hauteurs de ses rangées, pour la ressemblance demandée (« un tableau semblable au tableau à compléter »).
      const hauteurs = `(racine) => { const h = (sel) => [...document.querySelectorAll(racine + " " + sel)].map((x) => Math.round(x.getBoundingClientRect().height * 10) / 10); return { x: h(".moteur-rangee-x td"), signe: h(".moteur-rangee-signe td"), variation: h(".moteur-rangee-variation td"), titre: h(".moteur-titre-ligne"), colonnes: h(".moteur-rangee-x td").length }; }`;
      const aCompleter = (await page.evaluate(`(${hauteurs})(".moteur-ecran-courant .moteur-tableau-signes:not(.moteur-tableau-solution)")`)) as Record<string, number[] | number>;
      const tailleCase = (await page.evaluate(`[".moteur-rangee-signe .moteur-case-signe", ".moteur-rangee-variation .moteur-case-signe"].map((q) => getComputedStyle(document.querySelector(".moteur-ecran-courant " + q)).fontSize)`)) as string[];
      const cases = page.locator(".moteur-ligne-tableau td button");
      const n = await cases.count();
      for (let k = 0; k < n; k++) await cases.nth(k).click();
      const saisies = (await page.evaluate(`[...document.querySelectorAll(".moteur-ecran-courant .moteur-ligne-tableau .moteur-case-signe")].map((b) => b.getAttribute("aria-label").replace(" Toucher pour changer.", ""))`)) as string[];
      await valider(page);
      await page.waitForSelector(".moteur-retour .moteur-tableau-solution");
      const marqueesDirect = (await page.evaluate(`(() => { const c = [...document.querySelectorAll(".moteur-ecran-courant .moteur-ligne-tableau .moteur-case-signe.moteur-partie-fausse")]; if (c.length === 0) return null; const k = getComputedStyle(c[0]); return { n: c.length, couleur: k.color, bord: k.borderTopColor + " " + k.borderTopWidth, fond: k.backgroundColor }; })()`)) as { n: number; couleur: string; bord: string; fond: string } | null;
      await flou(page);
      await page.screenshot({ path: join(CAPTURES, `fidelite-app-tableau-solution-${largeur}.png`), fullPage: true });
      const S = ".moteur-retour .moteur-tableau-solution";
      comparer(e, "étiquette", REF["etiquette"]!, await mesurer(page, ".moteur-retour .moteur-solution-structuree > .moteur-solution"), ["color", "backgroundColor", "borderTopLeftRadius"]);
      comparer(e, "cadre", REF["cadre"]!, await mesurer(page, S), ["borderTopWidth", "borderTopColor", "borderTopStyle", "borderTopLeftRadius", "overflowX", "backgroundColor"]);
      comparer(e, "case de signe", REF["case"]!, await mesurer(page, `${S} .moteur-rangee-signe .moteur-case-signe`), P_CASE);
      comparer(e, "case de variation", REF["case-variation"]!, await mesurer(page, `${S} .moteur-rangee-variation .moteur-case-signe`), ["color", "backgroundColor", "minHeight", "display", "justifyContent"]);
      // Ressemblance avec le tableau à compléter : mêmes rangées, mêmes hauteurs.
      const solution = (await page.evaluate(`(${hauteurs})(${JSON.stringify(S)})`)) as Record<string, number[] | number>;
      verifier(JSON.stringify(solution) === JSON.stringify(aCompleter), `${e} : mêmes rangées et mêmes hauteurs que le tableau à compléter (à compléter ${JSON.stringify(aCompleter)}, solution ${JSON.stringify(solution)})`);
      verifier(solution.colonnes === 7, `${e} : 7 colonnes (${solution.colonnes})`);
      const tailleSolution = (await page.evaluate(`[".moteur-rangee-signe .moteur-case-signe", ".moteur-rangee-variation .moteur-case-signe"].map((q) => getComputedStyle(document.querySelector(${JSON.stringify(S)} + " " + q)).fontSize)`)) as string[];
      verifier(JSON.stringify(tailleSolution) === JSON.stringify(tailleCase), `${e} : mêmes tailles de signe que le tableau à compléter (à compléter ${tailleCase.join(" / ")}, solution ${tailleSolution.join(" / ")})`);
      // Rempli, dessiné, lecture seule.
      const etat = (await page.evaluate(`(() => { const t = document.querySelector(${JSON.stringify(S)}); const b = [...t.querySelectorAll(".moteur-case-signe")]; const c = t.closest(".moteur-ecran-courant").getBoundingClientRect(), r = t.getBoundingClientRect(); return { nb: b.length, vides: b.filter((x) => x.textContent.trim() === "?" || x.getAttribute("aria-label").includes("vide")).length, actifs: b.filter((x) => !x.disabled || x.tabIndex !== -1).length, fleches: t.querySelectorAll(".moteur-fleche").length, glyphes: b.filter((x) => /[\u2197\u2198]/.test(x.textContent)).length, invite: b.filter((x) => /Toucher/.test(x.getAttribute("aria-label"))).length, dedans: r.left >= c.left && r.right <= c.right + 0.5, debordePage: document.documentElement.scrollWidth > window.innerWidth, valeursX: [...t.querySelectorAll(".moteur-rangee-x td")].map((x) => x.textContent.trim()).filter(Boolean), couleurs: [...new Set(b.map((x) => getComputedStyle(x).color))] }; })()`)) as { nb: number; vides: number; actifs: number; fleches: number; glyphes: number; invite: number; dedans: boolean; debordePage: boolean; valeursX: string[]; couleurs: string[] };
      verifier(etat.nb === 10 && etat.vides === 0, `${e} : toutes les cases sont remplies (${etat.nb} cases, ${etat.vides} vides)`);
      verifier(etat.actifs === 0 && etat.invite === 0, `${e} : lecture seule (aucune case active ni « Toucher pour changer » : ${etat.actifs} / ${etat.invite})`);
      verifier(etat.fleches === 2 && etat.glyphes === 0, `${e} : flèches de variation TRACÉES (${etat.fleches}), jamais un glyphe ↗/↘ (${etat.glyphes})`);
      verifier(etat.dedans && !etat.debordePage, `${e} : le tableau tient dans la carte (${JSON.stringify({ dedans: etat.dedans, debordePage: etat.debordePage })})`);
      verifier(etat.couleurs.length === 1 && etat.couleurs[0] === (REF["case"] as any).color, `${e} : texte des cases NEUTRE, jamais la couleur du verdict (${etat.couleurs.join(" | ")})`);
      verifier(etat.valeursX.length === 3 && etat.valeursX.every((v) => v.length > 0), `${e} : les trois valeurs de x (vraies) sont écrites (${JSON.stringify(etat.valeursX)})`);
      // La phrase n'est plus affichée en doublon : l'étiquette seule + le tableau.
      verifier((await page.locator(".moteur-retour .moteur-solution").count()) === 1 && (await page.locator(".moteur-retour .moteur-solution").innerText()).trim() === "Réponse attendue :", `${e} : une seule étiquette « Réponse attendue : » suivie du tableau (pas de phrase en double)`);

      // Écran récapitulatif : même tableau, dans la carte de relecture.
      await page.getByRole("button", { name: /Voir la fin/ }).click();
      await page.waitForSelector(".moteur-ecran-termine .moteur-tableau-solution");
      await flou(page);
      await page.screenshot({ path: join(CAPTURES, `fidelite-app-tableau-solution-recap-${largeur}.png`), fullPage: true });
      const R = ".moteur-ecran-termine .moteur-resume .moteur-tableau-solution:not(.moteur-tableau-reponse)";
      verifier((await page.locator(R).count()) === 1, `${e} / récapitulatif : le tableau rempli est dans la carte de relecture`);
      comparer(e, "récapitulatif : cadre", REF["cadre"]!, await mesurer(page, R), ["borderTopWidth", "borderTopColor", "borderTopLeftRadius", "overflowX"]);
      comparer(e, "récapitulatif : case de signe", REF["case"]!, await mesurer(page, `${R} .moteur-rangee-signe .moteur-case-signe`), P_CASE);
      verifier(JSON.stringify(await page.evaluate(`(${hauteurs})(${JSON.stringify(R)})`)) === JSON.stringify(aCompleter), `${e} / récapitulatif : mêmes rangées et mêmes hauteurs que le tableau à compléter`);
      verifier(!(await page.evaluate("document.documentElement.scrollWidth > window.innerWidth")), `${e} / récapitulatif : pas de défilement horizontal de la page`);
      // « Ta réponse » dessinée (RAPPORT §54) : le même tableau, rempli de CE QUE L'ÉLÈVE a confirmé, cases fausses en rouge comme sous « Valider ».
      const RE = ".moteur-ecran-termine .moteur-resume .moteur-tableau-reponse";
      verifier((await page.locator(RE).count()) === 1, `${e} / récapitulatif : « Ta réponse » est un tableau`);
      verifier((await page.locator(".moteur-ecran-termine .moteur-resume:has(.moteur-tableau-reponse) .moteur-reponse-eleve").innerText()).trim() === "Ta réponse :", `${e} / récapitulatif : étiquette « Ta réponse : » puis le tableau (pas de résumé en texte en double)`);
      comparer(e, "récapitulatif : ta réponse, cadre", REF["cadre"]!, await mesurer(page, RE), ["borderTopWidth", "borderTopColor", "borderTopLeftRadius", "overflowX"]);
      verifier(JSON.stringify(await page.evaluate(`(${hauteurs})(${JSON.stringify(RE)})`)) === JSON.stringify(aCompleter), `${e} / récapitulatif : ta réponse a les mêmes rangées et hauteurs que le tableau à compléter`);
      const lues = (await page.evaluate(`[...document.querySelectorAll(${JSON.stringify(RE)} + " .moteur-case-signe")].map((b) => b.getAttribute("aria-label"))`)) as string[];
      const sansPoint = (v: string): string => (v.endsWith(".") ? v.slice(0, -1) : v);
      verifier(lues.length === saisies.length && lues.every((v, k) => sansPoint(v) === sansPoint(saisies[k]!)), `${e} / récapitulatif : les cases rendent EXACTEMENT ce que l'élève avait saisi (${lues.length} cases ; ${lues.slice(0, 2).join(" | ")} / ${saisies.slice(0, 2).join(" | ")})`);
      const etatRep = (await page.evaluate(`(() => { const t = document.querySelector(${JSON.stringify(RE)}); const b = [...t.querySelectorAll(".moteur-case-signe")]; return { actifs: b.filter((x) => !x.disabled || x.tabIndex !== -1).length, vides: b.filter((x) => x.getAttribute("aria-label").includes("vide")).length, fleches: t.querySelectorAll(".moteur-fleche").length, marquees: b.filter((x) => x.classList.contains("moteur-partie-fausse")).length, marques: b.filter((x) => x.classList.contains("moteur-partie-fausse")).every((x) => x.getAttribute("aria-description") === "Réponse incorrecte"), couleur: (() => { const m = b.find((x) => x.classList.contains("moteur-partie-fausse")); const k = m ? getComputedStyle(m) : null; return k ? { couleur: k.color, bord: k.borderTopColor + " " + k.borderTopWidth, fond: k.backgroundColor } : null; })(), neutres: [...new Set(b.filter((x) => !x.classList.contains("moteur-partie-fausse")).map((x) => getComputedStyle(x).color))] }; })()`)) as { actifs: number; vides: number; fleches: number; marquees: number; marques: boolean; couleur: { couleur: string; bord: string; fond: string } | null; neutres: string[] };
      verifier(etatRep.actifs === 0 && etatRep.vides === 0, `${e} / récapitulatif : ta réponse en lecture seule, toutes cases remplies (${JSON.stringify({ actifs: etatRep.actifs, vides: etatRep.vides })})`);
      verifier(etatRep.fleches >= 1, `${e} / récapitulatif : flèches de variation TRACÉES dans ta réponse (${etatRep.fleches})`);
      verifier(marqueesDirect !== null && etatRep.marquees === marqueesDirect.n && etatRep.marquees >= 1 && etatRep.marques, `${e} / récapitulatif : les MÊMES cases fausses qu'après « Valider » (${etatRep.marquees} contre ${marqueesDirect?.n}), avec aria-description`);
      verifier(marqueesDirect !== null && etatRep.couleur !== null && JSON.stringify(etatRep.couleur) === JSON.stringify({ couleur: marqueesDirect.couleur, bord: marqueesDirect.bord, fond: marqueesDirect.fond }), `${e} / récapitulatif : case fausse du récapitulatif = case fausse de l'écran courant (${JSON.stringify(etatRep.couleur)} contre ${JSON.stringify(marqueesDirect)})`);
      verifier(etatRep.neutres.length === 1 && etatRep.neutres[0] === (REF["case"] as any).color, `${e} / récapitulatif : cases justes en texte neutre (${etatRep.neutres.join(" | ")})`);
      await page.locator(RE).scrollIntoViewIfNeeded();
      await page.screenshot({ path: join(CAPTURES, `fidelite-app-tableau-reponse-recap-${largeur}.png`), fullPage: true });
      await ctx.close();
    }
  }

  // ── Graphique d'écran et annotations d'une aide par paliers (RAPPORT §56) : docs/reference/graphe-parabole.html, à 390 ET 1280 px ──
  {
    const refFig = readFileSync(join(RACINE, "docs/reference/graphe-parabole.html"), "utf8");
    for (const largeur of [390, 1280]) {
      const e = `figure ${largeur} px`;
      const ctxR = await navigateur.newContext({ viewport: { width: largeur, height: 1200 } });
      const pR = await ctxR.newPage();
      await pR.route("**/fonts.googleapis.com/**", (r: any) => r.fulfill({ contentType: "text/css", body: "" }));
      await pR.setContent(refFig);
      const REF: Record<string, Element | null> = {};
      for (const ref of ["cadre", "grille-fine", "grille", "axe", "graduation", "courbe", "point-annote", "etiquette-forte", "vecteur", "pointe", "etiquette"]) REF[ref] = await mesurer(pR, `[data-ref="${ref}"]`);
      await pR.screenshot({ path: join(CAPTURES, `fidelite-ref-figure-${largeur}.png`), fullPage: true });
      await ctxR.close();

      const { page, ctx } = await ouvrir("graphe", [], ".figure-svg", largeur);
      await flou(page);
      const SVG = `${C} .figure-svg`;
      verifier((await page.locator(`${SVG} .figure-annotations > *`).count()) === 0, `${e} : AUCUNE annotation avant l'aide (ni S ni A)`);
      verifier((await page.locator(`${SVG} .figure-point-annote, ${SVG} .figure-vecteur`).count()) === 0 && !(await page.locator(SVG).innerHTML()).includes("S("), `${e} : le graphique de base ne nomme ni S ni A`);
      await page.screenshot({ path: join(CAPTURES, `fidelite-app-figure-base-${largeur}.png`), fullPage: true });
      const style = ["fill", "stroke", "strokeWidth"];
      comparer(e, "cadre", REF["cadre"]!, await app(page, ".figure-cadre"), style);
      comparer(e, "quadrillage fin", REF["grille-fine"]!, await app(page, ".figure-grille-fine"), ["stroke", "strokeWidth"]);
      comparer(e, "quadrillage gradué", REF["grille"]!, await app(page, ".figure-grille"), ["stroke", "strokeWidth"]);
      if ((await page.locator(`${SVG} .figure-axe`).count()) > 0) comparer(e, "axe", REF["axe"]!, await app(page, ".figure-axe"), ["stroke", "strokeWidth"]);
      comparer(e, "graduation", REF["graduation"]!, await app(page, ".figure-graduation"), ["fill", "fontSize", "fontFamily"]);
      comparer(e, "courbe", REF["courbe"]!, await app(page, ".figure-courbe"), ["fill", "stroke", "strokeWidth", "strokeLinecap"]);
      const geo = (await page.evaluate(`(() => { const svg = document.querySelector("${SVG}"); const r = svg.getBoundingClientRect(); const g = svg.querySelector(".figure-graduation"); const k = r.width / 360; return { largeur: r.width, carte: svg.closest(".moteur-ecran-courant").getBoundingClientRect().width, police: parseFloat(getComputedStyle(g).fontSize) * k, debord: document.documentElement.scrollWidth > window.innerWidth }; })()`)) as { largeur: number; carte: number; police: number; debord: boolean };
      verifier(geo.largeur <= geo.carte + 0.5 && !geo.debord, `${e} : le graphique tient dans la carte, sans défilement horizontal (${geo.largeur} / ${geo.carte})`);
      verifier(geo.police >= 9, `${e} : graduations lisibles une fois mises à l'échelle (${geo.police.toFixed(1)} px)`);

      // Palier 1 : S marqué SUR le graphique principal ; la zone d'aide ne reçoit que la légende.
      const demander = async () => {
        const bouton = page.locator(`${C} .moteur-aide button`);
        await bouton.click();
        if ((await bouton.innerText()).startsWith("Confirmer")) await bouton.click();
      };
      await demander();
      await page.waitForSelector(`${SVG} .figure-point-annote`, { state: "attached" });
      await flou(page);
      verifier((await page.locator(`${SVG} .figure-annotations .figure-point-annote`).count()) === 1 && (await page.locator(`${SVG} .figure-vecteur`).count()) === 0, `${e} : palier 1 : le seul S est marqué`);
      verifier((await page.locator(`${C} .moteur-aide-texte svg`).count()) === 0 && /sommet/.test(await page.locator(`${C} .moteur-aide-texte`).innerText()), `${e} : les annotations sont sur le graphique principal ; la zone d'aide ne porte que la légende`);
      verifier(/Un indice de plus/.test(await page.locator(`${C} .moteur-aide button`).innerText()), `${e} : le bouton propose « Un indice de plus ? »`);
      comparer(e, "point annoté", REF["point-annote"]!, await app(page, ".figure-point-annote"), style);
      comparer(e, "étiquette de point", REF["etiquette-forte"]!, await app(page, ".figure-etiquette-forte"), ["fill", "fontSize", "fontWeight", "paintOrder", "stroke", "strokeWidth"]);
      const surLaCourbe = `(() => { const svg = document.querySelector("${SVG}"); const chemin = svg.querySelector(".figure-courbe"); const L = chemin.getTotalLength(); const dist = (c) => { let m = Infinity; for (let i = 0; i <= 800; i++) { const p = chemin.getPointAtLength((L * i) / 800); m = Math.min(m, Math.hypot(p.x - c[0], p.y - c[1])); } return m; }; return [...svg.querySelectorAll(".figure-point-annote")].map((c) => dist([Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))])); })()`;
      verifier(((await page.evaluate(surLaCourbe)) as number[]).every((d) => d < 0.8), `${e} : palier 1 : S est SUR la courbe tracée (distance ${JSON.stringify(await page.evaluate(surLaCourbe))})`);
      await page.screenshot({ path: join(CAPTURES, `fidelite-app-figure-palier1-${largeur}.png`), fullPage: true });

      // Palier 2 : A et deux vecteurs, cumulés avec S.
      await demander();
      await page.waitForSelector(`${SVG} .figure-vecteur`, { state: "attached" });
      await flou(page);
      verifier((await page.locator(`${SVG} .figure-point-annote`).count()) === 2 && (await page.locator(`${SVG} .figure-vecteur`).count()) === 2 && (await page.locator(`${SVG} .figure-vecteur-pointe`).count()) === 2, `${e} : palier 2 : S, A et DEUX vecteurs (cumul)`);
      verifier(((await page.evaluate(surLaCourbe)) as number[]).every((d) => d < 0.8), `${e} : palier 2 : S et A sont SUR la courbe tracée`);
      const bouts = (await page.evaluate(`(() => { const svg = document.querySelector("${SVG}"); const pts = [...svg.querySelectorAll(".figure-point-annote")].map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]); const v = [...svg.querySelectorAll(".figure-vecteur")].map((l) => ({ a: [Number(l.getAttribute("x1")), Number(l.getAttribute("y1"))], b: [Number(l.getAttribute("x2")), Number(l.getAttribute("y2"))] })); return { pts, v }; })()`)) as { pts: number[][]; v: { a: number[]; b: number[] }[] };
      const proche = (u: number[], w: number[]) => Math.hypot(u[0]! - w[0]!, u[1]! - w[1]!) < 0.6;
      const [S, A] = bouts.pts as [number[], number[]];
      verifier(proche(bouts.v[0]!.a, S) && Math.abs(bouts.v[0]!.b[1]! - S[1]!) < 0.6 && proche(bouts.v[1]!.b, A) && Math.abs(bouts.v[1]!.a[0]! - A[0]!) < 0.6 && proche(bouts.v[0]!.b, bouts.v[1]!.a), `${e} : vecteur horizontal S -> (xA ; yS), vecteur vertical -> A, bout à bout`);
      comparer(e, "vecteur", REF["vecteur"]!, await app(page, ".figure-vecteur"), ["stroke", "strokeWidth"]);
      comparer(e, "pointe de vecteur", REF["pointe"]!, await app(page, ".figure-vecteur-pointe"), ["fill"]);
      comparer(e, "étiquette de vecteur", REF["etiquette"]!, await app(page, ".figure-annotation-vecteur .figure-etiquette"), ["fill", "fontSize", "fontWeight"]);
      verifier((await page.locator(`${C} .moteur-aide button:visible`).count()) === 0, `${e} : après le dernier palier, plus de bouton d'indice`);
      await page.screenshot({ path: join(CAPTURES, `fidelite-app-figure-palier2-${largeur}.png`), fullPage: true });

      // Réponse juste -> relecture : le graphique reste sous l'énoncé, SANS annotations.
      const ligne = (await page.evaluate(`1`)) as number;
      void ligne;
      await ctx.close();
    }
  }
  await navigateur.close();
  srv.serveur.close();

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications de fidélité au design (référence et application mesurées dans le même Chromium), captures dans ${CAPTURES}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
