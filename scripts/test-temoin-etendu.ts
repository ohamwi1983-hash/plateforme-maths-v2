// Test permanent — phase 3b-1 : témoin technique ÉTENDU (`_temoin_technique_etendu_v1`) et contrat étendu :
// champs_multiples, intervalle, liste_valeurs.permetAucune, tableau_signes étendu, aides typées (2 formes
// strictes), balisage mathématique dans chaque texte d'auteur. Exécute le VRAI `api/router.ts` contre une
// base en mémoire (scripts/support/), sans réseau. Lancer : `npx tsx scripts/test-temoin-etendu.ts`.

export {}; // module

import { readFileSync } from "node:fs";
import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { verifierBalisageMath, versTexteBrut } from "./support/texteMath";
import { validerAide, aidePresente, NB_SEGMENTS_MAX, LONGUEUR_LATEX_MAX } from "../lib/aideTypee";
import type { EcranDeclare, Generateur } from "../lib/contratGenerateur";
import {
  CHAMP_ALLURE, CHAMP_AXE, CHAMP_COEFFICIENTS, CHAMP_EXTREMUM, CHAMP_IMAGE, CHAMP_RACINES, CHAMP_SIGNES_VARIATION, CODE_AXE_NOTATION,
  generateurTemoinTechniqueEtendu as temoin, reponseBruteCorrecteEtendue, VARIANTE_TEMOIN_ETENDU,
} from "../src/generateurs/_temoinTechniqueEtendu";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

const CHAMPS = [CHAMP_COEFFICIENTS, CHAMP_ALLURE, CHAMP_EXTREMUM, CHAMP_AXE, CHAMP_IMAGE, CHAMP_RACINES, CHAMP_SIGNES_VARIATION];

/** Tous les textes D'AUTEUR d'un écran, étiquetés par nature (pour vérifier que chaque nature porte du balisage). */
function textesAuteur(ecran: EcranDeclare): { nature: string; texte: string }[] {
  const t: { nature: string; texte: string }[] = [{ nature: "consigne", texte: ecran.consigne }];
  if (typeof ecran.aide === "string") t.push({ nature: "aide (chaîne)", texte: ecran.aide });
  if (ecran.type === "qcm") for (const c of ecran.choix) t.push({ nature: "libellé de choix (qcm)", texte: c.libelle });
  if (ecran.type === "liste_valeurs") {
    t.push({ nature: "étiquette d'ajout", texte: ecran.etiquetteAjout });
    if (ecran.etiquetteAucune) t.push({ nature: "étiquette aucune", texte: ecran.etiquetteAucune });
    if (ecran.etiquetteAuMoinsUne) t.push({ nature: "étiquette au moins une", texte: ecran.etiquetteAuMoinsUne });
  }
  if (ecran.type === "champs_multiples") {
    for (const s of ecran.champs) {
      t.push({ nature: "libellé de sous-champ", texte: s.libelle });
      if (s.genre === "choix") for (const c of s.choix) t.push({ nature: "libellé de choix (sous-champ)", texte: c.libelle });
    }
  }
  if (ecran.type === "tableau_signes") {
    for (const c of ecran.colonnes) {
      t.push({ nature: "libellé de colonne", texte: c.libelle });
      if (c.sousLibelle) t.push({ nature: "sous-libellé de colonne", texte: c.sousLibelle });
    }
    for (const l of ecran.lignes) t.push({ nature: "libellé de ligne", texte: l.libelle });
    if (ecran.bornes) t.push({ nature: "borne d'affichage", texte: ecran.bornes.gauche }, { nature: "borne d'affichage", texte: ecran.bornes.droite });
  }
  return t;
}

