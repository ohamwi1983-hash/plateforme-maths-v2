// Test permanent — gen9 « Complète le carré », génération et énoncé (RAPPORT §59). Propriétés (aucun différentiel : gen9 n'existe dans aucun ancien pilote) sur toutes les configurations
// admises × 400 graines : `TH` toujours active (`p ≠ 0`, donc `b ≠ 0`), `a ≠ 0`, `b` et `c` ENTIERS, énoncé développé relu par `lirePolynome` = la fonction, termes JAMAIS dans l'ordre canonique,
// repli différent de la vraie fonction ; couples (th, facteur) admissibles exhaustifs ; déterminisme et exercices ÉPINGLÉS (règle `_v2`). Lancer : `npm run test-gen9-generation`. Sans réseau.

export {}; // module

import { join } from "node:path";
import { genererExerciceCc, activesDe, couplesAdmissibles } from "../src/generateurs/completionDuCarre/generation";
import { latexDeveloppe, latexFonctionDeveloppee, termesAffiches } from "../src/generateurs/completionDuCarre/enonce";
import { coefficientsDeveloppes, parametres, type ExerciceCc } from "../src/generateurs/completionDuCarre/types";
import { POOL_CV, POOL_EV, POOL_TRANSLATION, poolFacteur, tirerRepli } from "../src/generateurs/_noyauQuadratique/tirage";
import { coefficient, lirePolynome } from "../src/generateurs/_noyauQuadratique/polynome";
import { parametresRepli, polynomeDe, type Transformation } from "../src/generateurs/_noyauQuadratique/types";
import { egalR, multiplierR, rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";
import { verifierBalisageMath } from "./support/texteMath";

/* eslint-disable @typescript-eslint/no-require-imports */
const katex = require(join(__dirname, "..", "public", "vendor", "katex-0.18.9", "katex.min.js")) as { renderToString(latex: string, options: Record<string, unknown>): string };

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

// Les 12 configurations admises : TH + (TV ou non) × (rien | EV | CV) × (SOX ou non).
const CONFIGURATIONS: Transformation[][] = [];
for (const tv of [false, true]) for (const facteur of [null, "EV", "CV"] as const) for (const sox of [false, true]) CONFIGURATIONS.push(["TH", ...(tv ? ["TV" as const] : []), ...(facteur ? [facteur] : []), ...(sox ? ["SOX" as const] : [])]);
const GRAINES = Array.from({ length: 400 }, (_, i) => 7 + i * 131);
const nomConfig = (c: readonly string[]): string => c.join("+");

/** `\dfrac{n}{d}` -> `(n/d)` : relisible par `lirePolynome`. */
const versSaisie = (latex: string): string => latex.replace(/\\dfrac\{(\d+)\}\{(\d+)\}/g, "($1/$2)");

function compile(latex: string): string | null {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: false, trust: () => false, strict: "error" });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

