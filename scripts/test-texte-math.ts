// Test permanent — phase 3b-1 : convention de balisage mathématique `$…$` (CLAUDE.md « Balisage
// mathématique »). Segmentation (public/moteur/texteMath.js, une seule implémentation), liste unique de
// commandes interdites (lib/balisageMath.ts), lecteur de nombre unique et décodeurs partagés
// (lib/reponsesEcran.ts). Aucun réseau. Lancer : `npx tsx scripts/test-texte-math.ts`.

export {}; // module

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { COMMANDES_MATH_INTERDITES, commandesInterditesDans } from "../lib/balisageMath";
import { decoderChampsMultiples, decoderIntervalle, decoderListeValeurs, decoderListeValeursOuAucune, lireNombreOuFraction } from "../lib/reponsesEcran";
import { decouperTexteMath, verifierBalisageMath, versTexteBrut } from "./support/texteMath";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}
const segs = (t: string) => JSON.stringify(decouperTexteMath(t));
const attendu = (valide: boolean, segments: [string, string][]) => JSON.stringify({ valide, segments: segments.map(([type, valeur]) => ({ type, valeur })) });

// ── 1. Tableau de référence (prompt 3b-1, A.3) ──
verifier(segs("Étudie la fonction suivante : $f(x) = -6x + 3x^2$.") === attendu(true, [["texte", "Étudie la fonction suivante : "], ["math", "f(x) = -6x + 3x^2"], ["texte", "."]]), "exemple f(x) : segmentation");
verifier(segs("Donne $x_S$ et $y_S$.") === attendu(true, [["texte", "Donne "], ["math", "x_S"], ["texte", " et "], ["math", "y_S"], ["texte", "."]]), "exemple x_S / y_S");
verifier(segs("Résous $3x^2 - 6x = 0$.") === attendu(true, [["texte", "Résous "], ["math", "3x^2 - 6x = 0"], ["texte", "."]]), "exemple équation");
verifier(segs("Im $= [-3\\,;\\,+\\infty[$") === attendu(true, [["texte", "Im "], ["math", "= [-3\\,;\\,+\\infty["]]), "exemple intervalle (texte · math)");
verifier(segs("Coût : 5 \\$ par pièce") === attendu(true, [["texte", "Coût : 5 $ par pièce"]]), "\\$ hors mathématiques = $ littéral");
verifier(segs("$x_S") === attendu(false, [["texte", "$x_S"]]), "$ non fermé : texte brut intégral");
verifier(segs("a $$ b") === attendu(false, [["texte", "a $$ b"]]), "$$ invalide : texte brut intégral");
verifier(segs("") === attendu(true, []), "chaîne vide : aucun segment");
verifier(segs("$\\textcolor{red}{x}$") === attendu(true, [["math", "\\textcolor{red}{x}"]]), "commande interdite : la segmentation reste valide");
verifier(verifierBalisageMath("$\\textcolor{red}{x}$").length === 1 && verifierBalisageMath("$\\textcolor{red}{x}$")[0].includes("textcolor"), "verifierBalisageMath signale \\textcolor");

