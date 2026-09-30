// Test permanent — vérification des six écrans restants de gen7 (phase 3b-3, commit 1) : `coefficients`, `allure`,
// `axeSommet`, `domaineImage`, `racinesReconnaissance`, `tableauSignes` (modules purs de `src/generateurs/analyseFonction/`).
// Lancer : `npm run test-verification-gen7`. Sans réseau.
//
// Critère d'acceptation : la TABLE DE VÉRITÉ DIFFÉRENTIELLE (`scripts/support/table-verite-gen7-pilote.json`) — 46 exercices
// × ~200 saisies = 9 000+ cas produits en appelant le VRAI code de l'ancien pilote (`6acc102`,
// `docs/extraction-table-verite-gen7.md`) — est reproduite (statut ET code de compétence), sauf les DIVERGENCES DÉLIBÉRÉES
// ci-dessous, chacune rattachée à une CLASSE de cas et COMPTÉE. « À l'identique » est impossible : la décision D6 (illisible →
// `parse_error` avec message) et le nouveau contrat de tableau (RAPPORT §30) changent des comportements ; un cas qui diffère
// sans appartenir à une classe déclarée fait ÉCHOUER le test, et le nombre de cas de chaque classe est figé.

export {}; // module

import { readFileSync } from "node:fs";
import type { ResultatVerification } from "../lib/contratGenerateur";
import { lireNombreOuFraction } from "../lib/reponsesEcran";
import { decoderIntervalle } from "../lib/reponsesEcran";
import { verifierBalisageMath } from "./support/texteMath";
import {
  fonctionDe,
  rangeesTableau,
  solutionTableau,
  verifierAllure,
  verifierAxeSommet,
  verifierCoefficients,
  verifierDomaineImage,
  verifierReconnaissance,
  verifierTableauSignes,
  type CategorieAnalyseFonction,
  type FonctionSecondDegre,
} from "../src/generateurs/analyseFonction";

const echecs: string[] = [];
let nbVerifs = 0;
function verifier(condition: boolean, message: string): void {
  nbVerifs++;
  if (!condition) echecs.push(message);
}

type Verdict = [statut: string, code: string | null];
interface ExerciceTable {
  categorie: CategorieAnalyseFonction;
  a: number;
  b: number;
  c: number;
  xS: number;
  yS: number;
  racines: (number | null)[];
  grille: { colonnesValeurs: number[]; indexSommet: number; ligneSigne: string[]; ligneVariation: string[] };
  coefficients: string[][];
  allure: string[][];
  axeSommet: string[][];
  domaineImage: string[][];
  domaineImageBrute: string[][];
  racinesReconnaissance: string[][];
  tableauSignes: string[][];
  tableauSignesBrute: string[][];
}
interface Table {
  provenance: { commit: string; cas: Record<string, number> };
  exercices: ExerciceTable[];
}

const codeDe = (r: ResultatVerification): string | null => (r.codesCompetence.length === 0 ? null : r.codesCompetence.join());
const memeVerdict = (r: ResultatVerification, [statut, code]: Verdict): boolean => r.statut === statut && codeDe(r) === code;
const messageSain = (r: ResultatVerification): boolean => r.statut === "parse_error" && r.messageErreur.trim() !== "" && verifierBalisageMath(r.messageErreur).length === 0;

/** Compteurs de divergences par classe (le nom de la classe est la clé). */
const divergences = new Map<string, number>();
const noter = (classe: string) => divergences.set(classe, (divergences.get(classe) ?? 0) + 1);
const nonReconnues: string[] = [];

/** Lecture des COEFFICIENTS par l'ancien code (`parserReponseCoefficients`) : `Number(texte.trim().replace(",", "."))` seul, un texte vide valant 0. */
function coefficientIllisibleAncien(texte: string): boolean {
  const t = texte.trim().replace(",", ".");
  return t !== "" && !Number.isFinite(Number(t));
}

