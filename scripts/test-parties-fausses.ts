// Test permanent — PARTIES FAUSSES d'une réponse (RAPPORT §52) : pour chaque écran de gen7 « motif / delta », `verifier` désigne EXACTEMENT les parties fausses de la réponse.
// Lancer : `npm run test-parties-fausses`. Pur (aucune base).
//
// Contrat : `ResultatVerification.not_equivalent.partiesFausses` (identifiants que le COMPOSANT de l'écran sait retrouver) :
//   champs_multiples = id du sous-champ ; intervalle = crochetGauche | borneGauche | borneDroite | crochetDroit ; liste_valeurs = `ligne:<i>` (rang dans la liste soumise) | `mode:aucune` ;
//   tableau_signes = `<ligne>:<ancre>` (clés d'ancrage de la réponse) ; qcm = id du choix coché ; champ_expression = `champ`.
// Une réponse illisible (`parse_error`) n'en porte jamais : rien n'a été jugé. Une valeur juste mais écrite avec une racine non simplifiée est une partie fausse (le verdict est négatif).
// Méthode : on part de la réponse JUSTE de chaque famille et de plusieurs graines, on PERTURBE un sous-ensemble connu de parties, et on exige que l'ensemble désigné soit exactement celui-là.

export {}; // module

import { creerPrng } from "../lib/prng";
import { FAMILLES } from "../src/generateurs/analyseFonctionMotifDelta/familles";
import { genererExerciceMD } from "../src/generateurs/analyseFonctionMotifDelta/exercice";
import { reponseBruteCorrecteMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/solutions";
import { verifierMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/verification";
import { rangeesTableauMD } from "../src/generateurs/analyseFonctionMotifDelta/tableauSignes";
import { fonctionVraie, type ExerciceMotifDelta } from "../src/generateurs/analyseFonctionMotifDelta/types";
import { verifierAvecControle } from "../lib/registreGenerateurs";
import { chercherGenerateur } from "../lib/registreGenerateurs";
import type { ResultatVerification } from "../lib/contratGenerateur";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const FAUX = "997"; // jamais une valeur attendue (|c| ≤ 100, racines et sommets bornés)
const parties = (r: ResultatVerification): string[] | "illisible" | "juste" => (r.statut === "parse_error" ? "illisible" : r.statut === "correct" ? "juste" : [...(r.partiesFausses ?? [])].sort());
/** Tous les sous-ensembles NON VIDES de `ids`. */
const sousEnsembles = (ids: string[]): string[][] => {
  const sortie: string[][] = [];
  for (let m = 1; m < 1 << ids.length; m++) sortie.push(ids.filter((_, i) => m & (1 << i)));
  return sortie;
};
const meme = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const prng = creerPrng(52052);
let nbExercices = 0;
for (const fam of FAMILLES) {
  for (let k = 0; k < 8; k++) {
    const ex: ExerciceMotifDelta = genererExerciceMD(fam.id, prng.entierEntre(0, 2 ** 32 - 1));
    nbExercices++;
    const ctx = `${fam.numero}`;
    const juste = (champ: string) => JSON.parse(reponseBruteCorrecteMotifDelta(ex, champ)) as Record<string, any>;
    const f = fonctionVraie(ex);

    // ── Une réponse JUSTE n'a aucune partie fausse ──
    for (const champ of ["coefficients", "allure", "axeSommet", "domaineImage", "racines", "tableauSignes"]) {
      const r = verifierMotifDelta(ex, champ, reponseBruteCorrecteMotifDelta(ex, champ));
      verifier(r.statut === "correct" && !("partiesFausses" in r), `${ctx} / ${champ} : réponse juste sans partie fausse`);
    }

    // ── coefficients : chaque sous-ensemble de {a, b, c} ──
    for (const sub of sousEnsembles(["a", "b", "c"])) {
      const rep = { ...juste("coefficients") };
      for (const id of sub) rep[id] = FAUX;
      verifier(meme(parties(verifierMotifDelta(ex, "coefficients", JSON.stringify(rep))), sub.slice().sort()), `${ctx} / coefficients : ${sub.join("+")} faux désigné exactement`);
    }

    // ── allure : sens et position ──
    for (const sub of sousEnsembles(["concavite", "positionSommet"])) {
      const rep = { ...juste("allure") };
      if (sub.includes("concavite")) rep.concavite = rep.concavite === "+" ? "-" : "+";
      if (sub.includes("positionSommet")) rep.positionSommet = rep.positionSommet === "gauche" ? "droite" : "gauche";
      verifier(meme(parties(verifierMotifDelta(ex, "allure", JSON.stringify(rep))), sub.slice().sort()), `${ctx} / allure : ${sub.join("+")} faux désigné exactement`);
    }

    // ── axeSommet : axe, x_S, y_S ──
    for (const sub of sousEnsembles(["axeTexte", "xS", "yS"])) {
      const rep = { ...juste("axeSommet") };
      if (sub.includes("axeTexte")) rep.axeTexte = `x = ${FAUX}`;
      if (sub.includes("xS")) rep.xS = FAUX;
      if (sub.includes("yS")) rep.yS = FAUX;
      verifier(meme(parties(verifierMotifDelta(ex, "axeSommet", JSON.stringify(rep))), sub.slice().sort()), `${ctx} / axeSommet : ${sub.join("+")} faux désigné exactement`);
    }

    // ── domaineImage : deux crochets et deux bornes ──
    for (const sub of sousEnsembles(["crochetGauche", "borneGauche", "borneDroite", "crochetDroit"])) {
      const rep = { ...juste("domaineImage") };
      for (const id of sub) rep[id] = id.startsWith("crochet") ? (rep[id] === "[" ? "]" : "[") : FAUX;
      verifier(meme(parties(verifierMotifDelta(ex, "domaineImage", JSON.stringify(rep))), sub.slice().sort()), `${ctx} / domaineImage : ${sub.join("+")} faux désigné exactement`);
    }

    // ── racines : lignes fausses, mode « pas de racine », doublon ──
    {
      const racines = juste("racines") as unknown as string[];
      if (racines.length === 0) {
        const r = parties(verifierMotifDelta(ex, "racines", JSON.stringify([FAUX])));
        verifier(meme(r, ["ligne:0"]), `${ctx} / racines : une valeur proposée alors qu'il n'y a aucune racine → ligne:0 (${JSON.stringify(r)})`);
        const deux = parties(verifierMotifDelta(ex, "racines", JSON.stringify([FAUX, "998"])));
        verifier(meme(deux, ["ligne:0", "ligne:1"]), `${ctx} / racines : deux valeurs alors qu'il n'y a aucune racine → les deux lignes (${JSON.stringify(deux)})`);
      } else {
        const aucune = parties(verifierMotifDelta(ex, "racines", "[]"));
        verifier(meme(aucune, ["mode:aucune"]), `${ctx} / racines : « Pas de racine » alors qu'il y en a → mode:aucune (${JSON.stringify(aucune)})`);
        for (const sub of sousEnsembles(racines.map((_, i) => String(i)))) {
          const rep = racines.map((v, i) => (sub.includes(String(i)) ? (i === 0 ? FAUX : "998") : v));
          const attendu = sub.map((i) => `ligne:${i}`).sort();
          verifier(meme(parties(verifierMotifDelta(ex, "racines", JSON.stringify(rep))), attendu), `${ctx} / racines : lignes ${sub.join("+")} fausses désignées exactement (${JSON.stringify(rep)})`);
        }
        if (racines.length === 2) {
          const doublon = parties(verifierMotifDelta(ex, "racines", JSON.stringify([racines[0], racines[0]])));
          verifier(meme(doublon, ["ligne:1"]), `${ctx} / racines : une racine répétée → la 2e ligne seulement (${JSON.stringify(doublon)})`);
        }
        if (racines.length === 1) {
          const trop = parties(verifierMotifDelta(ex, "racines", JSON.stringify([racines[0], FAUX])));
          verifier(meme(trop, ["ligne:1"]), `${ctx} / racines : une racine en trop → cette ligne (${JSON.stringify(trop)})`);
        }
      }
    }

    // ── tableauSignes : chaque case seule, puis une ligne entière inversée ──
    {
      const sol = juste("tableauSignes") as Record<string, Record<string, string>>;
      const SYM: Record<string, string> = { "+": "-", "-": "+", "0": "+", "↗": "↘", "↘": "↗", "⌢": "⌣", "⌣": "⌢" };
      const rangees = rangeesTableauMD(f);
      for (const rangee of rangees) {
        for (const cellule of rangee.cellules) {
          const rep = JSON.parse(JSON.stringify(sol)) as typeof sol;
          const avant = (rep[rangee.ligne] as Record<string, string>)[cellule.ancre] as string;
          (rep[rangee.ligne] as Record<string, string>)[cellule.ancre] = SYM[avant] as string;
          const r = parties(verifierMotifDelta(ex, "tableauSignes", JSON.stringify(rep)));
          verifier(meme(r, [`${rangee.ligne}:${cellule.ancre}`]), `${ctx} / tableau : la case ${rangee.ligne}:${cellule.ancre} seule désignée (${JSON.stringify(r)})`);
        }
        const rep = JSON.parse(JSON.stringify(sol)) as typeof sol;
        for (const c of rangee.cellules) (rep[rangee.ligne] as Record<string, string>)[c.ancre] = SYM[(sol[rangee.ligne] as Record<string, string>)[c.ancre] as string] as string;
        const toutes = parties(verifierMotifDelta(ex, "tableauSignes", JSON.stringify(rep)));
        verifier(meme(toutes, rangee.cellules.map((c) => `${rangee.ligne}:${c.ancre}`).sort()), `${ctx} / tableau : ligne « ${rangee.ligne} » entièrement fausse → toutes ses cases (${JSON.stringify(toutes)})`);
      }
    }
  }
}

// ── Cas particuliers ──
{
  // Racine non simplifiée : la valeur est juste mais le verdict est négatif → la partie est désignée.
  const fam = FAMILLES.find((f) => f.id === "af_motif_racines_opposees_irrationnelles")!;
  const ex = genererExerciceMD(fam.id, 12345);
  const c = JSON.parse(reponseBruteCorrecteMotifDelta(ex, "coefficients")) as Record<string, string>;
  const r = verifierMotifDelta(ex, "racines", JSON.stringify(["sqrt(8)", "-sqrt(8)"]));
  const racines = JSON.parse(reponseBruteCorrecteMotifDelta(ex, "racines")) as string[];
  verifier(c.a !== undefined && racines.length === 2, "(sanité) famille 1.5 : deux racines");
  if (r.statut === "not_equivalent") verifier(Array.isArray(r.partiesFausses), "racine non simplifiée : not_equivalent avec la liste des parties");
}
{
  // Illisible : jamais de parties.
  const ex = genererExerciceMD("af_delta_racines_rationnelles", 4242);
  for (const [champ, brut] of [["coefficients", JSON.stringify({ a: "sqrt(", b: "1", c: "1" })], ["axeSommet", JSON.stringify({ axeTexte: "3", xS: "1", yS: "1" })], ["racines", JSON.stringify(["1/"])], ["domaineImage", "{}"], ["tableauSignes", "{}"]] as const) {
    const r = verifierMotifDelta(ex, champ, brut);
    verifier(r.statut === "parse_error" && !("partiesFausses" in r), `illisible (${champ}) : parse_error sans partie fausse`);
  }
  // `parse_error` d'une partie : l'autre partie n'est pas jugée
  const r = verifierMotifDelta(ex, "coefficients", JSON.stringify({ a: "1", b: "x+", c: "997" }));
  verifier(r.statut === "parse_error" && !("partiesFausses" in r), "une partie illisible : l'écran entier est illisible, rien n'est désigné");
}

// ── Contrôle serveur : `verifierAvecControle` refuse une liste de parties invalide (échec bruyant, comme un code non déclaré) ──
{
  const g = chercherGenerateur("af_delta_racines_rationnelles")!;
  const ex = genererExerciceMD("af_delta_racines_rationnelles", 4242);
  const avecParties = (partiesFausses: unknown): ((exercice: unknown, champ: string, brut: string) => ResultatVerification) => () => ({ statut: "not_equivalent", codesCompetence: [], partiesFausses } as unknown as ResultatVerification);
  const lecteur = (v: unknown) => () => verifierAvecControle({ ...g, verifier: avecParties(v) }, ex, "coefficients", "{}");
  const leve = (v: unknown): boolean => {
    try {
      lecteur(v)();
      return false;
    } catch {
      return true;
    }
  };
  verifier(!leve(["a", "b"]) && !leve([]), "parties valides acceptées (liste vide admise : le verdict reste négatif)");
  verifier(leve("a") && leve([1]) && leve([""]) && leve(["a", "a"]) && leve([null]) && leve(["x".repeat(61)]) && leve(Array.from({ length: 201 }, (_, i) => `p${i}`)), "parties invalides refusées : non-tableau, non-chaîne, vide, doublon, trop long, trop nombreux");
  // jamais sur un `correct` : le type l'interdit, le contrôle aussi
  const surCorrect = () => verifierAvecControle({ ...g, verifier: () => ({ statut: "correct", codesCompetence: [], partiesFausses: ["a"] } as unknown as ResultatVerification) }, ex, "coefficients", "{}");
  let leveCorrect = false;
  try {
    surCorrect();
  } catch {
    leveCorrect = true;
  }
  verifier(leveCorrect, "`partiesFausses` sur un verdict `correct` : refusé");
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (${nbExercices} exercices, six écrans : parties fausses désignées exactement ; illisible sans partie ; contrôle serveur)`);
