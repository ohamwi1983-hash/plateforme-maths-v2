// Test permanent — gen9 « Complète le carré », aide de l'écran 1 à DEUX paliers (RAPPORT §59) : `src/generateurs/completionDuCarre/aide.ts`. Sur 12 configurations × 400 graines : l'aide est
// valide (`validerAide`), a exactement deux paliers ; le palier 1 est ÉQUIVALENT à f (relu par `lirePolynome` : il ne montre rien de plus que l'énoncé) avec rôles a et c seulement ; le palier 2 est
// IDENTIQUE pour tous les exercices (symbolique : aucune valeur propre à l'exercice) et porte l'emphase sur (b/2a)² ; le serveur ne sert qu'un palier à la fois ; tout compile sous KaTeX strict.
// Lancer : `npm run test-gen9-aide`. Sans réseau.

export {}; // module

import { join } from "node:path";
import { aideAPaliers, aideAuPalier, nombrePaliers, validerAide, type AideFormuleAPaliers, type SegmentFormule } from "../lib/aideTypee";
import { aideFormeCanonique, SEGMENTS_PALIER_2 } from "../src/generateurs/completionDuCarre/aide";
import { genererExerciceCc } from "../src/generateurs/completionDuCarre/generation";
import { parametres } from "../src/generateurs/completionDuCarre/types";
import { lirePolynome, egalP } from "../src/generateurs/_noyauQuadratique/polynome";
import { polynomeDe, type Transformation } from "../src/generateurs/_noyauQuadratique/types";
import { assemblerFormuleColoree, verifierBalisageMath } from "./support/texteMath";

/* eslint-disable @typescript-eslint/no-require-imports */
const katex = require(join(__dirname, "..", "public", "vendor", "katex-0.18.9", "katex.min.js")) as { renderToString(latex: string, options: Record<string, unknown>): string };

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const CONFIGURATIONS: Transformation[][] = [];
for (const tv of [false, true]) for (const facteur of [null, "EV", "CV"] as const) for (const sox of [false, true]) CONFIGURATIONS.push(["TH", ...(tv ? ["TV" as const] : []), ...(facteur ? [facteur] : []), ...(sox ? ["SOX" as const] : [])]);
const GRAINES = Array.from({ length: 400 }, (_, i) => 7 + i * 131);

/** Compilation sous les réglages du moteur : strict, et seuls `moteur-coef-a|b|c` / `moteur-emphase` admis comme classes. */
function compile(latex: string): string | null {
  try {
    katex.renderToString(latex, {
      throwOnError: true,
      displayMode: false,
      strict: (code: string) => (code === "htmlExtension" ? "ignore" : "error"),
      trust: (c: { command?: string; class?: string }) => c.command === "\\htmlClass" && /^(moteur-coef-[abc]|moteur-emphase)$/.test(c.class ?? ""),
    });
    return null;
  } catch (e) {
    return String(e);
  }
}

/** Segments -> saisie lisible par `lirePolynome` (palier 1 seulement : numérique). */
const versSaisie = (segments: readonly SegmentFormule[]): string =>
  segments
    .map((s) => s.latex)
    .join("")
    .replace(/^f\(x\) = /, "")
    .replace(/\\left|\\right/g, "")
    .replace(/\\dfrac\{(\d+)\}\{(\d+)\}/g, "($1/$2)");

const palier2 = JSON.stringify(SEGMENTS_PALIER_2);
let aides = 0;
for (const config of CONFIGURATIONS) {
  for (const graine of GRAINES) {
    const ex = genererExerciceCc(graine, { actives: config });
    const aide = aideFormeCanonique(ex);
    aides++;
    verifier(validerAide(aide).length === 0, `aide valide (${config.join("+")} / ${graine}) : ${validerAide(aide).join("; ")}`);
    verifier(aideAPaliers(aide) && nombrePaliers(aide) === 2, "deux paliers");
    const paliers = (aide as AideFormuleAPaliers).paliers;
    const [p1, p2] = [paliers[0], paliers[1]];
    if (!p1 || !p2) continue;
    // Palier 1 : équivalent à f, rôles a et c seulement, aucune emphase.
    const lue = lirePolynome(versSaisie(p1.segments));
    verifier(lue.ok && egalP(lue.polynome, polynomeDe(parametres(ex))), `palier 1 équivalent à f (${config.join("+")} / ${graine}) : ${versSaisie(p1.segments)}`);
    verifier(p1.segments.every((s) => s.emphase === undefined && (s.role === undefined || s.role === "a" || s.role === "c")), "palier 1 : rôles a et c, jamais d'emphase");
    verifier(p1.segments.filter((s) => s.role === "a").length <= 1 && p1.segments.filter((s) => s.role === "c").length <= 1, "palier 1 : un segment par rôle");
    // Palier 2 : le même pour tous (donc aucune valeur de l'exercice), emphase unique.
    verifier(JSON.stringify(p2.segments) === palier2, "palier 2 identique pour tous les exercices (symbolique)");
    verifier(p2.segments.filter((s) => s.emphase === true).length === 1 && p2.segments.every((s) => !(s.emphase && s.role)), "palier 2 : une emphase, jamais avec un rôle");
    // Le serveur sert un seul palier à la fois, sans rien cumuler.
    const s1 = aideAuPalier(aide as AideFormuleAPaliers, 1);
    const s2 = aideAuPalier(aide as AideFormuleAPaliers, 2);
    verifier(s1.type === "formule_coloree" && s1.palier === 1 && s1.palierTotal === 2 && !JSON.stringify(s1).includes("emphase"), "palier 1 servi : rien du palier 2");
    verifier(s2.type === "formule_coloree" && s2.palier === 2 && JSON.stringify(s2).includes("emphase") && JSON.stringify(s2.segments) === palier2, "palier 2 servi : son schéma seul");
    if (graine % 5 === 7 % 5) {
      for (const p of [p1, p2]) {
        const erreur = compile(assemblerFormuleColoree(p.segments));
        verifier(erreur === null, `KaTeX : ${erreur}`);
        verifier(verifierBalisageMath(p.legende ?? "").length === 0, `légende sans balisage interdit : ${p.legende}`);
      }
    }
  }
}
verifier(aides === 12 * 400, "toutes les aides construites");
// Exemple épinglé : f(x) = 2x² − 12x + 19 = 2(x − 3)² + 1 (TH, TV, EV).
{
  const base = genererExerciceCc(7, { actives: ["TH", "TV", "EV"] });
  const ex = { ...base, th: 3, tv: 1, facteurN: 2, facteurD: 1, sox: false };
  const p1 = (aideFormeCanonique(ex) as AideFormuleAPaliers).paliers[0];
  verifier(versSaisie(p1?.segments ?? []).replace(/ /g, "") === "2(x^2-6x)+19", `palier 1 épinglé : 2(x^2 - 6x) + 19 (reçu ${versSaisie(p1?.segments ?? [])})`);
}

if (echecs.length > 0) {
  console.error(`✗ ${echecs.length} échec(s) sur ${nb} vérifications :\n${echecs.join("\n")}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (gen9 aide : ${aides} aides, deux paliers, palier 1 équivalent à f, palier 2 symbolique et identique, un palier servi à la fois, KaTeX strict)`);