/** Lecture de `xS`/`yS` par l'ancien code (`parserNombreOuFraction`) : `Number()` puis fraction `p/q`. */
function nombreOuFractionIllisibleAncien(texte: string): boolean {
  const t = texte.trim().replace(",", ".");
  return t === "" || (!Number.isFinite(Number(t)) && !/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/.test(t));
}

const table = JSON.parse(readFileSync(`${__dirname}/support/table-verite-gen7-pilote.json`, "utf8")) as Table;
verifier(table.provenance.commit === "6acc102", "provenance de la table : ancien pilote 6acc102");

function blocDonnees(): void {
  for (const ex of table.exercices) {
    const f = fonctionDe(ex.categorie, ex.a, ex.b, ex.c);
    verifier(f.xS === ex.xS && f.yS === ex.yS, `${ex.categorie} (${ex.a},${ex.b},${ex.c}) : xS/yS identiques à l'ancien (${f.xS}/${f.yS} contre ${ex.xS}/${ex.yS})`);
    verifier(JSON.stringify(f.racines) === JSON.stringify(ex.racines.some((r) => r === null) ? null : ex.racines), `${ex.categorie} (${ex.a},${ex.b},${ex.c}) : racines identiques`);
    // Grille : la solution du NOUVEAU tableau (cases fusionnées) redéveloppée colonne par colonne = la grille de l'ancien code.
    const sol = solutionTableau(f);
    const rangees = rangeesTableau(f);
    const nbColonnes = ex.grille.ligneSigne.length;
    const signeDeveloppe: string[] = [];
    const variationDeveloppee: string[] = [];
    const colonnes = rangees[0]!.cellules.map((c) => c.ancre);
    for (const ancre of colonnes) signeDeveloppe.push((sol.signe as Record<string, string>)[ancre] as string);
    for (const cellule of rangees[1]!.cellules) for (const _ of cellule.couvre) variationDeveloppee.push((sol.variation as Record<string, string>)[cellule.ancre] as string);
    verifier(colonnes.length === nbColonnes && signeDeveloppe.join() === ex.grille.ligneSigne.join(), `${ex.categorie} (${ex.a},${ex.b},${ex.c}) : ligne des signes attendue identique (${signeDeveloppe.join()} contre ${ex.grille.ligneSigne.join()})`);
    verifier(variationDeveloppee.join() === ex.grille.ligneVariation.join(), `${ex.categorie} (${ex.a},${ex.b},${ex.c}) : ligne des variations attendue identique une fois les cases fusionnées redéveloppées`);
    verifier(nbColonnes === (ex.categorie === "mise_en_evidence" || ex.categorie === "binome_conjugue" ? 7 : 3), `${ex.categorie} : ${nbColonnes} colonnes`);
  }
}

function blocCoefficients(): void {
  for (const ex of table.exercices) {
    const f = fonctionDe(ex.categorie, ex.a, ex.b, ex.c);
    for (const ligne of ex.coefficients) {
      const champs = ligne.slice(0, -2);
      const ancien: Verdict = [ligne[ligne.length - 2] as string, (ligne[ligne.length - 1] as string | null) ?? null];
      const [ta, tb, tc] = champs;
      const r = verifierCoefficients(f, JSON.stringify(tc === undefined ? { a: ta, b: tb } : { a: ta, b: tb, c: tc }));
      const identite = `${ex.categorie} (${ex.a},${ex.b},${ex.c}) coefficients ${JSON.stringify(champs)}`;
      if (memeVerdict(r, ancien) && !(champs.some((t) => t.trim() === ""))) continue;
      // Classes de divergence, dans l'ordre.
      if (tc === undefined) { noter("coefficients : champ manquant"); verifier(r.statut === "parse_error" && messageSain(r), `${identite} : champ manquant → parse_error`); continue; }
      if (champs.some((t) => t.trim() === "")) { noter("coefficients : champ vide (l'ancien lisait 0)"); verifier(r.statut === "parse_error" && messageSain(r), `${identite} : champ vide → parse_error avec message`); continue; }
      const anciensLisibles = champs.every((t) => !coefficientIllisibleAncien(t));
      const nouveauxLisibles = champs.every((t) => lireNombreOuFraction(t) !== null);
      if (nouveauxLisibles && !anciensLisibles) { noter("coefficients : lecture élargie (fraction, moins typographique)"); verifier(r.statut !== "parse_error", `${identite} : lu par le nouveau lecteur`); continue; }
      if (anciensLisibles && !nouveauxLisibles) { noter("coefficients : lecture restreinte (écriture scientifique, hexadécimal)"); verifier(r.statut === "parse_error" && messageSain(r), `${identite} : refusé avec message`); continue; }
      if (!anciensLisibles && !nouveauxLisibles) { noter("coefficients : illisible → parse_error (l'ancien : not_equivalent)"); verifier(ancien[0] === "not_equivalent" && r.statut === "parse_error" && messageSain(r), `${identite} : illisible → parse_error`); continue; }
      nonReconnues.push(`${identite} : ancien ${ancien.join("/")}, nouveau ${r.statut}/${codeDe(r)}`);
    }
  }
}

