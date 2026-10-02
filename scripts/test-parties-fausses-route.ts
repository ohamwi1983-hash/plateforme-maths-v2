// Test permanent — les PARTIES FAUSSES sur le vrai routeur (RAPPORT §52). Lancer : `npm run test-parties-fausses-route`. Base en mémoire, sans réseau.
//
// Règle (demande du propriétaire) : sous CORRECTION IMMÉDIATE (avec ou sans « Afficher la réponse attendue », avec ou sans essais supplémentaires), la réponse d'un écran faux désigne
// les parties fausses (`parties_fausses`) pour que le navigateur les surligne ; `GET /api/exercices/:id` les redonne pour l'écran récapitulatif. Sous correction COUPÉE : jamais, y compris
// quand la fin de la tâche révèle les verdicts (la porte est le réglage RÉEL de la tâche, pas la révélation forcée). Une réponse juste n'en porte pas ; illisible non plus.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import type { ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const FAMILLE = "af_delta_racines_rationnelles";
const CHAMPS = ["coefficients", "allure", "axeSommet", "domaineImage", "racines", "tableauSignes"];

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  let compteur = 0;
  const nouveau = async (o: { feedback: boolean; visible: boolean; tentatives?: number }) => {
    compteur++;
    const tache = creerTache(s, { nom: `parties ${compteur}`, variantes: [{ variante_id: FAMILLE, nombre_exercices: 1 }], feedback_immediat: o.feedback, reponse_visible: o.visible, tentatives_supplementaires: o.tentatives ?? 0 });
    const origine = Math.random;
    Math.random = () => 4242 / 2 ** 32;
    try {
      await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const ex: ExerciceMotifDelta = genererExerciceMD(FAMILLE, Number(ligne.graine));
    const juste = (champ: string) => JSON.parse(reponseBruteCorrecteMotifDelta(ex, champ));
    return {
      ex,
      juste,
      poster: (champ: string, brute: unknown) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: ligne.id, champ, reponse_brute: typeof brute === "string" ? brute : JSON.stringify(brute) } }),
      lire: async () => (await appeler(`exercices/${ligne.id}`, "GET", { jeton: "eleve:eleve-1" })).corps as { champs: { champ: string; statut: string | null; parties_fausses?: string[] | null }[] },
    };
  };
  const partiesDe = (g: { champs: { champ: string; parties_fausses?: string[] | null }[] }, champ: string) => g.champs.find((c) => c.champ === champ)?.parties_fausses;

  // ── 1. Correction immédiate : AVEC la case, SANS la case, AVEC essais supplémentaires ──
  for (const r of [
    { nom: "immédiate + case", feedback: true, visible: true, tentatives: 0 },
    { nom: "immédiate sans la case", feedback: true, visible: false, tentatives: 0 },
    { nom: "immédiate + 2 essais", feedback: true, visible: false, tentatives: 2 },
  ]) {
    const x = await nouveau(r);
    const c = { ...x.juste("coefficients"), b: "997" };
    const p = await x.poster("coefficients", c);
    verifier(p.corps.statut === "not_equivalent" && JSON.stringify(p.corps.parties_fausses) === JSON.stringify(["b"]), `${r.nom} : la réponse POST désigne b (${JSON.stringify(p.corps)})`);
    const g = await x.lire();
    verifier(JSON.stringify(partiesDe(g, "coefficients")) === JSON.stringify(r.tentatives > 0 ? ["b"] : ["b"]), `${r.nom} : GET redonne les parties pour l'écran récapitulatif (${JSON.stringify(partiesDe(g, "coefficients"))})`);
    verifier(g.champs.filter((c2) => c2.champ !== "coefficients").every((c2) => !c2.parties_fausses), `${r.nom} : aucun autre champ n'en porte`);
    // une réponse juste (ou illisible) n'en porte pas
    if (r.tentatives > 0) {
      const illisible = await x.poster("coefficients", { a: "sqrt(", b: "1", c: "1" });
      verifier(illisible.corps.statut === "parse_error" && !("parties_fausses" in illisible.corps), `${r.nom} : illisible → aucune partie (${JSON.stringify(illisible.corps)})`);
      const bon = await x.poster("coefficients", x.juste("coefficients"));
      verifier(bon.corps.statut === "correct" && !("parties_fausses" in bon.corps), `${r.nom} : réponse juste après essai → aucune partie`);
      verifier(!partiesDe(await x.lire(), "coefficients"), `${r.nom} : GET après réussite → plus de parties (dernière réponse juste)`);
    }
  }

  // ── 2. Chacun des six écrans désigne ses parties, POST et GET identiques ──
  {
    const x = await nouveau({ feedback: true, visible: false, tentatives: 5 });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage"]) await x.poster(champ, x.juste(champ));
    const cas: [string, unknown, string[]][] = [
      ["racines", ["997", "-4"], ["ligne:0"]],
      ["racines", [], ["mode:aucune"]],
    ];
    for (const [champ, brut, attendu] of cas) {
      const p = await x.poster(champ, brut);
      verifier(JSON.stringify(p.corps.parties_fausses) === JSON.stringify(attendu), `${champ} ${JSON.stringify(brut)} → ${JSON.stringify(attendu)} (${JSON.stringify(p.corps.parties_fausses)})`);
      verifier(JSON.stringify(partiesDe(await x.lire(), champ)) === JSON.stringify(attendu), `${champ} : GET identique au POST`);
    }
    await x.poster("racines", x.juste("racines"));
    const tab = x.juste("tableauSignes") as Record<string, Record<string, string>>;
    const [ligne] = Object.keys(tab) as [string];
    const [ancre, valeur] = Object.entries(tab[ligne]!)[0] as [string, string];
    const faux = JSON.parse(JSON.stringify(tab)) as typeof tab;
    faux[ligne]![ancre] = valeur === "+" ? "-" : "+";
    const pt = await x.poster("tableauSignes", faux);
    verifier(JSON.stringify(pt.corps.parties_fausses) === JSON.stringify([`${ligne}:${ancre}`]), `tableau : la case ${ligne}:${ancre} désignée (${JSON.stringify(pt.corps.parties_fausses)})`);
  }

  // ── 3. Correction COUPÉE : jamais, ni pendant, ni à la fin de la tâche (révélation forcée des verdicts) ──
  {
    const x = await nouveau({ feedback: false, visible: true });
    const p = await x.poster("coefficients", { ...x.juste("coefficients"), b: "997" });
    verifier(!("parties_fausses" in p.corps) && p.corps.statut === undefined, `coupé : la réponse POST ne désigne rien (${JSON.stringify(p.corps)})`);
    verifier((await x.lire()).champs.every((c) => !c.parties_fausses), "coupé, tâche en cours : GET sans parties");
    for (const champ of CHAMPS.slice(1)) await x.poster(champ, x.juste(champ));
    const fin = await x.lire();
    verifier(fin.champs.find((c) => c.champ === "coefficients")?.statut === "not_equivalent", "coupé, tâche terminée : le verdict est révélé d'un coup (sanité)");
    verifier(fin.champs.every((c) => !c.parties_fausses), `coupé, tâche terminée : AUCUNE partie désignée malgré la révélation des verdicts (${JSON.stringify(fin.champs.map((c) => c.parties_fausses))})`);
  }

  // ── 4. Immédiat sans écran faux : rien ──
  {
    const x = await nouveau({ feedback: true, visible: true });
    for (const champ of CHAMPS) {
      const r = await x.poster(champ, x.juste(champ));
      verifier(r.corps.statut === "correct" && !("parties_fausses" in r.corps), `${champ} juste : aucune partie`);
    }
    verifier((await x.lire()).champs.every((c) => !c.parties_fausses), "tout juste : GET sans parties");
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (parties fausses sur le vrai routeur : trois variantes de correction immédiate, six écrans, correction coupée jamais, POST et GET identiques)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
