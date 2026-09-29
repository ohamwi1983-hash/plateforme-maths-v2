# Extraction de la table de vérité `racinesChamp1` / `racinesChamp2` (ancien pilote)

Provenance de `scripts/support/table-verite-racines-pilote.json` (RAPPORT.md §19). L'ancien pilote
(`ohamwi1983-hash/plateforme-maths-pilote`, commit `6acc102`) est une SPEC en lecture seule : **il n'est jamais modifié**. L'extraction
travaille sur une **copie jetable** dont on exporte une seule fonction par `sed`.

```bash
git -C plateforme-maths-pilote archive 6acc102 | tar -x -C /tmp/pilote-copie && cd /tmp/pilote-copie && npm ci
sed -i 's/^function traiterAnalyseFonction(/export function traiterAnalyseFonction(/' lib/routes/reponses.ts
# copier le script ci-dessous dans /tmp/pilote-copie/extraire-3b2.ts, puis :
npx tsx extraire-3b2.ts        # écrit /tmp/table-verite-racines-pilote.json (15 100 cas)
```

Le script appelle le VRAI `traiterAnalyseFonction("racinesChamp1"|"racinesChamp2", saisie, { exercice })` de l'ancien pilote
(aucune réplique de sa logique) et relève, pour le champ 2, le message pédagogique (`lireEtEffacerMessageErreurParsing`).