function blocAllure(): void {
  for (const ex of table.exercices) {
    const f = fonctionDe(ex.categorie, ex.a, ex.b, ex.c);
    for (const [sa, sab, statut, code] of ex.allure) {
      const ancien: Verdict = [statut as string, code ?? null];
      const r = verifierAllure(f, JSON.stringify({ signeA: sa, signeAB: sab }));
      const identite = `${ex.categorie} (${ex.a},${ex.b},${ex.c}) allure ${sa}/${sab}`;
      const valides = (sa === "+" || sa === "-") && (sab === "+" || sab === "-" || sab === "0");
      if (valides) {
        verifier(memeVerdict(r, ancien), `${identite} : ancien ${ancien.join("/")}, nouveau ${r.statut}/${codeDe(r)}`);
      } else {
        noter("allure : choix absent ou hors liste (l'ancien : not_equivalent)");
        verifier(ancien[0] === "not_equivalent" && ancien[1] === null && r.statut === "parse_error" && messageSain(r), `${identite} : choix hors liste → parse_error avec message`);
      }
    }
  }
}

function blocAxeSommet(): void {
  const REGEX = /^x\s*=\s*(.+)$/;
  for (const ex of table.exercices) {
    const f = fonctionDe(ex.categorie, ex.a, ex.b, ex.c);
    for (const [axe, xS, yS, statut, code] of ex.axeSommet) {
      const ancien: Verdict = [statut as string, code ?? null];
      const r = verifierAxeSommet(f, JSON.stringify({ axeTexte: axe, xS, yS }));
      const identite = `${ex.categorie} (${ex.a},${ex.b},${ex.c}) axeSommet ${JSON.stringify([axe, xS, yS])}`;
      if (memeVerdict(r, ancien) && ![axe, xS, yS].some((t) => (t as string).trim() === "")) continue;
      const textes = [axe, xS, yS] as string[];
      if (textes.some((t) => t.trim() === "")) {
        noter("axeSommet : champ vide");
        verifier(ancien[0] === "not_equivalent" && ancien[1] === null && r.statut === "parse_error" && r.codesCompetence.length === 0 && messageSain(r), `${identite} : champ vide → parse_error sans code`);
        continue;
      }
      const lisiblesAnciens = [xS, yS].every((t) => !nombreOuFractionIllisibleAncien(t as string));
      const lisiblesNouveaux = [xS, yS].every((t) => lireNombreOuFraction(t as string) !== null);
      if (lisiblesAnciens && !lisiblesNouveaux) {
        noter("axeSommet : lecture restreinte (écriture scientifique)");
        verifier(r.statut === "parse_error" && messageSain(r), `${identite} : refusé avec message`);
        continue;
      }
      if (ancien[0] === "not_equivalent" && r.statut === "parse_error" && messageSain(r) && ancien[1] === codeDe(r)) {
        const m = REGEX.exec(axe as string);
        noter(m === null ? "axeSommet : axe sans « x = » (code inchangé)" : "axeSommet : valeur illisible → parse_error (l'ancien : not_equivalent)");
        continue;
      }
      nonReconnues.push(`${identite} : ancien ${ancien.join("/")}, nouveau ${r.statut}/${codeDe(r)}`);
    }
  }
}

