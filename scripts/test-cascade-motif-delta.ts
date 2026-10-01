// Test permanent — CASCADE de gen7 « motif / delta » (RAPPORT §18, §38, §45, §49) : les écrans dépendants sont jugés sur les coefficients CONFIRMÉS (même faux) quand ils sont exploitables.
// Lancer : `npm run test-cascade-motif-delta`. Pur.
//
//  1. Coefficients confirmés : faux mais exploitables (la fonction effective est celle de l'élève) ; justes (les vrais, jamais une réécriture) ; inexploitables (repli sur les vrais :
//     illisible, `a = 0`, `a` irrationnel, `b` somme de deux radicaux, démesuré).
//  2. `allure`, `axeSommet`, `domaineImage` jugés sur la fonction EFFECTIVE : la réponse de l'élève suivant SA fonction est correcte, la réponse de la vraie fonction (si elle diffère) ne l'est pas.
//  3. Ordonnée du sommet confirmée (fausse) → `domaineImage` repart d'elle.
//  4. Libellé : IDENTIQUE que les coefficients confirmés soient justes ou faux (règle de révélation) ; ordre des termes jamais canonique ; terme nul absent.
//  5. `projeterMotifDelta` : valeurs de x du tableau vraies seulement si la solution est montrée ; le tableau lui-même est jugé sur la fonction EFFECTIVE (RAPPORT §41).

export {}; // module