// ── 2. Cas limites ──
verifier(segs("$ $") === attendu(false, [["texte", "$ $"]]), "contenu mathématique vide (espaces) : invalide");
verifier(segs("$a$$b$") === attendu(true, [["math", "a"], ["math", "b"]]), "deux blocs collés : lus comme $a$ puis $b$ (le « $$ » n'est jamais en position d'ouverture)");
verifier(segs("$a$ puis $b$") === attendu(true, [["math", "a"], ["texte", " puis "], ["math", "b"]]), "deux blocs séparés");
verifier(segs("$\\$$") === attendu(true, [["math", "\\$"]]), "\\$ DANS les mathématiques reste du LaTeX et ne ferme pas");
verifier(segs("\\\\$x$") === attendu(true, [["texte", "\\\\"], ["math", "x"]]), "deux antislashs avant $ : $ non échappé (délimiteur)");
verifier(segs("\\\\\\$ok") === attendu(true, [["texte", "\\\\$ok"]]), "trois antislashs avant $ : deux littéraux puis $ échappé");
verifier(segs("a\\b") === attendu(true, [["texte", "a\\b"]]), "un autre antislash hors mathématiques est littéral");
verifier(segs("fin \\") === attendu(true, [["texte", "fin \\"]]), "antislash final littéral");
verifier(segs("5 € et 3 $ sans fin") === attendu(false, [["texte", "5 € et 3 $ sans fin"]]), "$ isolé : invalide, texte brut (jamais de rendu partiel)");
verifier(segs("$a$ 3 $") === attendu(false, [["texte", "$a$ 3 $"]]), "un $ isolé après un bloc valide : invalide");
verifier(decouperTexteMath("x").segments.length === 1 && decouperTexteMath("x").valide, "texte simple : un segment");
verifier(JSON.stringify(decouperTexteMath(undefined as unknown as string)) === attendu(true, []), "undefined ne lève pas");
for (const hostile of ["<img src=x onerror=alert(1)>", "$<b>x</b>$", "&lt;script&gt;", "\u0000$\u0000"]) {
  let leve = false;
  try {
    decouperTexteMath(hostile);
  } catch {
    leve = true;
  }
  verifier(!leve, `découpage : ne doit jamais lever (« ${hostile} »)`);
}

// ── 3. versTexteBrut ──
verifier(versTexteBrut("Donne $x_S$ et \\$5") === "Donne x_S et $5", "versTexteBrut : délimiteurs retirés, \\$ devient $");
verifier(versTexteBrut("$x_S") === "$x_S", "versTexteBrut : texte invalide renvoyé tel quel");
verifier(versTexteBrut("") === "", "versTexteBrut : vide");