```ts
// EXTRACTION JETABLE (copie jetable de l'ancien pilote 6acc102, `traiterAnalyseFonction` exportée par sed dans la COPIE ; clone intact).
// Produit la table de vérité différentielle racinesChamp1/racinesChamp2 : appelle le VRAI code de l'ancien pilote.
import { writeFileSync } from "node:fs";
import { traiterAnalyseFonction } from "./lib/routes/reponses";
import { lireEtEffacerMessageErreurParsing } from "./src/moteur/messagesErreurParsing";
import { construireMiseEnEvidence } from "./src/generateurs/secondDegre/categories/miseEnEvidence";
import { construireBinomeConjugue } from "./src/generateurs/secondDegre/categories/binomeConjugue";
import { construireProduitRemarquable } from "./src/generateurs/secondDegre/categories/produitRemarquable";

type Cas = [string, string, string | null, string | null]; // saisie, statut, code, message
const lin = (k: number) => (k >= 0 ? `x-${k}` : `x+${-k}`);
const fac = (k: number, m: number) => `${k}x${m >= 0 ? "+" : "-"}${Math.abs(m)}`; // kx+m
const coef = (a: number) => (a === 1 ? "" : String(a));

function saisiesChamp1(a: number, r: number, b: number, c: number): string[] {
  const ar = Math.abs(r);
  const dev = `${coef(a)}x^2${b === 0 ? "" : (b > 0 ? "+" : "-") + (Math.abs(b) === 1 ? "" : Math.abs(b)) + "x"}${c === 0 ? "" : (c > 0 ? "+" : "-") + Math.abs(c)}`;
  return [
    // mise en évidence et variantes
    `${coef(a)}x(${lin(r)})`, `x(${fac(a, b)})`, `${coef(a)}x(${lin(r)})=0`, `${coef(a)}x(${lin(r)}) = 0`, `${coef(a)}X(${lin(r)})`, dev,
    `-x(${fac(-a, -b)})`, `-x(${fac(-a, -b)})=0`, `-${coef(a)}x(${lin(-r)})`, `${coef(a)}x(${lin(-r)})`, `-(x)(${fac(-a, -b)})`, `(${coef(a)}x)(${lin(r)})`,
    `${coef(a)}·x·(${lin(r)})`, `${coef(a)}*x*(${lin(r)})`, `x*x*${a}-${Math.abs(b)}x`, `${coef(a)}x(${lin(r)})=1`, `-${a}x(${-r >= 0 ? "x-" + (-r) : "x+" + r})`,
    // binôme conjugué / produit remarquable et signes
    `${coef(a)}(${lin(ar)})(${lin(-ar)})`, `${coef(a)}(${lin(-ar)})(${lin(ar)})`, `${coef(a)}(${lin(ar)})(${lin(ar)})`, `${coef(a)}(${lin(-ar)})(${lin(-ar)})`,
    `${coef(a)}(x-${ar})^2`, `${coef(a)}(x+${ar})²`, `${coef(a)}(${lin(r)})^2`, `${coef(a)}(${lin(-r)})^2`, `${coef(a)}(${lin(r)})(${lin(r)})`, `${coef(a)}(${lin(r)})(${lin(-r)})`, `${coef(a)}(${lin(-r)})(${lin(r)})`,
    `(${fac(2 * a, -2 * a * ar)})(0.5x+${0.5 * ar})`, `(${fac(2 * a, -2 * a * r)})(0.5x${-0.5 * r * 1 >= 0 ? "+" : "-"}${Math.abs(0.5 * r)})`, `(${fac(2 * a, -2 * a * r)})(0,5x${-r >= 0 ? "+" : "-"}${Math.abs(0.5 * r)})`,
    `${coef(a)}(x-${ar + 1})(x+${ar + 1})`, `(x-${ar})(x+${ar})`, `${coef(a + 1)}(x-${ar})(x+${ar})`, `${coef(a)}(x-${ar})(x+${ar})*1`, `${coef(a)}(x-${ar})(x+${ar})(x)`, `${coef(a)}(${lin(r)})^3`,
    `${coef(a)}x^2-${a * ar * ar}`, `${coef(a)}x^2${b >= 0 ? "+" : "-"}${Math.abs(b)}x+${Math.abs(c)}`, `${coef(a)}(${lin(r)})(${lin(r)})=0`,
    `3(x-${ar})(x-${ar})`, `5(x-${ar})(x+${ar})`, `5(x-${ar})(x-${ar})`, `(${lin(ar)})(${lin(ar)})(${lin(ar)})`, `x(x-1)(x-2)`, `x(x)`, `-x(x)`, `--x(x-${r})`, `(-x)(${fac(-a, b)})`,
    // erreurs de syntaxe et cas limites
    `x(${a}x-`, `y(x-${r})`, `sqrt(4)x`, `= 0`, ``, `${coef(a)}x`, `(x-3`, `abc`, `3x(`, `x^`, `2xx`, `x²`, `x^2`, `3`, `x`, `0`, `1/x`, `x/(x-1)`, `x(1/x)`, `1.2.3x`, `${a},5x(x-1)`, `(x-${ar})(x+${ar}))`, `$x$`, `x(x-${ar})\\`, `${coef(a)}x(${lin(r)}) =  0 `, `${coef(a)}x(${lin(r)})=0=0`,
  ];
}

function saisiesChamp2(r1: number, r2: number): string[] {
  return [
    `${r1};${r2}`, `${r2};${r1}`, `${r1}`, `${r2}`, `${r1};${r1}`, `${r2};${r2}`, `${r1};${r2};${r2}`, `${r1};${r2};${r1}`, `aucune`, `Aucune`, `AUCUNE`, `aucune;3`, ``, `  `, `;;`, `;`,
    `${r1};${r2 + 1}`, `${r1 + 1};${r2}`, `${r1};${r2 + 137}`, `${r1 + 1};${r2 + 1}`, `${-r1};${-r2}`, `${r1 + 1e-10};${r2}`, `${r1 + 1e-8};${r2}`, `${r1};${r2 + 0.005}`, `${r1 + 0.000000001};${r2}`,
    `${2 * r1}/2;${r2}`, `${r1}+0;${r2}`, `sqrt(${r1 * r1});${r2}`, `abs(${r2});${r1}`, `|${r2}|;${r1}`, `${r1}x1;${r2}`, `x;${r2}`, `0x;${r2}`, `${r1}x;${r2}`, `X;${r1}`,
    `sqrt(-1);${r2}`, `sqrt(-1);${r1}`, `1/0;${r2}`, `0/0;${r2}`, `sqrt(-1);sqrt(-1)`, `${r1};sqrt(-4)`, `sqrt(-1)`, `1/0`, `${r1};1/0`, `cbrt(-8);${r2}`, `${r1};${r1}/${r1 === 0 ? 1 : r1}`,
    `${r1};abc`, `${r1};(${r2}`, `${r1};`, `;${r2}`, `${r1};;${r2}`, `${r1},${r2}`, `${r1} ; ${r2}`, `${r1}\t;${r2}`, `${r1}.0;${r2}.0`, `${r1},0;${r2}`,
    `constructor(4);${r2}`, `constructor;${r2}`, `${r1};constructor(0)`, `Constructor(2);${r1}`,
    `$;${r2}`, `\\;1`, `é;1`, `${r1};$`, `sqrt;${r2}`, `sqrt(;${r2}`, `sqrt(4;${r2}`, `|${r1};${r2}`, `${r1}+;${r2}`, `${r1}*;${r2}`, `()`, `(${r1});(${r2})`, `-(${r1});-(${r2})`, `--${r1};${r2}`, `${r1}^2;${r2}`, `${r1}²;${r2}`,
  ];
}

const exercices: any[] = [];
const constructeurs: [string, (a: number, r: number) => any, number[]][] = [
  ["mise_en_evidence", (a, r) => construireMiseEnEvidence({ aImpose: a, racineImposee: r }), [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]],
  ["binome_conjugue", (a, r) => construireBinomeConjugue({ aImpose: a, racineImposee: r }), [1, 2, 3, 4, 5]],
  ["produit_remarquable", (a, r) => construireProduitRemarquable({ aImpose: a, racineImposee: r }), [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5]],
];
let n1 = 0, n2 = 0;
for (const [cat, build, rs] of constructeurs) {
  for (const a of [1, 2, 3, 4]) {
    for (const r of rs) {
      const ex = { ...build(a, r), formeAffichage: "canonique" } as any;
      const { a: ea, b, c } = ex.enonce;
      const champ1: Cas[] = saisiesChamp1(ea, r, b, c).map((s) => {
        const res = traiterAnalyseFonction("racinesChamp1", s, { exercice: ex } as any);
        lireEtEffacerMessageErreurParsing();
        return [s, res.statut, res.bugDetecte, null];
      });
      const [r1, r2] = ex.solution.racines as [number, number];
      const champ2: Cas[] = saisiesChamp2(r1, r2).map((s) => {
        const res = traiterAnalyseFonction("racinesChamp2", s, { exercice: ex } as any);
        return [s, res.statut, res.bugDetecte, lireEtEffacerMessageErreurParsing()];
      });
      n1 += champ1.length; n2 += champ2.length;
      exercices.push({ categorie: cat, a: ea, r, b, c, racines: ex.solution.racines, formeFactorisee: ex.solution.formeFactorisee, racinesExactes: ex.solution.racinesExactes, champ1, champ2 });
    }
  }
}
const sortie = { provenance: { depot: "plateforme-maths-pilote", commit: "6acc102", fonction: "traiterAnalyseFonction('racinesChamp1'|'racinesChamp2') — lib/routes/reponses.ts (exportée par sed dans une COPIE jetable ; le clone n'est jamais modifié)", generation: "scripts/… extraction jetable, non commitée : voir RAPPORT.md §19", cas: { champ1: n1, champ2: n2, exercices: exercices.length } }, format: "cas = [saisie, statut, bug_detecte|null, message_erreur|null] ; champ2: saisie = wire d'origine « v1;v2 » ou « aucune »", exercices };
writeFileSync("/tmp/table-verite-racines-pilote.json", JSON.stringify(sortie));
console.log(JSON.stringify(sortie.provenance.cas), "exercices", exercices.length);
```
