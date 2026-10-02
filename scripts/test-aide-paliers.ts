// Test permanent — figure d'écran et aide PAR PALIERS `annotations_figure` (RAPPORT §56), contre le VRAI `api/router.ts`, le témoin (profil `graphe`) et une base en mémoire.
// Lancer : `npm run test-aide-paliers`. Sans réseau.
//
// Règles : la figure est une donnée statique sans coordonnée remarquable ; l'aide n'est JAMAIS envoyée avec l'écran ; `POST /api/reponses/aide` ne sert que le palier demandé
// (annotations cumulées), dans l'ordre (pas de saut de palier) ; le palier atteint est enregistré côté serveur ; la pénalité reste binaire (un palier ou deux : même coût).

export {}; // module

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { VARIANTE_TEMOIN, CHAMP_COURBE, graineDeProfil, generateurTemoinTechnique, reponseBruteCorrecte } from "../src/generateurs/_temoinTechnique";
import { aideAuPalier, nombrePaliers, validerAide, type AideAnnotationsFigure } from "../lib/aideTypee";
import { validerFigure } from "../lib/figureDeclaree";
import { figureParabole, ordonneeSurLaCourbe, pasDeGraduation } from "../lib/figureParabole";
import { creerPrng } from "../lib/prng";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

async function main(): Promise<void> {
  // ── 1. Construction de la figure (pur) : les marques sont sur la courbe PAR CONSTRUCTION ──
  const prng = creerPrng(8888);
  const cas: { a: number; p: number; q: number; xA: number }[] = [];
  for (let k = 0; k < 600; k++) {
    // Valeurs de gen8 : a entier ou fraction, S dans [-5,5], A à l'écart d (entier) avec a·d² entier.
    const a = prng.choisir([2, 3, 4, 5, -2, -3, 1, -1, 0.5, -0.5, 1.5, 0.25, 2 / 3, 4 / 3, 0.2, 3 / 4]);
    const d = prng.choisir([1, 2, 3, 4, 5, 6]);
    cas.push({ a, p: prng.entierEntre(-5, 5), q: prng.entierEntre(-5, 5), xA: 0 + (prng.entierEntre(0, 1) === 0 ? -d : d) });
    cas[k]!.xA += cas[k]!.p;
  }
  for (const c of cas) {
    const { figure, sommet, pointA } = figureParabole({ ...c, description: "Graphique." });
    const etiquette = `a=${c.a} p=${c.p} q=${c.q} xA=${c.xA}`;
    verifier(validerFigure(figure).length === 0, `figure valide : ${etiquette} -> ${validerFigure(figure).join(" ; ")}`);
    verifier(Math.abs(ordonneeSurLaCourbe(figure, sommet.x) - sommet.y) < 1e-6, `le sommet est SUR la courbe : ${etiquette}`);
    const yAttendu = c.a * (c.xA - c.p) ** 2 + c.q;
    verifier(Math.abs(ordonneeSurLaCourbe(figure, c.xA) - yAttendu) < 1e-6 && Math.abs(pointA.y - yAttendu) < 1e-9, `A est SUR la courbe : ${etiquette}`);
    const f = figure.fenetre;
    verifier(f.xMin <= Math.min(sommet.x, pointA.x) - 1 && f.xMax >= Math.max(sommet.x, pointA.x) + 1 && f.yMin <= Math.min(sommet.y, pointA.y) - 1 && f.yMax >= Math.max(sommet.y, pointA.y) + 1, `fenêtre avec marge autour de S et A : ${etiquette}`);
    verifier(figure.graduations.x.length >= 2 && figure.graduations.x.length <= 13 && figure.graduations.y.length >= 2 && figure.graduations.y.length <= 13, `graduations lisibles : ${etiquette} (${figure.graduations.x.length} / ${figure.graduations.y.length})`);
    const json = JSON.stringify(figure);
    verifier(!json.includes("etiquette") && !json.includes('"S"'), `la figure ne nomme ni S ni A : ${etiquette}`);
  }
  verifier(pasDeGraduation(10) === 1 && pasDeGraduation(30) === 5 && pasDeGraduation(130) === 20 && pasDeGraduation(0.5) === 1, "pas de graduation");
  verifier(JSON.stringify(figureParabole({ a: 1, p: 0, q: 0, xA: 1, description: "G" })) === JSON.stringify(figureParabole({ a: 1, p: 0, q: 0, xA: 1, description: "G" })), "figure déterministe");

  // ── 2. validerFigure / validerAide : refus bruyants ──
  const bonne = figureParabole({ a: 2, p: 1, q: -3, xA: 2, description: "G" }).figure;
  verifier(validerFigure(bonne).length === 0 && validerFigure(null).length > 0 && validerFigure({ ...bonne, type: "autre" }).length > 0, "validerFigure : type");
  verifier(validerFigure({ ...bonne, fenetre: { ...bonne.fenetre, xMin: 10 } }).length > 0, "validerFigure : fenêtre inversée refusée");
  verifier(validerFigure({ ...bonne, courbe: { ...bonne.courbe, y0: NaN } }).length > 0 && validerFigure({ ...bonne, courbe: { ...bonne.courbe, y0: Infinity } }).length > 0, "validerFigure : courbe non finie refusée");
  verifier(validerFigure({ ...bonne, graduations: { x: [999], y: [] } }).length > 0, "validerFigure : graduation hors fenêtre refusée");
  verifier(validerFigure({ ...bonne, description: "$a$" }).length > 0 && validerFigure({ ...bonne, description: "" }).length > 0 && validerFigure({ ...bonne, couleur: "red" }).length > 0, "validerFigure : description, clé inconnue");
  const aideBonne: AideAnnotationsFigure = { type: "annotations_figure", paliers: [{ legende: "Un.", annotations: [{ genre: "point", x: 1, y: 2, etiquette: "S(1 ; 2)" }] }, { legende: "Deux.", annotations: [{ genre: "vecteur", de: [0, 0], vers: [1, 1], etiquette: "1" }] }] };
  verifier(validerAide(aideBonne).length === 0, "validerAide : annotations_figure valide");
  const refusAide: [string, unknown][] = [
    ["paliers vides", { type: "annotations_figure", paliers: [] }],
    ["4 paliers", { type: "annotations_figure", paliers: [aideBonne.paliers[0], aideBonne.paliers[0], aideBonne.paliers[0], aideBonne.paliers[0]] }],
    ["clé inconnue", { ...aideBonne, couleur: "red" }],
    ["légende vide", { type: "annotations_figure", paliers: [{ legende: " ", annotations: aideBonne.paliers[0]!.annotations }] }],
    ["commande interdite", { type: "annotations_figure", paliers: [{ legende: "\\textcolor{red}{S}", annotations: aideBonne.paliers[0]!.annotations }] }],
    ["aucune annotation", { type: "annotations_figure", paliers: [{ legende: "x", annotations: [] }] }],
    ["7 annotations", { type: "annotations_figure", paliers: [{ legende: "x", annotations: Array.from({ length: 7 }, () => aideBonne.paliers[0]!.annotations[0]) }] }],
    ["coordonnée infinie", { type: "annotations_figure", paliers: [{ legende: "x", annotations: [{ genre: "point", x: Infinity, y: 0, etiquette: "S" }] }] }],
    ["étiquette avec $", { type: "annotations_figure", paliers: [{ legende: "x", annotations: [{ genre: "point", x: 0, y: 0, etiquette: "$S$" }] }] }],
    ["étiquette vide", { type: "annotations_figure", paliers: [{ legende: "x", annotations: [{ genre: "point", x: 0, y: 0, etiquette: "" }] }] }],
    ["genre inconnu", { type: "annotations_figure", paliers: [{ legende: "x", annotations: [{ genre: "cercle", x: 0, y: 0, etiquette: "S" }] }] }],
    ["vecteur mal formé", { type: "annotations_figure", paliers: [{ legende: "x", annotations: [{ genre: "vecteur", de: [0], vers: [1, 1], etiquette: "1" }] }] }],
    ["clé inconnue d'annotation", { type: "annotations_figure", paliers: [{ legende: "x", annotations: [{ genre: "point", x: 0, y: 0, etiquette: "S", couleur: "red" }] }] }],
  ];
  for (const [nom, a] of refusAide) verifier(validerAide(a).length > 0, `validerAide refuse : ${nom}`);
  verifier(nombrePaliers(aideBonne) === 2 && nombrePaliers("texte") === 1 && nombrePaliers({ type: "formule_coloree", segments: [] }) === 1, "nombrePaliers");
  const p2 = aideAuPalier(aideBonne, 2);
  verifier(p2.palier === 2 && p2.palierTotal === 2 && p2.legende === "Deux." && p2.annotations.length === 2, "aideAuPalier : annotations cumulées, légende du palier");
  verifier(aideAuPalier(aideBonne, 1).annotations.length === 1 && !JSON.stringify(aideAuPalier(aideBonne, 1)).includes("Deux."), "aideAuPalier(1) ne contient rien du palier 2");

  // ── 3. Routes : le témoin, profil `graphe` ──
  imposerProfilAssignation("graphe");
  const s = creerScenario();
  installerBase(s.base);
  const jeton = `prof:${s.profId}`;
  const monter = async (options: Parameters<typeof creerTache>[1]) => {
    const tache = creerTache(s, { variantes: [{ variante_id: VARIANTE_TEMOIN, nombre_exercices: 1 }], ...options });
    const a = await appeler("assignations", "POST", { jeton, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    if (a.statut !== 201) throw new Error("assignation " + a.statut);
    const ligne = s.base.table("exercices_assignes").filter((e) => e.tache_id === tache)[0]!;
    const ex = generateurTemoinTechnique.generer(Number(ligne.graine));
    const lire = async () => (await appeler(`exercices/${ligne.id}`, "GET", { jeton: "eleve:eleve-1" })).corps;
    const aide = (palier?: unknown) => appeler("reponses/aide", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ: CHAMP_COURBE, ...(palier === undefined ? {} : { palier }) } });
    const repondre = (brute: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ: CHAMP_COURBE, reponse_brute: brute } });
    const lignesAide = () => s.base.table("aides_utilisees").filter((l) => l.exercice_assigne_id === ligne.id);
    return { ligne, ex, lire, aide, repondre, lignesAide };
  };
  const m = await monter({ aide_activee: true, aide_penalite_pourcent: 20, reponse_visible: true });
  verifier(m.ex.profil === "graphe" && m.ex.graphe !== undefined, "(sanité) exercice du témoin en profil graphe");
  const vue = await m.lire();
  const ecran = vue.ecrans[0];
  verifier(vue.ecrans.length === 2 && ecran.champ === CHAMP_COURBE && ecran.type === "champ_expression" && vue.ecrans[1].champ === "chaine", "deux écrans : champ_expression (courbe) puis chaîne");
  verifier(JSON.stringify(vue.ecrans[0].figure) === JSON.stringify(vue.ecrans[1].figure), "la MÊME figure sur les deux écrans");
  verifier(ecran.figure?.type === "graphe_parabole" && validerFigure(ecran.figure).length === 0, "la figure est servie avec l'écran, valide");
  const texteVue = JSON.stringify(vue);
  verifier(ecran.aide === undefined && !texteVue.includes("annotations") && !texteVue.replace(/aide_paliers/g, "").includes("paliers") && !texteVue.includes("etiquette") && !texteVue.includes("legende"), "l'aide n'est JAMAIS envoyée avec l'écran (ni annotations, ni paliers, ni étiquettes)");
  verifier(ecran.aide_disponible === true && ecran.aide_paliers === 2 && vue.champs[0].aide_palier === 0 && vue.champs[0].aide_utilisee === false, "aide disponible, 2 paliers, palier atteint 0");
  const { sommet, pointA } = (() => {
    const g = m.ex.graphe!;
    return { sommet: { x: g.p, y: g.q }, pointA: { x: g.xA, y: g.a * (g.xA - g.p) ** 2 + g.q } };
  })();
  verifier(Math.abs(ordonneeSurLaCourbe(ecran.figure, sommet.x) - sommet.y) < 1e-6 && Math.abs(ordonneeSurLaCourbe(ecran.figure, pointA.x) - pointA.y) < 1e-6, "la figure servie passe par S et A");
  verifier(!texteVue.includes(`S(${sommet.x} ; ${sommet.y})`), "S n'apparaît nulle part avant l'aide");

  // Palier 2 AVANT le palier 1 : refusé, rien d'enregistré.
  const saut = await m.aide(2);
  verifier(saut.statut === 409 && m.lignesAide().length === 0, `palier 2 sans palier 1 : 409 et rien d'écrit (${saut.statut})`);
  for (const invalide of [0, -1, 1.5, "2", null, 3]) {
    const r = await m.aide(invalide);
    verifier(r.statut === 400 && m.lignesAide().length === 0, `palier invalide ${JSON.stringify(invalide)} : 400 (${r.statut})`);
  }
  // Palier 1.
  const a1 = await m.aide();
  verifier(a1.statut === 200 && a1.corps.aide.type === "annotations_figure" && a1.corps.aide.palier === 1 && a1.corps.aide.palierTotal === 2, `palier 1 servi (${a1.statut})`);
  verifier(a1.corps.aide.annotations.length === 1 && a1.corps.aide.annotations[0].etiquette === `S(${sommet.x} ; ${sommet.y})`, "palier 1 : seulement S");
  verifier(!JSON.stringify(a1.corps).includes(`A(${pointA.x}`) && !JSON.stringify(a1.corps).includes("vecteur"), "palier 1 : RIEN du palier 2 (ni A ni vecteurs)");
  verifier(m.lignesAide().length === 1 && m.lignesAide()[0]!.palier === 1, "palier atteint enregistré côté serveur : 1");
  const v1 = await m.lire();
  verifier(v1.champs[0].aide_palier === 1 && v1.champs[0].aide_utilisee === true, "GET : aide_palier 1");
  // Palier 2.
  const a2 = await m.aide(2);
  verifier(a2.statut === 200 && a2.corps.aide.palier === 2 && a2.corps.aide.annotations.length === 4, `palier 2 : annotations cumulées (S, A, 2 vecteurs) : ${a2.corps?.aide?.annotations?.length}`);
  verifier(a2.corps.aide.annotations.some((x: any) => x.genre === "point" && x.etiquette === `A(${pointA.x} ; ${pointA.y})`) && a2.corps.aide.annotations.filter((x: any) => x.genre === "vecteur").length === 2, "palier 2 : A et deux vecteurs");
  verifier(m.lignesAide().length === 1 && m.lignesAide()[0]!.palier === 2, "palier atteint : 2 (une seule ligne, relevée)");
  // Rejeu : sans palier = le palier atteint ; un palier inférieur est rejouable ; aucune ligne de plus ; palier atteint inchangé.
  const rejeu = await m.aide();
  const rejeu1 = await m.aide(1);
  verifier(rejeu.corps.aide.palier === 2 && rejeu1.corps.aide.palier === 1 && rejeu1.corps.aide.annotations.length === 1, "rejeu : sans palier = palier atteint ; palier 1 rejouable");
  verifier(m.lignesAide().length === 1 && m.lignesAide()[0]!.palier === 2, "rejeu gratuit : le palier atteint ne redescend jamais");
  verifier((await m.aide(3)).statut === 400, "palier 3 : l'aide n'en a que 2");
  verifier((await m.lire()).champs[0].aide_palier === 2, "GET : aide_palier 2");

  // Pénalité BINAIRE : un palier ou deux, même score (20 %).
  const reussite = await m.repondre(reponseBruteCorrecte(m.ex, CHAMP_COURBE));
  verifier(reussite.corps.statut === "correct", "réponse juste");
  const scoreDeux = (await m.lire()).champs[0].score;
  const m1 = await monter({ aide_activee: true, aide_penalite_pourcent: 20, reponse_visible: true });
  await m1.aide(1);
  await m1.repondre(reponseBruteCorrecte(m1.ex, CHAMP_COURBE));
  const scoreUn = (await m1.lire()).champs[0].score;
  const m0 = await monter({ aide_activee: true, aide_penalite_pourcent: 20, reponse_visible: true });
  await m0.repondre(reponseBruteCorrecte(m0.ex, CHAMP_COURBE));
  const scoreZero = (await m0.lire()).champs[0].score;
  verifier(scoreZero === 100 && scoreUn === 80 && scoreDeux === 80, `pénalité binaire : sans aide ${scoreZero}, palier 1 ${scoreUn}, palier 2 ${scoreDeux}`);

  // Aide désactivée par le professeur : refusée (403), aucune ligne.
  const mSans = await monter({ aide_activee: false });
  const refus = await mSans.aide();
  verifier(refus.statut === 403 && mSans.lignesAide().length === 0, "aide désactivée : 403");
  verifier((await mSans.lire()).ecrans[0].aide_disponible === false && (await mSans.lire()).ecrans[0].aide_paliers === 0, "aide désactivée : aide_disponible faux, 0 palier");

  // Un autre élève ne peut pas utiliser l'aide d'un exercice qui n'est pas le sien.
  const autre = await appeler("reponses/aide", "POST", { jeton: "eleve:eleve-2", corps: { exercice_assigne_id: m.ligne.id, champ: CHAMP_COURBE } });
  verifier(autre.statut === 404, "aide d'un exercice d'un autre élève : 404");

  // ── 4. Stabilité du témoin : les profils d'origine ne changent pas ──
  imposerProfilAssignation("aleatoire");
  verifier(graineDeProfil("base", 0) === 0 || generateurTemoinTechnique.generer(graineDeProfil("base", 0)).profil === "base", "profil base inchangé");
  for (let g = 0; g < 2000; g++) verifier(generateurTemoinTechnique.generer(g).profil !== "graphe", `graine ${g} : jamais le profil graphe`);
  verifier(generateurTemoinTechnique.generer(graineDeProfil("graphe", 0)).profil === "graphe", "graineDeProfil(graphe) tire bien le profil graphe");

  // ── 5. Migration : palier dans schema.sql ET cumulatif.sql ──
  const racine = join(__dirname, "..");
  verifier(/create table aides_utilisees \([\s\S]*?palier int not null default 1,\s*primary key/.test(readFileSync(join(racine, "supabase/schema.sql"), "utf8")), "schema.sql : aides_utilisees.palier");
  verifier(/alter table aides_utilisees add column if not exists palier int not null default 1;/.test(readFileSync(join(racine, "supabase/migrations/cumulatif.sql"), "utf8")), "cumulatif.sql : aides_utilisees.palier (idempotent)");

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (figure : marques sur la courbe, validation ; aide par paliers : ordre, cumul, état serveur, pénalité binaire, portes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