// ── 4. Liste unique de commandes interdites (lib/balisageMath.ts) ──
const interdites = ["color", "textcolor", "colorbox", "fcolorbox", "htmlClass", "htmlStyle", "htmlId", "htmlData", "href", "url", "includegraphics"];
for (const c of interdites) {
  verifier(COMMANDES_MATH_INTERDITES.includes(c), `\\${c} doit figurer dans la liste interdite`);
  verifier(commandesInterditesDans(`x + \\${c}{y}`).includes(c), `\\${c} doit être détecté`);
  verifier(verifierBalisageMath(`$x + \\${c}{y}$`).length >= 1, `verifierBalisageMath doit refuser \\${c}`);
}
verifier(commandesInterditesDans("\\frac{1}{2} + \\sqrt{x} + \\infty").length === 0, "commandes admises non signalées");
verifier(commandesInterditesDans("\\colorful").length === 0, "\\colorful n'est pas \\color (correspondance de nom entier)");
verifier(verifierBalisageMath("$\\frac{3}{4}$ et $x^2$").length === 0, "balisage sain : aucun problème");
verifier(verifierBalisageMath("$x").length === 1 && verifierBalisageMath("a $$ b").length === 1, "non fermé / $$ signalés une fois");
// La liste n'existe qu'à UN endroit : le module client n'en contient aucune copie.
const clientTexteMath = readFileSync(join(__dirname, "../public/moteur/texteMath.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const clientRendre = readFileSync(join(__dirname, "../public/moteur/rendreTexte.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
// Seule exception : `htmlClass`, que le client EMPLOIE (il ne la copie pas d'une liste) pour la surbrillance a/b/c de `formule_coloree` —
// assemblage (`assemblerFormuleColoree`, texteMath.js) et confiance restreinte (`reglagesKatex`, rendreTexte.js) — et nulle part ailleurs.
for (const c of COMMANDES_MATH_INTERDITES) {
  if (c === "htmlClass") continue;
  verifier(!clientTexteMath.includes(c) && !clientRendre.includes(c), `la commande interdite « ${c} » ne doit pas être recopiée dans public/moteur/`);
}
{
  const occurrences = (t: string) => (t.match(/htmlClass/g) ?? []).length;
  verifier(occurrences(clientTexteMath) === 1 && clientTexteMath.includes("\\\\htmlClass{moteur-coef-${segment.role}}"), "htmlClass : UNE occurrence dans texteMath.js, l'assemblage moteur-coef-<rôle>");
  verifier(occurrences(clientRendre) === 1 && clientRendre.includes('contexte.command === "\\\\htmlClass"') && clientRendre.includes("/^moteur-coef-[abc]$/"), "htmlClass : UNE occurrence dans rendreTexte.js, la confiance restreinte à moteur-coef-a|b|c");
  const dossier = join(__dirname, "../public/moteur");
  const autres: string[] = [];
  const parcourir = (d: string): void => {
    for (const nom of readdirSync(d)) {
      const chemin = join(d, nom);
      if (statSync(chemin).isDirectory()) parcourir(chemin);
      else if (/\.(js|css|html)$/.test(nom) && !["texteMath.js", "rendreTexte.js"].includes(nom) && readFileSync(chemin, "utf8").includes("htmlClass")) autres.push(chemin);
    }
  };
  parcourir(dossier);
  verifier(autres.length === 0, `htmlClass ne figure dans aucun autre fichier de public/moteur/ (${autres.join(", ")})`);
}

// ── 5. lireNombreOuFraction : LE lecteur de nombre (jamais 0 par défaut) ──
const cas: [string, number | null][] = [
  ["", null], ["   ", null], ["abc", null], ["1/0", null], ["1/", null], ["/2", null], ["--3", null], ["1e3", null], ["0x10", null], ["Infinity", null], ["1,2,3", null], ["1..2", null], ["3 4", null],
  ["3", 3], [" -3 ", -3], ["+3", 3], ["2,5", 2.5], ["2.5", 2.5], [".5", 0.5], ["-0,5", -0.5], ["−3", -3], ["7/2", 3.5], ["7 / 2", 3.5], ["-7/2", -3.5], ["7/-2", -3.5], ["0", 0], ["4/2", 2],
];
for (const [texte, attendue] of cas) verifier(lireNombreOuFraction(texte) === attendue, `lireNombreOuFraction(${JSON.stringify(texte)}) devrait valoir ${attendue}, obtenu ${lireNombreOuFraction(texte)}`);

// ── 6. Décodeurs ──
const ecranCoef = { champs: [
  { id: "a", libelle: "$a =$", genre: "texte" as const },
  { id: "b", libelle: "$b =$", genre: "texte" as const },
  { id: "signe", libelle: "Signe de $a$", genre: "choix" as const, choix: [{ id: "+", libelle: "$a > 0$" }, { id: "-", libelle: "$a < 0$" }] },
] };
const bon = decoderChampsMultiples(JSON.stringify({ a: " 2 ", b: "-3", signe: "+" }), ecranCoef);
verifier(bon.ok && bon.valeur.a === "2" && bon.valeur.b === "-3" && bon.valeur.signe === "+", "champs_multiples : réponse valide (valeurs rognées)");
const manque = decoderChampsMultiples(JSON.stringify({ a: "2", signe: "+" }), ecranCoef);
verifier(!manque.ok && manque.message.includes("b") && manque.message.includes("manque"), `champs_multiples : id manquant nommé (${!manque.ok && manque.message})`);
const enTrop = decoderChampsMultiples(JSON.stringify({ a: "2", b: "3", signe: "+", z: "1" }), ecranCoef);
verifier(!enTrop.ok && enTrop.message.includes("z"), "champs_multiples : id en trop refusé");
const vide = decoderChampsMultiples(JSON.stringify({ a: "2", b: "   ", signe: "+" }), ecranCoef);
verifier(!vide.ok && vide.message.includes("vide") && vide.message.includes("b ="), `champs_multiples : champ vide refusé et nommé sans balisage (${!vide.ok && vide.message})`);
verifier(!decoderChampsMultiples(JSON.stringify({ a: "2", b: "", signe: "+" }), ecranCoef).ok, "champs_multiples : chaîne vide refusée — jamais lue comme 0");
verifier(!decoderChampsMultiples(JSON.stringify({ a: "2", b: "3", signe: "0" }), ecranCoef).ok, "champs_multiples : id de choix inconnu refusé");
verifier(!decoderChampsMultiples(JSON.stringify({ a: 2, b: "3", signe: "+" }), ecranCoef).ok, "champs_multiples : valeur non chaîne refusée");
for (const illisible of ["pas du json", "[]", "null", "3", '"x"']) verifier(!decoderChampsMultiples(illisible, ecranCoef).ok, `champs_multiples : « ${illisible} » illisible`);

const iv = decoderIntervalle(JSON.stringify({ crochetGauche: "[", borneGauche: " -3 ", crochetDroit: "[", borneDroite: "+inf" }));
verifier(iv.ok && iv.valeur.borneGauche === "-3" && iv.valeur.borneDroite === "+inf", "intervalle : réponse valide");
verifier(decoderIntervalle(JSON.stringify({ crochetGauche: "]", borneGauche: "-inf", crochetDroit: "]", borneDroite: "+inf" })).ok, "intervalle : (+inf à droite, -inf à gauche) lisible");
verifier(decoderIntervalle(JSON.stringify({ crochetGauche: "[", borneGauche: "+inf", crochetDroit: "]", borneDroite: "-inf" })).ok, "intervalle : sens absurde LISIBLE (le générateur le jugera faux, pas le décodeur)");
verifier(!decoderIntervalle(JSON.stringify({ crochetGauche: "(", borneGauche: "1", crochetDroit: "]", borneDroite: "2" })).ok, "intervalle : crochet inconnu refusé");
verifier(!decoderIntervalle(JSON.stringify({ crochetGauche: "[", borneGauche: "", crochetDroit: "]", borneDroite: "2" })).ok, "intervalle : borne gauche vide refusée");
verifier(!decoderIntervalle(JSON.stringify({ crochetGauche: "[", borneGauche: "1", crochetDroit: "]", borneDroite: "  " })).ok, "intervalle : borne droite vide refusée");
verifier(!decoderIntervalle(JSON.stringify({ crochetGauche: "[", borneGauche: "1", crochetDroit: "]" })).ok, "intervalle : clé manquante refusée");
verifier(!decoderIntervalle(JSON.stringify({ crochetGauche: "[", borneGauche: "1", crochetDroit: "]", borneDroite: "2", extra: "x" })).ok, "intervalle : clé en trop refusée");
verifier(!decoderIntervalle(JSON.stringify({ crochetGauche: "[", borneGauche: 1, crochetDroit: "]", borneDroite: "2" })).ok, "intervalle : borne non chaîne refusée");
verifier(!decoderIntervalle("pas du json").ok && !decoderIntervalle("[]").ok, "intervalle : illisible refusé");

const aucune = decoderListeValeursOuAucune("[]");
verifier(aucune.ok && aucune.valeur.aucune === true && aucune.valeur.valeurs.length === 0, "liste : [] = aucune (permetAucune)");
const deux = decoderListeValeursOuAucune(JSON.stringify([" 1 ", "2"]));
verifier(deux.ok && !deux.valeur.aucune && deux.valeur.valeurs.join() === "1,2", "liste : valeurs rognées");
verifier(!decoderListeValeursOuAucune(JSON.stringify(["", "  "])).ok, "liste : valeurs toutes vides refusées (ce n'est pas « aucune »)");
verifier(!decoderListeValeursOuAucune("pas du json").ok && !decoderListeValeursOuAucune('"x"').ok, "liste : illisible refusé");
verifier(!decoderListeValeurs("[]").ok, "decoderListeValeurs (sans permetAucune) rejette TOUJOURS la liste vide — inchangé");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(" - " + e);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (segmentation $…$, échappement, invalidité, liste unique de commandes interdites, lecteur de nombre, décodeurs champs_multiples/intervalle/liste)`);