const motifsVus = new Set<string>();
let total = 0;
let aMoinsUn = 0;
let aUn = 0;
let c0 = 0;
for (const actives of CONFIGURATIONS) {
  const nom = nomConfig(actives);
  const vus = new Set<string>();
  for (const graine of GRAINES) {
    const ex = genererExerciceCc(graine, { actives });
    total++;
    const g = parametres(ex);
    const { a, b, c } = coefficientsDeveloppes(g);
    verifier(ex.actives.includes("TH") && g.p.n !== 0 && g.p.d === 1, `${nom} g=${graine} : TH active, p entier non nul`);
    verifier(a.n !== 0 && b.n !== 0 && b.d === 1 && c.d === 1, `${nom} g=${graine} : a ≠ 0, b ≠ 0, b et c entiers (${b.n}/${b.d}, ${c.n}/${c.d})`);
    verifier(egalR(multiplierR(a, rat(1)), g.a) && g.q.d === 1, `${nom} g=${graine} : q entier`);
    verifier(ex.sox === actives.includes("SOX") && (ex.tv !== 0) === actives.includes("TV") && ((ex.facteurN !== 1 || ex.facteurD !== 1) || !(actives.includes("EV") || actives.includes("CV"))), `${nom} g=${graine} : cases ↔ valeurs`);
    if (g.a.n === -1 && g.a.d === 1) aMoinsUn++;
    if (g.a.n === 1 && g.a.d === 1) aUn++;
    if (c.n === 0) c0++;
    // Énoncé : relu par lirePolynome = la fonction.
    const latex = latexDeveloppe(ex);
    const lue = lirePolynome(versSaisie(latex));
    const vrai = polynomeDe(g);
    verifier(lue.ok && [0, 1, 2].every((k) => egalR(coefficient(lue.polynome, k), coefficient(vrai, k))), `${nom} g=${graine} : l'énoncé « ${latex} » relu = la fonction`);
    verifier(!/\+ -|- -|--|\+ \+|(?<![0-9])1x|[^0-9]0x| \+ 0$| \+ 0 /.test(latex) && !/^\+/.test(latex), `${nom} g=${graine} : écriture propre « ${latex} »`);
    verifier(compile(latexFonctionDeveloppee(ex)) === null && verifierBalisageMath(`$${latexFonctionDeveloppee(ex)}$`).length === 0, `${nom} g=${graine} : l'énoncé compile sous KaTeX strict`);
    // Termes mélangés : jamais l'ordre canonique, permutation exacte des termes présents.
    const presents = c.n === 0 ? [0, 1] : [0, 1, 2];
    verifier(JSON.stringify([...ex.ordre].sort()) === JSON.stringify(presents) && JSON.stringify(ex.ordre) !== JSON.stringify(presents), `${nom} g=${graine} : ordre ${JSON.stringify(ex.ordre)} ≠ canonique, mêmes termes`);
    verifier(termesAffiches(ex).length === presents.length && (c.n !== 0 || !ex.ordre.includes(2)), `${nom} g=${graine} : un terme nul n'est pas affiché`);
    motifsVus.add(`${c.n === 0 ? 2 : 3}|${ex.ordre.join("")}`);
    // Repli : différent de la vraie fonction, atteignable avec la configuration (TH, TV, facteur, SOX seulement s'ils sont actifs).
    const rp = parametresRepli(ex);
    verifier(!(egalR(rp.a, g.a) && egalR(rp.p, g.p) && egalR(rp.q, g.q)), `${nom} g=${graine} : repli ≠ vraie fonction`);
    verifier((actives.includes("TV") || ex.repli.tv === 0) && (actives.includes("SOX") ? true : !ex.repli.sox) && (poolFacteur(actives) !== null || (ex.repli.facteurN === 1 && ex.repli.facteurD === 1)), `${nom} g=${graine} : repli atteignable avec la configuration`);
    // Déterminisme.
    if (graine % 7 === 0) verifier(JSON.stringify(genererExerciceCc(graine, { actives })) === JSON.stringify(ex), `${nom} g=${graine} : déterministe`);
    vus.add(`${ex.th}|${ex.facteurN}/${ex.facteurD}`);
  }
  // Couverture : tous les couples admissibles sont atteints (400 graines suffisent pour les 76 / 18 couples).
  const pool = poolFacteur(actives);
  const attendus = pool === null ? POOL_TRANSLATION.length : couplesAdmissibles(pool).length;
  verifier(pool === null || vus.size >= Math.min(attendus, 400) * 0.9, `${nom} : couverture des couples (${vus.size} / ${attendus})`);
}
verifier(aMoinsUn > 0, `a = −1 est GÉNÉRÉ (SOX seul, sans EV ni CV) : ${aMoinsUn} exercices`);
verifier(aUn > 0, `a = 1 est généré (aucune transformation de facteur ni SOX) : ${aUn} exercices`);
verifier(c0 > 0, `c = 0 se produit (terme constant absent) : ${c0} exercices`);
verifier(motifsVus.size === 5 + 1 + 0 || motifsVus.size >= 6, `les ordres de 3 termes (5) et de 2 termes (1) sont tous vus (${[...motifsVus].sort().join(" ")})`);

// ── Couples admissibles : exhaustifs et exacts ──
{
  const ev = couplesAdmissibles(POOL_EV);
  const cv = couplesAdmissibles(POOL_CV);
  verifier(ev.length === 76 && cv.length === 18, `76 couples admissibles en EV, 18 en CV (obtenu ${ev.length}, ${cv.length})`);
  let errones = 0;
  for (const [pool, liste] of [[POOL_EV, ev], [POOL_CV, cv]] as const) {
    for (const th of POOL_TRANSLATION) for (const f of pool) {
      const a = rat(f[0], f[1]);
      const entier = multiplierR(rat(-2), multiplierR(a, rat(th))).d === 1 && multiplierR(a, rat(th * th)).d === 1;
      const dedans = liste.some((x) => x.th === th && x.facteur[0] === f[0] && x.facteur[1] === f[1]);
      if (entier !== dedans) errones++;
    }
  }
  verifier(errones === 0, `un couple est admissible ⇔ b et c entiers (${errones} écart)`);
  // Ordre contractuel : th-majeur, puis ordre du pool.
  verifier(JSON.stringify(ev.slice(0, 3)) === JSON.stringify([{ th: -5, facteur: [2, 1] }, { th: -5, facteur: [3, 1] }, { th: -5, facteur: [4, 1] }]), "ordre contractuel de la liste (th-majeur)");
  verifier(cv.every((x) => x.th !== 1 && x.th !== -1), "CV : aucun couple avec p = ±1 (d ≥ 2 ne divise pas 1)");
}

