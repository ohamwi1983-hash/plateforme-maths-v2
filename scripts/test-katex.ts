// Test permanent — KaTeX 0.18.9 vendoré et son emploi (phase 3b-3, commit 4). Sans réseau, sans navigateur (le rendu DOM est couvert par
// `npm run chromium-temoin`). Lancer : `npm run test-katex`.
//  1. intégrité : version, sha256 de chaque fichier du dossier vendoré, identité octet pour octet avec `node_modules/katex` ;
//  2. réglages de rendu (`reglagesKatex`, public/moteur/rendreTexte.js) : `trust` refuse toute commande de confiance hors `roles`, et pour
//     `roles` n'accepte que `\htmlClass{moteur-coef-a|b|c}` ;
//  3. assemblage de `formule_coloree` en UNE chaîne : exactement une classe par rôle, aucune classe ne vient d'un segment ;
//  4. GARDE : tout texte d'auteur de gen7 (consignes, libellés, aides, solutions, messages d'erreur) compile avec `throwOnError: true`,
//     sans commande refusée, sur N graines et les quatre catégories ; les commandes de couleur restent arrêtées par le serveur.

export {}; // module

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { commandesInterditesDans } from "../lib/balisageMath";
import { validerAide } from "../lib/aideTypee";
import type { EcranDeclare } from "../lib/contratGenerateur";
import { assemblerFormuleColoree, decouperTexteMath, verifierBalisageMath } from "./support/texteMath";
import { textesAuteurDe } from "./support/textesAuteur";
import {
  aideFormuleColoree,
  champsAnalyseFonction,
  ecransAnalyseFonction,
  genererExercice,
  projeterAnalyseFonction,
  reponseBruteCorrecteAnalyseFonction,
  solutionAttendueAnalyseFonction,
  verifierAnalyseFonction,
  type CategorieAnalyseFonction,
} from "../src/generateurs/analyseFonction";

/* eslint-disable @typescript-eslint/no-require-imports */
const DOSSIER = join(__dirname, "..", "public", "vendor", "katex-0.18.9");
const katex = require(join(DOSSIER, "katex.min.js")) as {
  version: string;
  renderToString(latex: string, options: Record<string, unknown>): string;
};
const { reglagesKatex } = require("../public/moteur/rendreTexte.js") as {
  reglagesKatex(roles: boolean): { reglages: Record<string, unknown>; refuse: () => boolean };
};
/* eslint-enable @typescript-eslint/no-require-imports */

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

/** Rend `latex` avec les réglages de production ; `ok` faux = repli en source (erreur KaTeX OU commande refusée). */
function rendre(latex: string, roles = false): { ok: boolean; html: string } {
  const { reglages, refuse } = reglagesKatex(roles);
  try {
    const html = katex.renderToString(latex, reglages);
    return { ok: !refuse(), html };
  } catch {
    return { ok: false, html: "" };
  }
}
const classesDe = (html: string): string[] => [...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => (m[1] as string).split(/\s+/));

// ── 1. Intégrité du dossier vendoré ──
// Empreintes des fichiers de KaTeX 0.18.9 tels que publiés par npm (`katex@0.18.9/dist`), recopiés sans modification.
const EMPREINTES: Record<string, string> = {
  "katex.min.js": "155f6c2d673c5912e3b48f45d8830eaad18ae1953915939ceb648ea8b9c3e7e2",
  "katex.min.css": "b9ce0e8ce93f0c18c4986fe1f1c3c269d921b56a69e6c97f83a507916b38aab5",
  LICENSE: "766ccc1f306c885aa45542a9846bbd0a505b27a0374f146778171c2254ce18e3",
};
const sha = (chemin: string): string => createHash("sha256").update(readFileSync(chemin)).digest("hex");
function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}
verifier(katex.version === "0.18.9", `version de KaTeX : 0.18.9 attendue, obtenu ${katex.version}`);
for (const [nom, empreinte] of Object.entries(EMPREINTES)) verifier(sha(join(DOSSIER, nom)) === empreinte, `${nom} : empreinte sha256 modifiée (le dossier vendoré ne se modifie pas à la main)`);
{
  const upstream = join(__dirname, "..", "node_modules", "katex");
  const vendores = fichiers(DOSSIER).map((f) => relative(DOSSIER, f)).sort();
  verifier(vendores.length === 3 + 20, `dossier vendoré : 3 fichiers + 20 polices woff2 attendus, obtenu ${vendores.length}`);
  verifier(vendores.filter((f) => f.startsWith("fonts/")).every((f) => f.endsWith(".woff2")), "polices : uniquement woff2");
  for (const f of vendores) {
    const source = f === "LICENSE" ? join(upstream, "LICENSE") : join(upstream, "dist", f);
    verifier(sha(join(DOSSIER, f)) === sha(source), `${f} : différent de node_modules/katex@0.18.9 (le dossier vendoré doit rester identique à la source publiée)`);
  }
  const css = readFileSync(join(DOSSIER, "katex.min.css"), "utf8");
  const polices = [...css.matchAll(/url\(fonts\/([^)]+\.woff2)\)/g)].map((m) => m[1] as string);
  verifier(polices.length === 20 && polices.every((p) => vendores.includes(`fonts/${p}`)), "toute police woff2 citée par le CSS est présente (les repli woff/ttf ne sont volontairement pas livrés)");
}

