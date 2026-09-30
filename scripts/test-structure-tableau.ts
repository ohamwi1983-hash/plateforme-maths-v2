// Test permanent — RAPPORT §30 : structure d'un tableau de signes (`lib/structureTableau.ts`), la SEULE dérivation
// « quelle case existe, quelles valeurs elle offre, sous quelle clé elle répond ».
//  - les 3 configurations réelles de gen7 (aucune racine / racine double / deux racines), déclarées ici À LA MAIN d'après
//    la spécification (jamais dérivées du code testé) : nombre de colonnes, cycle de chaque case, fusions des variations ;
//  - le quotient (4 valeurs `∅` sur un pôle de la ligne finale seulement), les lignes empilées ;
//  - les déclarations incohérentes LÈVENT (échec bruyant) : alternance, 2N+1, 9 colonnes max, genre partiel, attributs mal placés ;
//  - `comparerCasesTableau` : case manquante / inconnue / hors alphabet → refus ; « ? » n'est JAMAIS une réponse ; clés hostiles
//    (`__proto__`, `constructor`) ; aucune clé lue dans le prototype ;
//  - hérité : une case par colonne, alphabet de ligne — inchangé ;
//  - casse (piège f(x) / F(X)) : aucun `text-transform` dans les règles de titre du tableau (public/moteur/ecrans.css).
// Lancer : `npx tsx scripts/test-structure-tableau.ts`.

export {}; // module

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ColonneTableauSignes, EcranTableauSignes, LigneTableauSignes } from "../lib/contratGenerateur";
import { decoderTableauSignes } from "../lib/reponsesEcran";
import { comparerCasesTableau, NB_COLONNES_MAX, resoudreRangees } from "../lib/structureTableau";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const S2 = ["+", "-"], S3 = ["+", "-", "0"], S4 = ["+", "-", "0", "∅"];
const V_INTERVALLE = ["↗", "↘"], V_SOMMET = ["⌢", "⌣"];

const intervalle = (id: string): ColonneTableauSignes => ({ id, libelle: id, genre: "intervalle" });
const valeur = (id: string, options: Partial<ColonneTableauSignes> = {}): ColonneTableauSignes => ({ id, libelle: id, genre: "valeur", valeur: `$${id}$`, ...options });
const signe: LigneTableauSignes = { id: "signe", libelle: "SIGNE DE $f(x)$" };
const variation: LigneTableauSignes = { id: "variation", libelle: "VARIATIONS", nature: "variation" };
const ecran = (colonnes: ColonneTableauSignes[], lignes: LigneTableauSignes[], reste: Partial<EcranTableauSignes> = {}): EcranTableauSignes => ({ champ: "t", type: "tableau_signes", consigne: "c", colonnes, lignes, ...reste });
const alphabets = (e: EcranTableauSignes) => resoudreRangees(e).map((r) => r.cellules.map((c) => c.alphabet));
const ancres = (e: EcranTableauSignes) => resoudreRangees(e).map((r) => r.cellules.map((c) => c.ancre));
const leve = (f: () => unknown): string | null => {
  try {
    f();
    return null;
  } catch (e) {
    return (e as Error).message;
  }
};