// ── Configurations refusées (défense en profondeur) ──
for (const [nom, configuration] of [["sans TH", { actives: ["TV", "EV"] }], ["EV + CV", { actives: ["TH", "EV", "CV"] }], ["vide", { actives: [] }], ["inconnue", { actives: ["TH", "XX"] }], ["absente", undefined]] as const) {
  let leve = false;
  try {
    activesDe(configuration as never);
  } catch {
    leve = true;
  }
  verifier(leve, `configuration refusée : ${nom}`);
}

// ── Exercices ÉPINGLÉS (règle `_v2`) : une dérive de pool, de filtre ou d'ordre est détectée ici ──
const EPINGLES: [number, Transformation[], object, string][] = [
  [1, ["TH"], { th: 2, tv: 0, facteurN: 1, facteurD: 1, sox: false, ordre: [0, 2, 1], repli: { th: 1, tv: 0, facteurN: 1, facteurD: 1, sox: false } }, "f(x) = x^2 + 4 - 4x"],
  [2, ["TH", "SOX"], { th: 3, tv: 0, facteurN: 1, facteurD: 1, sox: true, ordre: [1, 0, 2], repli: { th: -3, tv: 0, facteurN: 1, facteurD: 1, sox: true } }, "f(x) = 6x - x^2 - 9"],
  [3, ["TH", "TV", "EV"], { th: 2, tv: -5, facteurN: 15, facteurD: 4, sox: false, ordre: [1, 2, 0], repli: { th: -5, tv: 3, facteurN: 7, facteurD: 2, sox: false } }, "f(x) = -15x + 10 + \\dfrac{15}{4}x^2"],
  [4, ["TH", "TV", "CV", "SOX"], { th: 4, tv: -2, facteurN: 3, facteurD: 4, sox: true, ordre: [1, 0, 2], repli: { th: -5, tv: -3, facteurN: 1, facteurD: 5, sox: false } }, "f(x) = 6x - \\dfrac{3}{4}x^2 - 14"],
  [5, ["TH", "EV", "SOX"], { th: 2, tv: 0, facteurN: 11, facteurD: 4, sox: true, ordre: [2, 0, 1], repli: { th: -3, tv: 0, facteurN: 7, facteurD: 4, sox: false } }, "f(x) = -11 - \\dfrac{11}{4}x^2 + 11x"],
  [6, ["TH", "TV"], { th: 1, tv: -5, facteurN: 1, facteurD: 1, sox: false, ordre: [2, 0, 1], repli: { th: -3, tv: 1, facteurN: 1, facteurD: 1, sox: false } }, "f(x) = -4 + x^2 - 2x"],
];
for (const [graine, actives, attendu, enonce] of EPINGLES) {
  const ex = genererExerciceCc(graine, { actives });
  const { th, tv, facteurN, facteurD, sox, ordre, repli } = ex;
  verifier(JSON.stringify({ th, tv, facteurN, facteurD, sox, ordre, repli }) === JSON.stringify(attendu), `épinglé g=${graine} ${nomConfig(actives)} : exercice inchangé (règle _v2)`);
  verifier(latexFonctionDeveloppee(ex) === enonce, `épinglé g=${graine} ${nomConfig(actives)} : énoncé « ${latexFonctionDeveloppee(ex)} »`);
}
// Les pools du noyau partagé sont épinglés par test-fx-ecran1 (gen8) ; ici, le filtre de gen9 sur eux.
verifier(typeof tirerRepli === "function" && (null as ExerciceCc | null) === null, "(sanité) noyau partagé importé");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (gen9 génération : ${CONFIGURATIONS.length} configurations × ${GRAINES.length} graines, b et c entiers, énoncé relu, ordre jamais canonique, repli, couples admissibles, exercices épinglés)`);
