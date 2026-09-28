// Test permanent — phase 2 §E : le design system reste (1) fidèle à sa documentation et (2) le seul
// vocabulaire des composants d'écran du moteur.
//  - les 32 tokens de `:root` (public/style.css) et le tableau de docs/design-system.md sont
//    identiques (mêmes noms, mêmes valeurs, aucun token non documenté ni fantôme) ;
//  - public/moteur/ecrans.css n'utilise que des `var(--token)` existants : aucune couleur, police,
//    rayon ni longueur en dur (exceptions documentées : 0, 1px, 2px, 100%, em).
// Lancer : `npx tsx scripts/test-design-system.ts`.

export {}; // module

import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..");
const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const css = readFileSync(join(RACINE, "public/style.css"), "utf8");
const debut = css.indexOf(":root {");
const fin = css.indexOf("\n}\n", debut);
const bloc = css.slice(debut, fin).replace(/\/\*[\s\S]*?\*\//g, "");
const tokensCss = new Map<string, string>();
for (const m of bloc.matchAll(/^\s*(--[a-z0-9-]+):\s*(.+?);\s*$/gm)) tokensCss.set(m[1], m[2]);

verifier(tokensCss.size === 32, `:root doit contenir exactement 32 tokens, trouvé ${tokensCss.size}`);

const doc = readFileSync(join(RACINE, "docs/design-system.md"), "utf8");
const tokensDoc = new Map<string, string>();
for (const m of doc.matchAll(/^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|/gm)) tokensDoc.set(m[1], m[2]);
verifier(tokensDoc.size === 32, `docs/design-system.md doit documenter exactement 32 tokens, trouvé ${tokensDoc.size}`);
for (const [nom, valeur] of tokensCss) {
  verifier(tokensDoc.has(nom), `token ${nom} absent de docs/design-system.md`);
  verifier(!tokensDoc.has(nom) || tokensDoc.get(nom) === valeur, `token ${nom} : valeur documentée « ${tokensDoc.get(nom)} » ≠ valeur CSS « ${valeur} »`);
}
for (const nom of tokensDoc.keys()) verifier(tokensCss.has(nom), `token documenté ${nom} absent de :root`);

// ── Composants d'écran : uniquement des tokens ──
const ecrans = readFileSync(join(RACINE, "public/moteur/ecrans.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
verifier(ecrans.length > 500, "public/moteur/ecrans.css vide ou introuvable");
verifier(!/#[0-9a-fA-F]{3,8}\b/.test(ecrans), "ecrans.css : couleur hexadécimale en dur");
verifier(!/\b(rgb|rgba|hsl|hsla)\(/.test(ecrans), "ecrans.css : couleur rgb()/hsl() en dur");
for (const m of ecrans.matchAll(/font-family:\s*([^;]+);/g)) verifier(/^var\(--font-(corps|marque)\)$/.test(m[1].trim()), `ecrans.css : font-family en dur « ${m[1].trim()} »`);
for (const m of ecrans.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)px\b/g)) verifier(m[1] === "1" || m[1] === "2" || m[1] === "0", `ecrans.css : longueur en dur « ${m[0]} » (utiliser l'échelle --espace-* ou --radius*)`);
verifier(!/\brem\b|\d+rem\b/.test(ecrans), "ecrans.css : unité rem en dur");
for (const m of ecrans.matchAll(/border-radius:\s*([^;]+);/g)) verifier(/var\(--radius(-sm)?\)/.test(m[1]), `ecrans.css : border-radius en dur « ${m[1].trim()} »`);
// Alias locaux (`--etat-*`) : autorisés SEULEMENT s'ils sont définis exclusivement par `var(--token)` existant.
const aliasLocaux = new Set<string>();
for (const m of ecrans.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) {
  aliasLocaux.add(m[1]);
  verifier(/^var\((--[a-z0-9-]+)\)$/.test(m[2].trim()) && tokensCss.has(m[2].trim().slice(4, -1)), `ecrans.css : alias local ${m[1]} défini par « ${m[2].trim()} » (attendu : var(--token) existant)`);
}
for (const m of ecrans.matchAll(/var\((--[a-z0-9-]+)\)/g)) verifier(tokensCss.has(m[1]) || aliasLocaux.has(m[1]), `ecrans.css : token inconnu ${m[1]}`);
verifier(/box-shadow:\s*var\(--ombre-carte\)/.test(ecrans), "ecrans.css : la carte d'écran doit utiliser var(--ombre-carte)");
for (const m of ecrans.matchAll(/box-shadow:\s*([^;]+);/g)) verifier(/^(none|var\(--ombre-carte\)|inset 0 0 0 1px var\(--[a-z0-9-]+\))$/.test(m[1].trim()), `ecrans.css : box-shadow non conforme « ${m[1].trim()} »`);
for (const m of ecrans.matchAll(/(?<![\w-])(margin|padding|gap)(-[a-z]+)?:\s*([^;]+);/g)) {
  const valeurs = m[3].trim().split(/\s+/);
  verifier(valeurs.every((v) => v === "0" || v === "auto" || v.startsWith("var(--espace-") || v.startsWith("calc(")), `ecrans.css : ${m[1]}${m[2] ?? ""} en dur « ${m[3].trim()} »`);
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(" - " + e);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (32 tokens :root == docs/design-system.md, ecrans.css n'utilise que des tokens)`);