// ── 2. Réglages de confiance ──
{
  verifier(rendre("x^2 + 3x - 1").ok && rendre("\\dfrac{1}{2}").ok && rendre("[3\\,;\\,+\\infty[").ok && rendre("\\mathrm{dom}\\,f = \\mathbb{R}").ok, "LaTeX ordinaire accepté");
  for (const interdit of ["\\htmlClass{moteur-coef-a}{3}", "\\htmlClass{x}{3}", "\\htmlStyle{color:red}{3}", "\\htmlId{a}{3}", "\\htmlData{a=b}{3}", "\\href{http://exemple.test}{3}", "\\url{http://exemple.test}", "\\includegraphics{a.png}"]) {
    verifier(!rendre(interdit).ok, `hors formule_coloree, « ${interdit} » doit être refusé (repli en source)`);
  }
  for (const autorise of ["a", "b", "c"]) {
    const r = rendre(`\\htmlClass{moteur-coef-${autorise}}{3}x`, true);
    verifier(r.ok && classesDe(r.html).includes(`moteur-coef-${autorise}`), `roles : \\htmlClass{moteur-coef-${autorise}} accepté et posé`);
  }
  for (const refuse of ["\\htmlClass{evil}{3}", "\\htmlClass{moteur-coef-d}{3}", "\\htmlClass{moteur-coef-a moteur-coef-b}{3}", "\\htmlClass{moteur-coef-a evil}{3}", "\\htmlStyle{color:red}{3}", "\\htmlId{a}{3}", "\\htmlData{a=b}{3}", "\\href{http://exemple.test}{3}"]) {
    const r = rendre(refuse, true);
    verifier(!r.ok, `roles : « ${refuse} » doit être refusé`);
  }
  // Ce que KaTeX ne bloque PAS : la couleur. C'est le serveur (liste unique de lib/balisageMath.ts) qui l'arrête.
  for (const couleur of ["\\textcolor{red}{3}", "\\color{red}3", "\\colorbox{red}{3}", "\\fcolorbox{red}{blue}{3}"]) {
    verifier(rendre(couleur).ok, `(constat) KaTeX rend « ${couleur} » : seule la liste noire serveur l'arrête`);
    verifier(commandesInterditesDans(couleur).length > 0 && verifierBalisageMath(`$${couleur}$`).length > 0, `« ${couleur} » : arrêté par lib/balisageMath.ts`);
  }
  verifier(!rendre("\\frac{1").ok && !rendre("x^").ok && !rendre("\\inconnue{3}").ok, "LaTeX invalide : erreur -> repli en source (jamais le message rouge de KaTeX)");
  const refusee = rendre("\\htmlClass{moteur-coef-a}{3}");
  verifier(!refusee.ok && refusee.html.includes("cc0000"), "(constat) une commande refusée est rendue en ROUGE par KaTeX sans lever d'erreur : le drapeau `refuse` et le repli en source sont indispensables");
}

// ── 3. Assemblage de formule_coloree ──
{
  for (const f of [{ a: 3, b: -5, c: 7 }, { a: -1, b: 1, c: -2 }, { a: 1, b: 0, c: 4 }, { a: -4, b: 16, c: -16 }]) {
    const aide = aideFormuleColoree(f);
    verifier(validerAide(aide).length === 0, `formule_coloree valide pour ${JSON.stringify(f)}`);
    const chaine = assemblerFormuleColoree((aide as { segments: { latex: string; role?: string }[] }).segments);
    const r = rendre(chaine, true);
    verifier(r.ok, `formule assemblée compilée : « ${chaine} »`);
    const classes = classesDe(r.html).filter((c) => c.startsWith("moteur-coef-"));
    const rolesAttendus = (aide as { segments: { role?: string }[] }).segments.filter((s) => s.role).map((s) => `moteur-coef-${s.role}`);
    verifier(classes.join() === rolesAttendus.join(), `une classe par rôle, dans l'ordre a, b, c : ${classes.join()} contre ${rolesAttendus.join()}`);
    verifier(!/style="[^"]*color/.test(r.html), "aucune couleur en ligne dans la formule");
  }
  verifier(assemblerFormuleColoree([{ latex: "x", role: "z" }, { latex: "+1" }]) === "x+1", "un rôle inconnu n'ajoute aucune classe");
  // Segment hostile (validerAide l'arrête déjà) : même s'il arrivait jusqu'au client, aucune classe étrangère ne sort.
  for (const hostile of ["}\\htmlClass{evil}{a", "\\htmlClass{evil}{a}", "}{\\htmlStyle{color:red}{a"]) {
    const r = rendre(assemblerFormuleColoree([{ latex: "3", role: "a" }, { latex: hostile }]), true);
    verifier(!classesDe(r.html).includes("evil") && !/color:red/.test(r.html), `segment hostile « ${hostile} » : aucune classe ni couleur étrangère`);
  }
}

