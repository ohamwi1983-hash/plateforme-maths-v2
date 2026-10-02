// Test permanent — CÂBLAGE du catalogue de gen7 « motif / delta » (RAPPORT §49) : catalogue affiché, JSON, `CORRESPONDANCE_JSON_VERS_PILOTE` de prof.html, registre, anciennes variantes SUPPRIMÉES.
// Lancer : `npm run test-catalogue-motif-delta`. Pur (aucune base). Le champ « nombre d'exercices » non `disabled` des dix entrées est mesuré en Chromium (`scenarioGen7Prof`).
//
//  1. Les dix familles = les dix entrées du catalogue affiché (ids, ordre) ; libellés IDENTIQUES mot pour mot au JSON (4e, n° 7) ; deux axes (7 + 3).
//  2. `CORRESPONDANCE_JSON_VERS_PILOTE["4e:7"]` (extrait LITTÉRALEMENT de prof.html) : dix entrées, mêmes ids, même ordre que le JSON.
//  3. Registre : les dix nouveaux sont exécutables ; les quatre anciens (`af_mise_en_evidence`, …) n'existent plus (registre, catalogue, libellé) ; composition : nouveaux acceptés, anciens refusés.
//  4. `verifierCoherenceRegistre` : les défauts de câblage d'une variante curriculaire sont détectés.

export {}; // module

import * as fs from "node:fs";
import * as path from "node:path";
import { CATALOGUE_GENERATEURS, estVarianteConnue, labelPourVariante } from "../lib/catalogueGenerateurs";
import { DICTIONNAIRE_COMPETENCES } from "../lib/dictionnaireCompetences";
import { REGISTRE_GENERATEURS, chercherGenerateur, variantesCatalogueSansGenerateur, verifierCoherenceRegistre } from "../lib/registreGenerateurs";
import { validerComposition } from "../lib/validationCorpsTaches";
import { FAMILLES } from "../src/generateurs/analyseFonctionMotifDelta/familles";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const RACINE = path.join(__dirname, "..");
const IDS_ANCIENS = ["af_mise_en_evidence", "af_binome_conjugue", "af_produit_remarquable", "af_irreductible"];

// ── 1. Catalogue ↔ familles ↔ JSON ──
const gen7 = CATALOGUE_GENERATEURS.filter((e) => e.generateur_id === "gen7");
verifier(gen7.length === 10 && gen7.map((e) => e.variante_id).join() === FAMILLES.map((f) => f.id).join(), "catalogue : dix entrées gen7, mêmes identifiants et même ordre que les familles");
verifier(CATALOGUE_GENERATEURS.length === 11 && CATALOGUE_GENERATEURS.filter((e) => e.generateur_id !== "gen7").map((e) => e.variante_id).join() === "fx_depuis_graphe", `catalogue : ${CATALOGUE_GENERATEURS.length} entrées au total (gen7 ×10 et gen8 « fx_depuis_graphe »)`);
verifier(new Set(gen7.map((e) => e.label)).size === 10, "catalogue : dix libellés distincts");
const json = JSON.parse(fs.readFileSync(path.join(RACINE, "public/catalogue-generateurs-complet.json"), "utf8")) as { "4e": { numero: number; chapitre: number; libelle: string; variantes: { axe: string; label: string; exemple: string }[] }[] };
const entree7 = json["4e"].find((g) => g.numero === 7 && g.chapitre === 1);
verifier(entree7 !== undefined && Array.isArray(entree7.variantes) && entree7.variantes.length === 10, "JSON : 4e n°7 a dix variantes");
if (entree7) {
  verifier(entree7.variantes.map((v) => v.label).join("|") === gen7.map((e) => e.label).join("|"), "JSON : libellés IDENTIQUES mot pour mot à CATALOGUE_GENERATEURS, dans le même ordre");
  verifier(entree7.variantes.slice(0, 7).every((v) => v.axe === "sans discriminant") && entree7.variantes.slice(7).every((v) => v.axe === "avec discriminant"), "JSON : sept « sans discriminant » puis trois « avec discriminant »");
  verifier(entree7.variantes.every((v) => typeof v.exemple === "string" && v.exemple.length > 20), "JSON : chaque variante a un exemple");
  // Présentation prof (RAPPORT §53) : deux sous-groupes, via le mécanisme `groupe` déjà utilisé par gen13 ; la correspondance par INDEX (CORRESPONDANCE_JSON_VERS_PILOTE) n'est pas touchée.
  const groupes = (entree7.variantes as { groupe?: string }[]).map((v) => v.groupe);
  verifier(groupes.slice(0, 7).every((g) => g === "Sans discriminant") && groupes.slice(7).every((g) => g === "Avec discriminant"), "JSON : `groupe` = « Sans discriminant » (7 premières) puis « Avec discriminant » (3 dernières)");
  verifier(FAMILLES.slice(0, 7).every((f) => f.groupe === "motif") && FAMILLES.slice(7).every((f) => f.groupe === "delta"), "familles : sept « motif » puis trois « delta »");
}