import { creerPrng } from "../lib/prng";
import type { ReponseConfirmee } from "../lib/contratGenerateur";
import { FAMILLES } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { coefVersExact, fonctionEffective, fonctionVraie, type ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { lireCoefficientsConfirmes, projeterMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/cascade";
import { verifierMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/verification";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { enonceEffectif } from "../src/generateurs/analyseFonctionMotifDelta/ecrans";
import { approx, egaux, texteSaisieExact } from "../src/generateurs/analyseFonctionMotifDelta/exact/nombreExact";
import { CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_COEFFICIENTS, CHAMP_DOMAINE_IMAGE, CHAMP_TABLEAU_SIGNES } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { CHAMP_RACINES } from "../src/generateurs/analyseFonctionMotifDelta/types";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const coefsTexte = (ex: ExerciceMotifDelta) => ({ a: texteSaisieExact(coefVersExact(ex.a)), b: texteSaisieExact(coefVersExact(ex.b)), c: texteSaisieExact(coefVersExact(ex.c)) });
const reponseCoef = (brut: unknown, statut: ReponseConfirmee["statut"]): ReponseConfirmee => ({ champ: CHAMP_COEFFICIENTS, reponseBrute: typeof brut === "string" ? brut : JSON.stringify(brut), statut });
const projeter = (ex: ExerciceMotifDelta, reponses: ReponseConfirmee[], solutionMontree = false): ExerciceMotifDelta => projeterMotifDelta(ex, reponses, { correctionImmediate: true, solutionMontree });
const meme = (x: ReturnType<typeof fonctionVraie>, y: ReturnType<typeof fonctionVraie>): boolean => x.a.n === y.a.n && x.a.d === y.a.d && egaux(x.b, y.b) && x.c.n === y.c.n && x.c.d === y.c.d;

const prng = creerPrng(20261001);
let nbCas = 0;
let nbNombreDiff = 0;
for (const fam of FAMILLES) {
  for (let k = 0; k < 60; k++) {
    const ex = genererExerciceMD(fam.id, prng.entierEntre(0, 2 ** 32 - 1));
    const vrai = fonctionVraie(ex);
    const ctx = `${fam.numero} a=${ex.a.n} b=${texteSaisieExact(coefVersExact(ex.b))} c=${ex.c.n}`;
    nbCas++;

    // 1a. faux mais exploitable : a de signe contraire, c + 1, b = 3
    const faux = { ...coefsTexte(ex), a: String(-ex.a.n), b: "3", c: String(ex.c.n + 1) };
    const lus = lireCoefficientsConfirmes(JSON.stringify(faux));
    verifier(lus !== null && lus.a.n === -ex.a.n && lus.b.n === 3 && lus.c.n === ex.c.n + 1, `${ctx} : coefficients faux mais exploitables lus tels quels`);
    const proj = projeter(ex, [reponseCoef(faux, "not_equivalent")]);
    verifier(proj.effectif.coefficientsEleve && proj.effectif.coefficientsAffiches, `${ctx} : coefficients de l'élève → effectif, affiché`);
    const fe = fonctionEffective(proj);
    verifier(fe.a.n === -ex.a.n && !meme(fe, vrai), `${ctx} : la fonction effective est celle de l'élève`);

    // 2. écrans dépendants jugés sur la fonction EFFECTIVE
    for (const champ of [CHAMP_ALLURE, CHAMP_AXE_SOMMET, CHAMP_DOMAINE_IMAGE, CHAMP_RACINES, CHAMP_TABLEAU_SIGNES]) {
      const attenduEleve = reponseBruteCorrecteMotifDelta(proj, champ);
      verifier(verifierMotifDelta(proj, champ, attenduEleve).statut === "correct", `${ctx} / ${champ} : la méthode juste appliquée aux coefficients de l'élève est CORRECTE`);
      const attenduVrai = reponseBruteCorrecteMotifDelta(ex, champ);
      // Jamais acceptée ; `parse_error` n'est possible que pour le tableau, dont la STRUCTURE (3 ou 7 colonnes) dépend de la fonction effective.
      if (attenduVrai !== attenduEleve) {
        const st = verifierMotifDelta(proj, champ, attenduVrai).statut;
        verifier(champ === CHAMP_TABLEAU_SIGNES ? st !== "correct" : st === "not_equivalent", `${ctx} / ${champ} : la réponse de la VRAIE fonction n'est pas acceptée sur celle de l'élève (${st})`);
      }
    }

    // 2 bis. écran « racines » : le NOMBRE de racines vient de la fonction effective (RACINES_NOMBRE_INCORRECT)
    {
      const [nVrai, nEff] = [vrai.racines.length, fe.racines.length];
      const reponseVraie = verifierMotifDelta(proj, CHAMP_RACINES, reponseBruteCorrecteMotifDelta(ex, CHAMP_RACINES));
      if (nVrai !== nEff) verifier(reponseVraie.statut === "not_equivalent" && reponseVraie.codesCompetence.join() === "RACINES_NOMBRE_INCORRECT", `${ctx} : ${nVrai} racine(s) vraie(s) mais ${nEff} avec les coefficients de l'élève → RACINES_NOMBRE_INCORRECT (obtenu ${JSON.stringify(reponseVraie)})`);
      nbNombreDiff += nVrai !== nEff ? 1 : 0;
    }

    // 1b. justes : les vrais, jamais une réécriture ; affichés
    const juste = projeter(ex, [reponseCoef({ a: `${ex.a.n}`, b: coefsTexte(ex).b, c: `${ex.c.n}.0` }, "correct")]);
    verifier(!juste.effectif.coefficientsEleve && juste.effectif.coefficientsAffiches && meme(fonctionEffective(juste), vrai), `${ctx} : coefficients justes → les vrais, affichés`);

    // 1c. inexploitables → repli sur les vrais, non affichés
    for (const [nom, inexploitable] of [
      ["illisible", { ...coefsTexte(ex), a: "abc" }],
      ["a = 0", { ...coefsTexte(ex), a: "0" }],
      ["a irrationnel", { ...coefsTexte(ex), a: "sqrt(2)" }],
      ["b somme de deux radicaux", { ...coefsTexte(ex), b: "1+sqrt(2)" }],
      ["c irrationnel", { ...coefsTexte(ex), c: "sqrt(3)" }],
      ["démesuré", { ...coefsTexte(ex), a: "100000" }],
      ["sqrt d'un négatif", { ...coefsTexte(ex), b: "sqrt(-1)" }],
    ] as const) {
      const p = projeter(ex, [reponseCoef(inexploitable, "not_equivalent")]);
      verifier(!p.effectif.coefficientsEleve && !p.effectif.coefficientsAffiches && meme(fonctionEffective(p), vrai), `${ctx} : coefficients ${nom} → repli sur les vrais, non affichés`);
    }
    const sansReponse = projeter(ex, []);
    verifier(!sansReponse.effectif.coefficientsAffiches && !sansReponse.effectif.coefficientsEleve, `${ctx} : aucune réponse → exercice brut`);

    // 3. ordonnée du sommet confirmée (fausse) → domaineImage repart d'elle
    const yFaux = Math.round(approx(vrai.yS)) + 3; // toujours ≠ de la vraie ordonnée du sommet (écart de 3)
    const axeFaux = JSON.stringify({ axeTexte: "x = 1", xS: "1", yS: String(yFaux) });
    const avecY = projeter(ex, [{ champ: CHAMP_AXE_SOMMET, reponseBrute: axeFaux, statut: "not_equivalent" }]);
    verifier(avecY.effectif.yImage !== null && avecY.effectif.yImage.n === yFaux, `${ctx} : ordonnée fausse confirmée → yImage = ${yFaux}`);
    verifier(verifierMotifDelta(avecY, CHAMP_DOMAINE_IMAGE, reponseBruteCorrecteMotifDelta(avecY, CHAMP_DOMAINE_IMAGE)).statut === "correct", `${ctx} : domaineImage jugé sur l'ordonnée confirmée`);
    const axeJuste = JSON.stringify({ axeTexte: "x = 1", xS: "1", yS: texteSaisieExact(vrai.yS) });
    const avecYJuste = projeter(ex, [{ champ: CHAMP_AXE_SOMMET, reponseBrute: axeJuste, statut: "correct" }]);
    verifier(avecYJuste.effectif.yImage === null, `${ctx} : ordonnée juste → sommet effectif`);
    const axeIllisible = projeter(ex, [{ champ: CHAMP_AXE_SOMMET, reponseBrute: JSON.stringify({ axeTexte: "x = 1", xS: "1", yS: "abc" }), statut: "parse_error" }]);
    verifier(axeIllisible.effectif.yImage === null, `${ctx} : ordonnée illisible → inexploitable`);

    // 4. libellé identique juste ou faux ; ordre jamais canonique ; terme nul absent
    verifier(enonceEffectif(juste).startsWith("Étudie la fonction suivante, d'après les coefficients que tu as donnés") && enonceEffectif(proj).startsWith("Étudie la fonction suivante, d'après les coefficients que tu as donnés"), `${ctx} : même libellé, coefficients justes ou faux`);
    verifier(enonceEffectif(sansReponse) === enonceEffectif(ex) && enonceEffectif(sansReponse).startsWith("Étudie la fonction suivante : "), `${ctx} : sans coefficients confirmés, énoncé de l'exercice`);
    const nul = projeter(ex, [reponseCoef({ a: String(ex.a.n), b: "0", c: "0" }, "not_equivalent")]);
    const lnul = enonceEffectif(nul);
    verifier(!lnul.includes("0x") && !/[+-] 0(\$|\.)/.test(lnul) && /f\(x\) = [^$]*x\^2[^$]*\$/.test(lnul) && !/\$f\(x\) = [^$]*(\+ 0|- 0)/.test(lnul), `${ctx} : terme nul absent (${lnul})`);

    // 5. valeurs de x du tableau
    verifier(projeter(ex, [], true).affichageTableau === "vraies" && projeter(ex, [], false).affichageTableau === "symboliques", `${ctx} : valeurs du tableau selon solutionMontree`);
  }
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length}+ vérification(s) en échec sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
verifier(nbNombreDiff >= 100, `couverture : ${nbNombreDiff} cas où le nombre de racines diffère entre la vraie fonction et celle de l'élève (≥ 100 attendus)`);
if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length}+ vérification(s) en échec sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (cascade des coefficients confirmés sur ${nbCas} exercices : exploitables, justes, inexploitables, ordonnée, nombre de racines (${nbNombreDiff} cas où il diffère), libellé, valeurs du tableau)`);
