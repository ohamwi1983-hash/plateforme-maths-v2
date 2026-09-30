// Test permanent — phase 2 §E : le design system reste (1) fidèle à sa documentation et (2) le seul
// vocabulaire des composants d'écran du moteur.
//  - les 36 tokens de `:root` (public/style.css) et le tableau de docs/design-system.md sont
//    identiques (mêmes noms, mêmes valeurs, aucun token non documenté ni fantôme) ;
//  - public/moteur/ecrans.css n'utilise que des `var(--token)` existants : aucune couleur, police,
//    rayon ni longueur en dur (exceptions documentées : 0, 1px, 2px, 100%, em) ;
//  - phase 3b-1 : les 3 tokens de surbrillance `--coef-a|b|c` sont RÉSERVÉS (usage limité à `.moteur-coef-*`)
//    et leur contraste est CALCULÉ ici (WCAG ≥ 4,5:1 sur tous les fonds de carte) : le contraste est un test permanent.
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

const NB_TOKENS = 36;
verifier(tokensCss.size === NB_TOKENS, `:root doit contenir exactement ${NB_TOKENS} tokens, trouvé ${tokensCss.size}`);

const doc = readFileSync(join(RACINE, "docs/design-system.md"), "utf8");
const tokensDoc = new Map<string, string>();
for (const m of doc.matchAll(/^\|\s*`(--[a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|/gm)) tokensDoc.set(m[1], m[2]);
verifier(tokensDoc.size === NB_TOKENS, `docs/design-system.md doit documenter exactement ${NB_TOKENS} tokens, trouvé ${tokensDoc.size}`);
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
for (const m of ecrans.matchAll(/border-radius:\s*([^;]+);/g)) verifier(/var\(--radius(-sm)?\)/.test(m[1]) || m[1].trim() === "50%", `ecrans.css : border-radius en dur « ${m[1].trim()} »`);
// Alias locaux (`--etat-*`) : autorisés SEULEMENT s'ils sont définis exclusivement par `var(--token)` existant.
const aliasLocaux = new Set<string>();
for (const m of ecrans.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) {
  aliasLocaux.add(m[1]);
  verifier(/^var\((--[a-z0-9-]+)\)$/.test(m[2].trim()) && tokensCss.has(m[2].trim().slice(4, -1)), `ecrans.css : alias local ${m[1]} défini par « ${m[2].trim()} » (attendu : var(--token) existant)`);
}
for (const m of ecrans.matchAll(/var\((--[a-z0-9-]+)\)/g)) verifier(tokensCss.has(m[1]) || aliasLocaux.has(m[1]), `ecrans.css : token inconnu ${m[1]}`);
verifier(/box-shadow:\s*var\(--ombre-carte\)/.test(ecrans), "ecrans.css : la carte d'écran doit utiliser var(--ombre-carte)");
for (const m of ecrans.matchAll(/box-shadow:\s*([^;]+);/g)) verifier(/^(none|var\(--ombre-carte\)|var\(--ombre-bouton\)|inset 0 0 0 1px var\(--[a-z0-9-]+\))$/.test(m[1].trim()), `ecrans.css : box-shadow non conforme « ${m[1].trim()} »`);
for (const m of ecrans.matchAll(/(?<![\w-])(margin|padding|gap)(-[a-z]+)?:\s*([^;]+);/g)) {
  const valeurs = m[3].trim().split(/\s+/);
  verifier(valeurs.every((v) => v === "0" || v === "auto" || v === "1px" || v === "2px" || v.startsWith("var(--espace-") || v.startsWith("calc(")), `ecrans.css : ${m[1]}${m[2] ?? ""} en dur « ${m[3].trim()} »`);
}

// ── Tokens de surbrillance des coefficients (phase 3b-1) : réservés + contraste calculé ──
const tokensCoef = [...tokensCss.keys()].filter((n) => n.startsWith("--coef-"));
verifier(tokensCoef.length === 3 && ["--coef-a", "--coef-b", "--coef-c"].every((n) => tokensCoef.includes(n)), `au plus 3 tokens de surbrillance, exactement --coef-a/b/c : trouvé ${tokensCoef.join(", ")}`);
const luminance = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const SEUIL_CONTRASTE = 4.5;
const FONDS_DE_CARTE = ["--surface", "--surface-sunken", "--ambre-clair", "--violet-clair", "--vert-clair", "--danger-clair"];
for (const coef of tokensCoef) {
  const couleur = tokensCss.get(coef) ?? "";
  verifier(/^#[0-9A-Fa-f]{6}$/.test(couleur), `${coef} doit être une couleur hexadécimale à 6 chiffres, trouvé « ${couleur} »`);
  for (const fond of FONDS_DE_CARTE) {
    const valeurFond = tokensCss.get(fond) ?? "";
    verifier(/^#[0-9A-Fa-f]{6}$/.test(valeurFond), `${fond} doit être une couleur hexadécimale pour le calcul de contraste`);
    if (/^#[0-9A-Fa-f]{6}$/.test(couleur) && /^#[0-9A-Fa-f]{6}$/.test(valeurFond)) {
      const r = ratio(couleur, valeurFond);
      verifier(r >= SEUIL_CONTRASTE, `${coef} (${couleur}) sur ${fond} (${valeurFond}) : contraste ${r.toFixed(2)}:1 < ${SEUIL_CONTRASTE}:1`);
    }
  }
}
// Réservés : chaque `var(--coef-x)` d'ecrans.css est dans une règle `.moteur-coef-x` (et seulement là).
for (const regle of ecrans.split("}")) {
  const [selecteur, corps] = [regle.slice(0, Math.max(0, regle.indexOf("{"))).trim(), regle.slice(regle.indexOf("{") + 1)];
  for (const m of corps.matchAll(/var\((--coef-[abc])\)/g)) {
    verifier(selecteur === `.moteur-coef-${m[1].slice(-1)}`, `ecrans.css : ${m[1]} n'est réservé qu'à .moteur-coef-${m[1].slice(-1)} (trouvé dans « ${selecteur} »)`);
  }
}
verifier(["a", "b", "c"].every((x) => new RegExp(`\\.moteur-coef-${x}\\s*\\{[^}]*color:\\s*var\\(--coef-${x}\\)`).test(ecrans)), "ecrans.css : .moteur-coef-a|b|c doivent colorer le texte avec leur token");
verifier(![...css.matchAll(/var\(--coef-/g)].length, "style.css : aucun usage de --coef-* hors ecrans.css");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(" - " + e);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (${NB_TOKENS} tokens :root == docs/design-system.md, ecrans.css n'utilise que des tokens, contraste des tokens --coef-* calculé)`);