// ── 1. Les trois configurations de gen7 ──
// Aucune racine réelle (af_irreductible) : 3 colonnes, TOUTES à 2 valeurs — jamais de « 0 » sur xS.
const aucune = ecran([intervalle("c0"), valeur("c1", { sommet: true }), intervalle("c2")], [signe, variation]);
verifier(JSON.stringify(alphabets(aucune)) === JSON.stringify([[S2, S2, S2], [V_INTERVALLE, V_SOMMET, V_INTERVALLE]]), `aucune racine : ${JSON.stringify(alphabets(aucune))}`);
// Racine double (af_produit_remarquable) : la colonne centrale est une vraie racine (3 valeurs), les intervalles restent à 2.
const double = ecran([intervalle("c0"), valeur("c1", { racine: true, sommet: true }), intervalle("c2")], [signe, variation]);
verifier(JSON.stringify(alphabets(double)) === JSON.stringify([[S2, S3, S2], [V_INTERVALLE, V_SOMMET, V_INTERVALLE]]), `racine double : ${JSON.stringify(alphabets(double))}`);
// Deux racines (af_mise_en_evidence, af_binome_conjugue) : x₁ et x₂ à 3 valeurs, xS et les intervalles à 2 ; variations fusionnées 3 | 1 | 3.
const deux = ecran(
  [intervalle("c0"), valeur("c1", { racine: true }), intervalle("c2"), valeur("c3", { sommet: true }), intervalle("c4"), valeur("c5", { racine: true }), intervalle("c6")],
  [signe, variation],
);
verifier(JSON.stringify(alphabets(deux)) === JSON.stringify([[S2, S3, S2, S2, S2, S3, S2], [V_INTERVALLE, V_SOMMET, V_INTERVALLE]]), `deux racines : ${JSON.stringify(alphabets(deux))}`);
verifier(JSON.stringify(ancres(deux)) === JSON.stringify([["c0", "c1", "c2", "c3", "c4", "c5", "c6"], ["c0", "c3", "c4"]]), `clés d'ancrage : première colonne de chaque groupe ${JSON.stringify(ancres(deux))}`);
verifier(JSON.stringify(resoudreRangees(deux)[1].cellules.map((c) => c.couvre.length)) === JSON.stringify([3, 1, 3]), "fusions 3 | 1 | 3 (avant le sommet, le sommet, après)");
verifier(JSON.stringify(resoudreRangees(double)[1].cellules.map((c) => c.couvre.length)) === JSON.stringify([1, 1, 1]), "racine double : 1 | 1 | 1");
// Le nombre de fusions suit la position RÉELLE des sommets, pas un découpage fixe : 9 colonnes, deux points de changement.
const neuf = ecran(
  [intervalle("a"), valeur("b", { racine: true }), intervalle("c"), valeur("d", { sommet: true }), intervalle("e"), valeur("f"), intervalle("g"), valeur("h", { sommet: true }), intervalle("i")],
  [signe, variation],
);
verifier(JSON.stringify(resoudreRangees(neuf)[1].cellules.map((c) => [c.ancre, c.couvre.length])) === JSON.stringify([["a", 3], ["d", 1], ["e", 3], ["h", 1], ["i", 1]]), `deux sommets : ${JSON.stringify(resoudreRangees(neuf)[1].cellules.map((c) => [c.ancre, c.couvre.length]))}`);
// Un tableau sans aucun sommet : un seul groupe fusionné sur toute la largeur.
const sansSommet = ecran([intervalle("a"), valeur("b"), intervalle("c")], [variation]);
verifier(JSON.stringify(resoudreRangees(sansSommet)[0].cellules.map((c) => c.couvre.length)) === "[3]", "aucun sommet : une seule case fusionnée");
verifier(resoudreRangees(neuf)[0].cellules.length === 9 && NB_COLONNES_MAX === 9, "9 colonnes (4 valeurs) : le maximum conçu");

// ── 2. Quotient : 4 valeurs, lignes empilées ──
const quotient = ecran(
  [intervalle("c0"), valeur("c1", { racine: true }), intervalle("c2"), valeur("c3", { racine: true, pole: true }), intervalle("c4"), valeur("c5", { racine: true }), intervalle("c6")],
  [{ id: "f1", libelle: "F1" }, { id: "f2", libelle: "F2" }, { id: "f3", libelle: "F3" }, { id: "q", libelle: "Q", nature: "quotient" }],
);
const alphQ = alphabets(quotient);
verifier(alphQ.length === 4 && [0, 1, 2].every((i) => JSON.stringify(alphQ[i]) === JSON.stringify([S2, S3, S2, S3, S2, S3, S2])), "3 lignes de facteurs empilées : jamais de « ∅ », 0 sur les colonnes racine");
verifier(JSON.stringify(alphQ[3]) === JSON.stringify([S2, S3, S2, S4, S2, S3, S2]), `ligne finale : « ∅ » uniquement au pôle (4 valeurs) : ${JSON.stringify(alphQ[3])}`);
verifier(alphQ.flat(2).filter((v) => v === "∅").length === 1, "un seul « ∅ » dans tout le tableau");
verifier(JSON.stringify(ancres(quotient)[0]) === JSON.stringify(ancres(quotient)[3]), "les lignes de signe empilées ont exactement les mêmes clés (mêmes colonnes)");
// `∅` distinct de `0` : deux symboles différents dans l'alphabet du pôle.
verifier(alphQ[3][3].includes("0") && alphQ[3][3].includes("∅"), "« ∅ » (indéfini) et « 0 » coexistent dans l'alphabet du pôle");
verifier(S4[2] !== S4[3], "« ∅ » (indéfini) est distinct de « 0 »");
// Des alphabets renvoyés sont des COPIES : en modifier un ne change pas le suivant.
const a1 = resoudreRangees(deux);
a1[0].cellules[0].alphabet.push("X");
verifier(resoudreRangees(deux)[0].cellules[0].alphabet.length === 2, "alphabets copiés à chaque résolution (aucun état partagé)");