function blocDomaineImage(): void {
  for (const ex of table.exercices) {
    const f = fonctionDe(ex.categorie, ex.a, ex.b, ex.c);
    for (const [cg, bg, cd, bd, statut, code] of ex.domaineImage) {
      const ancien: Verdict = [statut as string, code ?? null];
      const r = verifierDomaineImage(f, JSON.stringify({ crochetGauche: cg, borneGauche: bg, crochetDroit: cd, borneDroite: bd }));
      const identite = `${ex.categorie} (${ex.a},${ex.b},${ex.c}) domaineImage ${JSON.stringify([cg, bg, cd, bd])}`;
      if (memeVerdict(r, ancien)) {
        if (r.statut === "parse_error") verifier(messageSain(r), `${identite} : parse_error sans message sain`);
        continue;
      }
      const sentinelleEspacee = [bg, bd].some((t) => /^\s+[+-]inf$|^[+-]inf\s+$/.test(t as string));
      const scientifique = [bg, bd].some((t) => /^\d+e\d+$/.test(t as string));
      if (sentinelleEspacee && ancien[0] === "parse_error") { noter("domaineImage : sentinelle entourée d'espaces acceptée"); continue; }
      if (scientifique && r.statut === "parse_error") { noter("domaineImage : lecture restreinte (écriture scientifique)"); verifier(messageSain(r), `${identite} : message sain`); continue; }
      nonReconnues.push(`${identite} : ancien ${ancien.join("/")}, nouveau ${r.statut}/${codeDe(r)}`);
    }
    // Wire brut illisible : chez l'ancien un `parse_error` défensif ; ici JSON illisible → `parse_error` aussi.
    for (const [wire, statut] of ex.domaineImageBrute) {
      verifier(statut === "parse_error" && !decoderIntervalle(wire as string).ok, `domaineImage brut « ${wire} » : illisible des deux côtés`);
    }
  }
}

function blocReconnaissance(): void {
  for (const ex of table.exercices) {
    const f = fonctionDe(ex.categorie, ex.a, ex.b, ex.c);
    for (const [choix, statut, code] of ex.racinesReconnaissance) {
      const ancien: Verdict = [statut as string, code ?? null];
      const r = verifierReconnaissance(f, choix as string);
      const horsListe = !["mise_en_evidence", "binome_conjugue", "produit_remarquable", "irreductible"].includes(choix as string);
      if (!horsListe) verifier(memeVerdict(r, ancien), `${ex.categorie} racinesReconnaissance « ${choix} » : ancien ${ancien.join("/")}, nouveau ${r.statut}`);
      else {
        noter("racinesReconnaissance : identifiant hors liste (l'ancien : not_equivalent)");
        verifier(ancien[0] === "not_equivalent" && r.statut === "parse_error" && messageSain(r), `${ex.categorie} racinesReconnaissance « ${choix} » : parse_error`);
      }
    }
  }
}

