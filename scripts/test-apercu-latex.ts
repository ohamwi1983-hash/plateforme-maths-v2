// Test permanent — aperçu LaTeX de la saisie d'un élève (RAPPORT §58) : `public/moteur/apercuLatex.js`. Un AFFICHAGE : la saisie (texte d'ÉLÈVE) n'est jamais interprétée comme du
// LaTeX ; le LaTeX rendu est construit à partir d'un jeu fermé de jetons. Propriétés : jamais d'exception, LaTeX toujours compilable par KaTeX (réglages stricts, y compris pour chaque
// PRÉFIXE d'une saisie — l'élève tape caractère par caractère), aucune commande hors d'une liste fermée (donc aucune couleur, aucun lien, aucune image), tout `$` échappé, accolades
// équilibrées, nombres adjacents jamais fusionnés. Lancer : `npm run test-apercu-latex`. Sans réseau, sans navigateur.

export {}; // module

import { join } from "node:path";
import { commandesInterditesDans } from "../lib/balisageMath";
import { creerPrng } from "../lib/prng";
import { apercuComplet, versLatexApercu } from "./support/apercuLatex";

/* eslint-disable @typescript-eslint/no-require-imports */
const katex = require(join(__dirname, "..", "public", "vendor", "katex-0.18.9", "katex.min.js")) as { renderToString(latex: string, options: Record<string, unknown>): string };

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

