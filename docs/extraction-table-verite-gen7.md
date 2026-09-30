# Extraction de la table de vérité des six écrans restants de gen7 (ancien pilote)

Provenance de `scripts/support/table-verite-gen7-pilote.json` (RAPPORT.md §33, phase 3b-3). L'ancien pilote
(`ohamwi1983-hash/plateforme-maths-pilote`, commit `6acc102`) est une SPEC en lecture seule : **il n'est jamais modifié**. L'extraction
travaille sur une **copie jetable** dont on exporte une seule fonction par `sed`.

```bash
git -C plateforme-maths-pilote archive 6acc102 | tar -x -C /tmp/pilote-copie && cd /tmp/pilote-copie && npm ci
sed -i 's/^function traiterAnalyseFonction(/export function traiterAnalyseFonction(/' lib/routes/reponses.ts
# copier le script ci-dessous dans /tmp/pilote-copie/extraire-3b3.ts, puis :
npx tsx extraire-3b3.ts /tmp/table-verite-gen7-pilote.json   # 46 exercices, 9 000+ cas
```

Le script appelle le VRAI `traiterAnalyseFonction(champ, saisie, exercice)` de l'ancien pilote (aucune réplique de sa logique) pour
`coefficients`, `allure`, `axeSommet`, `domaineImage`, `racinesReconnaissance` et `tableauSignes`. Les exercices sont construits avec les
constructeurs réels de l'ancien pilote (`construireMiseEnEvidence`, `construireBinomeConjugue`, `construireProduitRemarquable`,
paramètres `a`/`r` imposés) et `construireGrilleSigneVariation` ; pour `irreductible` la construction de `construireIrreductible` est
reproduite avec `a`, `m`, `marge` imposés (le vrai constructeur tire au hasard). La table est **paramétrée par (catégorie, a, b, c)** :
elle prouve la vérification et les données dérivées (`xS`, `yS`, grille attendue), pas la graine.

`scripts/test-verification-gen7.ts` la rejoue contre les modules purs de `src/generateurs/analyseFonction/` : statut ET code de
compétence identiques, sauf les divergences délibérées (décision D6 et nouveau contrat de tableau), rattachées à une classe et
**comptées** (`ATTENDU` dans le test, RAPPORT §33).