// ── 3. Déclarations incohérentes : échec bruyant ──
const refus = (message: string, f: () => unknown, fragment: RegExp) => {
  const m = leve(f);
  verifier(m !== null && fragment.test(m), `${message} : doit lever (${fragment}) — obtenu ${JSON.stringify(m)}`);
};
refus("colonne −∞ (deux valeurs de suite)", () => resoudreRangees(ecran([valeur("a"), valeur("b"), intervalle("c")], [signe])), /alternance|doit être/);
refus("commence par une valeur", () => resoudreRangees(ecran([valeur("a"), intervalle("b"), valeur("c")], [signe])), /alternance|doit être/);
refus("nombre pair de colonnes", () => resoudreRangees(ecran([intervalle("a"), valeur("b"), intervalle("c"), valeur("d")], [signe])), /2N\+1/);
refus("une seule colonne", () => resoudreRangees(ecran([intervalle("a")], [signe])), /2N\+1/);
refus("11 colonnes (au-delà de 9 : pas de repli)", () => resoudreRangees(ecran(Array.from({ length: 11 }, (_, i) => (i % 2 === 0 ? intervalle(`c${i}`) : valeur(`c${i}`))), [signe])), /2N\+1/);
refus("genre partiel", () => resoudreRangees(ecran([intervalle("a"), { id: "b", libelle: "b" }, intervalle("c")], [signe])), /TOUTES les colonnes/);
refus("valeur sans texte", () => resoudreRangees(ecran([intervalle("a"), { id: "b", libelle: "b", genre: "valeur" }, intervalle("c")], [signe])), /obligatoire/);
refus("racine sur une colonne d'intervalle", () => resoudreRangees(ecran([{ ...intervalle("a"), racine: true }, valeur("b"), intervalle("c")], [signe])), /colonne « valeur »/);
refus("attribut structuré sans genre (tableau hérité)", () => resoudreRangees(ecran([{ id: "a", libelle: "a", racine: true }], [{ id: "l", libelle: "l" }], { signesAutorises: ["+"] })), /sans `genre`/);
refus("id de colonne en double", () => resoudreRangees(ecran([intervalle("a"), valeur("a"), intervalle("c")], [signe])), /en double/);
refus("id de ligne en double", () => resoudreRangees(ecran([intervalle("a"), valeur("b"), intervalle("c")], [signe, signe])), /en double/);
refus("aucune ligne", () => resoudreRangees(ecran([intervalle("a"), valeur("b"), intervalle("c")], [])), /aucune ligne/);
refus("alphabet de ligne dans un tableau structuré", () => resoudreRangees(ecran([intervalle("a"), valeur("b"), intervalle("c")], [{ ...signe, signesAutorises: ["+"] }])), /hérité/);
refus("signesAutorises d'écran dans un tableau structuré", () => resoudreRangees(ecran([intervalle("a"), valeur("b"), intervalle("c")], [signe], { signesAutorises: ["+"] })), /hérité/);
refus("nature inconnue", () => resoudreRangees(ecran([intervalle("a"), valeur("b"), intervalle("c")], [{ ...signe, nature: "autre" as never }])), /nature inconnue/);
refus("nature dans un tableau hérité", () => resoudreRangees(ecran([{ id: "a", libelle: "a" }], [{ id: "l", libelle: "l", nature: "signe" }], { signesAutorises: ["+"] })), /structuré/);
refus("tableau hérité sans alphabet", () => resoudreRangees(ecran([{ id: "a", libelle: "a" }], [{ id: "l", libelle: "l" }])), /sans alphabet/);

// ── 4. Tableau hérité : une case par colonne, alphabet de la ligne (inchangé) ──
const herite = ecran([{ id: "c0", libelle: "x" }, { id: "c1", libelle: "y" }], [{ id: "l1", libelle: "L1" }, { id: "l2", libelle: "L2", signesAutorises: ["a", "b"] }], { signesAutorises: ["+", "-", "0"] });
verifier(JSON.stringify(alphabets(herite)) === JSON.stringify([[S3, S3], [["a", "b"], ["a", "b"]]]), "hérité : alphabet de l'écran par défaut, alphabet de ligne prioritaire");

