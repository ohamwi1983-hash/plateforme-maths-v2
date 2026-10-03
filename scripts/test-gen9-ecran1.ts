// Test permanent — gen9 « Complète le carré », écran 1 « forme canonique » (RAPPORT §59) : lecteur `lireFormeCanonique`, vérification exacte, diagnostic. Par propriété sur les 12
// configurations × 400 graines : toute écriture canonique de la vraie fonction est juste ; RECOPIER l'énoncé développé est un `parse_error` (jamais « correct ») ; les quatre codes sont
// PARTITIONNANTS, contrôlés par un ORACLE écrit en (a, b, c) (la méthode de l'élève) indépendamment de la formule du code ; à a = −1 aucun code (collisions) ; à a = 1 les deux codes
// « facteur oublié » sont inertes ; deux erreurs ou plus : aucun code ; entrées hostiles sans exception. Lancer : `npm run test-gen9-ecran1`. Sans réseau.

export {}; // module

import { DICTIONNAIRE_COMPETENCES } from "../lib/dictionnaireCompetences";
import { EXPLICATIONS_COMPETENCES } from "../lib/explicationsCompetences";
import { EXPLICATIONS_COMPETENCES_ELEVE } from "../lib/explicationsCompetencesEleve";
import { categoriserCompetence } from "../lib/categoriesCompetences";
import { lireFormeCanonique } from "../src/generateurs/_noyauQuadratique/formeCanonique";
import { activesDe, genererExerciceCc } from "../src/generateurs/completionDuCarre/generation";
import { latexDeveloppe } from "../src/generateurs/completionDuCarre/enonce";
import { CODES_CC, CODES_CC_ECRAN_FORME, CODE_P_FACTEUR_A_OUBLIE, CODE_Q_FACTEUR_A_OUBLIE, CODE_Q_SIGNE_INVERSE, CODE_SIGNE_P_INVERSE } from "../src/generateurs/completionDuCarre/codes";
import { coefficientsDeveloppes, parametres, type ExerciceCc } from "../src/generateurs/completionDuCarre/types";
import { verifierFormeCanonique } from "../src/generateurs/completionDuCarre/verification";
import type { Transformation } from "../src/generateurs/_noyauQuadratique/types";
import { ajouterR, diviserR, egalR, multiplierR, oppR, rat, soustraireR, signeR, type Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const CONFIGURATIONS: Transformation[][] = [];
for (const tv of [false, true]) for (const facteur of [null, "EV", "CV"] as const) for (const sox of [false, true]) CONFIGURATIONS.push(["TH", ...(tv ? ["TV" as const] : []), ...(facteur ? [facteur] : []), ...(sox ? ["SOX" as const] : [])]);
const GRAINES = Array.from({ length: 400 }, (_, i) => 7 + i * 131);

/** Écriture d'un rationnel pour la saisie : `n`, `-n`, `(n/d)`. */
const ecrit = (r: Rat): string => (r.d === 1 ? String(r.n) : `(${r.n}/${r.d})`);
const signe = (r: Rat): string => (signeR(r) < 0 ? "-" : "+");
const absolu = (r: Rat): Rat => (signeR(r) < 0 ? oppR(r) : r);
/** `x − p` ou `x + |p|` ; `x` seul si p = 0. */
const binome = (p: Rat): string => (signeR(p) === 0 ? "x" : `x${signe(oppR(p))}${ecrit(absolu(p))}`);
const termeQ = (q: Rat): string => (signeR(q) === 0 ? "" : `${signe(q)}${ecrit(absolu(q))}`);

/** Plusieurs écritures canoniques de a(x − p)² + q. */
function ecritures(a: Rat, p: Rat, q: Rat): string[] {
  const b = binome(p);
  const unSigne = signeR(a) < 0;
  const aa = absolu(a);
  const aTexte = egalR(aa, rat(1)) ? "" : ecrit(aa);
  const devant = `${unSigne ? "-" : ""}${aTexte}`;
  const liste = [
    `${devant}(${b})^2${termeQ(q)}`,
    `${devant}(${b})²${termeQ(q)}`,
    ` ${devant} ( ${b} ) ^ 2 ${termeQ(q)} `,
    `${signeR(q) === 0 ? "" : `${ecrit(q)}+`}${devant}(${b})^2`,
    `${ecrit(a)}*(${b})^2${termeQ(q)}`,
    `(${b})^2*${ecrit(a)}${termeQ(q)}`,
  ];
  if (signeR(q) !== 0) liste.push(`${ecrit(a)}(${b})^2+${ecrit(q)}`);
  return liste;
}

// ── 1. Lecteur : accepte toute écriture canonique de la vraie fonction, sur 12 configurations × 400 graines ──
let ecrituresLues = 0;
const exercices: ExerciceCc[] = [];
for (const config of CONFIGURATIONS) {
  for (const graine of GRAINES) {
    const ex = genererExerciceCc(graine, { actives: config });
    exercices.push(ex);
    const { a, p, q } = parametres(ex);
    for (const texte of ecritures(a, p, q)) {
      const lue = lireFormeCanonique(texte);
      ecrituresLues++;
      verifier(lue.ok && egalR(lue.a, a) && egalR(lue.p, p) && egalR(lue.q, q), `lecteur : « ${texte} » doit donner (${ecrit(a)}, ${ecrit(p)}, ${ecrit(q)}) ${JSON.stringify(lue)}`);
      const v = verifierFormeCanonique(ex, texte);
      verifier(v.statut === "correct", `vérification : « ${texte} » doit être juste (${v.statut})`);
    }
  }
}
verifier(exercices.length === 12 * 400 && activesDe({ actives: ["TH"] }).includes("TH"), "12 configurations × 400 graines");
verifier(ecrituresLues > 20_000, `assez d'écritures canoniques essayées (${ecrituresLues})`);

// ── 2. Recopier l'énoncé développé : parse_error, JAMAIS correct ──
let recopies = 0;
for (const ex of exercices) {
  const latex = latexDeveloppe(ex);
  const saisie = latex.replace(/\\dfrac\{(\d+)\}\{(\d+)\}/g, "($1/$2)").replace(/\\cdot/g, "*").replace(/\\left|\\right/g, "").replace(/\^\{2\}/g, "^2");
  for (const texte of [saisie, saisie.replace(/\s+/g, ""), saisie.replace(/\^2/g, "²")]) {
    recopies++;
    const v = verifierFormeCanonique(ex, texte);
    verifier(v.statut === "parse_error", `recopier l'énoncé « ${texte} » doit être un parse_error (${v.statut})`);
    verifier(v.codesCompetence.length === 0 && !("partiesFausses" in v && v.partiesFausses), "recopier l'énoncé : ni code ni partie fausse");
  }
}
verifier(recopies === 3 * exercices.length, "recopies essayées");

// ── 3. Entrées pas canoniques ou illisibles : parse_error (jamais un (a, p, q) faux) ──
const REFUSEES = [
  "", "   ", "x^2-6x+9", "(x-3)^2+(x-1)^2", "2(2x-6)^2+1", "(x-3)^3+1", "(x-3)^2*(x-1)", "2((x-3)^2)+1", "(x-3)^2+x", "x(x-3)^2", "2(x-3)^2+1x", "2(x-3)^2+3x-3x", "(x-3)(x-3)+1",
  "2(x-3)^2+1=", "f(x)=", "constructor", "__proto__", "2(x-3)^2+__proto__", "$2(x-3)^2$", "2(x-3)^2+1+", "((x-3)^2", "2(x-3)^2)", "(y-3)^2+1", "1/(x-3)^2", "(x-3)^2/x", "3", "0(x-3)^2+1x",
  "99999999999999999999(x-3)^2+1", "(x-99999999999999999999)^2+1", "(x-3)^2+99999999999999999999/3",
];
for (const texte of REFUSEES) {
  const ex = exercices[0] as ExerciceCc;
  let v;
  try {
    v = verifierFormeCanonique(ex, texte);
  } catch (e) {
    verifier(false, `« ${texte} » : exception ${String(e)}`);
    continue;
  }
  verifier(v.statut === "parse_error" || v.statut === "not_equivalent", `« ${texte} » : jamais correct (${v.statut})`);
  if (v.statut === "parse_error") verifier(v.codesCompetence.length === 0 && typeof v.messageErreur === "string" && v.messageErreur.length > 0, `« ${texte} » : parse_error avec message`);
}
// Les entrées structurellement non canoniques sont TOUTES des parse_error (pas des essais ratés).
for (const texte of ["x^2-6x+9", "(x-3)^2+(x-1)^2", "2(2x-6)^2+1", "(x-3)^3+1", "x(x-3)^2", "(x-3)(x-3)+1", "(x-3)^2+x"]) {
  verifier(verifierFormeCanonique(exercices[0] as ExerciceCc, texte).statut === "parse_error", `« ${texte} » : parse_error`);
}
// a = 0 : parse_error (pas une fonction du second degré), avec message distinct.
{
  const v = verifierFormeCanonique(exercices[0] as ExerciceCc, "0(x-3)^2+1");
  verifier(v.statut === "parse_error", "a = 0 : parse_error");
}

// ── 4. Oracle (a, b, c) : ce que ferait l'élève qui complète le carré avec UNE erreur mécanique ──
// Indépendant de la formule du diagnostic : écrit en fonction des coefficients DÉVELOPPÉS (a, b, c) de l'énoncé.
type Reponse = { a: Rat; p: Rat; q: Rat };
function codeOracle(ex: ExerciceCc, r: Reponse): string | null {
  const v = parametres(ex);
  const { a, b, c } = coefficientsDeveloppes(v);
  const juste = egalR(r.a, v.a) && egalR(r.p, v.p) && egalR(r.q, v.q);
  if (juste || !egalR(r.a, a)) return null;
  const moitieB = diviserR(b, rat(2));
  const quatreA = multiplierR(rat(4), a);
  const candidats: { code: string; ok: boolean }[] = [
    { code: CODE_P_FACTEUR_A_OUBLIE, ok: egalR(r.q, v.q) && egalR(r.p, oppR(moitieB)) }, // p = −b/2
    { code: CODE_SIGNE_P_INVERSE, ok: egalR(r.q, v.q) && egalR(r.p, diviserR(b, multiplierR(rat(2), a))) }, // p = +b/(2a)
    { code: CODE_Q_FACTEUR_A_OUBLIE, ok: egalR(r.p, v.p) && egalR(r.q, soustraireR(c, multiplierR(v.p, v.p))) }, // q = c − p²
    { code: CODE_Q_SIGNE_INVERSE, ok: egalR(r.p, v.p) && egalR(r.q, ajouterR(c, diviserR(multiplierR(b, b), quatreA))) }, // q = c + b²/(4a)
  ];
  const retenus = candidats.filter((x) => x.ok).map((x) => x.code);
  return retenus.length === 1 ? (retenus[0] as string) : null; // deux candidats simultanés (a = −1) : aucun code
}

const atteints = new Set<string>();
const parA = new Map<string, Set<string>>(); // a (texte) -> codes émis
let nonEmissions = 0;
let jugees = 0;
for (const ex of exercices.filter((_, i) => i % 4 === 0)) {
  const v = parametres(ex);
  const { a, b, c } = coefficientsDeveloppes(v);
  const moitieB = diviserR(b, rat(2));
  const quatreA = multiplierR(rat(4), a);
  const valeursP = [v.p, oppR(v.p), multiplierR(a, v.p), oppR(moitieB), diviserR(b, multiplierR(rat(2), a)), ajouterR(v.p, rat(1)), rat(0), rat(7, 3)];
  const valeursQ = [v.q, ajouterR(v.q, multiplierR(soustraireR(a, rat(1)), multiplierR(v.p, v.p))), ajouterR(v.q, multiplierR(multiplierR(rat(2), a), multiplierR(v.p, v.p))), soustraireR(c, multiplierR(v.p, v.p)), ajouterR(c, diviserR(multiplierR(b, b), quatreA)), oppR(v.q), rat(0), rat(5, 2)];
  const valeursA = [v.a, oppR(v.a), rat(1), rat(3, 2)];
  for (const ap of valeursA) for (const pp of valeursP) for (const qq of valeursQ) {
    const r = { a: ap, p: pp, q: qq };
    if (egalR(ap, rat(0))) continue;
    // La réponse est écrite sous une forme canonique ; elle est lue puis jugée par la production.
    const texte = ecritures(ap, pp, qq)[0] as string;
    const verdict = verifierFormeCanonique(ex, texte);
    jugees++;
    const juste = egalR(ap, v.a) && egalR(pp, v.p) && egalR(qq, v.q);
    verifier(verdict.statut === (juste ? "correct" : "not_equivalent"), `verdict de « ${texte} » (${verdict.statut})`);
    if (juste) continue;
    const attendu = codeOracle(ex, r);
    const obtenu = verdict.codesCompetence;
    verifier(obtenu.length <= 1, `jamais deux codes pour « ${texte} » (${obtenu.join(",")})`);
    verifier((obtenu[0] ?? null) === attendu, `code de « ${texte} » (a=${ecrit(v.a)} p=${ecrit(v.p)} q=${ecrit(v.q)}) : oracle ${attendu}, production ${obtenu[0] ?? null}`);
    verifier(verdict.statut === "not_equivalent" && verdict.partiesFausses?.length === 1 && verdict.partiesFausses[0] === "champ", "partie fausse « champ »");
    if (attendu) atteints.add(attendu);
    if (obtenu[0]) {
      const cle = ecrit(v.a);
      if (!parA.has(cle)) parA.set(cle, new Set());
      (parA.get(cle) as Set<string>).add(obtenu[0]);
    }
    // Un code ne suppose JAMAIS a' ≠ a ; une réponse avec a' ≠ a n'a aucun code.
    if (!egalR(ap, v.a)) verifier(obtenu.length === 0, `a' ≠ a : aucun code (« ${texte} »)`);
    if (egalR(v.a, rat(-1)) && obtenu.length === 0) nonEmissions++;
    if (egalR(v.a, rat(-1))) verifier(obtenu.length === 0, `a = −1 : aucun code (« ${texte} »)`);
    if (egalR(v.a, rat(1))) verifier(!obtenu.includes(CODE_P_FACTEUR_A_OUBLIE) && !obtenu.includes(CODE_Q_FACTEUR_A_OUBLIE), `a = 1 : les codes « facteur oublié » sont inertes (« ${texte} »)`);
  }
}
verifier(jugees > 100_000, `assez de réponses jugées (${jugees})`);
for (const code of CODES_CC_ECRAN_FORME) verifier(atteints.has(code), `code atteignable : ${code}`);
verifier(nonEmissions > 0, "à a = −1 il existe des réponses ambiguës sans code");
// À a = −1 : aucun code du tout (deux codes de p sont confondus, ceux de q aussi, et p ≠ 0 donc SIGNE_P_INVERSE ≡ P_FACTEUR_A_OUBLIE).
verifier((parA.get("-1")?.size ?? 0) === 0, `a = −1 : aucun code émis (${[...(parA.get("-1") ?? [])].join(",")})`);
verifier(parA.get("1") !== undefined && !(parA.get("1") as Set<string>).has(CODE_P_FACTEUR_A_OUBLIE), "a = 1 : P_FACTEUR_A_OUBLIE jamais émis");

// ── 5. Exemples ÉPINGLÉS (documentation vivante des quatre erreurs) : f(x) = 2x² − 12x + 19 = 2(x − 3)² + 1 ──
{
  const ex = { ...(exercices[0] as ExerciceCc), th: 3, tv: 1, facteurN: 2, facteurD: 1, sox: false, actives: ["TH", "TV", "EV"] as Transformation[] };
  const code = (texte: string): string | null => verifierFormeCanonique(ex, texte).codesCompetence[0] ?? null;
  verifier(verifierFormeCanonique(ex, "2(x-3)^2+1").statut === "correct", "épinglé : 2(x-3)^2+1 juste");
  verifier(code("2(x-6)^2+1") === CODE_P_FACTEUR_A_OUBLIE, "épinglé : p = −b/2 = 6");
  verifier(code("2(x+3)^2+1") === CODE_SIGNE_P_INVERSE, "épinglé : signe de p");
  verifier(code("2(x-3)^2+10") === CODE_Q_FACTEUR_A_OUBLIE, "épinglé : q = 19 − 9");
  verifier(code("2(x-3)^2+37") === CODE_Q_SIGNE_INVERSE, "épinglé : q = 19 + 18");
  verifier(code("2(x-6)^2+10") === null, "épinglé : deux erreurs, aucun code");
  verifier(code("3(x-3)^2+1") === null && verifierFormeCanonique(ex, "3(x-3)^2+1").statut === "not_equivalent", "épinglé : a faux, aucun code");
  verifier(verifierFormeCanonique(ex, "2x^2-12x+19").statut === "parse_error", "épinglé : recopier l'énoncé est un parse_error");
  verifier(verifierFormeCanonique(ex, "2(x-3)^2+1").codesCompetence.length === 0, "épinglé : juste sans code");
}

// ── 6. Déclarations : chaque code est au dictionnaire, aux deux explications et catégorisé ; l'explication élève est un texte statique ──
for (const code of CODES_CC) {
  verifier(Object.hasOwn(DICTIONNAIRE_COMPETENCES, code), `dictionnaire : ${code}`);
  verifier(Object.hasOwn(EXPLICATIONS_COMPETENCES, code), `explication professeur : ${code}`);
  verifier(Object.hasOwn(EXPLICATIONS_COMPETENCES_ELEVE, code), `explication élève : ${code}`);
  verifier(categoriserCompetence(code) !== null && categoriserCompetence(code) !== undefined, `catégorie : ${code}`);
}
for (const code of [CODE_P_FACTEUR_A_OUBLIE, CODE_Q_FACTEUR_A_OUBLIE, CODE_Q_SIGNE_INVERSE]) {
  const texte = (EXPLICATIONS_COMPETENCES_ELEVE as Record<string, string>)[code] ?? "";
  verifier(texte !== "" && !/[$\\]/.test(texte), `explication élève : texte non vide, sans balisage (statique, donc aucune valeur de l'exercice) : ${code}`);
}

if (echecs.length > 0) {
  console.error(`✗ ${echecs.length} échec(s) sur ${nb} vérifications :\n${echecs.join("\n")}`);
  process.exit(1);
}
console.log(`✓ gen9 écran 1 : ${nb} vérifications (${ecrituresLues} écritures canoniques, ${recopies} recopies refusées, ${jugees} réponses jugées contre l'oracle)`);
