// Test permanent — gen8 « f(x) à partir du graphe », écran 2 « chaîne de transformations » (RAPPORT §57) : atteignabilité, transformations ADMISES pour l'élève (option 4 : configuration
// ∪ transformations nécessaires à sa fonction confirmée, clause `x²`), règles locales de chaque étape, vérification à deux niveaux, crédit partiel PLAFONNÉ, cascade (`projeter`) dans tous
// les régimes, poids inversés, absence de fuite. Les chaînes de test sont CONSTRUITES (étiquette + paramètre → expression suivante) : l'oracle ne ré-implémente pas les règles. Lancer :
// `npm run test-fx-ecran2`. Sans réseau.

export {}; // module

import type { EcranChaineTransformations } from "../lib/contratGenerateur";
import type { ReponseConfirmee } from "../lib/contratGenerateur";
import { verifierBalisageMath } from "./support/texteMath";
import { validerDependances } from "../lib/cascadeEcrans";
import { projeterExercice, type ExerciceRegenere } from "../lib/etatExercice";
import { poidsDesEcrans } from "../lib/poidsEcran";
import { verifierAvecControle } from "../lib/registreGenerateurs";
import { creerPrng } from "../lib/prng";
import { generateurFxDepuisGraphe as G } from "../src/generateurs/fxDepuisGraphe/generateur";
import { effectifDepuisReponses, parametresDepuisReponse, projeterFx } from "../src/generateurs/fxDepuisGraphe/cascade";
import { POLYNOME_DEPART, chaineCanonique, estXCarre, etapeLocalementValide, longueurMinimale, necessaires, parametreEtape, transformationsAdmises } from "../src/generateurs/fxDepuisGraphe/chaine";
import { CHAMP_CHAINE, CHAMP_EXPRESSION, CHOIX_CHAINE, POIDS_CHAINE, POIDS_EXPRESSION } from "../src/generateurs/fxDepuisGraphe/ecrans";
import { latexFonction } from "../src/generateurs/fxDepuisGraphe/formatage";
import { genererExerciceFx } from "../src/generateurs/fxDepuisGraphe/generation";
import { coefficient, constante, decalerP, degre, egalP, foisScalaire, lirePolynome, plusP, type Polynome } from "../src/generateurs/fxDepuisGraphe/polynome";
import { TRANSFORMATIONS, depuisJson, estTransformation, parametres, parametresRepli, polynomeDe, versJson, type ExerciceFx, type Parametres, type Transformation } from "../src/generateurs/fxDepuisGraphe/types";
import { egalR, oppR, rat, signeR, type Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition) echecs.push(message);
}

const CONFIGURATIONS: Transformation[][] = [];
for (const th of [false, true]) for (const tv of [false, true]) for (const echelle of [null, "EV", "CV"] as const) for (const sox of [false, true]) {
  const actives = TRANSFORMATIONS.filter((t) => (t === "TH" && th) || (t === "TV" && tv) || t === echelle || (t === "SOX" && sox));
  if (actives.length > 0) CONFIGURATIONS.push(actives);
}
const GRAINES = [3, 5_000_003, 91_234_567, 1_500_000_011, 3_000_000_019];
const cfg = (actives: readonly string[]) => ({ actives: [...actives] });
const P = (a: [number, number?], p: [number, number?], q: [number, number?]): Parametres => ({ a: rat(a[0], a[1] ?? 1), p: rat(p[0], p[1] ?? 1), q: rat(q[0], q[1] ?? 1) });

// Texte SAISI par un élève (relisible par `lirePolynome`) pour un polynôme.
const rationnel = (r: Rat): string => `(${r.n}${r.d === 1 ? "" : `/${r.d}`})`;
function saisie(p: Polynome): string {
  if (p.length === 0) return "0";
  const termes: string[] = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = coefficient(p, k);
    if (signeR(c) === 0) continue;
    termes.push(k === 0 ? rationnel(c) : k === 1 ? `${rationnel(c)}*x` : `${rationnel(c)}*x^${k}`);
  }
  return termes.join("+");
}
// Valeur déclarée (RAPPORT §58) : par défaut la VRAIE valeur de l'étape (`parametreEtape`), `v` la remplace ; « 1 » si la règle de l'étape est fausse (étape mal étiquetée) ; aucune pour SOX.
const saisieRat = (r: Rat): string => (r.d === 1 ? String(r.n) : `${r.n}/${r.d}`);
function brute(etapes: { t: string; e: Polynome; v?: string }[]): string {
  let avant: Polynome = POLYNOME_DEPART;
  return JSON.stringify({
    etapes: etapes.map(({ t, e, v }) => {
      const parametre = estTransformation(t) ? parametreEtape(t, avant, e) : null;
      avant = e;
      return { expression: saisie(e), transformation: t, valeur: v ?? (t === "SOX" ? "" : parametre === null ? "1" : saisieRat(parametre)) };
    }),
  });
}

// Construction d'une étape : l'ÉTIQUETTE de construction est la vérité de l'oracle.
type Etape = { t: Transformation; e: Polynome };
function construire(etiquettes: { t: Transformation; param?: Rat }[]): Etape[] {
  let courant: Polynome = POLYNOME_DEPART;
  return etiquettes.map(({ t, param }) => {
    courant = t === "TH" ? decalerP(courant, param as Rat) : t === "TV" ? plusP(courant, constante(param as Rat)) : t === "SOX" ? foisScalaire(courant, rat(-1)) : foisScalaire(courant, param as Rat);
    return { t, e: courant };
  });
}
const exProjete = (ex: ExerciceFx, g: Parametres): ExerciceFx => ({ ...ex, effectif: versJson(g) });
const regenere = (ex: ExerciceFx): ExerciceRegenere => ({ ligne: {} as never, generateur: G, exercice: ex, ecrans: G.ecrans(ex) });

