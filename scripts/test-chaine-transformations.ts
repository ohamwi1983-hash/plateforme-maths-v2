// Test permanent — type d'écran `chaine_transformations` (RAPPORT §56) : décodeur de la réponse, et chemin complet par le VRAI `api/router.ts` avec le témoin (profil `graphe`).
// Le témoin ne juge que la STRUCTURE de la chaîne (TH puis TV) : la vérification à deux niveaux de gen8 est testée avec gen8. Lancer : `npm run test-chaine-transformations`. Sans réseau.

export {}; // module

import { appeler, creerScenario, creerTache, imposerProfilAssignation, installerBase } from "./support/harnaisRouteur";
import { VARIANTE_TEMOIN, CHAMP_CHAINE, CHAMP_COURBE, generateurTemoinTechnique, reponseBruteCorrecte } from "../src/generateurs/_temoinTechnique";
import { decoderChaineTransformations } from "../lib/reponsesEcran";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const CHOIX = ["TH", "TV", "EV", "CV", "SOX"].map((id) => ({ id, libelle: id }));
const ECRAN = { choix: CHOIX, etapesMin: 1, etapesMax: 5 };
const etape = (expression: string, transformation: string) => ({ expression, transformation });
const brute = (etapes: unknown) => JSON.stringify({ etapes });

