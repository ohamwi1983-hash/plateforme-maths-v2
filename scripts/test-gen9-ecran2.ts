// Test permanent — gen9 « Complète le carré », écran 2 (chaîne de transformations réutilisée du noyau partagé) et câblage du générateur (RAPPORT §59) : cascade dans les TROIS régimes de
// correction (projeterExercice réel), fonction effective, énoncé de l'écran 2 sans fuite, poids 3/2, dépendances, solutions lisibles qui se vérifient comme justes, chaîne canonique juste,
// chaîne fausse, garde de forme du registre. La logique de la chaîne elle-même (règles locales, hors sujet, crédit partiel) est le noyau partagé, couverte par `test-fx-ecran2` (gen8).
// Lancer : `npm run test-gen9-ecran2`. Sans réseau.

export {}; // module

import type { EcranChaineTransformations, ReponseConfirmee } from "../lib/contratGenerateur";
import { validerDependances } from "../lib/cascadeEcrans";
import { projeterExercice, type ExerciceRegenere } from "../lib/etatExercice";
import { poidsDesEcrans } from "../lib/poidsEcran";
import { verifierAvecControle } from "../lib/registreGenerateurs";
import { generateurCompletionDuCarre as G } from "../src/generateurs/completionDuCarre/generateur";
import { CHAMP_CHAINE, CHAMP_FORME, CONSIGNE_GLOBALE, POIDS_CHAINE, POIDS_FORME } from "../src/generateurs/completionDuCarre/ecrans";
import { genererExerciceCc } from "../src/generateurs/completionDuCarre/generation";
import { parametres, type ExerciceCc } from "../src/generateurs/completionDuCarre/types";
import { POLYNOME_DEPART, chaineCanonique, parametreEtape, transformationsAdmises } from "../src/generateurs/_noyauQuadratique/chaine";
import { CHOIX_CHAINE } from "../src/generateurs/_noyauQuadratique/ecranChaine";
import { latexFonction } from "../src/generateurs/_noyauQuadratique/formatage";
import { coefficient, type Polynome } from "../src/generateurs/_noyauQuadratique/polynome";
import { depuisJson, parametresRepli, polynomeDe, versJson, type Parametres, type Transformation } from "../src/generateurs/_noyauQuadratique/types";
import { egalR, rat, signeR, type Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";
import { verifierBalisageMath } from "./support/texteMath";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const CONFIGURATIONS: Transformation[][] = [];
for (const tv of [false, true]) for (const facteur of [null, "EV", "CV"] as const) for (const sox of [false, true]) CONFIGURATIONS.push(["TH", ...(tv ? ["TV" as const] : []), ...(facteur ? [facteur] : []), ...(sox ? ["SOX" as const] : [])]);
const GRAINES = [3, 5_000_003, 91_234_567, 1_500_000_011, 3_000_000_019];
const cfg = (actives: readonly string[]) => ({ actives: [...actives] });
const P = (a: [number, number?], p: [number, number?], q: [number, number?]): Parametres => ({ a: rat(a[0], a[1] ?? 1), p: rat(p[0], p[1] ?? 1), q: rat(q[0], q[1] ?? 1) });
const memeParams = (a: Parametres, b: Parametres): boolean => egalR(a.a, b.a) && egalR(a.p, b.p) && egalR(a.q, b.q);

const rationnel = (r: Rat): string => `(${r.n}${r.d === 1 ? "" : `/${r.d}`})`;
const saisieRat = (r: Rat): string => (r.d === 1 ? String(r.n) : `${r.n}/${r.d}`);
function saisie(p: Polynome): string {
  const termes: string[] = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = coefficient(p, k);
    if (signeR(c) === 0) continue;
    termes.push(k === 0 ? rationnel(c) : k === 1 ? `${rationnel(c)}*x` : `${rationnel(c)}*x^${k}`);
  }
  return termes.length === 0 ? "0" : termes.join("+");
}
/** Réponse JSON d'une chaîne : chaque étape avec sa VRAIE valeur déclarée (`parametreEtape`). */
function brute(etapes: { t: Transformation; apres: Parametres }[]): string {
  let avant: Polynome = POLYNOME_DEPART;
  return JSON.stringify({
    etapes: etapes.map(({ t, apres }) => {
      const e = polynomeDe(apres);
      const parametre = parametreEtape(t, avant, e);
      avant = e;
      return { expression: saisie(e), transformation: t, valeur: t === "SOX" ? "" : parametre === null ? "1" : saisieRat(parametre) };
    }),
  });
}
const exProjete = (ex: ExerciceCc, g: Parametres): ExerciceCc => ({ ...ex, effectif: versJson(g) });
const regenere = (ex: ExerciceCc): ExerciceRegenere => ({ ligne: {} as never, generateur: G, exercice: ex, ecrans: G.ecrans(ex) });
/** Forme canonique SAISIE d'une fonction : `a*(x-p)^2+q`. */
const canonique = (g: Parametres): string => `${rationnel(g.a)}*(x-${rationnel(g.p)})^2+${rationnel(g.q)}`;