// ── 1. Atteignabilité, transformations admises, longueur minimale, chaîne canonique : TOUTES les configurations × une grille de réponses possibles ──
const AS = [rat(1), rat(-1), rat(2), rat(-2), rat(1, 2), rat(-1, 2), rat(3, 2), rat(15, 4), rat(-3, 4), rat(1, 5), rat(5)];
const PS = [0, 1, -1, 2, -3, 5, -5].map((n) => rat(n)).concat([rat(1, 2), rat(-5, 2)]);
const QS = [0, 1, -1, 2, -4, 5].map((n) => rat(n)).concat([rat(3, 4)]);
let cas = 0;
for (const actives of CONFIGURATIONS) {
  const nom = actives.join("+");
  for (const graine of GRAINES) {
    const ex = genererExerciceFx(graine, cfg(actives));
    const f = parametres(ex);
    // Pour la VRAIE fonction : aucune extension de la configuration.
    const admisesVrai = transformationsAdmises(ex.actives, f);
    verifier(admisesVrai.size === actives.length && actives.every((t) => admisesVrai.has(t)), `${nom} g=${graine} : la vraie fonction n'élargit pas la configuration`);
    verifier([...necessaires(f)].every((t) => actives.includes(t)), `${nom} g=${graine} : la vraie fonction n'exige que des transformations actives`);
    // Le repli : différent de la vraie, atteignable avec la configuration.
    const r = parametresRepli(ex);
    verifier(!(egalR(r.a, f.a) && egalR(r.p, f.p) && egalR(r.q, f.q)), `${nom} g=${graine} : le repli diffère de la vraie fonction`);
    verifier([...necessaires(r)].every((t) => actives.includes(t)) && (!estXCarre(r) || ["TH", "TV", "SOX"].some((t) => actives.includes(t as Transformation))), `${nom} g=${graine} : le repli est atteignable avec la configuration`);
    for (const a of AS) for (const p of PS) for (const q of QS) {
      const g: Parametres = { a, p, q };
      cas++;
      const admises = transformationsAdmises(actives, g);
      verifier(actives.every((t) => admises.has(t)), `${nom} : la configuration reste admise`);
      verifier([...necessaires(g)].every((t) => admises.has(t)), `${nom} : le nécessaire est admis`);
      const chaine = chaineCanonique(g, admises);
      verifier(chaine !== null, `${nom} a=${a.n}/${a.d} p=${p.n}/${p.d} q=${q.n}/${q.d} : une chaîne existe`);
      if (chaine === null) continue;
      verifier(chaine.length >= 1 && chaine.length <= 5 && chaine.length === longueurMinimale(g), `${nom} : longueur minimale (${chaine.length} vs ${longueurMinimale(g)})`);
      verifier(chaine.every((e) => admises.has(e.transformation)), `${nom} : la chaîne n'emploie que des transformations admises`);
      // Rejouée par les règles LOCALES : chaque étape est valide, l'arrivée est exactement g.
      let avant: Polynome = POLYNOME_DEPART;
      let ok = true;
      for (const e of chaine) {
        const apres = polynomeDe(e.apres);
        ok &&= etapeLocalementValide(e.transformation, avant, apres);
        avant = apres;
      }
      verifier(ok && egalP(avant, polynomeDe(g)), `${nom} : la chaîne canonique est valide et arrive à g`);
      // Sans la transformation nécessaire, la chaîne n'existe pas (exactitude de `necessaires`).
      for (const t of necessaires(g)) {
        const sans = new Set(admises);
        sans.delete(t);
        verifier(chaineCanonique(g, sans) === null, `${nom} : sans ${t}, g n'est pas atteignable`);
      }
    }
  }
}
verifier(cas > 40_000, `grille d'atteignabilité couverte (${cas} cas)`);

// Clause x² : EV seul / CV seul → il faut la paire EV + CV ; sinon la transformation réversible suffit.
{
  const x2 = P([1], [0], [0]);
  for (const t of ["EV", "CV"] as const) {
    const a = transformationsAdmises([t], x2);
    verifier(a.has("EV") && a.has("CV") && chaineCanonique(x2, a)?.length === 2 && longueurMinimale(x2) === 2, `${t} seul : x² admet la paire EV + CV`);
  }
  for (const t of ["TH", "TV", "SOX"] as const) {
    const a = transformationsAdmises([t], x2);
    verifier(a.size === 1 && chaineCanonique(x2, a)?.length === 2, `${t} seul : x² par la paire réversible, sans élargissement`);
  }
  verifier(transformationsAdmises(["EV", "SOX"], x2).has("CV") === false, "EV + SOX : x² par SOX, SOX sans élargissement");
}

