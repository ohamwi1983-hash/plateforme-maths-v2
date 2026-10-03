// Test permanent — aide `formule_coloree` À PALIERS avec EMPHASE (RAPPORT §59), contre le VRAI `api/router.ts`, le témoin (profil `formule`) et une base en mémoire.
// Lancer : `npm run test-formule-paliers`. Sans réseau.
//
// Règles : exactement UNE des écritures `segments` | `paliers` ; l'emphase est neutre (jamais avec un rôle, jamais un token `--coef-*`) ; le serveur ne sert QUE le palier demandé (chaque palier est
// complet, rien n'est cumulé), dans l'ordre ; le palier atteint est enregistré côté serveur ; la pénalité reste binaire ; le palier 2 met la quantité `(b/2a)²` en emphase SANS valeur numérique.

export {}; // module

import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { VARIANTE_TEMOIN, CHAMP_CARRE, generateurTemoinTechnique, graineDeProfil, reponseBruteCorrecte } from "../src/generateurs/_temoinTechnique";
import { aideAPaliers, aideAuPalier, nombrePaliers, validerAide, type AideFormuleColoree } from "../lib/aideTypee";
import { assemblerFormuleColoree, verifierBalisageMath } from "./support/texteMath";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

async function main(): Promise<void> {
  // ── 1. Contrat pur ──
  const palier = (legende: string | undefined, ...segments: object[]) => ({ ...(legende === undefined ? {} : { legende }), segments });
  const bonne = { type: "formule_coloree", paliers: [palier("Un.", { latex: "x" }), palier("Deux.", { latex: "x" }, { latex: "y", emphase: true })] };
  verifier(validerAide(bonne).length === 0, "paliers valides");
  verifier(validerAide({ type: "formule_coloree", segments: [{ latex: "f(x) = " }, { latex: "3", role: "a" }, { latex: "x^2" }] }).length === 0, "l'écriture historique `segments` reste valide");
  verifier(validerAide({ type: "formule_coloree", segments: [{ latex: "x", emphase: true }] }).length === 0, "emphase admise aussi dans l'écriture sans paliers");
  const refus: [string, unknown][] = [
    ["ni segments ni paliers", { type: "formule_coloree" }],
    ["segments ET paliers", { type: "formule_coloree", segments: [{ latex: "x" }], paliers: bonne.paliers }],
    ["paliers vides", { type: "formule_coloree", paliers: [] }],
    ["4 paliers", { type: "formule_coloree", paliers: [0, 1, 2, 3].map(() => palier("x", { latex: "x" })) }],
    ["paliers non tableau", { type: "formule_coloree", paliers: "x" }],
    ["palier non objet", { type: "formule_coloree", paliers: ["x"] }],
    ["palier tableau", { type: "formule_coloree", paliers: [[]] }],
    ["clé de palier inconnue", { type: "formule_coloree", paliers: [{ segments: [{ latex: "x" }], couleur: "red" }] }],
    ["palier sans segments", { type: "formule_coloree", paliers: [{ legende: "x" }] }],
    ["segments de palier vides", { type: "formule_coloree", paliers: [{ segments: [] }] }],
    ["légende vide", { type: "formule_coloree", paliers: [palier(" ", { latex: "x" })] }],
    ["légende non texte", { type: "formule_coloree", paliers: [{ legende: 3, segments: [{ latex: "x" }] }] }],
    ["légende trop longue", { type: "formule_coloree", paliers: [palier("x".repeat(201), { latex: "x" })] }],
    ["légende avec commande interdite", { type: "formule_coloree", paliers: [palier("$\\textcolor{red}{x}$", { latex: "x" })] }],
    ["emphase non booléenne", { type: "formule_coloree", paliers: [palier("x", { latex: "x", emphase: "oui" })] }],
    ["emphase ET rôle", { type: "formule_coloree", paliers: [palier("x", { latex: "x", emphase: true, role: "a" })] }],
    ["latex avec $", { type: "formule_coloree", paliers: [palier("x", { latex: "$x$", emphase: true })] }],
    ["latex avec couleur", { type: "formule_coloree", paliers: [palier("x", { latex: "\\textcolor{red}{x}", emphase: true })] }],
    ["latex avec htmlClass", { type: "formule_coloree", paliers: [palier("x", { latex: "\\htmlClass{evil}{x}", emphase: true })] }],
    ["rôle inconnu dans un palier", { type: "formule_coloree", paliers: [palier("x", { latex: "x", role: "z" })] }],
    ["clé de segment inconnue", { type: "formule_coloree", paliers: [palier("x", { latex: "x", gras: true })] }],
    ["41 segments dans un palier", { type: "formule_coloree", paliers: [{ segments: Array.from({ length: 41 }, () => ({ latex: "x" })) }] }],
  ];
  for (const [nom, aide] of refus) verifier(validerAide(aide).length > 0, `refusé : ${nom}`);

  verifier(aideAPaliers(bonne) && !aideAPaliers({ type: "formule_coloree", segments: [{ latex: "x" }] }) && !aideAPaliers("texte") && !aideAPaliers(null), "aideAPaliers");
  verifier(nombrePaliers(bonne) === 2 && nombrePaliers({ type: "formule_coloree", segments: [{ latex: "x" }] }) === 1 && nombrePaliers("texte") === 1, "nombrePaliers");
  const servi1 = aideAuPalier(bonne as AideFormuleColoree & { paliers: NonNullable<AideFormuleColoree["paliers"]> }, 1);
  const servi2 = aideAuPalier(bonne as AideFormuleColoree & { paliers: NonNullable<AideFormuleColoree["paliers"]> }, 2);
  verifier(servi1.type === "formule_coloree" && servi1.palier === 1 && servi1.palierTotal === 2 && servi1.segments.length === 1 && !JSON.stringify(servi1).includes("emphase") && !JSON.stringify(servi1).includes("Deux"), "palier 1 servi : RIEN du palier 2");
  verifier("segments" in servi2 && servi2.segments.length === 2 && JSON.stringify(servi2).includes("emphase") && !JSON.stringify(servi2).includes("Un."), "palier 2 servi : sa formule seule (rien de cumulé)");
  verifier(assemblerFormuleColoree([{ latex: "y", emphase: true }]) === "\\htmlClass{moteur-emphase}{y}", "assemblage de l'emphase");

  // ── 2. Routes : le témoin, profil `formule` ──
  imposerProfilAssignation("formule");
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
    const aide = (p?: unknown) => appeler("reponses/aide", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ: CHAMP_CARRE, ...(p === undefined ? {} : { palier: p }) } });
    const repondre = (brute: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ: CHAMP_CARRE, reponse_brute: brute } });
    const lignesAide = () => s.base.table("aides_utilisees").filter((l) => l.exercice_assigne_id === ligne.id);
    return { ligne, ex, lire, aide, repondre, lignesAide };
  };
  verifier(graineDeProfil("formule", 0) >= 4_294_966_000 && graineDeProfil("formule", 0) < 4_294_967_000, "(sanité) le profil formule vit dans ses graines réservées");
  const m = await monter({ aide_activee: true, aide_penalite_pourcent: 20, reponse_visible: true });
  const f = m.ex.formule!;
  verifier(m.ex.profil === "formule" && f !== undefined, "(sanité) exercice du témoin en profil formule");
  const vue = await m.lire();
  const ecran = vue.ecrans[0];
  verifier(vue.ecrans.length === 1 && ecran.champ === CHAMP_CARRE && ecran.type === "champ_expression" && ecran.aide === undefined && ecran.aide_disponible === true && ecran.aide_paliers === 2, "un écran, aide disponible à 2 paliers, JAMAIS envoyée avec l'écran");
  const texteVue = JSON.stringify(vue);
  verifier(!texteVue.includes("emphase") && !texteVue.includes("b}{2a}"), "aucun segment d'aide dans la vue de l'exercice");
  verifier(verifierBalisageMath(ecran.consigne).length === 0 && verifierBalisageMath(ecran.question).length === 0, "énoncé du témoin : balisage admis");

  const saut = await m.aide(2);
  verifier(saut.statut === 409 && m.lignesAide().length === 0, `palier 2 sans palier 1 : 409 et rien d'écrit (${saut.statut})`);
  for (const invalide of [0, -1, 1.5, "2", null, 3]) verifier((await m.aide(invalide)).statut === 400 && m.lignesAide().length === 0, `palier invalide ${JSON.stringify(invalide)} : 400`);
  const a1 = await m.aide();
  const aide1 = a1.corps.aide;
  verifier(a1.statut === 200 && aide1.type === "formule_coloree" && aide1.palier === 1 && aide1.palierTotal === 2 && typeof aide1.legende === "string", `palier 1 servi (${a1.statut})`);
  verifier(!JSON.stringify(a1.corps).includes("emphase") && aide1.segments.every((x: any) => x.emphase === undefined), "palier 1 : aucune emphase");
  verifier(m.lignesAide().length === 1 && m.lignesAide()[0]!.palier === 1, "palier atteint enregistré côté serveur : 1");
  const a2 = await m.aide(2);
  const aide2 = a2.corps.aide;
  const emphases = aide2.segments.filter((x: any) => x.emphase === true);
  verifier(a2.statut === 200 && aide2.palier === 2 && emphases.length === 1, `palier 2 : une seule quantité en emphase (${emphases.length})`);
  verifier(emphases[0].role === undefined && /^\\left\(\\dfrac\{b\}\{2a\}\\right\)\^2$/.test(emphases[0].latex), `l'emphase est SYMBOLIQUE, sans rôle : « ${emphases[0].latex} »`);
  verifier(aide2.segments.length > aide1.segments.length && assemblerFormuleColoree(aide2.segments).startsWith(assemblerFormuleColoree(aide1.segments)), "le palier 2 reprend la formule du palier 1, puis y ajoute la quantité");
  const rejeu = await m.aide();
  const rejeu1 = await m.aide(1);
  verifier(rejeu.corps.aide.palier === 2 && rejeu1.corps.aide.palier === 1 && !JSON.stringify(rejeu1.corps).includes("emphase"), "rejeu : sans palier = palier atteint ; palier 1 rejouable sans emphase");
  verifier(m.lignesAide().length === 1 && m.lignesAide()[0]!.palier === 2, "rejeu gratuit : le palier atteint ne redescend jamais");
  verifier((await m.aide(3)).statut === 400, "palier 3 : l'aide n'en a que 2");

  // Pénalité binaire.
  verifier((await m.repondre(reponseBruteCorrecte(m.ex, CHAMP_CARRE))).corps.statut === "correct", "réponse juste");
  const scoreDeux = (await m.lire()).champs[0].score;
  const m1 = await monter({ aide_activee: true, aide_penalite_pourcent: 20, reponse_visible: true });
  await m1.aide(1);
  await m1.repondre(reponseBruteCorrecte(m1.ex, CHAMP_CARRE));
  const scoreUn = (await m1.lire()).champs[0].score;
  const m0 = await monter({ aide_activee: true, aide_penalite_pourcent: 20, reponse_visible: true });
  await m0.repondre(reponseBruteCorrecte(m0.ex, CHAMP_CARRE));
  const scoreZero = (await m0.lire()).champs[0].score;
  verifier(scoreZero === 100 && scoreUn === 80 && scoreDeux === 80, `pénalité binaire : sans aide ${scoreZero}, palier 1 ${scoreUn}, palier 2 ${scoreDeux}`);
  const mSans = await monter({ aide_activee: false });
  verifier((await mSans.aide()).statut === 403 && mSans.lignesAide().length === 0, "aide désactivée par le professeur : refusée, rien d'écrit");
  imposerProfilAssignation("aleatoire");

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (formule_coloree à paliers : contrat, emphase neutre, service palier par palier, état serveur, pénalité binaire, non-fuite)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