// ── 1. Cascade dans les TROIS régimes (projeterExercice réel) ──
const REGIMES = [
  { nom: "coupée", reglages: { feedback_immediat: false, reponse_visible: false }, montree: false },
  { nom: "immédiate sans case", reglages: { feedback_immediat: true, reponse_visible: false }, montree: false },
  { nom: "immédiate avec case (solution montrée)", reglages: { feedback_immediat: true, reponse_visible: true }, montree: true },
];
for (const actives of CONFIGURATIONS) {
  const nom = actives.join("+");
  for (const graine of GRAINES.slice(0, 3)) {
    const brut = genererExerciceCc(graine, cfg(actives));
    const f = parametres(brut);
    const repli = parametresRepli(brut);
    verifier(!memeParams(f, repli), `${nom} g=${graine} : le repli diffère de la vraie fonction`);
    const gFaux = P([-3, 4], [5, 2], [-7]);
    const reponse = (g: Parametres, statut: "correct" | "not_equivalent"): ReponseConfirmee => ({ champ: CHAMP_FORME, reponseBrute: canonique(g), statut });
    for (const regime of REGIMES) {
      const lieu = `${nom} g=${graine} ${regime.nom}`;
      const effectifDe = (reps: ReponseConfirmee[]): Parametres => {
        const p = projeterExercice(regenere(brut), reps, { reglages: regime.reglages }).exercice as ExerciceCc;
        return depuisJson(p.effectif as NonNullable<ExerciceCc["effectif"]>);
      };
      verifier(memeParams(effectifDe([reponse(f, "correct")]), f), `${lieu} : réponse juste → la vraie fonction`);
      verifier(memeParams(effectifDe([reponse(gFaux, "not_equivalent")]), regime.montree ? f : gFaux), `${lieu} : réponse fausse → ${regime.montree ? "la vraie fonction (révélée)" : "sa propre fonction"}`);
      verifier(memeParams(effectifDe([]), regime.montree ? f : repli), `${lieu} : aucune réponse → ${regime.montree ? "la vraie" : "le repli"}`);
      verifier(memeParams(effectifDe([{ champ: CHAMP_FORME, reponseBrute: "(x-", statut: "not_equivalent" }]), regime.montree ? f : repli), `${lieu} : réponse illisible → comme aucune`);
      verifier(validerDependances(G.ecrans(brut)).length === 0, `${lieu} : dépendances valides`);
    }
  }
}