// ── 2. Règles locales, une transformation à la fois ──
{
  const x2 = POLYNOME_DEPART;
  const e = (a: number, p: number, q: number): Polynome => polynomeDe(P([a], [p], [q]));
  verifier(etapeLocalementValide("TH", x2, e(1, 2, 0)) && etapeLocalementValide("TH", x2, e(1, -3, 0)), "TH : (x − h)²");
  verifier(!etapeLocalementValide("TH", x2, x2), "TH : h = 0 n'est pas une translation");
  verifier(etapeLocalementValide("TH", e(2, 1, 3), e(2, 4, 3)), "TH sur 2(x−1)²+3 → 2(x−4)²+3");
  verifier(!etapeLocalementValide("TH", constante(rat(5)), constante(rat(5))), "TH sur une constante : refusée");
  verifier(etapeLocalementValide("TV", x2, e(1, 0, 3)) && etapeLocalementValide("TV", x2, e(1, 0, -2)), "TV : + k");
  verifier(!etapeLocalementValide("TV", x2, x2) && !etapeLocalementValide("TV", x2, e(2, 0, 0)), "TV : k = 0 refusée, un facteur n'est pas une translation");
  verifier(etapeLocalementValide("EV", x2, e(3, 0, 0)) && etapeLocalementValide("EV", x2, e(5, 0, 0)) && !etapeLocalementValide("EV", x2, e(1, 0, 0)) && !etapeLocalementValide("EV", x2, foisScalaire(x2, rat(1, 2))), "EV : m > 1");
  verifier(etapeLocalementValide("CV", x2, foisScalaire(x2, rat(1, 2))) && !etapeLocalementValide("CV", x2, foisScalaire(x2, rat(2))) && !etapeLocalementValide("CV", x2, foisScalaire(x2, rat(-1, 2))), "CV : 0 < m < 1");
  verifier(etapeLocalementValide("SOX", x2, foisScalaire(x2, rat(-1))) && !etapeLocalementValide("SOX", x2, foisScalaire(x2, rat(-2))) && !etapeLocalementValide("SOX", x2, x2), "SOX : × (−1) exactement");
  verifier(!etapeLocalementValide("EV", x2, plusP(x2, constante(rat(1)))), "EV : une translation n'est pas un étirement");
  verifier(!etapeLocalementValide("EV", [], x2) && !etapeLocalementValide("SOX", [], []), "polynôme nul : refusé");
  // Au plus UNE étiquette vraie pour des polynômes non constants (exclusion mutuelle), sur 6 000 paires tirées.
  const prng = creerPrng(2025);
  const alea = (): Polynome => polynomeDe(P([prng.choisir([1, -1, 2, -2, 3])], [prng.entierEntre(-3, 3)], [prng.entierEntre(-3, 3)]));
  let ambigus = 0;
  for (let i = 0; i < 6000; i++) {
    const a = alea();
    const b = prng.entierEntre(0, 3) === 0 ? alea() : [plusP(a, constante(rat(prng.entierEntre(-3, 3)))), decalerP(a, rat(prng.entierEntre(-3, 3))), foisScalaire(a, rat(prng.entierEntre(-4, 4), prng.choisir([1, 2, 3])))][prng.entierEntre(0, 2)]!;
    if (TRANSFORMATIONS.filter((t) => etapeLocalementValide(t, a, b)).length > 1) ambigus++;
  }
  verifier(ambigus === 0, `une étape ne justifie jamais deux transformations (${ambigus} ambiguïtés)`);
}

// ── 3. Vérification de l'écran 2 sur des chaînes CONSTRUITES, toutes configurations × graines ──
let chainesJugees = 0;
for (const actives of CONFIGURATIONS) {
  const nom = actives.join("+");
  for (const graine of GRAINES) {
    const brut = genererExerciceFx(graine, cfg(actives));
    const f = parametres(brut);
    const ex = exProjete(brut, f); // élève juste à l'écran 1
    const canonique = chaineCanonique(f, transformationsAdmises(actives, f)) as NonNullable<ReturnType<typeof chaineCanonique>>;
    const etapes = canonique.map((c) => ({ t: c.transformation, e: polynomeDe(c.apres) }));
    const r = verifierAvecControle(G, ex, CHAMP_CHAINE, brute(etapes));
    verifier(r.statut === "correct" && r.codesCompetence.length === 0, `${nom} g=${graine} : la chaîne canonique est juste`);
    chainesJugees++;

    // Étiquette fausse sur une étape bien formée : étape fausse, SANS code hors sujet.
    if (etapes.length >= 1) {
      const autre = TRANSFORMATIONS.find((t) => t !== etapes[0]!.t && !etapeLocalementValide(t, POLYNOME_DEPART, etapes[0]!.e))!;
      const m = verifierAvecControle(G, ex, CHAMP_CHAINE, brute([{ ...etapes[0]!, t: autre }, ...etapes.slice(1)]));
      verifier(m.statut === "not_equivalent" && m.codesCompetence.length === 0 && m.partiesFausses?.[0] === "etape:0", `${nom} g=${graine} : étape mal étiquetée = fausse sans code`);
    }

    // Hors sujet : une paire (T, T⁻¹) avec T NON admise, placée AVANT la chaîne ; l'arrivée est correcte mais le verdict ne l'est pas.
    for (const t of TRANSFORMATIONS.filter((x) => !actives.includes(x))) {
      const paire: { t: Transformation; param?: Rat }[] = t === "TH" ? [{ t, param: rat(2) }, { t, param: rat(-2) }] : t === "TV" ? [{ t, param: rat(3) }, { t, param: rat(-3) }] : t === "SOX" ? [{ t }, { t }] : t === "EV" ? [{ t, param: rat(2) }, { t: "CV", param: rat(1, 2) }] : [{ t, param: rat(1, 2) }, { t: "EV", param: rat(2) }];
      const avant = construire(paire);
      // La paire laisse x² : la chaîne canonique se rejoue ensuite depuis x² (mêmes expressions).
      const chaine = [...avant, ...etapes];
      if (chaine.length > 5) continue;
      const attenduHors = paire.filter((p) => !actives.includes(p.t)).length; // étapes hors sujet de la paire
      const rr = verifierAvecControle(G, ex, CHAMP_CHAINE, brute(chaine));
      verifier(rr.statut === "not_equivalent", `${nom} g=${graine} : paire ${t} hors sujet → faux alors que la chaîne arrive à f`);
      if (rr.statut === "not_equivalent") {
        verifier(rr.codesCompetence.join() === "TRANSFORMATION_HORS_SUJET", `${nom} : code hors sujet pour ${t}`);
        const fausses = (rr.partiesFausses ?? []).filter((x) => x.startsWith("etape:")).map((x) => Number(x.slice(6)));
        verifier(fausses.length === attenduHors && fausses.every((i) => i < 2), `${nom} : ${attenduHors} étape(s) hors sujet désignée(s) pour ${t}`);
        const k = longueurMinimale(f);
        const valides = chaine.length - attenduHors;
        verifier(Math.abs((rr.fractionCorrecte ?? -1) - (Math.min(valides, k) + 1) / (chaine.length + 1)) < 1e-12, `${nom} : crédit partiel plafonné (${rr.fractionCorrecte})`);
        verifier((rr.fractionCorrecte ?? 1) < 1, `${nom} : φ < 1`);
      }
    }
  }
}
verifier(chainesJugees === CONFIGURATIONS.length * GRAINES.length, "toutes les chaînes canoniques jugées");