function blocTableau(): void {
  for (const ex of table.exercices) {
    const f: FonctionSecondDegre = fonctionDe(ex.categorie, ex.a, ex.b, ex.c);
    const rangees = rangeesTableau(f);
    const [rSigne, rVariation] = rangees as [(typeof rangees)[number], (typeof rangees)[number]];
    const n = rSigne.cellules.length;
    for (const [signeTexte, variationTexte, statut, code] of ex.tableauSignes) {
      const ancien: Verdict = [statut as string, code ?? null];
      const s = (signeTexte as string) === "" ? [""] : (signeTexte as string).split(",");
      const v = (variationTexte as string) === "" ? [""] : (variationTexte as string).split(",");
      const identite = `${ex.categorie} (${ex.a},${ex.b},${ex.c}) tableauSignes ${signeTexte}|${variationTexte}`;
      // Représentable ? Il faut n valeurs de signe et n de variation, égales à l'intérieur de chaque case fusionnée.
      let indexColonne = 0;
      const groupes: string[] = [];
      let representable = s.length === n && v.length === n;
      if (representable) {
        for (const cellule of rVariation.cellules) {
          const valeurs = v.slice(indexColonne, indexColonne + cellule.couvre.length);
          indexColonne += cellule.couvre.length;
          if (new Set(valeurs).size !== 1) representable = false;
          groupes.push(valeurs[0] as string);
        }
      }
      if (!representable) {
        noter("tableauSignes : réponse non représentable (longueur, ou variations différentes dans une même case fusionnée)");
        verifier(ancien[0] !== "correct", `${identite} : non représentable mais l'ancien la jugeait correcte`);
        continue;
      }
      const reponse = {
        signe: Object.fromEntries(rSigne.cellules.map((c, i) => [c.ancre, s[i]])),
        variation: Object.fromEntries(rVariation.cellules.map((c, i) => [c.ancre, groupes[i]])),
      };
      const r = verifierTableauSignes(f, JSON.stringify(reponse));
      if (memeVerdict(r, ancien)) {
        if (r.statut === "parse_error") verifier(messageSain(r), `${identite} : parse_error sans message sain`);
        continue;
      }
      const horsChoix = rSigne.cellules.some((c, i) => !c.alphabet.includes(s[i] as string)) || rVariation.cellules.some((c, i) => !c.alphabet.includes(groupes[i] as string));
      if (horsChoix && r.statut === "parse_error" && messageSain(r) && ancien[0] === "not_equivalent") {
        noter("tableauSignes : valeur hors des choix de sa case (l'ancien : cycle unique de 4 symboles)");
        continue;
      }
      nonReconnues.push(`${identite} : ancien ${ancien.join("/")}, nouveau ${r.statut}/${codeDe(r)}`);
    }
    for (const [wire, statut] of ex.tableauSignesBrute) verifier(statut === "parse_error", `tableauSignes brut « ${wire} » : parse_error chez l'ancien`);
  }
}

