// Test permanent — gen7 dans le VRAI `api/router.ts` avec le VRAI registre (phase 3b-3, commit 3). Base en mémoire, sans réseau.
// Lancer : `npm run test-route-gen7`. Contrairement à `test-verification-racines.ts` (générateur de test), ici les quatre `af_*` réelles
// sont assignées, servies, répondues : champs attendus, écrans servis (filtrage de la cascade), verdicts, codes de compétence stockés,
// cascade A/B sur la réponse CONFIRMÉE, règle de révélation sous correction coupée, requêtes forgées.

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import { verifierBalisageMath } from "./support/texteMath";
import type { EcranDeclare } from "../lib/contratGenerateur";
import {
  champsAnalyseFonction,
  genererExercice,
  reponseBruteCorrecteAnalyseFonction,
  type CategorieAnalyseFonction,
  type ExerciceAnalyseFonction,
} from "../src/generateurs/analyseFonction";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const CATEGORIES: CategorieAnalyseFonction[] = ["mise_en_evidence", "binome_conjugue", "produit_remarquable", "irreductible"];

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let compteur = 0;

  /** Assigne UN exercice de la variante avec la graine voulue (la route tire la graine de `Math.random`). */
  const nouveau = async (categorie: CategorieAnalyseFonction, graine: number, options: { feedback?: boolean; tentatives?: number; visible?: boolean } = {}) => {
    compteur++;
    const tache = creerTache(s, { nom: `gen7 ${compteur}`, variantes: [{ variante_id: `af_${categorie}`, nombre_exercices: 1 }], feedback_immediat: options.feedback ?? true, tentatives_supplementaires: options.tentatives ?? 0, reponse_visible: options.visible ?? true });
    const origine = Math.random;
    Math.random = () => graine / 2 ** 32;
    try {
      const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `assignation af_${categorie} : ${a.statut} ${JSON.stringify(a.corps)}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const ex: ExerciceAnalyseFonction = genererExercice(categorie, Number(ligne.graine));
    return {
      ligne,
      id,
      ex,
      poster: (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } }),
      lire: async () => (await appeler(`exercices/${id}`, "GET", { jeton: jetonEleve })).corps as { ecrans: EcranDeclare[]; champs: { champ: string; solution_attendue: unknown; revele: boolean }[]; champ_courant: string | null; exercice_termine: boolean },
      reponses: (champ: string) => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === champ),
    };
  };
  const champs = (ecrans: EcranDeclare[]) => ecrans.map((e) => e.champ);
  const consigneDe = (ecrans: EcranDeclare[], champ: string) => ecrans.find((e) => e.champ === champ)?.consigne ?? "";

  // ── 1. Assignation : graine, générateur, champs attendus ; aucun écran servi avant son tour ──
  for (const categorie of CATEGORIES) {
    const x = await nouveau(categorie, 12345);
    verifier(x.ligne.generateur_id === "gen7" && x.ligne.variante_id === `af_${categorie}`, `${categorie} : generateur_id/variante_id stockés`);
    verifier(JSON.stringify(x.ligne.champs_attendus) === JSON.stringify(champsAnalyseFonction(categorie)), `${categorie} : champs_attendus = champs des écrans, dans l'ordre (${JSON.stringify(x.ligne.champs_attendus)})`);
    verifier((x.ligne.champs_attendus as string[]).length === (categorie === "irreductible" ? 6 : 8), `${categorie} : ${categorie === "irreductible" ? 6 : 8} champs`);
    const g = await x.lire();
    // RAPPORT §38 : allure, axeSommet et domaineImage dépendent des coefficients confirmés (et domaineImage de l'ordonnée du sommet) : ils ne sont plus servis au départ.
    const attendusServis = categorie === "irreductible" ? ["coefficients", "racinesReconnaissance"] : ["coefficients", "racinesReconnaissance", "racinesChamp1"];
    verifier(champs(g.ecrans).join() === attendusServis.join() && g.champ_courant === "coefficients", `${categorie} : écrans dépendants NON servis au départ (${champs(g.ecrans).join()})`);
    // Le NOM d'un champ figure dans `champs` (état par champ, sans contenu) ; c'est le CONTENU de l'écran qui ne doit pas être servi.
    verifier(!JSON.stringify(g.ecrans).includes("racinesChamp2") && !JSON.stringify(g.ecrans).includes("tableauSignes") && !JSON.stringify(g.ecrans).includes("D'après"), `${categorie} : écrans dépendants absents de la charge utile des écrans`);
    verifier(g.champs.every((c) => c.solution_attendue === null && c.revele === false), `${categorie} : aucune solution servie au départ`);
    for (const e of g.ecrans) verifier(verifierBalisageMath(e.consigne).length === 0 && e.consigne.startsWith(e.champ === "racinesChamp1" || e.champ === "racinesReconnaissance" ? e.consigne.slice(0, 5) : "Étudie"), `${categorie}/${e.champ} : consigne servie saine et énoncée ("${e.consigne.slice(0, 40)}")`);
    verifier(!JSON.stringify(g).includes("aide") || !/"aide":"/.test(JSON.stringify(g)), `${categorie} : l'aide n'est jamais envoyée avec l'écran`);
  }

  // ── 2. Parcours complet correct par catégorie, en correction immédiate ──
  for (const categorie of CATEGORIES) {
    const x = await nouveau(categorie, 987654);
    const ordre = champsAnalyseFonction(categorie);
    let dernier: Awaited<ReturnType<typeof x.poster>> | null = null;
    let ok = true;
    for (const champ of ordre) {
      const courant = (await x.lire()).champ_courant;
      if (courant !== champ) ok = false;
      dernier = await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.ex, champ));
      if (dernier.statut !== 200 || dernier.corps.statut !== "correct") {
        ok = false;
        echecs.push(`${categorie} / ${champ} : réponse correcte refusée par la route : ${dernier.statut} ${JSON.stringify(dernier.corps)}`);
      }
    }
    nb++;
    verifier(ok && dernier?.corps.exercice_termine === true, `${categorie} : parcours complet correct jusqu'à la fin (${ordre.length} écrans)`);
    const g = await x.lire();
    verifier(g.exercice_termine === true && champs(g.ecrans).join() === ordre.join(), `${categorie} : tous les écrans servis une fois l'exercice terminé`);
    verifier(s.base.table("reponses").filter((l) => l.exercice_assigne_id === x.id && l.statut === "correct").length === ordre.length, `${categorie} : ${ordre.length} réponses correctes enregistrées`);
  }

  // ── 3. Cascade A dans la route (correction immédiate) : la consigne de racinesChamp2 suit la réponse CONFIRMÉE ──
  {
    const x = await nouveau("mise_en_evidence", 12345, { feedback: true, tentatives: 0 }); // f = 4x² + 8x
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.ex, champ));
    // factorisation juste mais écrite autrement : la consigne suivante reprend l'écriture de l'élève, RÉ-ÉCRITE (jamais la chaîne brute)
    const r1 = await x.poster("racinesChamp1", "(4x)(x+2)");
    verifier(r1.corps.statut === "correct", `A : « (4x)(x+2) » correct (${JSON.stringify(r1.corps)})`);
    const g = await x.lire();
    verifier(champs(g.ecrans).includes("racinesChamp2"), "A : racinesChamp2 servi après racinesChamp1 terminé");
    const c2 = consigneDe(g.ecrans, "racinesChamp2");
    verifier(c2.includes("D'après ta factorisation") && c2.includes("$(4x)(x + 2) = 0$") && !c2.includes("(4x)(x+2)"), `A : consigne bâtie sur la réponse confirmée, ré-écrite : « ${c2.slice(0, 90)} »`);
    verifier(!g.ecrans.some((e) => e.champ === "tableauSignes"), "A : le tableau reste absent tant que racinesChamp2 n'est pas terminé");
    const z = await x.poster("racinesChamp2", reponseBruteCorrecteAnalyseFonction(x.ex, "racinesChamp2"));
    verifier(z.corps.statut === "correct", "A : racines -2 ; 0 justes");
    const g2 = await x.lire();
    verifier(champs(g2.ecrans).includes("tableauSignes"), "A : le tableau est servi une fois axeSommet ET racinesChamp2 terminés");
  }

  // ── 3 bis. Noms d'écran (RAPPORT §43) : servis avec chaque écran, identiques pour tous les élèves et dans les deux régimes ; plus de ligne « Ce que tu sais déjà » ──
  {
    const x = await nouveau("produit_remarquable", 12345, { feedback: true, tentatives: 0 });
    const y = await nouveau("produit_remarquable", 12345, { feedback: false });
    await x.poster("coefficients", reponseBruteCorrecteAnalyseFonction(x.ex, "coefficients"));
    await y.poster("coefficients", reponseBruteCorrecteAnalyseFonction(y.ex, "coefficients"));
    const sx = (await x.lire()).ecrans;
    const sy = (await y.lire()).ecrans;
    verifier(sx.length > 0 && sx.every((e) => typeof e.nom === "string" && e.nom.length > 0), "chaque écran servi porte son nom");
    verifier(JSON.stringify(sx.map((e) => e.nom)) === JSON.stringify(sy.map((e) => e.nom)), "les noms sont identiques sous correction immédiate et coupée");
    verifier(![...sx, ...sy].some((e) => e.consigne.includes("Ce que tu sais déjà")), "aucune consigne ne porte de ligne de faits");
    verifier(!JSON.stringify(await y.lire()).includes("$a = 4$"), "la charge utile coupée ne contient pas les coefficients");
    verifier(consigneDe(sx, "allure").startsWith("Étudie la fonction suivante"), "la consigne d'un écran « fonction » commence par l'énoncé");
  }

  // ── 4. Cascade A sous correction COUPÉE : une méthode juste sur une donnée fausse RÉUSSIT, rien n'est révélé ──
  {
    const x = await nouveau("mise_en_evidence", 12345, { feedback: false });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.ex, champ));
    const r1 = await x.poster("racinesChamp1", "3x(x-2)"); // fausse mais exploitable
    verifier(r1.statut === 200 && r1.corps.statut === undefined && r1.corps.message_erreur === undefined && r1.corps.solution === undefined, `coupé : aucun verdict ni solution après racinesChamp1 (${JSON.stringify(r1.corps)})`);
    const g = await x.lire();
    const c2 = consigneDe(g.ecrans, "racinesChamp2");
    verifier(c2.includes("$3x(x - 2) = 0$") && !c2.includes("(x + 2)"), `coupé : l'équation est celle de l'élève, la vraie factorisation ne fuit pas : « ${c2.slice(0, 90)} »`);
    verifier(!/4x\(x \+ 2\)|x \+ 2\)/.test(JSON.stringify(g)), "coupé : la vraie factorisation n'apparaît nulle part dans la charge utile");
    await x.poster("racinesChamp2", JSON.stringify(["0", "2"])); // racines de SON équation
    const lignes = x.reponses("racinesChamp2");
    verifier(lignes.length === 1 && lignes[0]!.statut === "correct", `coupé : « 0 ; 2 » est CORRECT pour l'équation de l'élève (${JSON.stringify(lignes.map((l) => l.statut))})`);
    const g2 = await x.lire();
    const tab = g2.ecrans.find((e) => e.champ === "tableauSignes");
    verifier(tab?.type === "tableau_signes" && tab.colonnes.filter((c) => c.genre === "valeur").every((c) => /^\$x_(1|2|S)\$$/.test(c.valeur ?? "")) && tab.colonnes.every((c) => c.symbole === undefined), `coupé : valeurs du tableau SYMBOLIQUES (${JSON.stringify(tab && tab.type === "tableau_signes" ? tab.colonnes.map((c) => c.valeur ?? c.libelle) : null)})`);
    verifier(!/"valeur":"\$-?\d/.test(JSON.stringify(g2)), "coupé : aucune valeur numérique de x dans la charge utile du tableau");
  }

  // ── 5. Repli à deux régimes (réponse illisible) ──
  {
    const coupe = await nouveau("mise_en_evidence", 12345, { feedback: false });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await coupe.poster(champ, reponseBruteCorrecteAnalyseFonction(coupe.ex, champ));
    const illisible = await coupe.poster("racinesChamp1", "2x(x-4");
    verifier(illisible.statut === 200 && illisible.corps.statut === undefined && illisible.corps.message_erreur === undefined, "coupé : le message d'un parse_error n'est pas envoyé");
    const c2 = consigneDe((await coupe.lire()).ecrans, "racinesChamp2");
    verifier(c2.includes("L'équation à résoudre est $4x^2 + 8x = 0$") && !c2.includes("(x + 2)"), `coupé + illisible : équation DÉVELOPPÉE publique (« ${c2.slice(0, 80)} »)`);

    // Immédiate SANS « Afficher la réponse attendue » : rien n'est montré, la cascade reste celle de la donnée de l'élève. (Avec la case, RAPPORT §45 :
    // la réponse fausse est révélée, la vraie valeur sert de départ — `scripts/test-cascade-revelee.ts`.)
    const immediat = await nouveau("mise_en_evidence", 12345, { feedback: true, tentatives: 0, visible: false });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await immediat.poster(champ, reponseBruteCorrecteAnalyseFonction(immediat.ex, champ));
    const rate = await immediat.poster("racinesChamp1", "3x(x-2)");
    verifier(rate.corps.statut === "not_equivalent", "immédiat : factorisation fausse → not_equivalent");
    const c2i = consigneDe((await immediat.lire()).ecrans, "racinesChamp2");
    // RAPPORT §38 (D-A du propriétaire, déroge à §33-D) : la cascade est UNIFORME. Une factorisation fausse mais exploitable, même révélée par la
    // correction immédiate, reste la donnée de départ de racinesChamp2 (avant : « La factorisation est $4x(x + 2) = 0$ »).
    verifier(c2i.includes("D'après ta factorisation") && c2i.includes("$3x(x - 2) = 0$") && !c2i.includes("4x(x + 2)"), `immédiat sans la case : la cascade suit SA factorisation (« ${c2i.slice(0, 80)} »)`);
  }

  // ── 6. af_irreductible : deux écrans racines inexistants, requêtes forgées rejetées ──
  {
    const x = await nouveau("irreductible", 42);
    for (const champ of ["racinesChamp1", "racinesChamp2"]) {
      const forge = await x.poster(champ, champ === "racinesChamp2" ? "[]" : "x(x-1)");
      verifier(forge.statut === 400 && x.reponses(champ).length === 0, `irréductible : requête forgée sur ${champ} → 400, rien enregistré (${forge.statut})`);
    }
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.ex, champ));
    const g = await x.lire();
    verifier(champs(g.ecrans).join() === "coefficients,allure,axeSommet,domaineImage,racinesReconnaissance,tableauSignes" && g.champ_courant === "tableauSignes", `irréductible : après axeSommet, le tableau vient directement (${champs(g.ecrans).join()})`);
    const tab = g.ecrans.find((e) => e.champ === "tableauSignes");
    verifier(tab?.type === "tableau_signes" && tab.colonnes.length === 3, "irréductible : tableau à 3 colonnes (aucune racine)");
  }

  // ── 7. Codes de compétence stockés, parse_error avec message pédagogique ──
  {
    const x = await nouveau("produit_remarquable", 12345, { tentatives: 3 });
    const f = x.ex.fonction;
    await x.poster("coefficients", reponseBruteCorrecteAnalyseFonction(x.ex, "coefficients"));
    // allure : signe de a juste, signe de ab faux → ALLURE_PARTIELLE
    const signeA = f.a > 0 ? "+" : "-";
    const signeABfaux = f.a * f.b > 0 ? "-" : "+";
    const allure = await x.poster("allure", JSON.stringify({ signeA, signeAB: signeABfaux }));
    verifier(allure.corps.statut === "not_equivalent" && x.reponses("allure")[0]?.bug_detecte === "ALLURE_PARTIELLE", `ALLURE_PARTIELLE stocké (${JSON.stringify(x.reponses("allure").map((l) => l.bug_detecte))})`);
    await x.poster("allure", reponseBruteCorrecteAnalyseFonction(x.ex, "allure")); // l'écran courant ne change qu'une fois « allure » terminé
    // axe : la valeur juste sans « x = » (au lieu de « x = … ») → parse_error avec message et code de notation
    const axe = await x.poster("axeSommet", JSON.stringify({ axeTexte: String(f.xS), xS: String(f.xS), yS: String(f.yS) }));
    verifier(axe.statut === 200 && axe.corps.statut === "parse_error" && /x = /.test(axe.corps.message_erreur ?? "") && verifierBalisageMath(axe.corps.message_erreur ?? "").length === 0, `axe sans « x = » : parse_error + message pédagogique (${JSON.stringify(axe.corps)})`);
    verifier(x.reponses("axeSommet")[0]?.bug_detecte === "AXE_SYMETRIE_NOTATION", `AXE_SYMETRIE_NOTATION stocké sur un parse_error (${JSON.stringify(x.reponses("axeSommet").map((l) => l.bug_detecte))})`);
    // Rejet d'une clé inconnue et d'un champ inexistant
    const inconnu = await x.poster("nexistepas", "x");
    verifier(inconnu.statut === 400, `champ inexistant → 400 (${inconnu.statut})`);
  }

  // ── 7 bis. Codes de la factorisation (déclarés par le générateur, sinon `verifierAvecControle` lève -> 500) ──
  {
    const x = await nouveau("binome_conjugue", 12345, { tentatives: 3 }); // f = 4x² − 16 = 4(x − 2)(x + 2)
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.ex, champ));
    const c05 = await x.poster("racinesChamp1", "4(x-2)(x-2)");
    verifier(c05.statut === 200 && c05.corps.statut === "not_equivalent" && x.reponses("racinesChamp1")[0]?.bug_detecte === "C05_SIGNE_REPETE", `C05_SIGNE_REPETE stocké (${c05.statut} ${JSON.stringify(x.reponses("racinesChamp1").map((l) => l.bug_detecte))})`);
    const c06 = await x.poster("racinesChamp1", "4(x+2)(x+2)");
    verifier(c06.statut === 200, `racinesChamp1 : réponse suivante acceptée par la route (${c06.statut})`);
    await x.poster("racinesChamp1", reponseBruteCorrecteAnalyseFonction(x.ex, "racinesChamp1"));
    const partielle = await x.poster("racinesChamp2", JSON.stringify(["-2", "137"]));
    verifier(partielle.statut === 200 && partielle.corps.statut === "not_equivalent" && x.reponses("racinesChamp2")[0]?.bug_detecte === "RACINE_PARTIELLE", `RACINE_PARTIELLE stocké (${partielle.statut} ${JSON.stringify(x.reponses("racinesChamp2").map((l) => l.bug_detecte))})`);
  }
  {
    const { chercherGenerateur } = require("../lib/registreGenerateurs") as { chercherGenerateur: (v: string) => { codesCompetenceDeclares: string[] } | null };
    const irr = chercherGenerateur("af_irreductible")!.codesCompetenceDeclares;
    const me = chercherGenerateur("af_mise_en_evidence")!.codesCompetenceDeclares;
    verifier(irr.join() === "ALLURE_PARTIELLE,AXE_SYMETRIE_NOTATION,SIGNE_VARIATION_PARTIEL", `af_irreductible ne déclare aucun code de factorisation (${irr.join()})`);
    verifier(me.length === 7 && ["C04", "C05_SIGNE_REPETE", "C06_SIGNE_OPPOSE", "RACINE_PARTIELLE"].every((c) => me.includes(c)) && !me.includes("C07_ou_C08"), `af_mise_en_evidence déclare les 7 codes, jamais C07_ou_C08 (${me.join()})`);
  }

  // ── 8. Accès : l'élève ne voit jamais la solution (aide et solution absentes des écrans) ──
  {
    const x = await nouveau("binome_conjugue", 12345);
    const g = await x.lire();
    const brut = JSON.stringify(g);
    verifier(g.champs.every((c) => c.solution_attendue === null) && !brut.includes("reponse_attendue") && !brut.includes("formeFactorisee") && !brut.includes("(x - "), "GET exercice : aucune solution ni forme factorisée dans la charge utile");
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (gen7 réel dans le vrai routeur : assignation, filtrage de la cascade, parcours complet ×4, cascade A/B, repli, irréductible, codes stockés)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