async function main(): Promise<void> {
  // ── 1. Décodeur ──
  const ok = decoderChaineTransformations(brute([etape(" (x-2)^2 ", "TH"), etape("3(x-2)^2", "EV")]), ECRAN);
  verifier(ok.ok && ok.valeur.length === 2 && ok.valeur[0]!.expression === "(x-2)^2" && ok.valeur[1]!.transformation === "EV", "chaîne valide : expressions rognées, ordre conservé");
  verifier(decoderChaineTransformations(brute(Array.from({ length: 5 }, () => etape("x", "TH"))), ECRAN).ok, "5 étapes : admis");
  const refus: [string, string][] = [
    ["JSON illisible", "pas du json"],
    ["tableau nu", JSON.stringify([etape("x", "TH")])],
    ["null", "null"],
    ["clé en trop", JSON.stringify({ etapes: [etape("x", "TH")], autre: 1 })],
    ["clé manquante", JSON.stringify({})],
    ["autre clé", JSON.stringify({ steps: [etape("x", "TH")] })],
    ["étapes non tableau", JSON.stringify({ etapes: "x" })],
    ["0 étape", brute([])],
    ["6 étapes", brute(Array.from({ length: 6 }, () => etape("x", "TH")))],
    ["étape nulle", brute([null])],
    ["étape tableau", brute([["x", "TH"]])],
    ["clé d'étape en trop", brute([{ expression: "x", transformation: "TH", plus: 1 }])],
    ["clé d'étape manquante", brute([{ expression: "x" }])],
    ["expression non texte", brute([{ expression: 3, transformation: "TH" }])],
    ["expression vide", brute([etape("   ", "TH")])],
    ["expression trop longue", brute([etape("x".repeat(121), "TH")])],
    ["transformation inconnue", brute([etape("x", "XX")])],
    ["transformation non texte", brute([{ expression: "x", transformation: 1 }])],
    ["transformation prototype", brute([etape("x", "constructor")])],
    ["transformation __proto__", brute([etape("x", "__proto__")])],
  ];
  for (const [nom, b] of refus) {
    const d = decoderChaineTransformations(b, ECRAN);
    verifier(d.ok === false && d.message.length > 0, `décodeur refuse : ${nom}`);
  }
  const hostile = decoderChaineTransformations('{"etapes":[{"expression":"x","transformation":"TH"}],"__proto__":{"etapes":[]}}', ECRAN);
  verifier(hostile.ok === false, "décodeur : clé __proto__ en trop refusée");
  verifier(decoderChaineTransformations(brute([etape("x", "TH"), etape("x", "TV")]), { ...ECRAN, etapesMin: 3 }).ok === false && decoderChaineTransformations(brute([etape("x", "TH")]), { ...ECRAN, etapesMin: 2, etapesMax: 2 }).ok === false, "bornes de l'écran respectées");
  verifier(decoderChaineTransformations(brute([etape("<b>x</b> $a$", "TH")]), ECRAN).ok, "le texte d'élève est lu tel quel (jamais interprété, jamais rejeté pour ses caractères)");

  // ── 2. Chemin complet : témoin, profil `graphe` ──
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
    const poster = (champ: string, b: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: b } });
    const lire = async () => (await appeler(`exercices/${ligne.id}`, "GET", { jeton: "eleve:eleve-1" })).corps;
    return { ligne, ex, poster, lire };
  };
  const m = await monter({ feedback_immediat: true, reponse_visible: true, tentatives_supplementaires: 2 });
  // Le témoin déclare deux écrans indépendants : les deux sont servis dès le départ, dans l'ordre.
  const vue = await m.lire();
  verifier(JSON.stringify(vue.ecrans.map((e: any) => e.champ)) === JSON.stringify([CHAMP_COURBE, CHAMP_CHAINE]), `deux écrans servis : ${vue.ecrans.map((e: any) => e.champ).join(", ")}`);
  verifier(JSON.stringify(vue.champs.map((c: any) => c.champ)) === JSON.stringify([CHAMP_COURBE, CHAMP_CHAINE]), "deux champs attendus");

  // La MÊME figure sur les deux écrans, identique après chaque réponse (jamais reconstruite depuis une réponse).
  const avant = JSON.stringify((await m.lire()).ecrans[0].figure);
  await m.poster(CHAMP_COURBE, "999"); // réponse fausse
  const apres = (await m.lire()).ecrans;
  verifier(apres.every((e: any) => JSON.stringify(e.figure) === avant), "figure identique sur tous les écrans et inchangée par une réponse fausse");
  await m.poster(CHAMP_COURBE, reponseBruteCorrecte(m.ex, CHAMP_COURBE));
  const ecranChaine = (await m.lire()).ecrans.find((e: any) => e.champ === CHAMP_CHAINE);
  verifier(ecranChaine?.type === "chaine_transformations" && ecranChaine.choix.length === 5 && ecranChaine.etapesMin === 1 && ecranChaine.etapesMax === 5 && ecranChaine.depart.includes("f_0"), "écran chaîne servi avec ses cinq choix et ses bornes");
  verifier(ecranChaine.aide === undefined && ecranChaine.aide_disponible === false, "écran chaîne : aucune aide (délibéré)");
  verifier(JSON.stringify(ecranChaine.figure) === avant, "écran chaîne : même figure que l'écran 1");
  verifier((await m.lire()).champs.find((c: any) => c.champ === CHAMP_CHAINE).poids === 3 && (await m.lire()).champs.find((c: any) => c.champ === CHAMP_COURBE).poids === 2, "poids 2 et 3 exposés");

  const juste = reponseBruteCorrecte(m.ex, CHAMP_CHAINE);
  const illisible = await m.poster(CHAMP_CHAINE, "n'importe quoi");
  verifier(illisible.statut === 200 && illisible.corps.statut === "parse_error" && /chaîne/i.test(illisible.corps.message_erreur), `réponse illisible : parse_error pédagogique (${JSON.stringify(illisible.corps)})`);
  const mauvaise = await m.poster(CHAMP_CHAINE, brute([etape("(x-1)^2", "TH"), etape("2(x-1)^2", "EV"), etape("x", "SOX")]));
  verifier(mauvaise.corps.statut === "not_equivalent" && JSON.stringify(mauvaise.corps.parties_fausses) === '["etape:1","etape:2"]', `parties fausses : les étapes 1 et 2 (${JSON.stringify(mauvaise.corps.parties_fausses)})`);
  const bonne = await m.poster(CHAMP_CHAINE, juste);
  verifier(bonne.corps.statut === "correct" && bonne.corps.parties_fausses === undefined, "chaîne juste : correct, aucune partie fausse");

  // Correction coupée : aucune partie fausse envoyée, même par la réponse qui TERMINE la tâche (porte du §52 : jamais par la révélation de fin de tâche).
  const coupee = await monter({ feedback_immediat: false });
  const premiere = await coupee.poster(CHAMP_COURBE, "999");
  verifier(premiere.statut === 200 && premiere.corps.statut === undefined && premiere.corps.parties_fausses === undefined, "correction coupée : ni verdict ni partie fausse sur un écran non final");
  const derniere = await coupee.poster(CHAMP_CHAINE, brute([etape("x", "EV")]));
  verifier(derniere.statut === 200 && derniere.corps.parties_fausses === undefined, `correction coupée : aucune partie fausse, même à la fin de la tâche (${JSON.stringify(Object.keys(derniere.corps))})`);

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (décodeur de la chaîne, écran servi, figure identique, parties fausses, portes)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