```ts
// EXTRACTION JETABLE (copie jetable de l'ancien pilote 6acc102, `traiterAnalyseFonction` exportée par sed dans la COPIE ; clone intact).
// Produit la table de vérité différentielle des 6 écrans restants de gen7 (coefficients, allure, axeSommet, domaineImage,
// racinesReconnaissance, tableauSignes) : appelle le VRAI code de l'ancien pilote, aucune réplique de sa logique.
import { writeFileSync } from "node:fs";
import { traiterAnalyseFonction } from "./lib/routes/reponses";
import { construireGrilleSigneVariation } from "./src/generateurs/analyseFonction/grille";
import { construireMiseEnEvidence } from "./src/generateurs/secondDegre/categories/miseEnEvidence";
import { construireBinomeConjugue } from "./src/generateurs/secondDegre/categories/binomeConjugue";
import { construireProduitRemarquable } from "./src/generateurs/secondDegre/categories/produitRemarquable";

type Verdict = [statut: string, code: string | null];
const verdict = (champ: string, wire: string, exercice: any): Verdict => {
  const r = traiterAnalyseFonction(champ as never, wire, exercice);
  return [r.statut, r.bugDetecte];
};

/** Écritures équivalentes d'une valeur de ¼ℤ (ni « | » ni, pour `sansVirgule`, de « , »). */
function formes(v: number, sansVirgule: boolean): string[] {
  const s = new Set<string>([String(v)]);
  if (Number.isInteger(v)) {
    s.add(`${v}.0`);
    s.add(`${v * 2}/2`);
    if (v >= 0) s.add(`+${v}`);
    if (!sansVirgule) s.add(`${v},0`);
  } else {
    if (!sansVirgule) s.add(String(v).replace(".", ","));
    s.add(`${v * 4}/4`);
    s.add(`${v * 2}/2`);
  }
  return [...s];
}

function decalees(v: number): string[] {
  return [String(v + 0.004), String(v + 0.005), String(v + 0.006), String(v - 0.004), String(v - 0.006), String(v + 1), String(-v)];
}

function exercicesAnciens(): any[] {
  const liste: any[] = [];
  const ajouter = (categorie: string, enonce: { a: number; b: number; c: number }, racines: [number, number]) => {
    const { a, b, c } = enonce;
    const xS = -b / (2 * a);
    const yS = a * xS * xS + b * xS + c;
    const racinesPourGrille: [number, number] = categorie === "irreductible" ? [xS, xS] : racines;
    liste.push({
      categorie,
      exercice: { categorie, enonce, solution: { racines, racinesExactes: true }, formeAffichage: "canonique" },
      xS,
      yS,
      ordreTermes: ["a"],
      grilleSigneVariation: construireGrilleSigneVariation(enonce as any, racinesPourGrille, xS),
    });
  };
  for (const a of [1, 3]) for (const r of [-5, -2, 3, 5]) { const e = construireMiseEnEvidence({ aImpose: a, racineImposee: r }) as any; ajouter("mise_en_evidence", e.enonce, e.solution.racines); }
  for (const a of [1, 4]) for (const r of [1, 3, 5]) { const e = construireBinomeConjugue({ aImpose: a, racineImposee: r }) as any; ajouter("binome_conjugue", e.enonce, e.solution.racines); }
  for (const a of [2, 4]) for (const r of [-4, -1, 2, 5]) { const e = construireProduitRemarquable({ aImpose: a, racineImposee: r }) as any; ajouter("produit_remarquable", e.enonce, e.solution.racines); }
  // irréductible : même construction que `construireIrreductible` (a, m, marge imposés au lieu d'être tirés).
  for (const a of [-4, -2, 1, 3]) for (const m of [-3, 0, 4]) for (const marge of [1, 4]) {
    const b = a * m;
    const seuil = (b * b) / (4 * a);
    const c = a > 0 ? Math.ceil(seuil) + marge : Math.floor(seuil) - marge;
    ajouter("irreductible", { a, b, c }, [NaN, NaN]);
  }
  return liste;
}

const SIGNES = ["+", "-", "0"];
const VARIATIONS = ["↗", "↘", "⌢", "⌣"];

const sortie: any[] = [];
for (const ex of exercicesAnciens()) {
  const { a, b, c } = ex.exercice.enonce;
  const { xS, yS } = ex;

  // ── coefficients : 3 textes → « ta,tb,tc » (aucune virgule dans un texte : c'est le séparateur du wire)
  const bonsA = formes(a, true), bonsB = formes(b, true), bonsC = formes(c, true);
  const coefficients: string[][] = [[String(a), String(b), String(c)]];
  for (const f of bonsA.slice(1)) coefficients.push([f, String(b), String(c)]);
  for (const f of bonsB.slice(1)) coefficients.push([String(a), f, String(c)]);
  for (const f of bonsC.slice(1)) coefficients.push([String(a), String(b), f]);
  coefficients.push([` ${a} `, String(b), String(c)], [String(a), String(b), `−${Math.abs(c)}`], [`−${Math.abs(a)}`, String(b), String(c)]);
  coefficients.push([String(b), String(a), String(c)], [String(c), String(b), String(a)], [String(-a), String(b), String(c)], [String(a), String(-b), String(c)], [String(a), String(b), String(-c)]);
  coefficients.push([String(a + 1), String(b), String(c)], [String(a), String(b + 1), String(c)], [String(a), String(b), String(c + 1)], [String(a + 0.5), String(b), String(c)]);
  coefficients.push(["", String(b), String(c)], [String(a), "", String(c)], [String(a), String(b), ""], ["", "", ""], ["  ", String(b), String(c)]);
  coefficients.push(["abc", String(b), String(c)], [String(a), "x", String(c)], [String(a), String(b), "1/2"], [String(a), String(b), "sqrt(4)"], ["2x", String(b), String(c)], [String(a), "--3", String(c)]);
  coefficients.push([`${a}e0`, String(b), String(c)], [String(a), `${b}e0`, String(c)], [String(a), String(b), "1e1"], [a >= 0 ? `0x${a.toString(16)}` : "0x1", String(b), String(c)], ["Infinity", String(b), String(c)]);
  coefficients.push([String(a), String(b)]); // 2 champs seulement
  const tableCoefficients = coefficients.map((t) => [...t, ...verdict("coefficients", t.join(","), ex)]);

  // ── allure : « signeA,signeAB » (clés « ? » et hors alphabet incluses)
  const allure: string[][] = [];
  for (const sa of ["+", "-", "0", "?", "", "x", "++"]) for (const sab of ["+", "-", "0", "?", "", "x"]) allure.push([sa, sab]);
  const tableAllure = allure.map((t) => [...t, ...verdict("allure", t.join(","), ex)]);

  // ── axeSommet : « axeTexte|xS|yS »
  const axes: string[][] = [];
  const bonsX = formes(xS, false), bonsY = formes(yS, false);
  const texteAxe = (v: string) => [`x = ${v}`, `x=${v}`, ` x = ${v} `, `x =${v}`, `X = ${v}`, v, `AS: x = ${v}`, `x = (${v})`];
  for (const t of texteAxe(bonsX[0])) axes.push([t, bonsX[0], bonsY[0]]);
  for (const v of bonsX.slice(1)) axes.push([`x = ${v}`, bonsX[0], bonsY[0]], [v, bonsX[0], bonsY[0]]);
  for (const v of decalees(xS)) axes.push([`x = ${v}`, bonsX[0], bonsY[0]], [v, bonsX[0], bonsY[0]], [`x = ${xS}`, v, bonsY[0]]);
  for (const v of bonsX.slice(1)) axes.push([`x = ${bonsX[0]}`, v, bonsY[0]]);
  for (const v of bonsY.slice(1)) axes.push([`x = ${bonsX[0]}`, bonsX[0], v]);
  for (const v of decalees(yS)) axes.push([`x = ${bonsX[0]}`, bonsX[0], v]);
  axes.push(["", bonsX[0], bonsY[0]], ["   ", bonsX[0], bonsY[0]], ["x =", bonsX[0], bonsY[0]], ["x = abc", bonsX[0], bonsY[0]], ["x", bonsX[0], bonsY[0]], ["y = " + bonsX[0], bonsX[0], bonsY[0]], ["abc", bonsX[0], bonsY[0]]);
  axes.push([`x = ${bonsX[0]}`, "", bonsY[0]], [`x = ${bonsX[0]}`, bonsX[0], ""], [`x = ${bonsX[0]}`, "abc", bonsY[0]], [`x = ${bonsX[0]}`, bonsX[0], "1/0"], [`x = ${bonsX[0]}`, "2/", bonsY[0]], [`x = ${bonsX[0]}`, bonsX[0], "1e1"]);
  axes.push([bonsX[0], "", bonsY[0]], [bonsX[0], "abc", bonsY[0]], [bonsX[0], bonsX[0], ""], [String(xS + 1), bonsX[0], bonsY[0]], [String(xS + 1), "abc", bonsY[0]]);
  const tableAxe = axes.map((t) => [...t, ...verdict("axeSommet", t.join("|"), ex)]);

  // ── domaineImage : « crochetG|borneG|crochetD|borneD »
  const images: string[][] = [];
  const attenduG = a > 0 ? "[" : "]", attenduD = a > 0 ? "[" : "]";
  const borneFinie = bonsY[0];
  const combo = (cg: string, bg: string, cd: string, bd: string) => images.push([cg, bg, cd, bd]);
  if (a > 0) { combo("[", borneFinie, "[", "+inf"); combo("]", borneFinie, "[", "+inf"); combo("[", borneFinie, "]", "+inf"); combo("]", borneFinie, "]", "+inf"); }
  else { combo("]", "-inf", "]", borneFinie); combo("[", "-inf", "]", borneFinie); combo("]", "-inf", "[", borneFinie); combo("[", "-inf", "[", borneFinie); }
  for (const v of bonsY.slice(1)) a > 0 ? combo("[", v, "[", "+inf") : combo("]", "-inf", "]", v);
  for (const v of decalees(yS)) a > 0 ? combo("[", v, "[", "+inf") : combo("]", "-inf", "]", v);
  if (a > 0) { combo("[", "-inf", "[", "+inf"); combo("[", "+inf", "[", borneFinie); combo("[", borneFinie, "[", "-inf"); combo("[", borneFinie, "[", borneFinie); combo("]", "-inf", "]", borneFinie); combo("[", "", "[", "+inf"); combo("[", "abc", "[", "+inf"); combo("[", "1/0", "[", "+inf"); combo("[", ` ${borneFinie} `, "[", "+inf"); combo("[", borneFinie, "[", " +inf"); combo("[", borneFinie, "[", ""); combo("[", "1e1", "[", "+inf"); combo("(", borneFinie, "[", "+inf"); combo("[", borneFinie, ")", "+inf"); }
  else { combo("]", "+inf", "]", borneFinie); combo("]", borneFinie, "]", "+inf"); combo("]", "-inf", "]", "-inf"); combo("]", "-inf", "]", "abc"); combo("]", " -inf", "]", borneFinie); combo("]", "-inf", "]", ""); combo("[", "-inf", "[", borneFinie); combo("]", "", "]", borneFinie); combo("]", "-inf", "]", "1/0"); combo("]", "-inf", "]", "1e1"); combo("(", "-inf", "]", borneFinie); }
  void attenduG; void attenduD;
  const tableImage = images.map((t) => [...t, ...verdict("domaineImage", t.join("|"), ex)]);
  // wire illisible (nombre de parties) : conservé tel quel
  const imagesBrutes = ["", "a", "[|1|[", "[|1|[|+inf|3", "[|1|[|+inf|"];
  const tableImageBrute = imagesBrutes.map((w) => [w, ...verdict("domaineImage", w, ex)]);

  // ── racinesReconnaissance : un slug (ou n'importe quel texte)
  const choix = ["mise_en_evidence", "binome_conjugue", "produit_remarquable", "irreductible", "cas_general", "", "MISE_EN_EVIDENCE", "mise_en_evidence "];
  const tableReconnaissance = choix.map((t) => [t, ...verdict("racinesReconnaissance", t, ex)]);

  // ── tableauSignes : « s1,s2,…|v1,v2,… »
  const { ligneSigne: S, ligneVariation: V } = ex.grilleSigneVariation;
  const n = S.length;
  const tableaux: string[][][] = [[[...S], [...V]]];
  for (let i = 0; i < n; i++) {
    for (const s of SIGNES) if (s !== S[i]) { const t = [...S]; t[i] = s; tableaux.push([t, [...V]]); }
    for (const v of VARIATIONS) if (v !== V[i]) { const t = [...V]; t[i] = v; tableaux.push([[...S], t]); }
  }
  const inverse = (s: string) => (s === "+" ? "-" : "+");
  tableaux.push([S.map(inverse), [...V]], [[...S], V.map((v) => (v === "↗" ? "↘" : v === "↘" ? "↗" : v === "⌣" ? "⌢" : "⌣"))], [S.map(inverse), V.map((v) => (v === "↗" ? "↘" : v === "↘" ? "↗" : v === "⌣" ? "⌢" : "⌣"))]);
  tableaux.push([S.map(() => "+"), [...V]], [[...S], V.map(() => "↗")], [S.map(() => "0"), V.map(() => "⌣")]);
  tableaux.push([S.slice(0, n - 2), V.slice(0, n - 2)], [[...S, "+", "+"], [...V, "↗", "↗"]], [S.slice(0, n - 2), [...V]], [[...S], V.slice(0, n - 2)]);
  tableaux.push([[...S.slice(0, n - 1), "x"], [...V]], [[...S], [...V.slice(0, n - 1), "x"]], [[...S.slice(0, n - 1), "?"], [...V]], [[...S.slice(0, n - 1), ""], [...V]], [[], []]);
  const tableTableau = tableaux.map(([s, v]) => [s.join(","), v.join(","), ...verdict("tableauSignes", `${s.join(",")}|${v.join(",")}`, ex)]);
  const tableTableauBrute = ["", "+", "+|", "|↗", "+,-|↗", "+,-|↗,↘|x"].map((w) => [w, ...verdict("tableauSignes", w, ex)]);

  sortie.push({
    categorie: ex.categorie,
    a, b, c, xS, yS,
    racines: ex.exercice.solution.racines.map((r: number) => (Number.isNaN(r) ? null : r)),
    grille: { colonnesValeurs: ex.grilleSigneVariation.colonnesValeurs, indexSommet: ex.grilleSigneVariation.indexSommet, ligneSigne: S, ligneVariation: V },
    coefficients: tableCoefficients,
    allure: tableAllure,
    axeSommet: tableAxe,
    domaineImage: tableImage,
    domaineImageBrute: tableImageBrute,
    racinesReconnaissance: tableReconnaissance,
    tableauSignes: tableTableau,
    tableauSignesBrute: tableTableauBrute,
  });
}

const cas = { coefficients: 0, allure: 0, axeSommet: 0, domaineImage: 0, racinesReconnaissance: 0, tableauSignes: 0 } as Record<string, number>;
for (const e of sortie) {
  cas.coefficients += e.coefficients.length;
  cas.allure += e.allure.length;
  cas.axeSommet += e.axeSommet.length;
  cas.domaineImage += e.domaineImage.length + e.domaineImageBrute.length;
  cas.racinesReconnaissance += e.racinesReconnaissance.length;
  cas.tableauSignes += e.tableauSignes.length + e.tableauSignesBrute.length;
}
writeFileSync(
  process.argv[2] ?? "/tmp/table-verite-gen7-pilote.json",
  JSON.stringify({
    provenance: { depot: "plateforme-maths-pilote", commit: "6acc102", script: "docs/extraction-table-verite-gen7.md", cas: { ...cas, exercices: sortie.length } },
    format:
      "exercices[] : { categorie, a, b, c, xS, yS, racines, grille:{ligneSigne,ligneVariation,…}, <ecran>: [[…saisie, statut, code]] } ; saisie = champs du wire ancien SÉPARÉS (coefficients : [ta,tb,tc?] ; allure : [signeA,signeAB] ; axeSommet : [axeTexte,xS,yS] ; domaineImage : [cg,bg,cd,bd] ; racinesReconnaissance : [choix] ; tableauSignes : [lignesigne « s1,s2 », ligneVariation « v1,v2 »]) ; *Brute : [wire complet, statut, code]",
    exercices: sortie,
  }) + "\n",
);
console.log(`OK : ${sortie.length} exercices, cas ${JSON.stringify(cas)}`);
```