/** Compile avec les réglages les plus stricts : `throwOnError`, aucune commande de confiance, tout avertissement = erreur. */
function compile(latex: string): string | null {
  try {
    katex.renderToString(latex, { throwOnError: true, displayMode: false, trust: () => false, strict: "error" });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// Commandes que l'aperçu a le droit d'émettre (liste FERMÉE) : tout le reste serait une injection.
const COMMANDES_AUTORISEES = new Set(["left", "right", "dfrac", "cdot", "mathrm", "text", "backslash", "sim", "wedge", "square", ",", "$", "{", "}", "%", "#", "&", "_"]);
const commandesDe = (latex: string): string[] => [...latex.matchAll(/\\([A-Za-z]+|[^A-Za-z])/g)].map((m) => m[1] as string);

function controles(saisie: string): void {
  let latex: string;
  try {
    latex = versLatexApercu(saisie);
  } catch (e) {
    verifier(false, `exception sur « ${JSON.stringify(saisie).slice(0, 60)} » : ${(e as Error).message}`);
    return;
  }
  const erreur = compile(`f(x)=${latex}`);
  verifier(erreur === null, `non compilable : « ${JSON.stringify(saisie).slice(0, 60)} » -> ${latex.slice(0, 80)} : ${erreur}`);
  const inconnues = commandesDe(latex).filter((c) => !COMMANDES_AUTORISEES.has(c));
  verifier(inconnues.length === 0, `commande hors liste (${inconnues.join(",")}) pour « ${JSON.stringify(saisie).slice(0, 60)} »`);
  verifier(commandesInterditesDans(latex).length === 0, `commande interdite côté serveur pour « ${JSON.stringify(saisie).slice(0, 60)} »`);
  verifier(!/(?<!\\)\$/.test(latex), `« $ » non échappé pour « ${JSON.stringify(saisie).slice(0, 60)} »`);
  let profondeur = 0;
  let ok = true;
  for (let i = 0; i < latex.length; i++) {
    if (latex[i] === "\\") {
      i++; // le caractère échappé ne compte pas
      continue;
    }
    if (latex[i] === "{") profondeur++;
    if (latex[i] === "}") profondeur--;
    if (profondeur < 0) ok = false;
  }
  verifier(ok && profondeur === 0, `accolades déséquilibrées pour « ${JSON.stringify(saisie).slice(0, 60)} » : ${latex.slice(0, 80)}`);
}

// ── 1. Cas fixés ──
const CAS: [string, string][] = [
  ["", ""],
  ["x", "x"],
  ["2x^2", "2x^{2}"],
  ["x²", "x^{2}"],
  ["2(x-3)^2+1", "2\\left(x-3\\right)^{2}+1"],
  ["2 (x - 3) ^ 2 + 1", "2\\left(x-3\\right)^{2}+1"],
  ["-(x+1)^2-1", "-\\left(x+1\\right)^{2}-1"],
  ["1/2x^2", "\\dfrac{1}{2}x^{2}"],
  ["(1/2)(x-1)^2", "\\left(\\dfrac{1}{2}\\right)\\left(x-1\\right)^{2}"],
  ["3/4*(x+2)^2", "\\dfrac{3}{4}\\cdot \\left(x+2\\right)^{2}"],
  ["2*x", "2\\cdot x"],
  ["2×x", "2\\cdot x"],
  ["0,25x+0.5", "0{,}25x+0.5"],
  ["x−3", "x-3"],
  ["x^(-2)", "x^{\\left(-2\\right)}"],
  ["x^-2", "x^{-2}"],
  ["(x-", "\\left(x-\\right."],
  ["2(x-3", "2\\left(x-3\\right."],
  ["x^", "x^{}"],
  ["1/", "\\dfrac{1}{}"],
  ["2 3", "2\\,3"],
  ["f(x)=2x", "f\\left(x\\right)=2x"],
  ["a$b", "a\\$b"],
  ["\\textcolor{red}{x}", "\\backslash \\mathrm{textcolor}\\{\\mathrm{red}\\}\\{x\\}"],
  ["sqrt(2)", "\\mathrm{sqrt}\\left(2\\right)"],
  ["x^2^3", "{x^{2}}^{3}"],
  ["x²³", "{x^{2}}^{3}"],
  ["x)", "x)"],
  ["))", "))"],
];
for (const [saisie, attendu] of CAS) verifier(versLatexApercu(saisie) === attendu, `cas fixé « ${saisie} » : attendu ${attendu}, obtenu ${versLatexApercu(saisie)}`);
verifier(apercuComplet("f(x) =", "") === "f(x) =" && apercuComplet("f(x) =", "2x") === "f(x) =\\,2x", "libellé d'auteur suivi de la saisie");
for (const [saisie] of CAS) controles(saisie);

// ── 2. L'élève tape caractère par caractère : CHAQUE préfixe compile ──
const MODELES = [
  "2(x-3)^2+1", "-(x+1)^2-1", "1/2(x-1)^2+3", "3/4*(x+2)^2-5/2", "(x-2)^2", "x^2+4", "-2x^2+8x-6", "0,5(x-4)^2", "(1/3)(x+2)^2", "x²-4x+4", "2x(x-4)", "(x-3)(x+3)", "4(x-1/2)^2+7/4",
  "f(x)=2(x-3)^2+1", "y = 3 (x - 2)^2 - 1", "−(x−1)²+2", "2x^2-12x+19", "5/2(x+1)^2-9/2", "((x-1)^2)", "x^(1/2)", "2.5(x-1.5)^2",
];
for (const m of MODELES) for (let k = 0; k <= m.length; k++) controles(m.slice(0, k));

// ── 3. Fuzz : alphabet hostile (signes, backslash, dollar, accolades, unicode, contrôles, paires de substitution) ──
const prng = creerPrng(58);
const ALPHABET = Array.from("0123456789xXyf+-*/^=() ,.;:!?<>|'\"`@[]{}\\$%#&_~²³⁴×·−–—éèçàΩπ∞😀\u0000\u0007\u0085\u2028\t\n").concat(["sqrt", "textcolor", "\\color", "\\href", "\\includegraphics", "$$", "^^", "((", "))"]);
for (let i = 0; i < 6000; i++) {
  const n = prng.entierEntre(0, 24);
  controles(Array.from({ length: n }, () => prng.choisir(ALPHABET)).join(""));
}
// Longueurs et imbrications démesurées : bornées, sans exception.
controles("(".repeat(500));
controles("(x+".repeat(60) + ")".repeat(60));
controles("x^".repeat(300));
controles("9".repeat(5000));
verifier(versLatexApercu("9".repeat(5000)).length < 2000, "saisie démesurée : l'aperçu est borné");
// Types hostiles passés par un composant défaillant : jamais d'exception.
for (const v of [undefined, null, 12, {}, []] as unknown[]) {
  try {
    versLatexApercu(v as string);
    verifier(true, "type inattendu toléré");
  } catch {
    verifier(false, `type inattendu non toléré : ${JSON.stringify(v)}`);
  }
}
// Pas d'injection par construction : aucune sortie ne contient jamais une commande de couleur, quelle que soit la saisie.
for (const dangereux of ["\\textcolor{red}{x}", "\\color{red}x", "\\href{http://x}{y}", "\\htmlClass{moteur-coef-a}{x}", "$\\textcolor{red}{x}$", "\\\\", "}{"]) {
  const l = versLatexApercu(dangereux);
  verifier(!/\\(textcolor|color|href|htmlClass|includegraphics|url)\b/.test(l), `injection impossible : ${dangereux} -> ${l}`);
  verifier(compile(l) === null, `saisie dangereuse compilable : ${dangereux}`);
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (aperçu LaTeX : cas fixés, chaque préfixe de ${MODELES.length} saisies, 6000 chaînes hostiles, commandes en liste fermée, aucune injection)`);