/** Cas verrouillés par `test-gen7` / `test-taxonomie-gen7` de l'ancien pilote et pièges relevés par la spec 3a (indépendants de la table). */
function blocCasVerrouilles(): void {
  const f = fonctionDe("mise_en_evidence", 2, -8, 0); // f(x) = 2x² − 8x : xS = 2, yS = −8
  verifier(f.xS === 2 && f.yS === -8, "f = 2x² − 8x : xS = 2, yS = −8");
  const axe = (axeTexte: string, xS = "2", yS = "-8") => verifierAxeSommet(f, JSON.stringify({ axeTexte, xS, yS }));
  verifier(axe("x = 2").statut === "correct" && axe("x=4/2").statut === "correct", "axe : « x = 2 » et « x=4/2 » acceptés");
  verifier(axe("x = 2", "2", "-8.004").statut === "correct" && axe("x = 2", "2", "-8.006").statut === "not_equivalent", "tolérance ±0,005 sur yS : 0,004 accepté, 0,006 refusé");
  verifier(axe("x = 3").statut === "not_equivalent", "axe décalé de 1 → not_equivalent");
  const sansX = axe("2");
  verifier(sansX.statut === "parse_error" && sansX.codesCompetence.join() === "AXE_SYMETRIE_NOTATION" && messageSain(sansX), "valeur juste sans « x = » → parse_error + AXE_SYMETRIE_NOTATION (D6)");
  const sansXFaux = axe("7");
  verifier(sansXFaux.statut === "parse_error" && sansXFaux.codesCompetence.length === 0, "valeur FAUSSE sans « x = » → parse_error sans code (ancien : not_equivalent sans code)");
  const sansXYFaux = axe("2", "2", "5");
  verifier(sansXYFaux.statut === "parse_error" && sansXYFaux.codesCompetence.join() === "AXE_SYMETRIE_NOTATION", "le code ne dépend pas de la justesse de xS/yS (comme l'ancien)");
  verifier(axe("X = 2").statut === "parse_error" && axe("X = 2").codesCompetence.length === 0, "« X = 2 » (majuscule) refusé, sensible à la casse");
  verifier(axe("x = 2", "abc", "-8").statut === "parse_error" && axe("2", "abc", "-8").codesCompetence.length === 0, "xS illisible → parse_error sans code (le code exige des champs lisibles, comme l'ancien)");
  const coeff = (a: string, b: string, c: string) => verifierCoefficients(fonctionDe("binome_conjugue", 2, 0, -8), JSON.stringify({ a, b, c }));
  verifier(coeff("2", "0", "-8").statut === "correct", "binôme conjugué 2x² − 8 : coefficients justes");
  verifier(coeff("2", "", "-8").statut === "parse_error", "champ b vide → parse_error (l'ancien acceptait « 2,,-8 » comme juste : piège de la spec 3a §2.2)");
  verifier(coeff("0", "2", "-8").statut === "not_equivalent" && coeff("-8", "0", "2").statut === "not_equivalent", "coefficients échangés → not_equivalent");
  verifier(verifierAllure(f, JSON.stringify({ signeA: "+", signeAB: "+" })).codesCompetence.join() === "ALLURE_PARTIELLE", "allure : a juste, a·b faux → ALLURE_PARTIELLE (a·b = −16 < 0)");
  verifier(verifierAllure(f, JSON.stringify({ signeA: "-", signeAB: "+" })).codesCompetence.length === 0, "allure : les deux faux → aucun code");
  verifier(verifierAllure(fonctionDe("binome_conjugue", 2, 0, -8), JSON.stringify({ signeA: "+", signeAB: "0" })).statut === "correct", "b = 0 : signe de a·b = « 0 » attendu");
  const image = (cg: string, bg: string, cd: string, bd: string) => verifierDomaineImage(f, JSON.stringify({ crochetGauche: cg, borneGauche: bg, crochetDroit: cd, borneDroite: bd }));
  verifier(image("[", "-8", "[", "+inf").statut === "correct" && image("[", "-16/2", "[", "+inf").statut === "correct", "Im f = [−8 ; +∞[ (fraction acceptée)");
  verifier(image("]", "-8", "[", "+inf").statut === "not_equivalent" && image("[", "-8", "]", "+inf").statut === "not_equivalent", "mauvais crochet → not_equivalent");
  const fNeg = fonctionDe("irreductible", -1, 0, -1); // f = −x² − 1 : Im f = ]−∞ ; −1]
  verifier(verifierDomaineImage(fNeg, JSON.stringify({ crochetGauche: "]", borneGauche: "-inf", crochetDroit: "]", borneDroite: "-1" })).statut === "correct", "a < 0 : Im f = ]−∞ ; yS]");
  verifier(verifierReconnaissance(f, "mise_en_evidence").statut === "correct" && verifierReconnaissance(f, "binome_conjugue").statut === "not_equivalent", "reconnaissance : comparée à la VRAIE catégorie");
  // Irréductible : 3 colonnes à 2 valeurs, jamais de « 0 » ; produit remarquable : « 0 » au centre.
  const irr = fonctionDe("irreductible", 1, 0, 1);
  const rangeesIrr = rangeesTableau(irr);
  verifier(rangeesIrr[0]!.cellules.length === 3 && rangeesIrr[0]!.cellules.every((c) => c.alphabet.join() === "+,-"), "irréductible : 3 colonnes, toutes à 2 valeurs (jamais de « 0 »)");
  const prod = fonctionDe("produit_remarquable", 1, -4, 4);
  verifier(rangeesTableau(prod)[0]!.cellules.map((c) => c.alphabet.length).join() === "2,3,2", "produit remarquable : 2, 3, 2 valeurs");
  const bonneIrr = JSON.stringify(solutionTableau(irr));
  verifier(verifierTableauSignes(irr, bonneIrr).statut === "correct", "irréductible : réponse juste acceptée");
  const zero = solutionTableau(irr);
  (zero.signe as Record<string, string>).c0 = "0";
  verifier(verifierTableauSignes(irr, JSON.stringify(zero)).statut === "parse_error", "irréductible : « 0 » n'existe pas dans les choix → parse_error");
  const partiel = solutionTableau(fonctionDe("mise_en_evidence", 2, -8, 0));
  (partiel.variation as Record<string, string>).c3 = "⌢";
  const rPartiel = verifierTableauSignes(f, JSON.stringify(partiel));
  verifier(rPartiel.statut === "not_equivalent" && rPartiel.codesCompetence.join() === "SIGNE_VARIATION_PARTIEL", "signes justes + variation fausse → SIGNE_VARIATION_PARTIEL");
  (partiel.signe as Record<string, string>).c0 = "-";
  verifier(verifierTableauSignes(f, JSON.stringify(partiel)).codesCompetence.length === 0, "les deux lignes fausses → aucun code");
  // Aucune des réponses illisibles n'expose la solution : les messages ne contiennent ni xS ni yS attendus.
  const messages = [axe("2"), axe("x = 2", "abc", "-8"), coeff("", "0", "-8")].map((r) => (r.statut === "parse_error" ? r.messageErreur : ""));
  verifier(messages.every((m) => !/-8|\b2\b/.test(m.replace(/\$[^$]*\$/g, ""))), "les messages d'erreur ne révèlent aucune valeur attendue");
}