// ── 2. Énoncé : consigne identique sur les deux écrans, question de l'écran 1 = la forme développée, question de l'écran 2 = la fonction effective, aucune fuite sur l'exercice brut ──
{
  const g = P([-3, 4], [5, 2], [-7]);
  for (const actives of CONFIGURATIONS) for (const graine of GRAINES.slice(0, 2)) {
    const brut = genererExerciceCc(graine, cfg(actives));
    const [e1, e2] = G.ecrans(exProjete(brut, g)) as [ReturnType<typeof G.ecrans>[number], EcranChaineTransformations];
    verifier(e1?.champ === CHAMP_FORME && e2.champ === CHAMP_CHAINE && e1.consigne === CONSIGNE_GLOBALE && e2.consigne === CONSIGNE_GLOBALE, "consigne identique sur les deux écrans");
    verifier(!/\$/.test(CONSIGNE_GLOBALE) && !/\(x [-+]/.test(CONSIGNE_GLOBALE), "la consigne ne nomme aucune fonction");
    verifier((e2.question ?? "").includes(`$f(x) = ${latexFonction(g)}$`), "l'écran 2 vise la fonction effective, re-sérialisée");
    verifier(e1?.type === "champ_expression" && (e1.question ?? "").includes("forme canonique") && e1.apercu?.libelle === "f(x) =", "écran 1 : champ d'expression avec aperçu");
    for (const t of [e1?.consigne ?? "", e1?.question ?? "", e2.question ?? "", e2.legende ?? ""]) verifier(verifierBalisageMath(t).length === 0, `balisage admis : ${t}`);
  }
  const brut = genererExerciceCc(9, cfg(["TH", "TV"]));
  const e2brut = G.ecrans(brut)[1] as EcranChaineTransformations;
  verifier(!(e2brut.question ?? "").includes(latexFonction(parametres(brut))) && !/\(x [-+]/.test(e2brut.question ?? ""), "écran 2 de l'exercice brut : aucune fonction nommée");
  verifier(e2brut.dependDe?.join() === CHAMP_FORME && e2brut.aide === undefined && e2brut.figure === undefined, "écran 2 : dépend de l'écran 1, sans aide ni figure");
  verifier(JSON.stringify(e2brut.choix) === JSON.stringify(CHOIX_CHAINE) && CHOIX_CHAINE.length === 5, "le menu a toujours les cinq choix");
  for (const actives of CONFIGURATIONS) verifier(JSON.stringify((G.ecrans(genererExerciceCc(1, cfg(actives)))[1] as EcranChaineTransformations).choix) === JSON.stringify(CHOIX_CHAINE), `menu identique (${actives.join("+")})`);
  // Sur l'exercice BRUT, juger ou donner la solution de l'écran 2 LÈVE (jamais un jugement sur la vraie fonction par oubli de projection).
  let leve = 0;
  for (const appel of [() => G.verifier(brut, CHAMP_CHAINE, "{\"etapes\":[]}"), () => G.solutionAttendue?.(brut, CHAMP_CHAINE)]) {
    try {
      appel();
    } catch {
      leve++;
    }
  }
  verifier(leve === 2, "écran 2 sur l'exercice brut : verifier et solutionAttendue lèvent");
}

// ── 3. Poids 3 / 2 ──
{
  verifier(POIDS_FORME === 3 && POIDS_CHAINE === 2, "poids : 3 pour l'écran 1, 2 pour l'écran 2");
  for (const actives of CONFIGURATIONS) {
    const poids = poidsDesEcrans(G.ecrans(genererExerciceCc(2, cfg(actives))));
    verifier(poids.get(CHAMP_FORME) === 3 && poids.get(CHAMP_CHAINE) === 2, `poids ${actives.join("+")}`);
  }
}

// ── 4. Vérification câblée : forme canonique juste, chaîne canonique juste, chaîne fausse, et solutions lisibles qui se vérifient comme justes ──
for (const actives of CONFIGURATIONS) for (const graine of GRAINES) {
  const nom = `${actives.join("+")} g=${graine}`;
  const brut = genererExerciceCc(graine, cfg(actives));
  const f = parametres(brut);
  const ex = exProjete(brut, f);
  verifier(G.verifier(ex, CHAMP_FORME, canonique(f)).statut === "correct", `${nom} : forme canonique juste`);
  // Solution de l'écran 1 : « $f(x) = … $ » ; relue comme une réponse, elle est juste.
  const sol1 = (G.solutionAttendue as NonNullable<typeof G.solutionAttendue>)(ex, CHAMP_FORME);
  const relue = sol1.replace(/^\$f\(x\) = /, "").replace(/\$$/, "").replace(/\\dfrac\{(\d+)\}\{(\d+)\}/g, "($1/$2)");
  verifier(G.verifier(ex, CHAMP_FORME, relue).statut === "correct" && verifierBalisageMath(sol1).length === 0, `${nom} : la solution de l'écran 1 « ${sol1} » est juste`);
  // Chaîne canonique pour la fonction effective.
  const chaine = chaineCanonique(f, transformationsAdmises(brut.actives, f));
  verifier(chaine !== null, `${nom} : chaîne canonique existante`);
  if (chaine === null) continue;
  const juste = brute(chaine.map((c) => ({ t: c.transformation, apres: c.apres })));
  const v = G.verifier(ex, CHAMP_CHAINE, juste);
  verifier(v.statut === "correct" && v.codesCompetence.length === 0, `${nom} : chaîne canonique juste (${v.statut})`);
  // Chaîne qui n'arrive pas à f : fausse, crédit partiel < 1, jamais correct.
  const tronquee = chaine.length > 1 ? brute(chaine.slice(0, -1).map((c) => ({ t: c.transformation, apres: c.apres }))) : brute([{ t: chaine[0]!.transformation, apres: { ...chaine[0]!.apres, q: rat(99) } }]);
  const vt = G.verifier(ex, CHAMP_CHAINE, tronquee);
  verifier(vt.statut === "not_equivalent" && (vt.fractionCorrecte ?? 0) < 1, `${nom} : chaîne incomplète fausse avec crédit partiel < 1`);
  // La solution de l'écran 2 est une chaîne lisible.
  const sol2 = (G.solutionAttendue as NonNullable<typeof G.solutionAttendue>)(ex, CHAMP_CHAINE);
  verifier(sol2.startsWith("Une chaîne possible") && verifierBalisageMath(sol2).length === 0, `${nom} : solution de l'écran 2 lisible`);
  // Garde de forme du registre sur les deux champs.
  for (const [champ, texte] of [[CHAMP_FORME, canonique(P([2], [1], [1]))], [CHAMP_FORME, "x^2-6x+9"], [CHAMP_CHAINE, "[]"], [CHAMP_CHAINE, tronquee]] as const) {
    try {
      verifierAvecControle(G, ex, champ, texte);
      verifier(true, "contrôle du registre");
    } catch (e) {
      verifier(false, `${nom} : le contrôle du registre refuse un résultat (${champ}) : ${(e as Error).message}`);
    }
  }
}

// ── 5. Cascade d'une réponse fausse : l'écran 2 se juge sur la fonction CONFIRMÉE (option 4), pas sur l'énoncé ──
{
  const brut = genererExerciceCc(5_000_003, cfg(["TH"]));
  const gFaux = P([2], [-1], [4]); // lisible, fausse
  const ex = exProjete(brut, gFaux);
  const chaine = chaineCanonique(gFaux, transformationsAdmises(brut.actives, gFaux))!;
  verifier(G.verifier(ex, CHAMP_CHAINE, brute(chaine.map((c) => ({ t: c.transformation, apres: c.apres })))).statut === "correct", "chaîne juste pour la fonction confirmée (même fausse) : juste, transformations élargies pour cet élève");
}

if (echecs.length > 0) {
  console.error(`✗ ${echecs.length} échec(s) sur ${nb} vérifications :\n${echecs.join("\n")}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (gen9 écran 2 : cascade dans les trois régimes, énoncé sans fuite, poids 3/2, chaîne canonique juste, solutions relues, contrôle du registre)`);