// Deux étapes qui s'annulent numériquement : TV +3 puis TV −3 avec TV inactive — la chaîne retombe sur f, le verdict reste faux, chaque étape est hors sujet.
{
  const brut = genererExerciceFx(7, cfg(["TH", "EV"]));
  const f = parametres(brut);
  const ex = exProjete(brut, f);
  const canonique = chaineCanonique(f, transformationsAdmises(brut.actives, f))!.map((c) => ({ t: c.transformation, e: polynomeDe(c.apres) }));
  const chaine = [...construire([{ t: "TV", param: rat(3) }, { t: "TV", param: rat(-3) }]), ...canonique];
  const r = G.verifier(ex, CHAMP_CHAINE, brute(chaine));
  verifier(r.statut === "not_equivalent" && r.codesCompetence[0] === "TRANSFORMATION_HORS_SUJET" && r.partiesFausses?.join() === "etape:0,etape:1", "TV +3 puis −3 (TV inactive) : deux étapes hors sujet malgré l'arrivée exacte");
  // …et la même chaîne SANS la paire est juste.
  verifier(G.verifier(ex, CHAMP_CHAINE, brute(canonique)).statut === "correct", "la chaîne sans la paire est juste");
  // Option 4 : si la fonction confirmée de l'élève EXIGE TV, la même paire n'est plus hors sujet (TV admise pour cet élève).
  const g = P([2], [3], [4]); // exige TV, TH, EV
  const exG = exProjete(brut, g);
  const aller = construire([{ t: "TH", param: rat(3) }, { t: "EV", param: rat(2) }, { t: "TV", param: rat(4) }]);
  verifier(G.verifier(exG, CHAMP_CHAINE, brute(aller)).statut === "correct", "option 4 : TV exigée par la fonction de l'élève (TV inactive sur la ligne) est admise");
  const avecPaire = [...construire([{ t: "TV", param: rat(3) }, { t: "TV", param: rat(-3) }]), ...aller];
  verifier(G.verifier(exG, CHAMP_CHAINE, brute(avecPaire)).statut === "correct", "option 4 : TV admise, la paire +3 / −3 n'est plus hors sujet pour cet élève");
  // Mais une transformation NON exigée reste hors sujet : SOX (a > 0, SOX inactive).
  const avecSox = [...construire([{ t: "SOX" }, { t: "SOX" }]), ...aller];
  const rs = G.verifier(exG, CHAMP_CHAINE, brute(avecSox));
  verifier(rs.statut === "not_equivalent" && rs.codesCompetence[0] === "TRANSFORMATION_HORS_SUJET", "option 4 : SOX non exigée reste hors sujet");
}

// ── 4. Crédit partiel plafonné : jamais ≥ 1, plafonné, monotone ──
{
  const brut = genererExerciceFx(11, cfg(["TH", "TV", "EV", "SOX"]));
  const f = parametres(brut);
  const ex = exProjete(brut, f);
  const k = longueurMinimale(f);
  verifier(k === 4 || k === 3 || k === 2, `k* plausible (${k})`);
  // Remplissage : 5 étapes TV valides (TV active) qui n'arrivent pas à f.
  const remplissage = construire([1, 1, 1, 1, 1].map((u) => ({ t: "TV" as const, param: rat(u) })));
  const r = G.verifier(ex, CHAMP_CHAINE, brute(remplissage));
  verifier(r.statut === "not_equivalent" && Math.abs((r.fractionCorrecte ?? -1) - Math.min(5, k) / 6) < 1e-12, `remplissage : ${Math.min(5, k)}/6 et non 5/6 (reçu ${r.statut === "not_equivalent" ? r.fractionCorrecte : "?"})`);
  verifier((r.statut === "not_equivalent" ? (r.fractionCorrecte ?? 1) : 1) < 5 / 6 || k >= 5, "le remplissage ne rapporte pas 5/6");
  // Une chaîne canonique privée de sa dernière étape : k − 1 valides sur k − 1 soumises → (k−1)/k.
  const canonique = chaineCanonique(f, transformationsAdmises(brut.actives, f))!.map((c) => ({ t: c.transformation, e: polynomeDe(c.apres) }));
  const courte = G.verifier(ex, CHAMP_CHAINE, brute(canonique.slice(0, -1) as never));
  verifier(courte.statut === "not_equivalent" && courte.partiesFausses?.length === 0 && Math.abs((courte.fractionCorrecte ?? -1) - (k - 1) / k) < 1e-12, "chaîne incomplète : étapes toutes valides, φ = (k−1)/k");
}