blocDonnees();
blocCasVerrouilles();
blocCoefficients();
blocAllure();
blocAxeSommet();
blocDomaineImage();
blocReconnaissance();
blocTableau();

// ── Divergences délibérées : nombre figé par classe ──
const ATTENDU: Record<string, number> = {
  "allure : choix absent ou hors liste (l'ancien : not_equivalent)": 1656,
  "axeSommet : axe sans « x = » (code inchangé)": 938,
  "axeSommet : champ vide": 276,
  "axeSommet : lecture restreinte (écriture scientifique)": 92,
  "axeSommet : valeur illisible → parse_error (l'ancien : not_equivalent)": 184,
  "coefficients : champ manquant": 46,
  "coefficients : champ vide (l'ancien lisait 0)": 230,
  "coefficients : illisible → parse_error (l'ancien : not_equivalent)": 276,
  "coefficients : lecture élargie (fraction, moins typographique)": 176,
  "coefficients : lecture restreinte (écriture scientifique, hexadécimal)": 184,
  "domaineImage : lecture restreinte (écriture scientifique)": 46,
  "domaineImage : sentinelle entourée d'espaces acceptée": 46,
  "racinesReconnaissance : identifiant hors liste (l'ancien : not_equivalent)": 184,
  "tableauSignes : réponse non représentable (longueur, ou variations différentes dans une même case fusionnée)": 496,
  "tableauSignes : valeur hors des choix de sa case (l'ancien : cycle unique de 4 symboles)": 470,
};
const lignes = [...divergences.entries()].sort(([x], [y]) => x.localeCompare(y));
if (process.env.AFFICHER_DIVERGENCES) for (const [k, n] of lignes) console.log(`  ${n}\t${k}`);
for (const [classe, n] of lignes) if (Object.hasOwn(ATTENDU, classe)) verifier(ATTENDU[classe] === n, `divergences « ${classe} » : ${n} cas (figé à ${ATTENDU[classe]})`);
for (const classe of Object.keys(ATTENDU)) verifier(divergences.has(classe), `divergences « ${classe} » : classe déclarée mais aucun cas`);
verifier(nonReconnues.length === 0, `${nonReconnues.length} cas divergent sans classe déclarée : ${nonReconnues.slice(0, 5).join(" ;; ")}`);

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nbVerifs}`);
  for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nbVerifs} vérifications, ${[...divergences.values()].reduce((s, n) => s + n, 0)} divergences délibérées en ${divergences.size} classes`);