// ── 2. prof.html ──
const html = fs.readFileSync(path.join(RACINE, "public/prof.html"), "utf8");
const bloc = /"4e:7":\s*\[([\s\S]*?)\]/.exec(html);
const lignes = bloc ? [...(bloc[1] as string).matchAll(/\{\s*index:\s*(\d+),\s*variante_id:\s*"([^"]+)"\s*\}/g)].map((m) => ({ index: Number(m[1]), id: m[2] as string })) : [];
verifier(lignes.length === 10 && lignes.every((l, i) => l.index === i && l.id === gen7[i]!.variante_id), `prof.html : CORRESPONDANCE_JSON_VERS_PILOTE["4e:7"] = les dix ids du catalogue dans l'ordre (obtenu ${JSON.stringify(lignes.map((l) => l.id))})`);
verifier(!/variante_id:\s*"af_(mise_en_evidence|binome_conjugue|produit_remarquable|irreductible)"/.test(html), "prof.html : les anciens af_* n'y sont plus câblés");

// ── 3. Registre ──
for (const f of FAMILLES) {
  const g = chercherGenerateur(f.id);
  verifier(g !== null && g.generateur_id === "gen7" && g.curriculaire, `registre : ${f.id} exécutable`);
  verifier(estVarianteConnue(f.id) && validerComposition([{ variante_id: f.id, nombre_exercices: 1 }]).ok === true, `composition : ${f.id} acceptée`);
}
for (const id of IDS_ANCIENS) {
  verifier(chercherGenerateur(id) === null, `registre : ${id} n'existe plus`);
  verifier(!CATALOGUE_GENERATEURS.some((e) => e.variante_id === id) && labelPourVariante(id) === null, `${id} : absent du catalogue, sans libellé`);
  verifier(!estVarianteConnue(id) && validerComposition([{ variante_id: id, nombre_exercices: 1 }]).ok === false, `composition : ${id} refusée`);
}
verifier(REGISTRE_GENERATEURS.filter((g) => g.generateur_id === "gen7").length === 10, "registre : exactement 10 générateurs gen7");
verifier(variantesCatalogueSansGenerateur().length === 0, "aucune variante du catalogue sans générateur");
for (const f of FAMILLES) verifier(labelPourVariante(f.id) === gen7.find((e) => e.variante_id === f.id)!.label, `${f.id} : libellé d'affichage`);

// ── 4. Détection des défauts de câblage d'une variante curriculaire ──
const base = chercherGenerateur(FAMILLES[0]!.id)!;
const cat = CATALOGUE_GENERATEURS as unknown as { generateur_id: string; variante_id: string }[];
verifier(verifierCoherenceRegistre([base], [], DICTIONNAIRE_COMPETENCES).some((e) => e.includes("absent de CATALOGUE_GENERATEURS")), "cohérence : curriculaire absent du catalogue détecté");
verifier(verifierCoherenceRegistre([{ ...base, generateur_id: "gX" }], cat, DICTIONNAIRE_COMPETENCES).some((e) => e.includes("≠ catalogue")), "cohérence : generateur_id incohérent détecté");
verifier(verifierCoherenceRegistre([{ ...base, codesCompetenceDeclares: ["CODE_INCONNU"] }], cat, DICTIONNAIRE_COMPETENCES).some((e) => e.includes("CODE_INCONNU")), "cohérence : code inconnu détecté");
verifier(verifierCoherenceRegistre([{ ...base, curriculaire: false }], cat, DICTIONNAIRE_COMPETENCES).some((e) => e.includes("non curriculaire présent dans CATALOGUE_GENERATEURS")), "cohérence : non curriculaire au catalogue détecté");
verifier(verifierCoherenceRegistre([base, base], cat, DICTIONNAIRE_COMPETENCES).some((e) => e.includes("en double")), "cohérence : variante_id en double détecté");
verifier(verifierCoherenceRegistre(REGISTRE_GENERATEURS, CATALOGUE_GENERATEURS, DICTIONNAIRE_COMPETENCES).length === 0, "cohérence : le registre réel est sain");

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (catalogue, JSON, CORRESPONDANCE prof.html, registre : 10 variantes, anciennes supprimées, compositions, cohérence)`);
