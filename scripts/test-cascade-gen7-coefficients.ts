// Test permanent — cascade des coefficients dans gen7 (RAPPORT §38), contre le VRAI `api/router.ts` et le VRAI registre. Base en mémoire.
// Lancer : `npm run test-cascade-gen7-coefficients`. Sans réseau.
//
// Verrouille le scénario signalé par le propriétaire (f(x) = 4x² + 8x, graine 12345) : coefficients CONFIRMÉS a = 5, b = 4, c = −4 (faux) ;
// axeSommet xS = −2/5 (cohérent avec SES coefficients), yS = 0 (faux même pour eux) ; domaineImage [0 ; +∞[ = la méthode juste appliquée à
// SES valeurs confirmées (a = 5 > 0, yS = 0) -> doit être ACCEPTÉ. Dans les DEUX régimes de correction (D-A, cascade uniforme). Établit aussi
// la mécanique de révélation sous correction immédiate (`revelee` => solution montrée, indépendamment de `reponse_visible`), le repli sur la
// vraie fonction quand les coefficients confirmés sont inexploitables, le filtrage serveur des écrans dépendants, le panneau de faits, et
// la cascade de `racinesChamp2` désormais aussi sous correction immédiate (déroge à §33-D).

export {}; // module

import { appeler, creerScenario, creerTache, installerBase } from "./support/harnaisRouteur";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { genererExercice, reponseBruteCorrecteAnalyseFonction, ecransAnalyseFonction, type ExerciceAnalyseFonction } from "../src/generateurs/analyseFonction";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const COEF_FAUX = JSON.stringify({ a: "5", b: "4", c: "-4" });
const AXE = (yS: string) => JSON.stringify({ axeTexte: "x = -2/5", xS: "-2/5", yS });
const IMAGE = (borne: string) => JSON.stringify({ crochetGauche: "[", borneGauche: borne, crochetDroit: "[", borneDroite: "+inf" });

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let compteur = 0;

  const nouveau = async (options: { feedback: boolean; aide?: boolean; tentatives?: number; reponseVisible?: boolean; categorie?: "mise_en_evidence" | "irreductible" }) => {
    compteur++;
    const categorie = options.categorie ?? "mise_en_evidence";
    const tache = creerTache(s, { nom: `cascade ${compteur}`, variantes: [{ variante_id: `af_${categorie}`, nombre_exercices: 1 }], feedback_immediat: options.feedback, tentatives_supplementaires: options.tentatives ?? 0, reponse_visible: options.reponseVisible ?? false, aide_activee: options.aide ?? false });
    const origine = Math.random;
    Math.random = () => 12345 / 2 ** 32; // f(x) = 4x² + 8x pour mise_en_evidence
    try {
      const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `assignation : ${a.statut}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const ex: ExerciceAnalyseFonction = genererExercice(categorie, Number(ligne.graine));
    return {
      id,
      ex,
      poster: (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } }),
      lire: async () => (await appeler(`exercices/${id}`, "GET", { jeton: jetonEleve })).corps as { ecrans: (EcranDeclare & { aide_disponible?: boolean })[]; champs: any[]; champ_courant: string | null },
      aide: (champ: string) => appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ } }),
      statuts: (champ: string) => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === champ).map((l) => l.statut as string),
    };
  };
  const consigne = (g: { ecrans: EcranDeclare[] }, champ: string) => g.ecrans.find((e) => e.champ === champ)?.consigne ?? "";
  const REGIMES: { nom: string; feedback: boolean }[] = [{ nom: "correction immédiate", feedback: true }, { nom: "correction coupée", feedback: false }];

  // ── 0. Le sujet est bien celui du signalement ──
  {
    const x = await nouveau({ feedback: true });
    verifier(x.ex.fonction.a === 4 && x.ex.fonction.b === 8 && x.ex.fonction.c === 0 && x.ex.fonction.yS === -4, `f = 4x² + 8x (yS = −4) : ${JSON.stringify(x.ex.fonction)}`);
  }

  // ── 1. LE SCÉNARIO EXACT, dans les deux régimes ──
  for (const r of REGIMES) {
    const e = `${r.nom} / scénario exact`;
    const x = await nouveau({ feedback: r.feedback });
    await x.poster("coefficients", COEF_FAUX);
    verifier(x.statuts("coefficients")[0] === "not_equivalent", `${e} : a = 5, b = 4, c = −4 est faux pour l'énoncé`);
    const g = await x.lire();
    for (const champ of ["allure", "axeSommet"]) {
      verifier(consigne(g, champ).includes("d'après les coefficients que tu as donnés") && consigne(g, champ).includes("$f(x) = 5x^2 + 4x - 4$"), `${e} : la consigne de ${champ} affiche SA fonction (${consigne(g, champ).slice(0, 120)})`);
    }
    await x.poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
    verifier(x.statuts("allure")[0] === "correct", `${e} : allure jugée sur a = 5, b = 4`);
    await x.poster("axeSommet", AXE("0"));
    verifier(x.statuts("axeSommet")[0] === "not_equivalent", `${e} : yS = 0 est faux même pour ses coefficients (f(−2/5) = −24/5)`);
    const g2 = await x.lire();
    const cd = consigne(g2, "domaineImage");
    verifier(cd.includes("$f(x) = 5x^2 + 4x - 4$") && cd.includes("$y_S = 0$"), `${e} : la consigne de domaineImage affiche sa fonction ET son ordonnée du sommet (« ${cd.slice(0, 200)} »)`);
    const rep = await x.poster("domaineImage", IMAGE("0"));
    verifier(x.statuts("domaineImage")[0] === "correct", `${e} : [0 ; +∞[ est ACCEPTÉ (a = 5 > 0, yS = 0 confirmés) — statuts ${JSON.stringify(x.statuts("domaineImage"))} ${JSON.stringify(rep.corps).slice(0, 160)}`);
  }

  // ── 2. Valeurs cohérentes de bout en bout : la vraie image n'est PAS acceptée ──
  for (const r of REGIMES) {
    const e = `${r.nom} / cohérent`;
    const x = await nouveau({ feedback: r.feedback });
    await x.poster("coefficients", COEF_FAUX);
    await x.poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
    await x.poster("axeSommet", AXE("-24/5"));
    verifier(x.statuts("axeSommet")[0] === "correct", `${e} : xS = −2/5 et yS = −24/5 sont corrects pour a = 5, b = 4, c = −4`);
    await x.poster("domaineImage", IMAGE("-4"));
    verifier(x.statuts("domaineImage")[0] === "not_equivalent", `${e} : la VRAIE image [−4 ; +∞[ n'est pas la méthode appliquée à ses valeurs`);
    const y = await nouveau({ feedback: r.feedback });
    await y.poster("coefficients", COEF_FAUX);
    await y.poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
    await y.poster("axeSommet", AXE("-24/5"));
    await y.poster("domaineImage", IMAGE("-24/5"));
    verifier(y.statuts("domaineImage")[0] === "correct", `${e} : [−24/5 ; +∞[ est correct`);
  }

  // ── 3. allure : le SIGNE de a confirmé décide (a = −5 contre a = 4 vrai) ──
  for (const r of REGIMES) {
    const x = await nouveau({ feedback: r.feedback });
    await x.poster("coefficients", JSON.stringify({ a: "-5", b: "4", c: "0" }));
    await x.poster("allure", JSON.stringify({ signeA: "-", signeAB: "-" }));
    verifier(x.statuts("allure")[0] === "correct", `${r.nom} / allure : a = −5 confirmé -> a < 0 et ab < 0 corrects`);
    const y = await nouveau({ feedback: r.feedback });
    await y.poster("coefficients", JSON.stringify({ a: "-5", b: "4", c: "0" }));
    await y.poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
    verifier(y.statuts("allure")[0] === "not_equivalent", `${r.nom} / allure : les signes de l'énoncé (a = 4) ne sont pas ceux de SES coefficients`);
  }

  // ── 4. Coefficients inexploitables -> la vraie fonction (publique dans l'énoncé), consigne inchangée ──
  for (const r of REGIMES) {
    for (const [nom, brut] of [["illisibles", JSON.stringify({ a: "x", b: "y", c: "z" })], ["a = 0", JSON.stringify({ a: "0", b: "3", c: "1" })], ["démesurés", JSON.stringify({ a: "99999999", b: "1", c: "1" })]] as const) {
      const x = await nouveau({ feedback: r.feedback });
      await x.poster("coefficients", brut);
      const g = await x.lire();
      verifier(consigne(g, "allure") === ecransAnalyseFonction(x.ex).find((e) => e.champ === "allure")!.consigne, `${r.nom} / coefficients ${nom} : la consigne reste celle de l'exercice brut (vraie fonction) : ${consigne(g, "allure").slice(0, 90)}`);
      await x.poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
      await x.poster("axeSommet", JSON.stringify({ axeTexte: "x = -1", xS: "-1", yS: "-4" }));
      await x.poster("domaineImage", IMAGE("-4"));
      verifier(x.statuts("allure")[0] === "correct" && x.statuts("axeSommet")[0] === "correct" && x.statuts("domaineImage")[0] === "correct", `${r.nom} / coefficients ${nom} : repli sur la vraie fonction (${x.statuts("allure")}, ${x.statuts("axeSommet")}, ${x.statuts("domaineImage")})`);
    }
  }

  // ── 5. Aucun changement quand les coefficients sont justes (régression) ──
  {
    const x = await nouveau({ feedback: false });
    await x.poster("coefficients", reponseBruteCorrecteAnalyseFonction(x.ex, "coefficients"));
    const g = await x.lire();
    // Même libellé que pour des coefficients faux (aucun verdict visible sous correction coupée) ; la fonction affichée est la vraie, en ordre canonique.
    for (const champ of ["allure", "axeSommet"]) verifier(consigne(g, champ) === `Étudie la fonction suivante, d'après les coefficients que tu as donnés : $f(x) = 4x^2 + 8x$. ${champ === "allure" ? "Quelle est l'allure de sa parabole ?" : "Donne l'axe de symétrie et les coordonnées du sommet (arrondi au centième accepté si besoin)."}`, `coefficients justes : consigne de ${champ} = libellé commun + vraie fonction (« ${consigne(g, champ).slice(0, 110)} »)`);
    for (const champ of ["allure", "axeSommet", "domaineImage"]) {
      await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.ex, champ));
      verifier(x.statuts(champ)[0] === "correct", `coefficients justes : ${champ} correct`);
    }
    const aide = await x.aide("axeSommet").catch(() => null);
    verifier(aide === null || aide.statut === 403 || aide.statut === 200, "aide : pas d'exception");
  }

  // ── 5 bis. Correction coupée : aucun verdict visible dans le libellé ni dans les aides (juste, faux entier, faux non entier) ──
  {
    const forme = async (coefs: string) => {
      const x = await nouveau({ feedback: false, aide: true });
      await x.poster("coefficients", coefs);
      const g = await x.lire();
      const ecran = (champ: string) => g.ecrans.find((e) => e.champ === champ)!;
      return { consigne: consigne(g, "axeSommet").replace(/\$f\(x\) = [^$]*\$/, "$f$"), aide: ecran("axeSommet").aide_disponible, aideAllure: ecran("allure").aide_disponible };
    };
    const [juste, fauxEntier, fauxDecimal] = [await forme(JSON.stringify({ a: "4", b: "8", c: "0" })), await forme(COEF_FAUX), await forme(JSON.stringify({ a: "1.5", b: "2", c: "0" }))];
    verifier(juste.consigne === fauxEntier.consigne && juste.consigne === fauxDecimal.consigne, `libellé identique pour coefficients justes, faux entiers, faux décimaux (« ${juste.consigne.slice(0, 90)} » / « ${fauxDecimal.consigne.slice(0, 90)} »)`);
    verifier(juste.aide === fauxEntier.aide && juste.aide === fauxDecimal.aide && juste.aide === true, `l'aide de axeSommet reste disponible dans les trois cas (${juste.aide}, ${fauxEntier.aide}, ${fauxDecimal.aide})`);
  }

  // ── 6. Les écrans dépendants ne sont servis qu'une fois leurs prédécesseurs confirmés (filtrage serveur) ──
  {
    const x = await nouveau({ feedback: false });
    const g0 = await x.lire();
    const servis0 = g0.ecrans.map((e) => e.champ);
    verifier(servis0.join() === "coefficients,racinesReconnaissance,racinesChamp1", `au départ : seuls les écrans indépendants sont servis (${servis0.join()})`);
    verifier(!JSON.stringify(g0).includes("ensemble-image") && !JSON.stringify(g0).includes("l'allure de sa parabole") && !JSON.stringify(g0).includes("axe de symétrie"), "au départ : le contenu des écrans dépendants n'est pas dans la charge utile");
    await x.poster("coefficients", COEF_FAUX);
    const servis1 = (await x.lire()).ecrans.map((e) => e.champ);
    verifier(servis1.includes("allure") && servis1.includes("axeSommet") && !servis1.includes("domaineImage"), `après coefficients : allure et axeSommet servis, domaineImage attend axeSommet (${servis1.join()})`);
    await x.poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
    await x.poster("axeSommet", AXE("0"));
    verifier((await x.lire()).ecrans.map((e) => e.champ).includes("domaineImage"), "après axeSommet : domaineImage servi");
    const forge = await x.poster("domaineImage", IMAGE("0"));
    verifier(forge.statut === 200, "domaineImage acceptée une fois ses prédécesseurs confirmés");
  }

  // ── 7. MÉCANIQUE DE RÉVÉLATION (à confirmer explicitement) ──
  {
    // Correction immédiate, `reponse_visible = false` : un champ révélé montre TOUJOURS la solution (le réglage n'agit que sur une réussite).
    const un = await nouveau({ feedback: true, reponseVisible: false });
    const r1 = await un.poster("coefficients", COEF_FAUX);
    verifier(r1.corps.verrouille === true && r1.corps.revele === true && typeof r1.corps.solution_attendue === "string" && r1.corps.statut === "not_equivalent", `immédiat, 1 essai, reponse_visible=false : échec => verrouillé, révélé, solution montrée (${JSON.stringify(r1.corps).slice(0, 200)})`);
    const ok = await nouveau({ feedback: true, reponseVisible: false });
    const r2 = await ok.poster("coefficients", reponseBruteCorrecteAnalyseFonction(ok.ex, "coefficients"));
    verifier(r2.corps.statut === "correct" && r2.corps.solution_attendue === undefined && r2.corps.revele === false, "immédiat, reponse_visible=false : une RÉUSSITE ne montre pas la solution (le réglage agit là)");
    // Deux essais : le premier échec n'est ni terminé ni révélé ; le second (épuisement) révèle. Un parse_error compte comme un essai raté.
    const deux = await nouveau({ feedback: true, tentatives: 1, reponseVisible: false });
    const a1 = await deux.poster("coefficients", COEF_FAUX);
    verifier(a1.corps.verrouille === false && a1.corps.revele === false && a1.corps.solution_attendue === undefined && a1.corps.tentatives_restantes === 1, `2 essais : le 1er échec ne révèle rien (${JSON.stringify(a1.corps).slice(0, 160)})`);
    const a2 = await deux.poster("coefficients", JSON.stringify({ a: "6", b: "4", c: "-4" }));
    verifier(a2.corps.verrouille === true && a2.corps.revele === true && typeof a2.corps.solution_attendue === "string", "2 essais : l'épuisement révèle la solution");
    const gd = await deux.lire();
    verifier(consigne(gd, "allure").includes("$f(x) = 6x^2 + 4x - 4$"), `la valeur confirmée est celle de la DERNIÈRE tentative (a = 6) : ${consigne(gd, "allure").slice(0, 100)}`);
    const pe = await nouveau({ feedback: true, tentatives: 1 });
    await pe.poster("coefficients", COEF_FAUX);
    const p2 = await pe.poster("coefficients", JSON.stringify({ a: "x", b: "1", c: "1" }));
    verifier(p2.corps.statut === "parse_error" && p2.corps.revele === true && typeof p2.corps.solution_attendue === "string", "un parse_error qui épuise les essais révèle aussi");
    verifier(!consigne(await pe.lire(), "allure").includes("d'après les coefficients"), "… et sa valeur, inexploitable, laisse la vraie fonction");
    // Correction coupée : rien, ni à l'épuisement, ni dans le GET, avant la fin de la tâche.
    const coupe = await nouveau({ feedback: false, reponseVisible: true });
    const c1 = await coupe.poster("coefficients", COEF_FAUX);
    verifier(c1.corps.statut === undefined && c1.corps.solution_attendue === undefined && c1.corps.revele === false, "coupé : rien n'est révélé, même avec reponse_visible=true");
    const gc = await coupe.lire();
    verifier(gc.champs.every((c: any) => c.solution_attendue === null && c.statut === null && c.revele === false), "coupé : le GET non plus");
  }

  // ── 8. Panneau « Ce que tu sais déjà » : un fait n'est rappelé que si TOUTE sa chaîne est juste ──
  {
    const x = await nouveau({ feedback: true });
    await x.poster("coefficients", COEF_FAUX);
    await x.poster("allure", JSON.stringify({ signeA: "+", signeAB: "+" }));
    await x.poster("axeSommet", AXE("-24/5"));
    await x.poster("domaineImage", IMAGE("-24/5"));
    const g = await x.lire();
    const faits = consigne(g, "racinesReconnaissance").split("\n").find((l) => l.startsWith("Ce que tu sais déjà")) ?? "";
    verifier(faits === "", `coefficients faux : aucun fait issu de sa chaîne (allure/axe/image justes sur SES valeurs) n'est présenté comme acquis (« ${faits} »)`);
    const bon = await nouveau({ feedback: true });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage"]) await bon.poster(champ, reponseBruteCorrecteAnalyseFonction(bon.ex, champ));
    const fb = consigne(await bon.lire(), "racinesReconnaissance");
    verifier(fb.includes("$a = 4$") && fb.includes("axe de symétrie $x = -1$") && fb.includes("\\mathrm{im}\\,f = [-4"), `tout juste : les faits vrais figurent (${fb.slice(0, 160)})`);
  }

  // ── 9. racinesChamp2 : la cascade s'applique AUSSI sous correction immédiate (déroge à §33-D, décision D-A du propriétaire) ──
  for (const r of REGIMES) {
    const x = await nouveau({ feedback: r.feedback });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await x.poster(champ, reponseBruteCorrecteAnalyseFonction(x.ex, champ));
    await x.poster("racinesChamp1", "4x(x-2)"); // factorisation fausse de 4x² + 8x, mais exploitable : racines 0 et 2
    verifier(x.statuts("racinesChamp1")[0] === "not_equivalent", `${r.nom} : 4x(x−2) est faux pour 4x² + 8x`);
    const g = await x.lire();
    verifier(consigne(g, "racinesChamp2").includes("D'après ta factorisation") && consigne(g, "racinesChamp2").includes("$4x(x - 2) = 0$"), `${r.nom} : racinesChamp2 est bâti sur SA factorisation (${consigne(g, "racinesChamp2").slice(-80)})`);
    await x.poster("racinesChamp2", JSON.stringify(["0", "2"]));
    verifier(x.statuts("racinesChamp2")[0] === "correct", `${r.nom} : 0 ; 2 sont les racines de SON équation -> correct`);
    const y = await nouveau({ feedback: r.feedback });
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racinesReconnaissance"]) await y.poster(champ, reponseBruteCorrecteAnalyseFonction(y.ex, champ));
    await y.poster("racinesChamp1", "4x(x-2)");
    await y.poster("racinesChamp2", JSON.stringify(["-2", "0"]));
    verifier(y.statuts("racinesChamp2")[0] === "not_equivalent", `${r.nom} : les vraies racines ne sont pas celles de SON équation`);
  }

  // ── 10. af_irreductible : même cascade (les écrans coefficients/allure/axe/image existent) ──
  {
    const x = await nouveau({ feedback: false, categorie: "irreductible" });
    const f = x.ex.fonction;
    await x.poster("coefficients", JSON.stringify({ a: String(-f.a), b: "2", c: "1" }));
    const g = await x.lire();
    verifier(consigne(g, "allure").includes("d'après les coefficients que tu as donnés"), "irréductible : la consigne suit les coefficients confirmés");
    await x.poster("allure", JSON.stringify({ signeA: f.a > 0 ? "-" : "+", signeAB: (-f.a * 2 > 0) ? "+" : "-" }));
    verifier(x.statuts("allure")[0] === "correct", "irréductible : allure jugée sur a confirmé");
  }

  if (echecs.length > 0) {
    console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
    for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
    process.exit(1);
  }
  console.log(`OK : ${nb} vérifications (scénario exact dans les deux régimes, cohérence, allure, repli, régression, filtrage, révélation, panneau, racinesChamp2 sous correction immédiate, irréductible)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
