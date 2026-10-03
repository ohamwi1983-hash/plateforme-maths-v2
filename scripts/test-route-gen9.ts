// Test permanent — gen9 « Complète le carré » dans le VRAI `api/router.ts` avec le VRAI registre (RAPPORT §59), base en mémoire, sans réseau. Lancer : `npm run test-route-gen9`.
// Câblage (catalogue, JSON, prof.html), validation des lignes configurables (TH OBLIGATOIRE : refusée sinon, jamais complétée), assignation (configuration figée, champs attendus), service des
// écrans, recopie de l'énoncé refusée (parse_error, rien stocké), codes de l'écran 1 stockés mais jamais servis, cascade de l'écran 2 sous les TROIS régimes de correction, chaînes jugées de
// bout en bout, aide à deux paliers (formule_coloree, emphase au palier 2), poids 3/2.

export {}; // module

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appeler, creerScenario, installerBase } from "./support/harnaisRouteur";
import { verifierBalisageMath } from "./support/texteMath";
import { CATALOGUE_GENERATEURS } from "../lib/catalogueGenerateurs";
import { chercherGenerateur } from "../lib/registreGenerateurs";
import { genererExerciceCc } from "../src/generateurs/completionDuCarre/generation";
import { aideFormeCanonique } from "../src/generateurs/completionDuCarre/aide";
import { latexDeveloppe } from "../src/generateurs/completionDuCarre/enonce";
import { chaineCanonique, parametreEtape, transformationsAdmises } from "../src/generateurs/_noyauQuadratique/chaine";
import { latexFonction } from "../src/generateurs/_noyauQuadratique/formatage";
import { coefficient, constante, plusP, type Polynome } from "../src/generateurs/_noyauQuadratique/polynome";
import { parametres, coefficientsDeveloppes } from "../src/generateurs/completionDuCarre/types";
import { TRANSFORMATIONS, polynomeDe, type Parametres, type Transformation } from "../src/generateurs/_noyauQuadratique/types";
import { POLYNOME_DEPART } from "../src/generateurs/_noyauQuadratique/chaine";
import { rat, signeR, type Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const VARIANTE = "completion_du_carre";
const RACINE = join(__dirname, "..");

const rationnel = (r: Rat): string => `(${r.n}${r.d === 1 ? "" : `/${r.d}`})`;
function saisie(p: Polynome): string {
  const termes: string[] = [];
  for (let k = p.length - 1; k >= 0; k--) {
    const c = coefficient(p, k);
    if (signeR(c) === 0) continue;
    termes.push(k === 0 ? rationnel(c) : k === 1 ? `${rationnel(c)}*x` : `${rationnel(c)}*x^${k}`);
  }
  return termes.join("+") || "0";
}
/** Forme canonique SAISIE : `a*(x-p)^2+q`. */
const canonique = (g: Parametres): string => `${rationnel(g.a)}*(x-${rationnel(g.p)})^2+${rationnel(g.q)}`;
// Valeur déclarée (RAPPORT §58) : la vraie valeur de l'étape (`parametreEtape`), « 1 » si sa règle est fausse, aucune pour SOX.
function chaineBrute(etapes: { t: string; e: Polynome }[]): string {
  let avant: Polynome = POLYNOME_DEPART;
  return JSON.stringify({
    etapes: etapes.map(({ t, e }) => {
      const parametre = (TRANSFORMATIONS as readonly string[]).includes(t) ? parametreEtape(t as Transformation, avant, e) : null;
      avant = e;
      return { expression: saisie(e), transformation: t, valeur: t === "SOX" ? "" : parametre === null ? "1" : parametre.d === 1 ? String(parametre.n) : `${parametre.n}/${parametre.d}` };
    }),
  });
}
const chainePour = (g: Parametres, actives: readonly Transformation[]): { t: string; e: Polynome }[] =>
  (chaineCanonique(g, transformationsAdmises(actives, g)) ?? []).map((c) => ({ t: c.transformation, e: polynomeDe(c.apres) }));

interface Options {
  feedback?: boolean;
  visible?: boolean;
  aide?: boolean;
  tentatives?: number;
}
const REGIMES: { nom: string; o: Options; montree: boolean }[] = [
  { nom: "coupée", o: { feedback: false, visible: false }, montree: false },
  { nom: "immédiate sans case", o: { feedback: true, visible: false }, montree: false },
  { nom: "immédiate avec case", o: { feedback: true, visible: true }, montree: true },
];

async function main(): Promise<void> {
  const s = creerScenario();
  installerBase(s.base);
  const jetonProf = `prof:${s.profId}`;
  const jetonEleve = "eleve:eleve-1";
  let compteur = 0;

  const creerTacheGen9 = async (lignes: { configuration: unknown; nombre?: number }[], o: Options = {}) => {
    compteur++;
    return appeler("taches", "POST", {
      jeton: jetonProf,
      corps: {
        nom: `gen9 ${compteur}`,
        feedback_immediat: o.feedback ?? true,
        reponse_visible: o.visible ?? true,
        tentatives_supplementaires: o.tentatives ?? 0,
        aide_activee: o.aide ?? false,
        composition: lignes.map((l) => ({ variante_id: VARIANTE, nombre_exercices: l.nombre ?? 1, configuration: l.configuration })),
      },
    });
  };
  const nouveau = async (actives: readonly Transformation[], graine: number, o: Options = {}) => {
    const cree = await creerTacheGen9([{ configuration: { actives: [...actives] }, nombre: 2 }], o);
    verifier(cree.statut === 201, `tâche gen9 ${actives.join("+")} : ${cree.statut} ${JSON.stringify(cree.corps)}`);
    const tache = cree.corps.id as string;
    const origine = Math.random;
    Math.random = () => graine / 2 ** 32;
    try {
      const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `assignation gen9 : ${a.statut} ${JSON.stringify(a.corps)}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const brut = genererExerciceCc(Number(ligne.graine), { actives: [...actives] });
    return {
      tache,
      ligne,
      id,
      brut,
      f: parametres(brut),
      poster: (champ: string, brute: string) => appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, reponse_brute: brute } }),
      aide: (champ: string, palier?: number) => appeler("reponses/aide", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: id, champ, ...(palier === undefined ? {} : { palier }) } }),
      lire: async () => (await appeler(`exercices/${id}`, "GET", { jeton: jetonEleve })).corps as any,
      lignesReponses: (champ: string) => s.base.table("reponses").filter((l) => l.exercice_assigne_id === id && l.champ === champ),
      aidesUtilisees: () => s.base.table("aides_utilisees").filter((l) => l.exercice_assigne_id === id),
    };
  };

  // ── 1. Câblage : catalogue serveur, JSON, prof.html ──
  const cat = await appeler("catalogue-generateurs", "GET", { jeton: jetonProf });
  const entree = (cat.corps as any[]).find((e) => e.variante_id === VARIANTE);
  verifier(entree?.executable === true && entree.generateur_id === "gen9" && entree.label === "Forme canonique et transformations", "catalogue serveur : gen9 exécutable, libellé exact");
  verifier(entree?.configuration?.cases?.map((c: any) => c.id).join() === "TH,TV,EV,CV,SOX" && JSON.stringify(entree.configuration.exclusifs) === '[["EV","CV"]]' && JSON.stringify(entree.configuration.obligatoires) === '["TH"]', "catalogue serveur : descripteur servi, TH obligatoire");
  verifier(CATALOGUE_GENERATEURS.filter((e) => e.variante_id === VARIANTE).length === 1 && chercherGenerateur(VARIANTE) !== null, "une seule entrée de catalogue, au registre");
  const json = JSON.parse(readFileSync(join(RACINE, "public/catalogue-generateurs-complet.json"), "utf8")) as { "4e": { numero: number; chapitre: number; libelle: string; variantes: { axe: string; label: string }[] | string }[] };
  const e68 = json["4e"].filter((g) => g.numero === 68);
  verifier(e68.length === 1 && e68[0]!.chapitre === 1 && Array.isArray(e68[0]!.variantes) && e68[0]!.variantes.length === 1 && (e68[0]!.variantes as { label: string }[])[0]!.label === "Forme canonique et transformations", "JSON : 4e n°68, chapitre 1, UNE variante au libellé identique au catalogue");
  const html = readFileSync(join(RACINE, "public/prof.html"), "utf8");
  verifier(/"4e:68":\s*\[\s*\{\s*index:\s*0,\s*variante_id:\s*"completion_du_carre"\s*\}\s*\]/.test(html), 'prof.html : CORRESPONDANCE_JSON_VERS_PILOTE["4e:68"] = [{ index: 0, variante_id: "completion_du_carre" }]');
  const bloc = /const NUMEROS_PAR_CHAPITRE_4E = \{([\s\S]*?)\n    \};/.exec(html);
  const numeros = bloc ? [...(bloc[1] as string).matchAll(/\[([0-9, ]+)\]/g)].flatMap((m) => (m[1] as string).split(",").map((x) => Number(x.trim()))) : [];
  verifier(numeros.length === json["4e"].length && new Set(numeros).size === numeros.length && json["4e"].every((g) => numeros.includes(g.numero)), `prof.html : NUMEROS_PAR_CHAPITRE_4E couvre exactement une fois chaque numéro du JSON (${numeros.length}/${json["4e"].length})`);
  verifier(/1:\s*\[7, 8, 9, 67, 68,/.test(html), "prof.html : le n°68 est rangé dans le chapitre « La fonction du second degré »");

  // ── 2. Validation des lignes configurables (routes réelles) : TH est OBLIGATOIRE, jamais ajoutée d'office ──
  const avantTaches = s.base.table("taches").length;
  for (const [nom, configuration] of [["vide", { actives: [] }], ["sans TH", { actives: ["TV", "EV"] }], ["SOX seul", { actives: ["SOX"] }], ["EV et CV", { actives: ["TH", "EV", "CV"] }], ["inconnue", { actives: ["TH", "XX"] }], ["absente", undefined], ["forme", "TH"]] as const) {
    const r = await creerTacheGen9([{ configuration }]);
    verifier(r.statut === 400 && typeof r.corps.erreur === "string", `ligne gen9 ${nom} : 400 explicite (${r.statut})`);
  }
  verifier(s.base.table("taches").length === avantTaches, "les lignes refusées n'ont rien écrit");
  const canon = await creerTacheGen9([{ configuration: { actives: ["SOX", "CV", "TH"] } }]);
  verifier(canon.statut === 201 && JSON.stringify(s.base.table("taches_composition").find((l) => l.tache_id === canon.corps.id)!.configuration) === '{"actives":["TH","CV","SOX"]}', "configuration stockée sous sa forme canonique");
  const deux = await creerTacheGen9([{ configuration: { actives: ["TH"] }, nombre: 2 }, { configuration: { actives: ["TH", "EV"] } }, { configuration: { actives: ["TH"] }, nombre: 1 }]);
  verifier(deux.statut === 201 && s.base.table("taches_composition").filter((l) => l.tache_id === deux.corps.id).map((l) => `${(l.configuration as any).actives.join("+")}:${l.nombre_exercices}`).join() === "TH:3,TH+EV:1", "deux lignes gen9 : doublons exacts fusionnés, configurations différentes séparées");

  // ── 3. Assignation et service : les 12 configurations ──
  const configurations: Transformation[][] = [];
  for (const tv of [false, true]) for (const echelle of [null, "EV", "CV"] as const) for (const sox of [false, true]) configurations.push(["TH", ...(tv ? ["TV" as const] : []), ...(echelle ? [echelle] : []), ...(sox ? ["SOX" as const] : [])]);
  verifier(configurations.length === 12, "12 configurations");
  for (const actives of configurations) {
    const x = await nouveau(actives, 424242, { aide: true });
    verifier(x.ligne.generateur_id === "gen9" && JSON.stringify(x.ligne.configuration) === JSON.stringify({ actives }) && JSON.stringify(x.ligne.champs_attendus) === '["forme","chaine"]', `${actives.join("+")} : générateur, configuration figée, champs attendus`);
    verifier(typeof x.ligne.composition_id === "string", `${actives.join("+")} : exercice lié à sa ligne de composition`);
    const g = await x.lire();
    verifier(g.ecrans.length === 1 && g.ecrans[0].champ === "forme" && g.champ_courant === "forme", `${actives.join("+")} : seul l'écran 1 est servi au départ`);
    verifier(g.champs.length === 2 && g.champs[0].poids === 3 && g.champs[1].poids === 2, `${actives.join("+")} : poids 3 et 2 servis pour les deux champs`);
    const brut = JSON.stringify(g);
    verifier(!brut.includes("moteur-emphase") && !brut.includes('"segments"') && !/"aide":/.test(brut), `${actives.join("+")} : aucune aide dans l'exercice servi`);
    verifier(g.ecrans.every((e: any) => verifierBalisageMath(e.consigne).length === 0 && verifierBalisageMath(e.question ?? "").length === 0) && g.ecrans[0].figure === undefined && g.ecrans[0].aide_paliers === 2, `${actives.join("+")} : pas de figure, deux paliers d'aide annoncés`);
    verifier((g.ecrans[0].question ?? "").includes(`$f(x) = ${latexDeveloppe(x.brut)}$`), `${actives.join("+")} : l'énoncé est la forme développée`);
    verifier(g.champs.every((c: any) => c.solution_attendue === null && c.score === null), `${actives.join("+")} : aucune solution servie au départ`);
  }

  // ── 4. Cascade et chaînes de bout en bout, sous les trois régimes ──
  const CAS: { actives: Transformation[]; nom: string }[] = [
    { actives: ["TH"], nom: "TH seul" },
    { actives: ["TH", "TV", "SOX"], nom: "TH+TV+SOX" },
    { actives: ["TH", "EV"], nom: "TH+EV" },
    { actives: ["TH", "TV", "CV", "SOX"], nom: "TH+TV+CV+SOX" },
  ];
  for (const regime of REGIMES) {
    for (const cas of CAS) {
      const lieu = `${regime.nom} · ${cas.nom}`;
      const immediat = regime.o.feedback ?? true;

      // 4a. Réponse JUSTE à l'écran 1, puis chaîne juste.
      {
        const x = await nouveau(cas.actives, 777, regime.o);
        const r1 = await x.poster("forme", canonique(x.f));
        verifier(r1.statut === 200 && (immediat ? r1.corps.statut === "correct" : !("statut" in r1.corps)), `${lieu} : réponse juste enregistrée (${immediat ? "verdict" : "rien révélé"})`);
        const g = await x.lire();
        verifier(g.ecrans.map((e: any) => e.champ).join() === "forme,chaine" && g.champ_courant === "chaine", `${lieu} : l'écran 2 est servi après l'écran 1`);
        const e2 = g.ecrans.find((e: any) => e.champ === "chaine");
        verifier((e2.question ?? "").includes(`$f(x) = ${latexFonction(x.f)}$`), `${lieu} : l'énoncé reprend la fonction (vraie, confirmée juste)`);
        verifier(e2.type === "chaine_transformations" && e2.choix.length === 5 && e2.aide_disponible !== true && JSON.stringify(e2.figure) === JSON.stringify(g.ecrans[0].figure), `${lieu} : écran 2 sans aide, menu à 5 choix, même figure`);
        const r2 = await x.poster("chaine", chaineBrute(chainePour(x.f, cas.actives)));
        verifier(r2.statut === 200 && x.lignesReponses("chaine")[0]?.statut === "correct", `${lieu} : chaîne juste → correct en base`);
        verifier(immediat ? r2.corps.statut === "correct" : !("statut" in r2.corps), `${lieu} : verdict de l'écran 2 ${immediat ? "servi" : "non servi (la tâche n'est pas terminée : 2 exercices)"}`);
        verifier(!JSON.stringify(r2.corps).includes("fraction"), `${lieu} : aucune fraction de mérite dans la réponse HTTP`);
      }

      // 4b. Réponse FAUSSE (inatteignable avec la configuration : q = 5 et p = 2 sans TV ni TH, a = −3/4) puis chaîne vers CETTE fonction.
      {
        const x = await nouveau(cas.actives, 888, regime.o);
        const gEleve: Parametres = { a: rat(-3, 4), p: rat(2), q: rat(5) };
        const r1 = await x.poster("forme", canonique(gEleve));
        verifier(r1.statut === 200 && (immediat ? r1.corps.statut === "not_equivalent" : !("statut" in r1.corps)), `${lieu} : réponse fausse enregistrée`);
        const g = await x.lire();
        const e2 = g.ecrans.find((e: any) => e.champ === "chaine");
        const attendu = regime.montree ? x.f : gEleve;
        verifier(!!e2 && (e2.question ?? "").includes(`$f(x) = ${latexFonction(attendu)}$`), `${lieu} : l'énoncé affiche ${regime.montree ? "la VRAIE fonction (révélée, §45)" : "la fonction confirmée par l'élève, sans substitut"}`);
        if (!regime.montree) verifier(!(e2.question ?? "").includes(`$f(x) = ${latexFonction(x.f)}$`) && !e2.consigne.includes("$f(x) ="), `${lieu} : la vraie fonction ne fuit pas dans l'énoncé`);
        // La chaîne vers la fonction affichée est juste — même si sa fonction exige des transformations que la ligne n'active pas (option 4).
        const r2 = await x.poster("chaine", chaineBrute(chainePour(attendu, cas.actives)));
        verifier(r2.statut === 200 && x.lignesReponses("chaine")[0]?.statut === "correct", `${lieu} : chaîne vers la fonction affichée → correct en base (option 4)`);
        // …et la chaîne vers l'AUTRE fonction n'est pas juste (jugée sur la fonction effective).
        const y = await nouveau(cas.actives, 888, regime.o);
        await y.poster("forme", canonique(gEleve));
        const autre = regime.montree ? gEleve : x.f;
        const r3 = await y.poster("chaine", chaineBrute(chainePour(autre, cas.actives)));
        verifier(r3.statut === 200 && y.lignesReponses("chaine")[0]?.statut === "not_equivalent", `${lieu} : chaîne vers l'autre fonction → faux`);
      }
    }
  }

  // ── 5. Hors sujet de bout en bout (TH seul ; TV inactive) : paire +3 / −3 qui s'annule ──
  for (const regime of REGIMES) {
    const lieu = `hors sujet · ${regime.nom}`;
    const immediat = regime.o.feedback ?? true;
    const x = await nouveau(["TH"], 999, regime.o);
    await x.poster("forme", canonique(x.f));
    const paire = [{ t: "TV", e: plusP(POLYNOME_DEPART, constante(rat(3))) }, { t: "TV", e: POLYNOME_DEPART }];
    const apresPaire = chainePour(x.f, ["TH"]);
    const r = await x.poster("chaine", chaineBrute([...paire, ...apresPaire]));
    const ligne = x.lignesReponses("chaine")[0]!;
    verifier(ligne.statut === "not_equivalent" && String(ligne.bug_detecte ?? "").includes("TRANSFORMATION_HORS_SUJET"), `${lieu} : faux malgré l'arrivée exacte, code stocké (${String(ligne.bug_detecte)})`);
    verifier(ligne.fraction_correcte !== null && Math.abs(Number(ligne.fraction_correcte) - 2 / 4) < 1e-9, `${lieu} : fraction de mérite stockée = (min(1 valide, k*=1) + arrivée) / (3 + 1) (${String(ligne.fraction_correcte)})`);
    if (immediat) verifier(r.corps.statut === "not_equivalent" && JSON.stringify(r.corps.parties_fausses) === '["etape:0","etape:1"]', `${lieu} : étapes fautives surlignées (porte §52)`);
    else verifier(!("statut" in r.corps) && !("parties_fausses" in r.corps), `${lieu} : rien n'est révélé sous correction coupée`);
    verifier(!JSON.stringify(r.corps).includes("fraction") && !JSON.stringify(r.corps).includes("HORS_SUJET"), `${lieu} : ni fraction ni code dans la réponse HTTP`);
  }

  // ── 6. Aide de l'écran 1 : formule_coloree à deux paliers, dans l'ordre, pénalité unique ; aucune aide à l'écran 2 ──
  {
    const x = await nouveau(["TH", "TV", "EV"], 1212, { feedback: true, visible: true, aide: true });
    const attendue = aideFormeCanonique(x.brut);
    const hors = await x.aide("forme", 2);
    verifier(hors.statut !== null && hors.statut >= 400 && x.aidesUtilisees().length === 0, `palier 2 avant le palier 1 : refusé, rien enregistré (${hors.statut})`);
    const p1 = await x.aide("forme", 1);
    verifier(p1.statut === 200 && p1.corps.aide?.type === "formule_coloree" && p1.corps.aide.palier === 1 && p1.corps.aide.palierTotal === 2, `palier 1 servi (${p1.statut})`);
    verifier(JSON.stringify(p1.corps.aide?.segments) === JSON.stringify(attendue.paliers![0]!.segments) && !JSON.stringify(p1.corps).includes("emphase"), "palier 1 : sa formule seule, rien du palier 2");
    const p2 = await x.aide("forme", 2);
    verifier(p2.statut === 200 && p2.corps.aide.palier === 2 && JSON.stringify(p2.corps.aide.segments) === JSON.stringify(attendue.paliers![1]!.segments) && JSON.stringify(p2.corps).includes("emphase"), "palier 2 : le schéma symbolique, avec l'emphase");
    verifier(x.aidesUtilisees().length === 1 && x.aidesUtilisees()[0]!.palier === 2, "une seule ligne d'usage, palier le plus élevé atteint (pénalité binaire)");
    const g = await x.lire();
    verifier(g.champs[0].aide_utilisee === true && g.champs[0].aide_palier === 2, "GET : palier atteint exposé");
    await x.poster("forme", canonique(x.f));
    const a2 = await x.aide("chaine");
    verifier(a2.statut !== null && a2.statut >= 400 && x.aidesUtilisees().every((l) => l.champ !== "chaine"), `écran 2 : aucune aide (${a2.statut})`);
  }

  // ── 7. Requêtes forgées : l'écran 2 avant l'écran 1 ; clé en trop ; RECOPIE de l'énoncé développé : parse_error, rien stocké ──
  {
    const x = await nouveau(["TH"], 4343, { feedback: true, visible: true, tentatives: 1 });
    const t = await x.poster("chaine", chaineBrute([{ t: "TH", e: polynomeDe({ a: rat(1), p: rat(1), q: rat(0) }) }]));
    verifier(t.statut !== null && t.statut >= 400 && x.lignesReponses("chaine").length === 0, `écran 2 avant l'écran 1 : refusé, rien enregistré (${t.statut})`);
    const extra = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: x.id, champ: "forme", reponse_brute: "x^2", brouillon: "(x-1)^2" } });
    verifier(extra.statut === 400, "clé supplémentaire : 400");
    const { a, b, c } = coefficientsDeveloppes(x.f);
    const recopie = `${rationnel(a)}*x^2+${rationnel(b)}*x+${rationnel(c)}`;
    const r = await x.poster("forme", recopie);
    // `parse_error` COMPTE comme une tentative ratée, comme tout statut ≠ correct (`lib/moteurTentatives.ts`) : la ligne est stockée. Jamais « correct » ; sous correction immédiate, le message explique la forme attendue.
    verifier(r.statut === 200 && r.corps.statut === "parse_error" && x.lignesReponses("forme").length === 1 && x.lignesReponses("forme")[0]!.statut === "parse_error", `recopie de l'énoncé développé « ${recopie} » : parse_error stocké (${r.statut} ${JSON.stringify(r.corps)})`);
    verifier(String(r.corps.message_erreur ?? "").includes("forme canonique") && r.corps.tentatives_restantes === 1 && r.corps.verrouille !== true && !("solution_attendue" in r.corps), "recopie : message sur la forme attendue, une tentative restante, rien de révélé");
    const ok = await x.poster("forme", canonique(x.f));
    verifier(ok.statut === 200 && x.lignesReponses("forme").length === 2 && x.lignesReponses("forme")[1]!.statut === "correct", "la forme canonique juste est ensuite enregistrée comme correcte");
  }

  // ── 7b. Codes de l'écran 1 : stockés (bug_detecte), JAMAIS servis ; sous les trois régimes ──
  for (const regime of REGIMES) {
    const immediat = regime.o.feedback ?? true;
    const x = await nouveau(["TH", "EV"], 2468, regime.o);
    const v = x.f;
    const fausse: Parametres = { ...v, p: rat(v.a.n * v.p.n, v.a.d * v.p.d) }; // p' = a·p : P_FACTEUR_A_OUBLIE (a ≠ ±1 avec EV)
    verifier(!(v.a.n === v.a.d) && !(v.a.n === -v.a.d), `a ≠ ±1 pour cet exercice (${v.a.n}/${v.a.d})`);
    const r = await x.poster("forme", canonique(fausse));
    const ligne = x.lignesReponses("forme")[0]!;
    verifier(ligne.statut === "not_equivalent" && String(ligne.bug_detecte ?? "").includes("P_FACTEUR_A_OUBLIE"), `${regime.nom} : code stocké (${String(ligne.bug_detecte)})`);
    verifier(!JSON.stringify(r.corps).includes("P_FACTEUR_A_OUBLIE") && !JSON.stringify(r.corps).includes("bug"), `${regime.nom} : aucun code dans la réponse HTTP`);
    if (immediat) verifier(r.corps.statut === "not_equivalent" && JSON.stringify(r.corps.parties_fausses) === '["champ"]', `${regime.nom} : champ surligné (porte §52)`);
    else verifier(!("statut" in r.corps) && !("parties_fausses" in r.corps), `${regime.nom} : rien n'est révélé sous correction coupée`);
  }

  // ── 8. Configuration FIGÉE : l'API refuse de modifier une tâche assignée ; même une altération directe de la ligne de composition ne change rien pour l'exercice assigné ──
  {
    const x = await nouveau(["TH"], 5656);
    const avant = JSON.stringify(await x.lire());
    const patch = await appeler(`taches/${x.tache}`, "PATCH", { jeton: jetonProf, corps: { nom: "gen9 modifiée", composition: [{ variante_id: VARIANTE, nombre_exercices: 1, configuration: { actives: ["TV", "SOX"] } }] } });
    verifier(patch.statut === 400, `PATCH d'une tâche assignée : refusé (${patch.statut})`);
    const ligneComposition = s.base.table("taches_composition").find((l) => l.tache_id === x.tache)!;
    ligneComposition.configuration = { actives: ["TV", "SOX"] }; // altération hors API
    verifier(JSON.stringify(await x.lire()) === avant, "l'exercice déjà assigné ne bouge pas : la configuration est lue sur l'exercice, jamais sur la ligne de composition");
    await x.poster("forme", canonique(x.f));
    const r = await x.poster("chaine", chaineBrute(chainePour(x.f, ["TH"])));
    verifier(r.statut === 200 && x.lignesReponses("chaine")[0]?.statut === "correct", "la chaîne de la configuration figée reste juste");
  }
}

main()
  .then(() => {
    if (echecs.length > 0) {
      console.error(`ÉCHEC : ${echecs.length} vérification(s) sur ${nb}`);
      for (const e of echecs) console.error(` - ${e}`);
      process.exit(1);
    }
    console.log(`OK : ${nb} vérifications (gen9 dans le vrai routeur : câblage, TH obligatoire, 12 configurations, recopie refusée, codes stockés non servis, cascade de l'écran 2 sous les trois régimes, option 4, hors sujet, aide à deux paliers, configuration figée)`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