// ── 5. Comparaison d'une réponse ──
const attendu = { signe: { c0: "+", c1: "0", c2: "-", c3: "-", c4: "-", c5: "0", c6: "+" }, variation: { c0: "↘", c3: "⌣", c4: "↗" } };
const rangeesDeux = resoudreRangees(deux);
const decoder = (o: unknown) => {
  const d = decoderTableauSignes(JSON.stringify(o));
  if (!d.ok) throw new Error("décodage");
  return d.valeur;
};
const cmp = (o: unknown) => comparerCasesTableau(rangeesDeux, decoder(o), attendu);
const juste = () => JSON.parse(JSON.stringify(attendu)) as typeof attendu;
verifier(JSON.stringify(cmp(juste())) === '{"ok":true,"tousJustes":true}', "réponse juste");
const fausse = juste();
fausse.variation.c3 = "⌢";
verifier(JSON.stringify(cmp(fausse)) === '{"ok":true,"tousJustes":false}', "réponse fausse mais bien formée : tousJustes=false (un essai raté, pas une erreur de forme)");
const manquante = juste() as any;
delete manquante.variation.c3;
verifier(cmp(manquante).ok === false, "case manquante : refus");
const ligneManquante = juste() as any;
delete ligneManquante.variation;
verifier(cmp(ligneManquante).ok === false, "ligne manquante : refus");
const enTrop = juste() as any;
enTrop.signe.c9 = "+";
verifier(cmp(enTrop).ok === false, "case inconnue en trop : refus");
const couverte = juste() as any;
couverte.variation.c1 = "↘";
verifier(cmp(couverte).ok === false, "clé d'une colonne COUVERTE par une case fusionnée : refus (seule la clé d'ancrage existe)");
const ligneEnTrop = { ...juste(), fantome: { c0: "+" } };
verifier(cmp(ligneEnTrop).ok === false, "ligne inconnue : refus");
for (const [colonne, valeurSaisie] of [["c0", "0"], ["c3", "0"], ["c1", "∅"], ["c2", "?"], ["c2", ""], ["c2", "++"]] as const) {
  const o = juste() as any;
  o.signe[colonne] = valeurSaisie;
  verifier(cmp(o).ok === false, `« ${valeurSaisie} » sur ${colonne} : hors de l'alphabet de SA case → refus`);
}
verifier(!decoderTableauSignes('{"signe":{"c0":1}}').ok, "valeur non textuelle : refusée dès le décodage");
// Clés hostiles : jamais lues dans le prototype, jamais une case « valide » par héritage.
for (const cle of ["constructor", "toString", "hasOwnProperty", "__defineGetter__"]) {
  const o = juste() as any;
  o.signe[cle] = "+";
  verifier(cmp(o).ok === false, `clé hostile « ${cle} » dans une ligne : refus`);
  const p = juste() as any;
  p[cle] = { c0: "+" };
  verifier(cmp(p).ok === false, `ligne hostile « ${cle} » : refus`);
}
verifier(!decoderTableauSignes('{"signe":{"__proto__":"+"}}').ok, "« __proto__ » refusé dès le décodage");
// Un `attendu` dont une clé manque (bug de générateur) : jamais « juste » par défaut.
verifier(comparerCasesTableau(rangeesDeux, decoder(juste()), { signe: attendu.signe, variation: {} }).ok === true && !(comparerCasesTableau(rangeesDeux, decoder(juste()), { signe: attendu.signe, variation: {} }) as any).tousJustes, "attendu incomplet : jamais jugé juste");
verifier(!(comparerCasesTableau(rangeesDeux, decoder(juste()), Object.create({ signe: attendu.signe }) as never) as any).tousJustes, "attendu hérité du prototype : jamais lu");

// ── 6. Casse : jamais de `text-transform` sur les titres du tableau (f(x) deviendrait F(X)) ──
const css = readFileSync(join(__dirname, "..", "public/moteur/ecrans.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
verifier(!/text-transform/.test(css), "ecrans.css : aucun `text-transform` (les titres de section sont écrits dans leur casse ; RAPPORT §30)");
const regles = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /moteur-titre-tableau|moteur-titre-ligne/.test(m[1]));
verifier(regles.length >= 2 && regles.every((m) => /letter-spacing/.test(m[2]) || /padding-top/.test(m[2])), "les titres obtiennent l'effet « petites capitales » par taille et espacement des lettres");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (3 configurations gen7, quotient, déclarations incohérentes, comparaison, clés hostiles, casse)`);