// ── 4. Garde : les textes d'auteur de gen7 compilent ──
const CATEGORIES: CategorieAnalyseFonction[] = ["mise_en_evidence", "binome_conjugue", "produit_remarquable", "irreductible"];
const ENTREES_MALFORMEES = ["", "x", "{}", "[]", "null", "{\"a\":\"x\"}", "{\"axeTexte\":\"3\",\"xS\":\"1\",\"yS\":\"1\"}", "{\"axeTexte\":\"x = \",\"xS\":\"a\",\"yS\":\"1\"}", "{\"crochetGauche\":\"[\",\"borneGauche\":\"a\",\"crochetDroit\":\"[\",\"borneDroite\":\"1\"}", "{\"signeA\":\"+\"}", "((x", "2x(x-4", "[\"a\"]", "{\"__proto__\":1}"];
const GRAINES = Array.from({ length: 60 }, (_, i) => 3 + i * 1013);
const compilesVus = new Set<string>();
let segmentsCompiles = 0;
function verifierCompile(texte: string, contexte: string): void {
  const { valide, segments } = decouperTexteMath(texte);
  verifier(valide, `${contexte} : balisage $…$ invalide « ${texte} »`);
  for (const s of segments) {
    if (s.type !== "math") continue;
    segmentsCompiles++;
    if (compilesVus.has(s.valeur)) continue;
    compilesVus.add(s.valeur);
    verifier(rendre(s.valeur).ok, `${contexte} : « $${s.valeur}$ » ne compile pas (throwOnError) ou contient une commande refusée`);
  }
}
for (const categorie of CATEGORIES) {
  for (const graine of GRAINES) {
    const brut = genererExercice(categorie, graine);
    // Tout réussi en correction immédiate : le panneau « Ce que tu sais déjà » est présent sur tous les écrans qui suivent.
    const reussis = champsAnalyseFonction(categorie).map((champ) => ({ champ, reponseBrute: reponseBruteCorrecteAnalyseFonction(brut, champ), statut: "correct" as const }));
    for (const [correctionImmediate, confirmees] of [[true, []], [false, []], [true, reussis]] as const) {
      const ex = projeterAnalyseFonction(brut, confirmees, { correctionImmediate });
      for (const e of ecransAnalyseFonction(ex) as EcranDeclare[]) {
        for (const t of textesAuteurDe(e)) verifierCompile(t, `${categorie}/${e.champ}`);
        if (typeof e.aide === "object") {
          verifier(validerAide(e.aide).length === 0, `${categorie}/${e.champ} : aide typée valide`);
          if (e.aide.type === "formule_coloree") {
            segmentsCompiles++;
            const r = rendre(assemblerFormuleColoree(e.aide.segments), true);
            verifier(r.ok, `${categorie}/${e.champ} : formule_coloree assemblée compile`);
          }
        }
      }
    }
    // Cascade : consigne de racinesChamp2 bâtie sur une réponse confirmée (ré-écriture LaTeX, jamais la chaîne brute).
    if (categorie !== "irreductible") {
      for (const reponse of ["(4x)(x+2)", "3x(x-2)", "x^2-4", "0.5x(x-0.5)", "-x(x+2)", "2(x-3)^2", "x(x-1)(x-2)"]) {
        const ex = projeterAnalyseFonction(brut, [{ champ: "racinesChamp1", reponseBrute: reponse, statut: "not_equivalent" }], { correctionImmediate: false });
        for (const e of ecransAnalyseFonction(ex)) if (e.champ === "racinesChamp2") verifierCompile(e.consigne, `${categorie}/racinesChamp2 (réponse « ${reponse} »)`);
      }
    }
    for (const champ of champsAnalyseFonction(categorie)) {
      verifierCompile(solutionAttendueAnalyseFonction(brut, champ), `${categorie}/${champ} : solution`);
      for (const entree of ENTREES_MALFORMEES) {
        const r = verifierAnalyseFonction(brut, champ, entree);
        if (r.statut === "parse_error") verifierCompile(r.messageErreur, `${categorie}/${champ} : message d'erreur pour « ${entree} »`);
      }
    }
  }
}
verifier(segmentsCompiles > 5000 && compilesVus.size > 100, `la garde couvre assez de segments (${segmentsCompiles} vus, ${compilesVus.size} distincts)`);

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (KaTeX 0.18.9 : empreintes + identité avec npm, confiance restreinte à moteur-coef-a|b|c, assemblage d'une chaîne, ${compilesVus.size} formules distinctes de gen7 compilées sur ${segmentsCompiles} segments)`);
