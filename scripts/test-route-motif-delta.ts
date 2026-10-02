// Test permanent — gen7 « motif / delta » dans le VRAI `api/router.ts` avec le VRAI registre (RAPPORT §49, commit 7). Base en mémoire, sans réseau.
// Lancer : `npm run test-route-motif-delta`. Les dix variantes réelles sont assignées, servies, répondues : champs attendus, filtrage de la cascade, parcours complet correct
// (×10), cascade sous les trois régimes (immédiat sans la case, immédiat avec la case §45, coupé), codes stockés (RACINES_NOMBRE_INCORRECT, TABLEAU_*), aide combinée de l'écran
// d'allure (une ligne `aides_utilisees`), requêtes forgées, poids, variantes retirées (anciens `af_*`) toujours exécutables mais refusées à la composition.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { verifierBalisageMath } from "./support/texteMath";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { CATALOGUE_GENERATEURS } from "../lib/catalogueGenerateurs";
import { chercherGenerateur } from "../lib/registreGenerateurs";
import { FAMILLES, chercherFamille } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { champsMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/ecrans";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { fonctionVraie, type ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { coefVersExact } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { texteSaisieExact } from "../src/generateurs/analyseFonctionMotifDelta/exact/nombreExact";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const CHAMPS = champsMotifDelta();
const POIDS_ATTENDUS = (racines: 2 | 3): number[] => [1, 1, 2, 1, racines, 3];

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let compteur = 0;

  const nouveau = async (variante: string, graine: number, options: { feedback?: boolean; tentatives?: number; visible?: boolean; aide?: boolean } = {}) => {
    compteur++;
    const tache = creerTache(s, {
      nom: `md ${compteur}`,
      variantes: [{ variante_id: variante, nombre_exercices: 1 }],
      feedback_immediat: options.feedback ?? true,
      tentatives_supplementaires: options.tentatives ?? 0,
      reponse_visible: options.visible ?? true,
      aide_activee: options.aide ?? false,
    });
    const origine = Math.random;
    Math.random = () => graine / 2 ** 32;
    try {
      const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `assignation ${variante} : ${a.statut} ${JSON.stringify(a.corps)}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const ex: ExerciceMotifDelta = (chercherFamille(variante) ? genererExerciceMD(variante as ExerciceMotifDelta["famille"], Number(ligne.graine)) : null) as ExerciceMotifDelta; // null pour un ancien `af_*` retiré (autre générateur)
    return {
      ligne,
      id,
      ex,
      poster: (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } }),
      aide: (champ: string) => appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ } }),
      lire: async () =>
        (await appeler(`exercices/${id}`, "GET", { jeton: jetonEleve })).corps as { ecrans: EcranDeclare[]; champs: { champ: string; solution_attendue: unknown; revele: boolean }[]; champ_courant: string | null; exercice_termine: boolean },
      reponses: (champ: string) => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === champ),
      aidesUtilisees: () => s.base.table("aides_utilisees").filter((l) => l.exercice_assigne_id === id),
    };
  };
  const champsDe = (ecrans: EcranDeclare[]) => ecrans.map((e) => e.champ);
  const consigneDe = (ecrans: EcranDeclare[], champ: string) => ecrans.find((e) => e.champ === champ)?.consigne ?? "";

  // ── 1. Assignation des dix variantes : générateur, champs attendus ; seul « coefficients » servi au départ ──
  for (const fam of FAMILLES) {
    const x = await nouveau(fam.id, 12345);
    verifier(x.ligne.generateur_id === "gen7" && x.ligne.variante_id === fam.id, `${fam.numero} : generateur_id/variante_id stockés`);
    verifier(JSON.stringify(x.ligne.champs_attendus) === JSON.stringify(CHAMPS) && CHAMPS.length === 6, `${fam.numero} : champs_attendus = 6 écrans dans l'ordre (${JSON.stringify(x.ligne.champs_attendus)})`);
    const g = await x.lire();
    verifier(champsDe(g.ecrans).join() === "coefficients" && g.champ_courant === "coefficients", `${fam.numero} : seul « coefficients » est servi au départ (${champsDe(g.ecrans).join()})`);
    const brut = JSON.stringify(g);
    verifier(!/"aide":"/.test(brut) && !brut.includes("croquis_parabole"), `${fam.numero} : l'aide n'est jamais envoyée avec l'écran`);
    verifier(g.champs.every((c) => c.solution_attendue === null && !c.revele), `${fam.numero} : aucune solution servie au départ`);
    verifier(g.ecrans.every((e) => verifierBalisageMath(e.consigne).length === 0), `${fam.numero} : consignes servies saines`);
    verifier(!/"valeur":"\$-?\d/.test(brut) && !brut.includes("racinesChamp"), `${fam.numero} : rien des écrans suivants dans la charge utile`);
  }

  // ── 2. Parcours complet correct ×10, ordre de service, poids, champ courant ──
  for (const fam of FAMILLES) {
    const x = await nouveau(fam.id, 987654);
    let ok = true;
    let dernier: Awaited<ReturnType<typeof x.poster>> | null = null;
    for (const champ of CHAMPS) {
      const courant = (await x.lire()).champ_courant;
      if (courant !== champ) ok = false;
      dernier = await x.poster(champ, reponseBruteCorrecteMotifDelta(x.ex, champ));
      if (dernier.statut !== 200 || dernier.corps.statut !== "correct") {
        ok = false;
        echecs.push(`${fam.numero} / ${champ} : réponse correcte refusée : ${dernier.statut} ${JSON.stringify(dernier.corps)}`);
      }
    }
    verifier(ok && dernier?.corps.exercice_termine === true, `${fam.numero} : parcours complet correct jusqu'à la fin`);
    const g = await x.lire();
    verifier(g.exercice_termine === true && champsDe(g.ecrans).join() === CHAMPS.join(), `${fam.numero} : six écrans servis une fois terminé`);
    verifier(JSON.stringify(g.ecrans.map((e) => e.poids)) === JSON.stringify(POIDS_ATTENDUS(fam.poidsRacines)), `${fam.numero} : poids ${JSON.stringify(g.ecrans.map((e) => e.poids))}`);
    verifier(g.ecrans.every((e) => typeof e.nom === "string" && e.nom.length > 0), `${fam.numero} : chaque écran porte son nom`);
    verifier(x.reponses("racines").every((l) => l.statut === "correct"), `${fam.numero} : racines correctes enregistrées`);
  }

  // ── 3. Filtrage de la cascade : domaine/image après sommet, tableau après sommet ET racines ──
  {
    const x = await nouveau("af_motif_racines_opposees_rationnelles", 777);
    await x.poster("coefficients", reponseBruteCorrecteMotifDelta(x.ex, "coefficients"));
    verifier(champsDe((await x.lire()).ecrans).join() === "coefficients,allure,axeSommet,racines", `cascade : après coefficients → allure, sommet, racines (${champsDe((await x.lire()).ecrans).join()})`);
    await x.poster("allure", reponseBruteCorrecteMotifDelta(x.ex, "allure")); // un écran à la fois : l'ordre est imposé par le serveur
    await x.poster("axeSommet", reponseBruteCorrecteMotifDelta(x.ex, "axeSommet"));
    const g1 = await x.lire();
    verifier(champsDe(g1.ecrans).includes("domaineImage") && !champsDe(g1.ecrans).includes("tableauSignes"), "cascade : domaine/image servi après le sommet, pas encore le tableau");
    await x.poster("domaineImage", reponseBruteCorrecteMotifDelta(x.ex, "domaineImage"));
    await x.poster("racines", reponseBruteCorrecteMotifDelta(x.ex, "racines"));
    verifier(champsDe((await x.lire()).ecrans).includes("tableauSignes"), "cascade : tableau servi une fois coefficients, sommet et racines terminés");
  }

  // ── 4. Codes de compétence stockés ──
  {
    // RACINES_NOMBRE_INCORRECT : fonction à deux racines, une seule racine proposée
    const x = await nouveau("af_motif_racines_opposees_rationnelles", 777, { tentatives: 3 });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage"]) await x.poster(champ, reponseBruteCorrecteMotifDelta(x.ex, champ));
    const f = fonctionVraie(x.ex);
    const une = await x.poster("racines", JSON.stringify([texteSaisieExact(f.racines[0]!)]));
    verifier(une.statut === 200 && une.corps.statut === "not_equivalent" && x.reponses("racines")[0]?.bug_detecte === "RACINES_NOMBRE_INCORRECT", `RACINES_NOMBRE_INCORRECT stocké (${JSON.stringify(x.reponses("racines").map((l) => l.bug_detecte))})`);
    // parse_error : ne consomme pas d'essai, message pédagogique d'auteur sain
    const nbAvant = x.reponses("racines").length;
    const pe = await x.poster("racines", JSON.stringify(["sqrt("]));
    verifier(pe.statut === 200 && pe.corps.statut === "parse_error" && typeof pe.corps.message_erreur === "string" && verifierBalisageMath(pe.corps.message_erreur).length === 0, `parse_error + message (${JSON.stringify(pe.corps)})`);
    verifier(x.reponses("racines").length === nbAvant + 1, "parse_error enregistré comme une ligne");
    const c = await x.poster("racines", reponseBruteCorrecteMotifDelta(x.ex, "racines"));
    verifier(c.corps.statut === "correct", "racines justes acceptées après les essais ratés (3 essais supplémentaires)");

    // TABLEAU_* : l'écran tableau n'est servi qu'après le sommet et les racines ; on l'attaque avec la solution altérée ligne par ligne
    const bon = JSON.parse(reponseBruteCorrecteMotifDelta(x.ex, "tableauSignes")) as Record<string, Record<string, string>>;
    const SYM: Record<string, string> = { "+": "-", "-": "+", "0": "0", "↗": "↘", "↘": "↗", "⌢": "⌣", "⌣": "⌢" };
    const [ligneSigne, ligneVariation] = Object.keys(bon) as [string, string];
    const inverseLigne = (l: string) => Object.fromEntries(Object.entries(bon[l]!).map(([k, v]) => [k, SYM[v]!]));
    const essais: { nom: string; reponse: Record<string, Record<string, string>>; code: string }[] = [
      { nom: "signes inversés", reponse: { ...bon, [ligneSigne]: inverseLigne(ligneSigne) }, code: "TABLEAU_SIGNE_INVERSE" },
      { nom: "variations inversées", reponse: { ...bon, [ligneVariation]: inverseLigne(ligneVariation) }, code: "TABLEAU_CONCAVITE_INCORRECTE" },
      { nom: "signes partiels", reponse: { ...bon, [ligneSigne]: { ...bon[ligneSigne]!, [Object.keys(bon[ligneSigne]!)[0]!]: SYM[Object.values(bon[ligneSigne]!)[0]!]! === Object.values(bon[ligneSigne]!)[0] ? "+" : SYM[Object.values(bon[ligneSigne]!)[0]!]! } }, code: "TABLEAU_SIGNE_PARTIEL" },
    ];
    for (const e of essais) {
      const r = await x.poster("tableauSignes", JSON.stringify(e.reponse));
      const stocke = x.reponses("tableauSignes").at(-1)?.bug_detecte;
      verifier(r.statut === 200 && r.corps.statut === "not_equivalent" && stocke === e.code, `${e.nom} → ${e.code} stocké (${r.statut} ${r.corps.statut} ${String(stocke)})`);
    }
    const ok = await x.poster("tableauSignes", JSON.stringify(bon));
    verifier(ok.corps.statut === "correct", "tableau juste accepté après les essais ratés");
  }

  // ── 5. Aide combinée de l'écran d'allure : une seule aide, une seule ligne `aides_utilisees` ; tableau : croquis ; aide désactivée → 403 ──
  {
    const x = await nouveau("af_delta_racines_rationnelles", 4242, { aide: true });
    const avant = await x.aide("allure"); // dépend de coefficients, pas encore terminé
    verifier(avant.statut === 409 && x.aidesUtilisees().length === 0, `aide d'allure refusée avant coefficients (${avant.statut}) et non comptée`);
    await x.poster("coefficients", reponseBruteCorrecteMotifDelta(x.ex, "coefficients"));
    const a1 = await x.aide("allure");
    verifier(a1.statut === 200 && typeof a1.corps.aide === "string" && /a > 0/.test(a1.corps.aide) && /x_S/.test(a1.corps.aide) && verifierBalisageMath(a1.corps.aide).length === 0, `aide d'allure combinée servie (${a1.statut} ${JSON.stringify(a1.corps).slice(0, 80)})`);
    const a2 = await x.aide("allure");
    verifier(x.aidesUtilisees().filter((l) => l.champ === "allure").length === 1 && a2.statut === 200, "aide d'allure : une seule ligne aides_utilisees après deux demandes");
    const sansAide = await nouveau("af_delta_racines_rationnelles", 4242, { aide: false });
    await sansAide.poster("coefficients", reponseBruteCorrecteMotifDelta(sansAide.ex, "coefficients"));
    const refus = await sansAide.aide("allure");
    verifier(refus.statut === 403 && sansAide.aidesUtilisees().length === 0, `aide désactivée → 403 (${refus.statut})`);
  }

  // ── 6. Cascade sous les trois régimes : coefficients faux mais exploitables ──
  for (const reg of [
    { nom: "immédiat sans la case", feedback: true, visible: false },
    { nom: "immédiat avec la case (§45)", feedback: true, visible: true },
    { nom: "coupé", feedback: false, visible: false },
  ]) {
    const x = await nouveau("af_delta_racines_rationnelles", 4242, { feedback: reg.feedback, visible: reg.visible, tentatives: 0 });
    const f = fonctionVraie(x.ex);
    const faux = JSON.stringify({ a: String(-x.ex.a.n), b: texteSaisieExact(coefVersExact(x.ex.b)), c: String(x.ex.c.n) });
    const r = await x.poster("coefficients", faux);
    verifier(r.statut === 200, `${reg.nom} : coefficients faux acceptés par la route`);
    const g = await x.lire();
    const eff = consigneDe(g.ecrans, "allure");
    const cachee = !reg.feedback;
    if (cachee) verifier(r.corps.statut === undefined && r.corps.solution === undefined && r.corps.message_erreur === undefined, `${reg.nom} : aucun verdict ni solution`);
    // la fonction étudiée est celle de l'élève (régimes sans révélation de la solution) ou la vraie (§45 : solution montrée, réponse fausse révélée)
    const repartVrai = reg.feedback && reg.visible;
    verifier(repartVrai ? !eff.includes("d'après les coefficients que tu as donnés") : eff.includes("d'après les coefficients que tu as donnés"), `${reg.nom} : énoncé de l'écran suivant ${repartVrai ? "repart de la vraie fonction" : "suit la fonction de l'élève"} (« ${eff.slice(0, 70)} »)`);
    verifier(f.racines.length === 2, `${reg.nom} : (sanité) deux racines vraies`);
  }

  // ── 7. Requêtes forgées ──
  {
    const x = await nouveau("af_motif_racine_double_rationnelle", 31);
    for (const champ of ["racinesChamp1", "racinesChamp2", "reconnaissance", "nexistepas"]) {
      const forge = await x.poster(champ, "x");
      verifier(forge.statut === 400 && x.reponses(champ).length === 0, `champ forgé « ${champ} » → 400, rien enregistré (${forge.statut})`);
    }
    const dependant = await x.poster("tableauSignes", "{}");
    verifier(dependant.statut !== 200 || x.reponses("tableauSignes").length === 0, `tableau répondu avant ses prédécesseurs : rien d'enregistré (${dependant.statut})`);
    const cle = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: x.id, champ: "coefficients", reponse_brute: "{}", statut: "correct" } });
    verifier(cle.statut === 400, `clé inconnue dans le corps → 400 (${cle.statut})`);
  }

  // ── 8. Anciennes variantes : supprimées (registre, catalogue, composition) ──
  {
    const anciennes = ["af_mise_en_evidence", "af_binome_conjugue", "af_produit_remarquable", "af_irreductible"];
    for (const v of anciennes) {
      verifier(chercherGenerateur(v) === null, `${v} : plus au registre`);
      verifier(!CATALOGUE_GENERATEURS.some((e) => e.variante_id === v), `${v} : absente du catalogue affiché`);
    }
    for (const fam of FAMILLES) verifier(CATALOGUE_GENERATEURS.some((e) => e.variante_id === fam.id) && chercherGenerateur(fam.id) !== null, `${fam.id} : au catalogue et au registre`);
    const rep = await appeler("taches", "POST", {
      jeton: jetonProf,
      corps: { nom: "ancienne", feedback_immediat: true, tentatives_supplementaires: 0, reponse_visible: false, aide_activee: false, aide_penalite_pourcent: 0, chrono_mode: "aucun", afficher_recapitulatif: false, composition: [{ variante_id: "af_mise_en_evidence", nombre_exercices: 1 }] },
    });
    verifier(rep.statut === 400, `composition d'une ancienne variante refusée (${rep.statut})`);
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (gen7 motif/delta réel dans le vrai routeur : assignation ×10, parcours complet ×10, filtrage de la cascade, codes stockés, aide combinée, trois régimes, forgeries, anciennes variantes supprimées)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
