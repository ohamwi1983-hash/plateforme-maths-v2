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
import { CHAMP_SOMME, CHAMP_PARITE, CHAMP_DIVISEURS, generateurTemoinTechnique as temoin, reponseBruteCorrecte, VARIANTE_TEMOIN } from "../src/generateurs/_temoinTechnique";

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
const P_CARTE = ["backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", "boxShadow", ...PADDING];
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
  async function ouvrir(profil: "base" | "etendu", champsAvant: string[], attendre: string, largeur = 390) {
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
    await ctx.close();
  }
  // ── Enveloppe de l'exercice (RAPPORT §43) : docs/reference/enveloppe-exercice.html, à 390 ET 1280 px ──
  {
    const refEnveloppe = readFileSync(join(RACINE, "docs/reference/enveloppe-exercice.html"), "utf8");
    const P_LIEN = ["display", "alignItems", "gap", "color", "fontFamily", "fontSize", "fontWeight"];
    const P_TXT = ["color", "fontFamily", "fontSize", "fontWeight", "textTransform", "letterSpacing", "fontStyle"];
    const P_PANNEAU = ["backgroundColor", "borderTopColor", "borderTopWidth", "borderTopStyle", "borderTopLeftRadius", ...PADDING];
    const P_PISTE = ["display", "gap", "backgroundColor", "borderTopLeftRadius", "overflowX"];
    const P_SEGMENT = ["backgroundColor", "borderTopLeftRadius"];
    const P_MARQUE = [...P_ROND, "display", "alignItems", "justifyContent"];
    const taille = (m: Element | null): string => `${m?._largeur}×${m?._hauteur}`;
    /** Session du témoin : réglages de tâche + réponses déjà données (JSON brut par champ), puis ouverture du moteur. */
    async function ouvrirEnveloppe(largeur: number, reglages: { feedback: boolean }, reponses: [string, string][]) {
      imposerProfilAssignation("base");
      const s = creerScenario();
      installerBase(s.base);
      const tid = creerTache(s, { nom: "Fidélité enveloppe", feedback_immediat: reglages.feedback, reponse_visible: false, tentatives_supplementaires: 0, variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 2 }] });
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
      await page.waitForSelector(".moteur-ecran-courant .moteur-rappel");
      return { page, ctx };
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
      for (const ref of ["retour", "retour-puce", "retour-libelle", "surtitre", "titre", "rappel", "progression-etiquette", "piste", "segment-fait", "segment-courant", "segment-avenir", "rappel-titre", "rappel-liste", "ligne-juste", "marque-juste", "marque-faux", "marque-illisible", "marque-neutre", "marque-courant", "libelle", "valeur", "libelle-courant", "consigne"]) RM[ref] = await mesurer(pR, Rf(ref));
      const RD = {
        "retour→surtitre": await distance(pR, Rf("retour"), Rf("surtitre")),
        "surtitre→titre": await distance(pR, Rf("surtitre"), Rf("titre")),
        "titre→carte": await distance(pR, Rf("titre"), Rf("carte")),
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
        comparer(`enveloppe ${l}`, "panneau du rappel", RM["rappel"]!, await A(".moteur-rappel"), P_PANNEAU);
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
          "titre→carte": await distance(page, ".moteur-question-titre", ".moteur-ecran-courant"),
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