async function main() {
  // ── 1. Reproductibilité et formes ──
  const formes = new Map<boolean, number>();
  for (let graine = 0; graine < 300; graine++) {
    const ex = temoin.generer(graine);
    verifier(JSON.stringify(ex) === JSON.stringify(temoin.generer(graine)), `generer(${graine}) non reproductible`);
    verifier(JSON.stringify(temoin.ecrans(ex)) === JSON.stringify(temoin.ecrans(temoin.generer(graine))), `ecrans(generer(${graine})) non reproductible`);
    formes.set(ex.large, (formes.get(ex.large) ?? 0) + 1);
    const delta = ex.b * ex.b - 4 * ex.a * ex.c;
    verifier(ex.large ? delta > 0 : delta === 0, `graine ${graine} : discriminant incohérent avec la forme (${delta})`);
    verifier(Number.isInteger(ex.a) && Number.isInteger(ex.b) && Number.isInteger(ex.c) && ex.a > 0, `graine ${graine} : coefficients entiers, a > 0`);
    const tableau = temoin.ecrans(ex).find((e) => e.champ === CHAMP_SIGNES_VARIATION);
    verifier(tableau?.type === "tableau_signes" && tableau.colonnes.length === (ex.large ? 7 : 3), `graine ${graine} : ${ex.large ? 7 : 3} colonnes attendues`);
  }
  verifier((formes.get(true) ?? 0) > 20 && (formes.get(false) ?? 0) > 20, `les deux formes (7 et 3 colonnes) doivent être bien représentées : ${JSON.stringify([...formes])}`);
  const graineLarge = [...Array(300).keys()].find((g) => temoin.generer(g).large)!;
  const graineEtroite = [...Array(300).keys()].find((g) => !temoin.generer(g).large)!;
  verifier(JSON.stringify(temoin.ecrans(temoin.generer(graineLarge)).map((e) => e.champ)) === JSON.stringify(CHAMPS), "les 7 écrans, dans l'ordre");

  // ── 2. Balisage : chaque nature de texte d'auteur porte du balisage valide ──
  const naturesAvecMath = new Set<string>();
  for (let graine = 0; graine < 60; graine++) {
    const ex = temoin.generer(graine);
    for (const ecran of temoin.ecrans(ex)) {
      for (const { nature, texte } of textesAuteur(ecran)) {
        const problemes = verifierBalisageMath(texte);
        verifier(problemes.length === 0, `graine ${graine} / ${ecran.champ} : ${nature} « ${texte} » : ${problemes.join(" ; ")}`);
        if (texte.includes("$")) naturesAvecMath.add(nature);
      }
      if (ecran.type === "champs_multiples") {
        for (const s of ecran.champs) if (s.genre === "texte" && s.placeholder) verifier(!versTexteBrut(s.placeholder).includes("$") || s.placeholder.includes("\\$"), `${ecran.champ} : placeholder « ${s.placeholder} » : les délimiteurs doivent disparaître (versTexteBrut)`);
      }
      if (typeof ecran.aide === "object") verifier(validerAide(ecran.aide).length === 0, `graine ${graine} / ${ecran.champ} : aide typée invalide : ${validerAide(ecran.aide).join(" ; ")}`);
    }
    for (const champ of CHAMPS) {
      const problemes = verifierBalisageMath(temoin.solutionAttendue(ex, champ));
      verifier(problemes.length === 0, `graine ${graine} : solution attendue de ${champ} : ${problemes.join(" ; ")}`);
    }
  }
  for (const nature of ["consigne", "aide (chaîne)", "libellé de choix (qcm)", "étiquette d'ajout", "libellé de sous-champ", "libellé de choix (sous-champ)", "libellé de colonne", "sous-libellé de colonne", "libellé de ligne", "borne d'affichage"]) {
    verifier(naturesAvecMath.has(nature), `le témoin doit porter du balisage mathématique dans « ${nature} » (couverture)`);
  }
  verifier(verifierBalisageMath(temoin.solutionAttendue(temoin.generer(graineLarge), CHAMP_AXE)).length === 0, "solution d'axe saine");

  // ── 3. verifier : 7 écrans × statuts ──
  const ex = temoin.generer(graineLarge);
  const ex3 = temoin.generer(graineEtroite);
  const v = (e: typeof ex, champ: string, brute: string) => temoin.verifier(e, champ, brute);
  for (const e of [ex, ex3]) for (const champ of CHAMPS) verifier(v(e, champ, reponseBruteCorrecteEtendue(e, champ)).statut === "correct", `${champ} (${e.large ? "7" : "3"} colonnes) : réponse correcte refusée`);
  const coef = (a: string, b: string, c: string) => JSON.stringify({ a, b, c });
  verifier(v(ex, CHAMP_COEFFICIENTS, coef(String(ex.a + 1), String(ex.b), String(ex.c))).statut === "not_equivalent", "coefficients : faux → not_equivalent");
  verifier(v(ex, CHAMP_COEFFICIENTS, coef("abc", String(ex.b), String(ex.c))).statut === "parse_error", "coefficients : texte illisible → parse_error");
  const vide = v(ex, CHAMP_COEFFICIENTS, coef(String(ex.a), "", String(ex.c)));
  verifier(vide.statut === "parse_error" && vide.messageErreur.includes("b"), "coefficients : champ vide → parse_error nommant le champ (jamais lu comme 0)");
  verifier(v(ex, CHAMP_COEFFICIENTS, JSON.stringify({ a: String(ex.a), b: String(ex.b) })).statut === "parse_error", "coefficients : sous-champ manquant → parse_error");
  verifier(v(ex, CHAMP_COEFFICIENTS, "pas du json").statut === "parse_error", "coefficients : JSON invalide → parse_error");
  const bonA = ex.a > 0 ? "+" : "-";
  const signeAB = ex.a * ex.b > 0 ? "+" : ex.a * ex.b < 0 ? "-" : "0";
  verifier(v(ex, CHAMP_ALLURE, JSON.stringify({ signeA: bonA === "+" ? "-" : "+", signeAB })).statut === "not_equivalent", "allure : faux → not_equivalent");
  verifier(v(ex, CHAMP_ALLURE, JSON.stringify({ signeA: bonA })).statut === "parse_error", "allure : un choix manque → parse_error");
  verifier(v(ex, CHAMP_ALLURE, JSON.stringify({ signeA: bonA, signeAB: "?" })).statut === "parse_error", "allure : id de choix inconnu → parse_error");
  verifier(v(ex, CHAMP_EXTREMUM, "max").statut === "not_equivalent" && v(ex, CHAMP_EXTREMUM, "inconnu").statut === "parse_error", "extremum : faux / inconnu");
  const axe = JSON.parse(reponseBruteCorrecteEtendue(ex, CHAMP_AXE));
  const sansPrefixe = v(ex, CHAMP_AXE, JSON.stringify({ ...axe, axeTexte: axe.xS }));
  verifier(sansPrefixe.statut === "parse_error" && sansPrefixe.codesCompetence.includes(CODE_AXE_NOTATION) && sansPrefixe.messageErreur.includes("$x"), "axe : valeur juste sans « x = » → parse_error + code, message avec balisage");
  verifier(verifierBalisageMath(sansPrefixe.statut === "parse_error" ? sansPrefixe.messageErreur : "").length === 0, "axe : le message d'erreur passe le contrôle de balisage");
  const faussePuisMalFormee = v(ex, CHAMP_AXE, JSON.stringify({ ...axe, axeTexte: "999" }));
  verifier(faussePuisMalFormee.statut === "parse_error" && faussePuisMalFormee.codesCompetence.length === 0, "axe : valeur fausse ET mal formatée → parse_error SANS code");
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ ...axe, axeTexte: `X = ${axe.xS}` })).statut === "parse_error", "axe : « X = » (majuscule) illisible");
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ ...axe, yS: String(Number(axe.yS.includes("/") ? 0 : axe.yS) + 1) })).statut !== "correct", "axe : yS décalé refusé");
  const fractions = (n: number, d: number) => `${n}/${d}`;
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ axeTexte: `x = ${fractions(Math.round(-ex.b * 2 / (2 * ex.a)) , 2)}`, xS: axe.xS, yS: axe.yS })).statut === "correct", "axe : fraction équivalente acceptée");
  verifier(v(ex, CHAMP_AXE, JSON.stringify({ ...axe, xS: "", })).statut === "parse_error", "axe : xS vide → parse_error");
  const image = JSON.parse(reponseBruteCorrecteEtendue(ex, CHAMP_IMAGE));
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, crochetGauche: "]" })).statut === "not_equivalent", "image : mauvais crochet → not_equivalent");
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, borneDroite: "-inf" })).statut === "not_equivalent", "image : mauvais infini → not_equivalent");
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, borneGauche: "abc" })).statut === "parse_error", "image : borne illisible → parse_error");
  verifier(v(ex, CHAMP_IMAGE, JSON.stringify({ ...image, borneGauche: "" })).statut === "parse_error", "image : borne vide → parse_error");
  verifier(v(ex, CHAMP_IMAGE, "[]").statut === "parse_error", "image : forme invalide → parse_error");
  verifier(v(ex, CHAMP_RACINES, "[]").statut === "not_equivalent", "racines : « aucune » n'est jamais correct ici");
  verifier(v(ex, CHAMP_RACINES, JSON.stringify(["99"])).statut === "not_equivalent", "racines : fausse → not_equivalent");
  verifier(v(ex, CHAMP_RACINES, JSON.stringify(["a"])).statut === "parse_error", "racines : illisible → parse_error");
  verifier(v(ex, CHAMP_RACINES, JSON.stringify(["", " "])).statut === "parse_error", "racines : valeurs vides → parse_error (≠ « aucune »)");
  verifier(v(ex3, CHAMP_RACINES, JSON.stringify([String(ex3.r1), String(ex3.r1)])).statut === "correct", "racines : racine double saisie deux fois (comparaison en ensemble)");
  const tableau = JSON.parse(reponseBruteCorrecteEtendue(ex, CHAMP_SIGNES_VARIATION));
  tableau.variation.c3 = "↗";
  verifier(v(ex, CHAMP_SIGNES_VARIATION, JSON.stringify(tableau)).statut === "not_equivalent", "tableau : variation fausse → not_equivalent");
  delete tableau.variation.c3;
  verifier(v(ex, CHAMP_SIGNES_VARIATION, JSON.stringify(tableau)).statut === "parse_error", "tableau : case manquante → parse_error");
  const sol = JSON.parse(reponseBruteCorrecteEtendue(ex, CHAMP_SIGNES_VARIATION));
  verifier(sol.variation.c3 === "⌣" && sol.variation.c0 === "↘" && sol.variation.c6 === "↗", "tableau : sommet ⌣, flèches ↘ puis ↗ (a > 0)");
  verifier(Object.keys(sol.signe).length === 7 && Object.values(sol.signe).filter((s) => s === "0").length === 2, "tableau (7 colonnes) : exactement 2 zéros (les racines)");
  const sol3 = JSON.parse(reponseBruteCorrecteEtendue(ex3, CHAMP_SIGNES_VARIATION));
  verifier(Object.keys(sol3.signe).length === 3 && sol3.signe.c1 === "0" && sol3.signe.c0 === "+" && sol3.signe.c2 === "+", "tableau (3 colonnes) : racine double, + 0 +");

  // ── 4. validerAide : exactement 2 formes, validation stricte ──
  const formule = { type: "formule_coloree", segments: [{ latex: "f(x) = " }, { latex: "3", role: "a" }, { latex: "x^2" }] };
  const croquis = { type: "croquis_parabole", a: 1, b: -8, c: 16, marqueS: true, surlignageImf: false, marquesOx: true };
  verifier(validerAide(formule).length === 0, "formule_coloree valide acceptée");
  verifier(validerAide(croquis).length === 0 && validerAide({ type: "croquis_parabole", a: -2, b: 0, c: 0 }).length === 0, "croquis_parabole valide accepté (options facultatives)");
  const rejets: [string, unknown][] = [
    ["null", null], ["tableau", []], ["chaîne", "texte"], ["nombre", 3], ["sans type", {}], ["type inconnu", { type: "diagramme" }], ["type numérique", { type: 1 }],
    ["formule : clé inconnue", { ...formule, extra: 1 }], ["formule : segments absents", { type: "formule_coloree" }], ["formule : segments vides", { type: "formule_coloree", segments: [] }],
    ["formule : segments non tableau", { type: "formule_coloree", segments: "x" }],
    ["formule : trop de segments", { type: "formule_coloree", segments: Array.from({ length: NB_SEGMENTS_MAX + 1 }, () => ({ latex: "x" })) }],
    ["formule : segment non objet", { type: "formule_coloree", segments: ["x"] }], ["formule : segment tableau", { type: "formule_coloree", segments: [[]] }],
    ["formule : latex absent", { type: "formule_coloree", segments: [{}] }], ["formule : latex vide", { type: "formule_coloree", segments: [{ latex: "  " }] }],
    ["formule : latex non chaîne", { type: "formule_coloree", segments: [{ latex: 3 }] }],
    ["formule : latex trop long", { type: "formule_coloree", segments: [{ latex: "x".repeat(LONGUEUR_LATEX_MAX + 1) }] }],
    ["formule : $ dans latex", { type: "formule_coloree", segments: [{ latex: "$x$" }] }],
    ["formule : \\textcolor", { type: "formule_coloree", segments: [{ latex: "\\textcolor{red}{x}" }] }], ["formule : \\htmlClass", { type: "formule_coloree", segments: [{ latex: "\\htmlClass{x}{y}" }] }],
    ["formule : \\href", { type: "formule_coloree", segments: [{ latex: "\\href{http://x}{y}" }] }], ["formule : rôle inconnu", { type: "formule_coloree", segments: [{ latex: "x", role: "d" }] }],
    ["formule : rôle numérique", { type: "formule_coloree", segments: [{ latex: "x", role: 1 }] }], ["formule : clé de segment inconnue", { type: "formule_coloree", segments: [{ latex: "x", couleur: "red" }] }],
    ["croquis : clé inconnue", { ...croquis, extra: 1 }], ["croquis : a = 0", { ...croquis, a: 0 }], ["croquis : a décimal", { ...croquis, a: 1.5 }], ["croquis : a chaîne", { ...croquis, a: "1" }],
    ["croquis : b manquant", { type: "croquis_parabole", a: 1, c: 1 }], ["croquis : c NaN", { ...croquis, c: NaN }], ["croquis : c infini", { ...croquis, c: Infinity }], ["croquis : trop grand", { ...croquis, b: 10 ** 6 }],
    ["croquis : option non booléenne", { ...croquis, marqueS: "oui" }], ["croquis : option numérique", { ...croquis, marquesOx: 1 }],
  ];
  for (const [nom, aide] of rejets) verifier(validerAide(aide).length > 0, `validerAide doit rejeter : ${nom}`);
  verifier(aidePresente("texte") && aidePresente(croquis) && !aidePresente("") && !aidePresente(undefined) && !aidePresente(null), "aidePresente : chaîne non vide ou objet");

  // ── 5. Registre : témoin étendu présent, hors catalogue ──
  const registre = require("../lib/registreGenerateurs");
  const { CATALOGUE_GENERATEURS } = require("../lib/catalogueGenerateurs");
  const { DICTIONNAIRE_COMPETENCES } = require("../lib/dictionnaireCompetences");
  verifier(registre.chercherGenerateur(VARIANTE_TEMOIN_ETENDU) === temoin, "chercherGenerateur(témoin étendu)");
  verifier(registre.verifierCoherenceRegistre(registre.REGISTRE_GENERATEURS, CATALOGUE_GENERATEURS, DICTIONNAIRE_COMPETENCES).length === 0, "registre cohérent avec les deux témoins");
  verifier(!CATALOGUE_GENERATEURS.some((e: { variante_id: string }) => e.variante_id === VARIANTE_TEMOIN_ETENDU), "le témoin étendu n'est jamais au catalogue");
  const json = readFileSync(`${__dirname}/../public/catalogue-generateurs-complet.json`, "utf8");
  verifier(!json.includes("etendu") && !json.includes("temoin"), "aucune trace du témoin étendu dans catalogue-generateurs-complet.json");
  const s0 = creerScenario();
  installerBase(s0.base);
  const creation = await appeler("taches", "POST", { jeton: `prof:${s0.profId}`, corps: { nom: "x", composition: [{ variante_id: VARIANTE_TEMOIN_ETENDU, nombre_exercices: 1 }] } });
  verifier(creation.statut === 400, `POST /api/taches avec le témoin étendu doit être rejeté (400) : il n'est pas assignable par l'API, obtenu ${creation.statut}`);

  // ── 6. Parcours par le vrai routeur ──
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  const tache = creerTache(s, { nom: "étendu", variantes: [{ variante_id: VARIANTE_TEMOIN_ETENDU, nombre_exercices: 2 }], aide_activee: true, aide_penalite_pourcent: 25, tentatives_supplementaires: 1, feedback_immediat: true, reponse_visible: true });
  const ok = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
  verifier(ok.statut === 201 && ok.corps.nombre_exercices_generes === 2, `assignation du témoin étendu : ${JSON.stringify(ok.corps)}`);
  const lignes = s.base.table("exercices_assignes").filter((l) => l.tache_id === tache);
  verifier(lignes.every((l) => JSON.stringify(l.champs_attendus) === JSON.stringify(CHAMPS) && l.variante_id === VARIANTE_TEMOIN_ETENDU), "champs_attendus = les 7 champs dans l'ordre");
  const lg = lignes[0];
  const exReel = temoin.generer(Number(lg.graine));
  const get = await appeler(`exercices/${lg.id}`, "GET", { jeton: jetonEleve });
  verifier(get.statut === 200 && get.corps.ecrans.length === 7 && get.corps.champ_courant === CHAMP_COEFFICIENTS, `GET exercice : ${get.statut}`);
  const attendueDisponible: Record<string, boolean> = { [CHAMP_COEFFICIENTS]: true, [CHAMP_ALLURE]: false, [CHAMP_EXTREMUM]: false, [CHAMP_AXE]: true, [CHAMP_IMAGE]: true, [CHAMP_RACINES]: true, [CHAMP_SIGNES_VARIATION]: true };
  verifier(get.corps.ecrans.every((e: any) => e.aide === undefined && e.aide_disponible === attendueDisponible[e.champ]), `aide jamais envoyée avec l'écran ; aide_disponible par écran (typée ou chaîne) : ${JSON.stringify(get.corps.ecrans.map((e: any) => [e.champ, e.aide_disponible, e.aide === undefined]))}`);
  verifier(!JSON.stringify(get.corps).includes('"segments"') && !JSON.stringify(get.corps).includes("croquis_parabole"), "aucune aide typée (ni ses données) dans GET /api/exercices/:id");
  const allure = get.corps.ecrans.find((e: any) => e.champ === CHAMP_ALLURE);
  verifier(allure.type === "champs_multiples" && allure.illustration.type === "croquis_allure" && allure.illustration.c === exReel.c && allure.champs.length === 2, "écran d'allure : champs_multiples avec illustration (c public)");
  const tab = get.corps.ecrans.find((e: any) => e.champ === CHAMP_SIGNES_VARIATION);
  verifier(tab.bornes && tab.lignes.length === 2 && tab.lignes[1].rendu === "symboles_variation" && tab.lignes[1].signesAutorises.length === 4, "tableau étendu servi : bornes, alphabet par ligne, rendu");
  verifier(get.corps.ecrans.find((e: any) => e.champ === CHAMP_RACINES).permetAucune === true, "permetAucune servi");
  verifier(!JSON.stringify(get.corps.ecrans).includes(reponseBruteCorrecteEtendue(exReel, CHAMP_COEFFICIENTS)), "un écran semble contenir la solution des coefficients");

  const poster = (l: any, champ: string, brute: unknown) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: l.id, champ, reponse_brute: brute } });
  verifier((await poster(lg, CHAMP_COEFFICIENTS, { a: "1" })).statut === 400, "reponse_brute objet (état d'édition) : 400");
  verifier((await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_COEFFICIENTS, reponse_brute: "{}", champs: { a: "1" } } })).statut === 400, "clé hors contrat : 400");
  verifier(s.base.table("reponses").length === 0, "rien n'est enregistré avant une réponse confirmée valide");
  verifier((await poster(lg, CHAMP_ALLURE, JSON.stringify({}))).statut === 409, "champ hors ordre : 409");

  // Aide typée : servie APRÈS validation, usage enregistré côté serveur.
  const aideCoef = await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_COEFFICIENTS } });
  const aideDeclaree = temoin.ecrans(exReel).find((e) => e.champ === CHAMP_COEFFICIENTS)!.aide;
  verifier(aideCoef.statut === 200 && JSON.stringify(aideCoef.corps.aide) === JSON.stringify(aideDeclaree) && aideCoef.corps.aide.type === "formule_coloree" && aideCoef.corps.penalite_pourcent === 25, `aide formule_coloree servie telle que déclarée : ${JSON.stringify(aideCoef.corps).slice(0, 160)}`);
  verifier(s.base.table("aides_utilisees").length === 1, "usage de l'aide typée enregistré côté serveur");
  await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_COEFFICIENTS } });
  verifier(s.base.table("aides_utilisees").length === 1, "aides_utilisees : une ligne par (exercice, champ)");
  verifier((await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: lg.id, champ: CHAMP_ALLURE } })).statut === 404, "écran sans aide : 404 (et rien d'enregistré)");
  verifier(s.base.table("aides_utilisees").length === 1, "écran sans aide : aucun usage enregistré");

  // Le parcours complet, en réponses justes.
  for (const champ of CHAMPS) {
    const r = await poster(lg, champ, reponseBruteCorrecteEtendue(exReel, champ));
    verifier(r.statut === 200 && r.corps.statut === "correct" && r.corps.verrouille === true, `${champ} : ${JSON.stringify(r.corps).slice(0, 200)}`);
  }
  const fin = await appeler(`exercices/${lg.id}`, "GET", { jeton: jetonEleve });
  verifier(fin.corps.exercice_termine === true && fin.corps.champs.every((c: any) => c.statut === "correct"), "exercice terminé, 7 champs corrects");
  const lg2 = lignes[1];
  const ex2 = temoin.generer(Number(lg2.graine));
  for (const champ of CHAMPS.slice(0, 3)) await poster(lg2, champ, reponseBruteCorrecteEtendue(ex2, champ));

  // Sous correction immédiate active : `message_erreur` servi ; il contient du balisage valide.
  const axeParse = await poster(lg2, CHAMP_AXE, JSON.stringify({ axeTexte: JSON.parse(reponseBruteCorrecteEtendue(ex2, CHAMP_AXE)).xS, xS: "1", yS: "1" }));
  verifier(axeParse.corps.statut === "parse_error" && typeof axeParse.corps.message_erreur === "string" && verifierBalisageMath(axeParse.corps.message_erreur).length === 0, `parse_error servi avec message balisé : ${JSON.stringify(axeParse.corps)}`);
  verifier(s.base.table("reponses").some((r) => r.champ === CHAMP_AXE && r.bug_detecte === CODE_AXE_NOTATION), "le code de compétence d'un parse_error est stocké dans bug_detecte");
  // Solution révélée (reponse_visible) : balisage valide.
  const faux = await poster(lg2, CHAMP_AXE, JSON.stringify({ axeTexte: "x = 999", xS: "999", yS: "999" }));
  verifier(faux.corps.statut === "not_equivalent" && faux.corps.verrouille === true && typeof faux.corps.solution_attendue === "string" && verifierBalisageMath(faux.corps.solution_attendue).length === 0 && faux.corps.solution_attendue.includes("$"), `solution servie avec balisage valide : ${JSON.stringify(faux.corps)}`);

  // ── 7. Aide invalide : ni servie ni comptée (générateur défectueux temporaire) ──
  const ecransInvalides = (e: typeof ex): EcranDeclare[] => temoin.ecrans(e).map((ecran) => (ecran.champ === CHAMP_COEFFICIENTS ? { ...ecran, aide: { type: "formule_coloree", segments: [{ latex: "\\textcolor{red}{3}" }] } } : ecran)) as EcranDeclare[];
  const defectueux: Generateur<typeof ex> = { ...temoin, variante_id: "_temoin_aide_invalide_v1", ecrans: ecransInvalides, etatActuel: (e, r) => temoin.etatActuel(e, r) };
  // `installerBase` purge le cache des modules de lib/ : on insère dans l'instance du registre UTILISÉE par le routeur.
  const registreCourant = require("../lib/registreGenerateurs");
  registreCourant.REGISTRE_GENERATEURS.push(defectueux);
  try {
    const tacheDef = creerTache(s, { nom: "aide défectueuse", variantes: [{ variante_id: "_temoin_aide_invalide_v1", nombre_exercices: 1 }], aide_activee: true, aide_penalite_pourcent: 50 });
    await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tacheDef, eleve_ids: ["eleve-1"] } });
    const ld = s.base.table("exercices_assignes").find((l) => l.tache_id === tacheDef)!;
    const avant = s.base.table("aides_utilisees").length;
    const rd = await appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: ld.id, champ: CHAMP_COEFFICIENTS } });
    verifier(rd.statut === 500 && String(rd.corps.detail).includes("textcolor"), `aide invalide : erreur bruyante nommant la commande interdite, obtenu ${rd.statut} ${JSON.stringify(rd.corps)}`);
    verifier(rd.corps.aide === undefined, "aide invalide : rien n'est servi");
    verifier(s.base.table("aides_utilisees").length === avant, "aide invalide : l'usage n'est PAS enregistré (l'élève ne paie pas un défaut du générateur)");
  } finally {
    registreCourant.REGISTRE_GENERATEURS.pop();
  }
  verifier(registreCourant.chercherGenerateur("_temoin_aide_invalide_v1") === null, "générateur défectueux retiré du registre");

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nbVerifs}`);
    for (const e of echecs) console.error(" - " + e);
    process.exit(1);
  }
  console.log(`OK : ${nbVerifs} vérifications (témoin étendu : formes 3/7 colonnes, balisage, 7 écrans × statuts, validerAide, registre, parcours par le routeur, aides typées, aide invalide non comptée)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
