// Test permanent — la forme DESSINABLE de la solution (`solution_structuree`, RAPPORT §53) est servie sous la MÊME porte que `solution_attendue`, jamais ailleurs, contre le VRAI `api/router.ts`,
// le VRAI registre (gen7 « motif / delta ») et une base en mémoire. Lancer : `npm run test-solution-structuree`. Sans réseau.
//
// Règle : « Afficher la réponse attendue » (correction immédiate) montre le tableau de signes REMPLI ; case décochée ou correction coupée, rien — ni phrase ni tableau — avant la fin de la tâche.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { champsMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/ecrans";
import { reponseBruteCorrecteMotifDelta, solutionAttendueMotifDelta, solutionStructureeMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { FAMILLES } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { solutionStructureeSiMontree } from "../lib/solutionStructuree";
import { chercherGenerateur } from "../lib/registreGenerateurs";
import type { ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const FAMILLE = "af_delta_racines_rationnelles";
const GRAINE = 4242;
const CHAMPS = champsMotifDelta();
const TABLEAU = "tableauSignes";

const REGIMES: { nom: string; feedback: boolean; visible: boolean; montre: boolean }[] = [
  { nom: "immédiate + réponse attendue affichée", feedback: true, visible: true, montre: true },
  { nom: "immédiate SANS la case", feedback: true, visible: false, montre: false },
  { nom: "correction coupée", feedback: false, visible: false, montre: false },
];

async function main(): Promise<void> {
  // ── 1. Pur : la décision (porte unique) et le contenu ──
  {
    const ex = genererExerciceMD(FAMILLE, GRAINE);
    const generateur = chercherGenerateur(FAMILLE)!;
    verifier(solutionStructureeSiMontree(generateur, ex, TABLEAU, null) === null, "porte : sans solution_attendue, jamais de forme structurée (tableau)");
    verifier(solutionStructureeSiMontree(generateur, ex, TABLEAU, "peu importe") === reponseBruteCorrecteMotifDelta(ex, TABLEAU), "porte : avec solution_attendue, le tableau de signes a sa forme structurée = la réponse brute qui VALIDE l'écran");
    for (const champ of CHAMPS.filter((c) => c !== TABLEAU)) verifier(solutionStructureeSiMontree(generateur, ex, champ, "peu importe") === null, `porte : ${champ} n'a pas de forme structurée (reste une phrase)`);
    verifier(solutionStructureeSiMontree({}, ex, TABLEAU, "peu importe") === null, "porte : un générateur sans `solutionStructuree` (l'optionnel) donne null, jamais une erreur");
    for (const f of FAMILLES) for (const graine of [1, 2, 3, 77]) {
      const e = genererExerciceMD(f.id, graine);
      const s = solutionStructureeMotifDelta(e, TABLEAU);
      verifier(s !== null && s === reponseBruteCorrecteMotifDelta(e, TABLEAU) && typeof JSON.parse(s) === "object", `${f.id} #${graine} : forme structurée = JSON de la réponse juste`);
      verifier(solutionAttendueMotifDelta(e, TABLEAU).length > 0, `${f.id} #${graine} : la phrase de solution existe toujours (repli)`);
    }
  }

  // ── 2. Route : la même porte que `solution_attendue`, dans les trois régimes ──
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  let compteur = 0;
  const nouveau = async (feedback: boolean, visible: boolean) => {
    compteur++;
    const tache = creerTache(s, { nom: `structuree ${compteur}`, variantes: [{ variante_id: FAMILLE, nombre_exercices: 1 }], feedback_immediat: feedback, reponse_visible: visible, tentatives_supplementaires: 0 });
    const o = Math.random;
    Math.random = () => GRAINE / 2 ** 32;
    try {
      await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
    } finally {
      Math.random = o;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const brut: ExerciceMotifDelta = genererExerciceMD(FAMILLE, Number(ligne.graine));
    const poster = (champ: string, b: string) => appeler("reponses", "POST", { jeton: "eleve:eleve-1", corps: { exercice_assigne_id: id, champ, reponse_brute: b } });
    const lire = async (champ: string) => ((await appeler(`exercices/${id}`, "GET", { jeton: "eleve:eleve-1" })).corps as { champs: any[] }).champs.find((c) => c.champ === champ);
    const jusqueAuTableau = async () => {
      for (const champ of CHAMPS.filter((c) => c !== TABLEAU)) await poster(champ, reponseBruteCorrecteMotifDelta(brut, champ));
    };
    return { brut, poster, lire, jusqueAuTableau };
  };
  const tableauFaux = (b: ExerciceMotifDelta): string => {
    const t = JSON.parse(reponseBruteCorrecteMotifDelta(b, TABLEAU)) as Record<string, Record<string, string>>;
    const ligne = Object.keys(t)[0]!;
    const ancre = Object.keys(t[ligne]!)[0]!;
    t[ligne]![ancre] = t[ligne]![ancre] === "+" ? "-" : "+";
    return JSON.stringify(t);
  };

  for (const r of REGIMES) {
    // Un échec au tableau (1 essai) : champ épuisé, révélé SEULEMENT si la solution est montrée.
    const x = await nouveau(r.feedback, r.visible);
    await x.jusqueAuTableau();
    const faux = await x.poster(TABLEAU, tableauFaux(x.brut));
    const attendue = reponseBruteCorrecteMotifDelta(x.brut, TABLEAU);
    if (r.montre) {
      verifier(typeof faux.corps.solution_attendue === "string" && faux.corps.solution_structuree === attendue, `${r.nom} / POST : solution_attendue ET solution_structuree (= tableau juste)`);
      const vue = await x.lire(TABLEAU);
      verifier(typeof vue.solution_attendue === "string" && vue.solution_structuree === attendue, `${r.nom} / GET : solution_attendue ET solution_structuree`);
    } else {
      // Sous correction coupée, la réponse qui TERMINE la tâche révèle son champ (porte `revelationFinDeTache`) : le tableau est le dernier écran, donc la tâche se termine ici.
      if (r.feedback === false) verifier(typeof faux.corps.solution_attendue === "string" && faux.corps.solution_structuree === attendue, `${r.nom} / POST qui termine la tâche : phrase ET tableau révélés ensemble`);
      else verifier(!("solution_attendue" in faux.corps) && !("solution_structuree" in faux.corps), `${r.nom} / POST : ni phrase ni tableau (${JSON.stringify(Object.keys(faux.corps))})`);
      const vue = await x.lire(TABLEAU);
      if (r.feedback === false) verifier(vue.solution_attendue !== null && vue.solution_structuree === attendue, `${r.nom} / GET après la fin de la tâche : la solution (phrase ET tableau) est révélée`);
      else verifier(vue.solution_attendue === null && vue.solution_structuree === null, `${r.nom} / GET : ni phrase ni tableau (${JSON.stringify({ a: vue.solution_attendue, s: vue.solution_structuree })})`);
    }
  }

  // Correction coupée : AVANT la fin de la tâche, ni phrase ni tableau (un échec n'est pas plus visible qu'une réussite). Ici : tableau pas encore répondu.
  {
    const x = await nouveau(false, false);
    for (const champ of CHAMPS.filter((c) => c !== TABLEAU && c !== "racines")) await x.poster(champ, reponseBruteCorrecteMotifDelta(x.brut, champ));
    const vue = await x.lire("coefficients");
    verifier(vue.solution_attendue === null && vue.solution_structuree === null, "correction coupée, tâche NON terminée : coefficients — ni phrase ni forme structurée");
    const vueTableau = await x.lire(TABLEAU);
    verifier(vueTableau === undefined || (vueTableau.solution_attendue === null && vueTableau.solution_structuree === null), "correction coupée, tâche NON terminée : tableau — ni phrase ni forme structurée");
  }

  // Un autre champ révélé n'a jamais de forme structurée (reste une phrase).
  {
    const x = await nouveau(true, true);
    const r = await x.poster("coefficients", JSON.stringify({ a: "9", b: "9", c: "9" }));
    verifier(typeof r.corps.solution_attendue === "string" && !("solution_structuree" in r.corps), "immédiate + réponse affichée : un champ SANS forme structurée n'envoie que la phrase");
  }

  // La forme structurée, rejouée comme réponse sur un exercice neuf, est JUSTE (c'est bien une reponse_brute valide).
  {
    const x = await nouveau(true, true);
    await x.jusqueAuTableau();
    const faux = await x.poster(TABLEAU, tableauFaux(x.brut));
    const y = await nouveau(true, true);
    await y.jusqueAuTableau();
    const ok = await y.poster(TABLEAU, faux.corps.solution_structuree as string);
    verifier(ok.corps.statut === "correct", `la forme structurée servie est une réponse juste pour le tableau (${ok.corps.statut})`);
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (solution structurée : porte unique, trois régimes, POST et GET, tableau juste rejouable)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