// ── 5. Erreurs de lecture : parse_error (aucune tentative), messages sans la saisie, jamais d'exception ──
{
  const brut = genererExerciceFx(5, cfg(["TH"]));
  const ex = exProjete(brut, parametres(brut));
  const E = (expr: string, t = "TH") => JSON.stringify({ etapes: [{ expression: expr, transformation: t, valeur: t === "SOX" ? "" : "1" }] });
  for (const mauvaise of ["", "pas du json", "[]", "{}", JSON.stringify({ etapes: [] }), JSON.stringify({ etapes: Array.from({ length: 6 }, () => ({ expression: "x^2", transformation: "TH", valeur: "1" })) }), E("(x-2", "TH"), E("", "TH"), E("x^2", "XX"), E("3+", "TH"), E("sqrt(2)", "TH"), JSON.stringify({ etapes: [{ expression: "x^2" }] }), JSON.stringify({ etapes: [{ expression: "x^2", transformation: "TH", extra: 1 }] })]) {
    const r = G.verifier(ex, CHAMP_CHAINE, mauvaise);
    verifier(r.statut === "parse_error" && r.codesCompetence.length === 0 && r.messageErreur.length > 0, `lecture : « ${mauvaise.slice(0, 40)} » → parse_error`);
  }
  const r2 = G.verifier(ex, CHAMP_CHAINE, JSON.stringify({ etapes: [{ expression: "(x-2)^2", transformation: "TH", valeur: "2" }, { expression: "x^2+", transformation: "TV", valeur: "1" }] }));
  verifier(r2.statut === "parse_error" && r2.messageErreur.startsWith("Étape 2 : "), "le message désigne l'étape illisible");
  // Valeurs démesurées : jamais d'exception, étape fausse.
  const enorme = "9007199254740991";
  const r3 = G.verifier(ex, CHAMP_CHAINE, E(`${enorme}x^2+${enorme}x+${enorme}`));
  verifier(r3.statut === "not_equivalent", "valeurs démesurées : faux, sans exception");
  let leve = 0;
  const prng = creerPrng(7);
  const alphabet = "x^2+-*/() 0123456789,";
  for (let i = 0; i < 4000; i++) {
    const expr = Array.from({ length: prng.entierEntre(0, 12) }, () => alphabet[prng.entierEntre(0, alphabet.length - 1)]).join("");
    try {
      G.verifier(ex, CHAMP_CHAINE, E(expr, prng.choisir(["TH", "TV", "EV", "CV", "SOX"])));
    } catch {
      leve++;
    }
  }
  verifier(leve === 0, `fuzz : verifier ne lève jamais (${leve})`);
  // Exercice BRUT : jugement refusé bruyamment (jamais sur la vraie fonction).
  verifier((() => { try { G.verifier(brut, CHAMP_CHAINE, E("x^2")); return false; } catch { return true; } })(), "exercice non projeté : refus bruyant");
  verifier((() => { try { G.solutionAttendue(brut, CHAMP_CHAINE); return false; } catch { return true; } })(), "solution d'un exercice non projeté : refus bruyant");
}

// ── 5b. Valeur DÉCLARÉE de chaque étape (RAPPORT §58) : TH = h de f(x − h) (positif vers la droite), TV = constante ajoutée, EV | CV = facteur, SOX = aucune valeur ──
{
  const brut = genererExerciceFx(3, cfg(["TH", "TV", "EV", "SOX"]));
  const g = P([2], [3], [4]); // 2(x − 3)² + 4 : TH 3, EV 2, TV 4
  const ex = exProjete(brut, g);
  const bonne = construire([{ t: "TH", param: rat(3) }, { t: "EV", param: rat(2) }, { t: "TV", param: rat(4) }]);
  verifier(G.verifier(ex, CHAMP_CHAINE, brute(bonne)).statut === "correct", "valeurs déclarées justes : chaîne juste");
  const avecValeur = (i: number, v: string) => brute(bonne.map((e, k) => (k === i ? { ...e, v } : e)));
  // Mauvaise valeur sur une règle vraie : étape fausse, jamais un code « hors sujet », jamais une erreur de lecture.
  for (const [i, v, nomCas] of [[0, "-3", "TH : signe inversé (vers la gauche)"], [0, "2", "TH : autre valeur"], [1, "3", "EV : autre facteur"], [2, "-4", "TV : signe inversé"]] as [number, string, string][]) {
    const r = G.verifier(ex, CHAMP_CHAINE, avecValeur(i, v));
    verifier(r.statut === "not_equivalent" && r.codesCompetence.length === 0 && r.partiesFausses?.join() === `etape:${i}`, `${nomCas} : seule l'étape ${i} est fausse, sans code`);
    verifier(r.statut === "not_equivalent" && Math.abs((r.fractionCorrecte ?? -1) - (Math.min(2, longueurMinimale(g)) + 1) / 4) < 1e-12, `${nomCas} : crédit partiel (deux étapes valides + arrivée)`);
  }
  // Valeur HORS DOMAINE de la transformation choisie (TH, TV ≠ 0 ; EV > 1 ; CV dans ]0 ; 1[) : parse_error IMMÉDIAT (aucune tentative), avant toute comparaison à la règle ou à f ; le message est
  // une propriété de la transformation, identique pour tous les exercices, et ne cite aucune valeur attendue.
  const horsDomaine: [number, string, string][] = [[0, "0", "TH"], [2, "0", "TV"], [1, "1", "EV : 1 exactement"], [1, "1/2", "EV : l'inverse du facteur"], [1, "-2", "EV : négatif"], [1, "0", "EV : zéro"]];
  for (const [i, v, nomCas] of horsDomaine) {
    const r = G.verifier(ex, CHAMP_CHAINE, avecValeur(i, v));
    verifier(r.statut === "parse_error" && r.codesCompetence.length === 0 && r.messageErreur.startsWith(`Étape ${i + 1} : pour `), `valeur hors domaine (${nomCas}) : parse_error sur l'étape ${i + 1}, sans code`);
  }
  {
    const gCv = P([1, 3], [0], [0]); // x² comprimée : CV exigée
    const exCv = exProjete(genererExerciceFx(3, cfg(["CV"])), gCv);
    const chaineCv = construire([{ t: "CV", param: rat(1, 3) }]);
    verifier(G.verifier(exCv, CHAMP_CHAINE, brute(chaineCv)).statut === "correct", "CV 1/3 : juste");
    for (const v of ["3", "1", "0", "-1/3", "2"]) {
      const r = G.verifier(exCv, CHAMP_CHAINE, brute(chaineCv.map((e) => ({ ...e, v }))));
      verifier(r.statut === "parse_error" && r.messageErreur === "Étape 1 : pour CV, la valeur doit être un facteur compris entre 0 et 1 (exclus).", `CV « ${v} » : hors domaine -> parse_error`);
    }
    const memeMessage = G.verifier(ex, CHAMP_CHAINE, avecValeur(1, "1/2"));
    const autre = G.verifier(exProjete(brut, P([5], [-2], [1])), CHAMP_CHAINE, avecValeur(1, "1/2"));
    verifier(memeMessage.statut === "parse_error" && autre.statut === "parse_error" && memeMessage.messageErreur === autre.messageErreur, "le message hors domaine ne dépend pas de l'exercice");
    // L'ordre : un domaine refusé l'est AVANT le jugement, même si l'expression de l'étape est fausse.
    const fausseEtDomaine = G.verifier(ex, CHAMP_CHAINE, JSON.stringify({ etapes: [{ expression: "x^2+7", transformation: "EV", valeur: "1/2" }] }));
    verifier(fausseEtDomaine.statut === "parse_error", "valeur hors domaine + expression fausse : parse_error, pas un verdict");
  }
  // Toute écriture équivalente de la bonne valeur est acceptée (lecture exacte, pas de comparaison de texte).
  for (const [i, v] of [[0, "3.0"], [0, "+3"], [0, "6/2"], [0, "03"], [1, "4/2"], [1, "2,0"], [1, "(2)"], [2, "8/2"], [2, "4"]] as [number, string][]) {
    verifier(G.verifier(ex, CHAMP_CHAINE, avecValeur(i, v)).statut === "correct", `valeur équivalente acceptée : étape ${i} « ${v} »`);
  }
  // Valeur illisible ou qui n'est pas un nombre : parse_error (aucune tentative consommée), message désignant l'étape.
  for (const v of ["x", "2x", "trois", "1/0", "3 vers la droite", "((", "3+", "x^2"]) {
    const r = G.verifier(ex, CHAMP_CHAINE, avecValeur(1, v));
    verifier(r.statut === "parse_error" && r.codesCompetence.length === 0 && r.messageErreur.startsWith("Étape 2 : la valeur"), `valeur illisible « ${v} » : parse_error sur l'étape 2`);
  }
  // Structure : valeur absente (clé manquante), vide pour TH, ou fournie pour SOX → refus à la lecture.
  const sansCle = JSON.stringify({ etapes: [{ expression: "(x-3)^2", transformation: "TH" }] });
  const vide = JSON.stringify({ etapes: [{ expression: "(x-3)^2", transformation: "TH", valeur: "  " }] });
  const soxAvecValeur = JSON.stringify({ etapes: [{ expression: "-x^2", transformation: "SOX", valeur: "-1" }] });
  for (const [nomCas, corps] of [["clé « valeur » manquante", sansCle], ["valeur vide pour TH", vide], ["valeur fournie pour SOX", soxAvecValeur]] as [string, string][]) {
    const r = G.verifier(ex, CHAMP_CHAINE, corps);
    verifier(r.statut === "parse_error" && r.codesCompetence.length === 0, `${nomCas} : parse_error`);
  }
  // SOX : aucune valeur, jugé par la règle seule.
  const gNeg = P([-1], [0], [0]);
  verifier(G.verifier(exProjete(brut, gNeg), CHAMP_CHAINE, brute(construire([{ t: "SOX" }]))).statut === "correct", "SOX seule, sans valeur : juste pour −x²");
  // Hors sujet ET valeur fausse : le code reste « hors sujet » (la règle est vraie, la transformation non admise).
  const brutPeu = genererExerciceFx(7, cfg(["TH"]));
  const gPeu = parametres(brutPeu);
  const canonique = chaineCanonique(gPeu, transformationsAdmises(brutPeu.actives, gPeu))!.map((c) => ({ t: c.transformation, e: polynomeDe(c.apres) }));
  const horsSujet = G.verifier(exProjete(brutPeu, gPeu), CHAMP_CHAINE, brute([...construire([{ t: "TV", param: rat(3) }]), ...canonique].map((e, i) => (i === 0 ? { ...e, v: "99" } : e))));
  verifier(horsSujet.statut === "not_equivalent" && horsSujet.codesCompetence[0] === "TRANSFORMATION_HORS_SUJET", "règle vraie + transformation non admise + valeur fausse : code hors sujet conservé");
  // La solution écrite cite les valeurs (TH, TV, EV, CV) mais pas SOX.
  const sol = G.solutionAttendue(ex, CHAMP_CHAINE);
  verifier(/TH \(valeur \$3\$\)/.test(sol) && /EV \(valeur \$2\$\)/.test(sol) && /TV \(valeur \$4\$\)/.test(sol), `la solution cite les valeurs : ${sol}`);
  verifier(!/SOX \(valeur/.test(G.solutionAttendue(exProjete(brut, gNeg), CHAMP_CHAINE)), "la solution ne cite aucune valeur pour SOX");
  // Un résultat de vérification n'expose jamais la valeur attendue (le message d'une valeur illisible n'en cite aucune).
  const illisible = G.verifier(ex, CHAMP_CHAINE, avecValeur(0, "trois"));
  const autreExercice = G.verifier(exProjete(brut, P([5], [-2], [1])), CHAMP_CHAINE, avecValeur(0, "trois"));
  verifier(illisible.statut === "parse_error" && autreExercice.statut === "parse_error" && illisible.messageErreur === autreExercice.messageErreur, "le message d'une valeur illisible est le même pour tous les exercices (aucune valeur attendue n'y figure)");
}

// ── 6. Cascade : fonction effective dans TOUS les régimes (projeterExercice réel) ──
const REGIMES = [
  { nom: "coupée", reglages: { feedback_immediat: false, reponse_visible: false }, montree: false },
  { nom: "immédiate sans case", reglages: { feedback_immediat: true, reponse_visible: false }, montree: false },
  { nom: "immédiate avec case (solution montrée)", reglages: { feedback_immediat: true, reponse_visible: true }, montree: true },
];
const memeParams = (a: Parametres, b: Parametres): boolean => egalR(a.a, b.a) && egalR(a.p, b.p) && egalR(a.q, b.q);
for (const actives of CONFIGURATIONS) {
  const nom = actives.join("+");
  for (const graine of GRAINES.slice(0, 3)) {
    const brut = genererExerciceFx(graine, cfg(actives));
    const f = parametres(brut);
    const repli = parametresRepli(brut);
    const gFaux = P([-3, 4], [5, 2], [-7]); // jamais atteignable dans ces tests, ni égale à f
    const reponseFausse = (g: Parametres): ReponseConfirmee => ({ champ: CHAMP_EXPRESSION, reponseBrute: saisie(polynomeDe(g)), statut: "not_equivalent" });
    const reponseJuste: ReponseConfirmee = { champ: CHAMP_EXPRESSION, reponseBrute: saisie(polynomeDe(f)), statut: "correct" };
    for (const regime of REGIMES) {
      const lieu = `${nom} g=${graine} ${regime.nom}`;
      const effectifDe = (reps: ReponseConfirmee[]): Parametres => {
        const p = projeterExercice(regenere(brut), reps, { reglages: regime.reglages }).exercice as ExerciceFx;
        return depuisJson(p.effectif as NonNullable<ExerciceFx["effectif"]>);
      };
      verifier(memeParams(effectifDe([reponseJuste]), f), `${lieu} : réponse juste → la vraie fonction`);
      // Réponse fausse : solution montrée → la VRAIE (§45) ; sinon SA fonction, sans substitution, atteignable ou non.
      verifier(memeParams(effectifDe([reponseFausse(gFaux)]), regime.montree ? f : gFaux), `${lieu} : réponse fausse → ${regime.montree ? "la vraie fonction (révélée)" : "sa propre fonction, sans substitut"}`);
      const proche = P([2], [1], [1]);
      verifier(memeParams(effectifDe([reponseFausse(proche)]), regime.montree ? f : proche), `${lieu} : seconde réponse fausse`);
      // Aucune réponse (chrono) : la vraie fonction si montrée, sinon le repli (≠ f).
      verifier(memeParams(effectifDe([]), regime.montree ? f : repli), `${lieu} : aucune réponse → ${regime.montree ? "la vraie" : "le repli"}`);
      // Réponse illisible transmise (défensif) : comme « aucune ».
      verifier(memeParams(effectifDe([{ champ: CHAMP_EXPRESSION, reponseBrute: "(x-", statut: "not_equivalent" }]), regime.montree ? f : repli), `${lieu} : réponse illisible → comme aucune`);
      // Dépendances valides ; liste de champs inchangée par la projection.
      verifier(validerDependances(G.ecrans(brut)).length === 0, `${lieu} : dépendances valides`);
    }
  }
}

// L'énoncé de l'écran 2 ne dépend QUE de la fonction effective : ni de la configuration, ni du tirage, ni de la justesse de la réponse.
{
  const g = P([-3, 4], [5, 2], [-7]);
  const textes = new Set<string>();
  for (const actives of CONFIGURATIONS) for (const graine of GRAINES.slice(0, 2)) {
    const brut = genererExerciceFx(graine, cfg(actives));
    const e2 = G.ecrans(exProjete(brut, g))[1]! as EcranChaineTransformations;
    textes.add(e2.question ?? "");
    verifier(e2.consigne.startsWith("Détermine l'expression analytique") && !e2.consigne.includes("$f(x) ="), "la consigne reste générale : la fonction visée est dans la QUESTION, sous le graphe");
    verifier((e2.question ?? "").includes(`$f(x) = ${latexFonction(g)}$`), "l'énoncé reprend la fonction effective re-sérialisée");
    verifier(verifierBalisageMath(e2.consigne).length === 0 && verifierBalisageMath(e2.question ?? "").length === 0 && verifierBalisageMath(e2.legende ?? "").length === 0, "énoncé de l'écran 2 : balisage admis");
    verifier(e2.legende === "TH : translation horizontale · TV : translation verticale · EV : étirement vertical · CV : compression verticale · SOX : symétrie d'axe Ox." && !e2.consigne.includes("TH :") && !(e2.question ?? "").includes("TH :"), "la légende des abréviations est séparée (révélée par le « ? » de l'étape), jamais dans la consigne ni la question");
  }
  verifier(textes.size === 1, `énoncé identique pour toute configuration (${textes.size} variantes)`);
  // Une réponse brute écrite autrement donne le même énoncé (décoder puis re-sérialiser).
  const a = parametresDepuisReponse("-3/4*(x-5/2)^2-7")!;
  const b = parametresDepuisReponse("-0.75x^2+3.75x-11.6875")!;
  verifier(memeParams(a, g) && memeParams(b, g), "deux écritures de la même réponse donnent les mêmes paramètres");
  // L'exercice BRUT ne nomme aucune fonction.
  const brut = genererExerciceFx(9, cfg(["TH", "TV"]));
  const e2brut = G.ecrans(brut)[1]!;
  verifier(!(e2brut.question ?? "").includes(latexFonction(parametres(brut))) && !/\(x [-+]/.test(e2brut.question ?? "") && !/\(x [-+]/.test(e2brut.consigne), "écran 2 de l'exercice brut : aucune fonction nommée");
  verifier(e2brut.dependDe?.join() === CHAMP_EXPRESSION && e2brut.aide === undefined, "écran 2 : dépend de l'écran 1, aucune aide");
  verifier(JSON.stringify(e2brut.figure) === JSON.stringify(G.ecrans(brut)[0]!.figure), "la MÊME figure sur les deux écrans");
  verifier(e2brut.type === "chaine_transformations" && JSON.stringify((e2brut as { choix: unknown }).choix) === JSON.stringify(CHOIX_CHAINE) && CHOIX_CHAINE.length === 5, "le menu a toujours les cinq choix");
  for (const actives of CONFIGURATIONS) verifier(JSON.stringify((G.ecrans(genererExerciceFx(1, cfg(actives)))[1] as { choix: unknown }).choix) === JSON.stringify(CHOIX_CHAINE), `menu identique (${actives.join("+")})`);
  // Valeurs démesurées → inexploitable.
  verifier(parametresDepuisReponse("9007199254740991x^2+9007199254740991x+1") === null && parametresDepuisReponse("x") === null && parametresDepuisReponse("3") === null && parametresDepuisReponse("100000x^2+x") === null, "réponses démesurées ou de mauvais degré : inexploitables");
}

// ── 7. Poids inversés ──
{
  verifier(POIDS_EXPRESSION === 3 && POIDS_CHAINE === 2, "poids : 3 pour l'écran 1, 2 pour l'écran 2");
  for (const actives of CONFIGURATIONS) {
    const poids = poidsDesEcrans(G.ecrans(genererExerciceFx(2, cfg(actives))));
    verifier(poids.get(CHAMP_EXPRESSION) === 3 && poids.get(CHAMP_CHAINE) === 2, `poids ${actives.join("+")}`);
  }
  // Incitatif : le gain maximal d'une erreur délibérée à l'écran 1 (écran 2 entier, 2 points) est inférieur au minimum d'un élève qui réussit l'écran 1 (3 points).
  verifier(POIDS_CHAINE < POIDS_EXPRESSION, "se tromper exprès ne rapporte jamais : 2 < 3 pour toute probabilité de réussir l'écran 2");
}

// ── 8. Solution lisible de l'écran 2 ──
for (const actives of CONFIGURATIONS) {
  const brut = genererExerciceFx(13, cfg(actives));
  for (const g of [parametres(brut), parametresRepli(brut), P([-2], [3], [1]), P([1], [0], [0])]) {
    try {
      const sol = G.solutionAttendue(exProjete(brut, g), CHAMP_CHAINE);
      verifier(sol.startsWith("Une chaîne possible") && verifierBalisageMath(sol).length === 0, `solution écran 2 (${actives.join("+")})`);
    } catch (e) {
      verifier(false, `solution écran 2 (${actives.join("+")}) : ${(e as Error).message}`);
    }
  }
}

// ── 9. Garde de forme : les résultats passent le contrôle du registre pour tout type de verdict ──
{
  const brut = genererExerciceFx(21, cfg(["TH", "TV", "EV", "SOX"]));
  const ex = exProjete(brut, parametres(brut));
  for (const texte of [brute([{ t: "TH", e: polynomeDe(P([1], [2], [0])) }]), "[]", brute([{ t: "TV", e: polynomeDe(P([1], [0], [1])) }, { t: "TV", e: polynomeDe(P([1], [0], [2])) }])]) {
    try {
      verifierAvecControle(G, ex, CHAMP_CHAINE, texte);
      verifier(true, "contrôle du registre");
    } catch (e) {
      verifier(false, `contrôle du registre refuse un résultat : ${(e as Error).message}`);
    }
  }
  void degre;
  void lirePolynome;
  void oppR;
  void effectifDepuisReponses;
  void projeterFx;
}

if (echecs.length > 0) {
  console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
  for (const e of echecs.slice(0, 40)) console.error(` - ${e}`);
  process.exit(1);
}
console.log(`OK : ${nb} vérifications (gen8 écran 2 : atteignabilité et transformations admises, clause x², règles locales, chaînes construites, hors sujet y compris deux étapes qui s'annulent, crédit partiel plafonné, cascade dans les trois régimes, poids 3/2)`);
