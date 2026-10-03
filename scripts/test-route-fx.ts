// Test permanent — gen8 « f(x) à partir du graphe » dans le VRAI `api/router.ts` avec le VRAI registre (RAPPORT §57), base en mémoire, sans réseau. Lancer : `npm run test-route-fx`.
// Câblage (catalogue, JSON, prof.html), validation des lignes configurables, assignation (configuration figée, champs attendus), service des écrans, cascade de l'écran 2 sous les TROIS
// régimes de correction (option 4 : la fonction affichée est TOUJOURS celle que l'élève a confirmée, sauf solution montrée), chaînes jugées de bout en bout, hors sujet, crédit partiel stocké
// mais jamais servi, aide à deux paliers dans l'ordre, poids 3/2.

export {}; // module

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { appeler, creerScenario, installerBase } from "./support/harnaisRouteur";
import { verifierBalisageMath } from "./support/texteMath";
import { CATALOGUE_GENERATEURS } from "../lib/catalogueGenerateurs";
import { chercherGenerateur } from "../lib/registreGenerateurs";
import { genererExerciceFx } from "../src/generateurs/fxDepuisGraphe/generation";
import { chaineCanonique, parametreEtape, transformationsAdmises } from "../src/generateurs/_noyauQuadratique/chaine";
import { latexFonction } from "../src/generateurs/_noyauQuadratique/formatage";
import { coefficient, constante, plusP, type Polynome } from "../src/generateurs/_noyauQuadratique/polynome";
import { parametres } from "../src/generateurs/fxDepuisGraphe/types";
import { TRANSFORMATIONS, polynomeDe, type Parametres, type Transformation } from "../src/generateurs/_noyauQuadratique/types";
import { POLYNOME_DEPART } from "../src/generateurs/_noyauQuadratique/chaine";
import { rat, signeR, type Rat } from "../src/generateurs/analyseFonctionMotifDelta/exact/rationnel";

const echecs: string[] = [];
let nb = 0;
function verifier(condition: boolean, message: string): void {
  nb++;
  if (!condition && echecs.length < 40) echecs.push(message);
}

const VARIANTE = "fx_depuis_graphe";
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

  const creerTacheGen8 = async (lignes: { configuration: unknown; nombre?: number }[], o: Options = {}) => {
    compteur++;
    return appeler("taches", "POST", {
      jeton: jetonProf,
      corps: {
        nom: `gen8 ${compteur}`,
        feedback_immediat: o.feedback ?? true,
        reponse_visible: o.visible ?? true,
        tentatives_supplementaires: o.tentatives ?? 0,
        aide_activee: o.aide ?? false,
        composition: lignes.map((l) => ({ variante_id: VARIANTE, nombre_exercices: l.nombre ?? 1, configuration: l.configuration })),
      },
    });
  };
  const nouveau = async (actives: readonly Transformation[], graine: number, o: Options = {}) => {
    const cree = await creerTacheGen8([{ configuration: { actives: [...actives] }, nombre: 2 }], o);
    verifier(cree.statut === 201, `tâche gen8 ${actives.join("+")} : ${cree.statut} ${JSON.stringify(cree.corps)}`);
    const tache = cree.corps.id as string;
    const origine = Math.random;
    Math.random = () => graine / 2 ** 32;
    try {
      const a = await appeler("assignations", "POST", { jeton: jetonProf, corps: { tache_id: tache, eleve_ids: ["eleve-1"] } });
      verifier(a.statut === 201, `assignation gen8 : ${a.statut} ${JSON.stringify(a.corps)}`);
    } finally {
      Math.random = origine;
    }
    const ligne = s.base.table("exercices_assignes").find((l) => l.tache_id === tache)!;
    const id = ligne.id as string;
    const brut = genererExerciceFx(Number(ligne.graine), { actives: [...actives] });
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
  verifier(entree?.executable === true && entree.generateur_id === "gen8" && entree.label === "f(x) à partir du graphe", "catalogue serveur : gen8 exécutable, libellé exact");
  verifier(entree?.configuration?.cases?.map((c: any) => c.id).join() === "TH,TV,EV,CV,SOX" && JSON.stringify(entree.configuration.exclusifs) === '[["EV","CV"]]', "catalogue serveur : le descripteur de configuration est servi");
  verifier(CATALOGUE_GENERATEURS.filter((e) => e.variante_id === VARIANTE).length === 1 && chercherGenerateur(VARIANTE) !== null, "une seule entrée de catalogue, au registre");
  const json = JSON.parse(readFileSync(join(RACINE, "public/catalogue-generateurs-complet.json"), "utf8")) as { "4e": { numero: number; chapitre: number; libelle: string; variantes: { axe: string; label: string }[] | string }[] };
  const e67 = json["4e"].filter((g) => g.numero === 67);
  verifier(e67.length === 1 && e67[0]!.chapitre === 1 && Array.isArray(e67[0]!.variantes) && e67[0]!.variantes.length === 1 && (e67[0]!.variantes as { label: string }[])[0]!.label === "f(x) à partir du graphe", "JSON : 4e n°67, chapitre 1, UNE variante au libellé identique au catalogue");
  const html = readFileSync(join(RACINE, "public/prof.html"), "utf8");
  verifier(/"4e:67":\s*\[\s*\{\s*index:\s*0,\s*variante_id:\s*"fx_depuis_graphe"\s*\}\s*\]/.test(html), 'prof.html : CORRESPONDANCE_JSON_VERS_PILOTE["4e:67"] = [{ index: 0, variante_id: "fx_depuis_graphe" }]');
  const bloc = /const NUMEROS_PAR_CHAPITRE_4E = \{([\s\S]*?)\n    \};/.exec(html);
  const numeros = bloc ? [...(bloc[1] as string).matchAll(/\[([0-9, ]+)\]/g)].flatMap((m) => (m[1] as string).split(",").map((x) => Number(x.trim()))) : [];
  verifier(numeros.length === json["4e"].length && new Set(numeros).size === numeros.length && json["4e"].every((g) => numeros.includes(g.numero)), `prof.html : NUMEROS_PAR_CHAPITRE_4E couvre exactement une fois chaque numéro du JSON (${numeros.length}/${json["4e"].length})`);
  verifier(/1:\s*\[7, 8, 9, 67,/.test(html), "prof.html : le n°67 est rangé dans le chapitre « La fonction du second degré »");

  // ── 2. Validation des lignes configurables (routes réelles) ──
  const avantTaches = s.base.table("taches").length;
  for (const [nom, configuration] of [["vide", { actives: [] }], ["EV et CV", { actives: ["EV", "CV"] }], ["inconnue", { actives: ["TH", "XX"] }], ["absente", undefined], ["forme", "TH"]] as const) {
    const r = await creerTacheGen8([{ configuration }]);
    verifier(r.statut === 400 && typeof r.corps.erreur === "string", `ligne gen8 ${nom} : 400 explicite (${r.statut})`);
  }
  verifier(s.base.table("taches").length === avantTaches, "les lignes refusées n'ont rien écrit");
  const canon = await creerTacheGen8([{ configuration: { actives: ["SOX", "CV", "TH"] } }]);
  verifier(canon.statut === 201 && JSON.stringify(s.base.table("taches_composition").find((l) => l.tache_id === canon.corps.id)!.configuration) === '{"actives":["TH","CV","SOX"]}', "configuration stockée sous sa forme canonique");
  const deux = await creerTacheGen8([{ configuration: { actives: ["TH"] }, nombre: 2 }, { configuration: { actives: ["TV", "EV"] } }, { configuration: { actives: ["TH"] }, nombre: 1 }]);
  verifier(deux.statut === 201 && s.base.table("taches_composition").filter((l) => l.tache_id === deux.corps.id).map((l) => `${(l.configuration as any).actives.join("+")}:${l.nombre_exercices}`).join() === "TH:3,TV+EV:1", "deux lignes gen8 : doublons exacts fusionnés, configurations différentes séparées");

  // ── 3. Assignation et service : les 23 configurations ──
  const configurations: Transformation[][] = [];
  for (const th of [false, true]) for (const tv of [false, true]) for (const echelle of [null, "EV", "CV"] as const) for (const sox of [false, true]) {
    const actives = TRANSFORMATIONS.filter((t) => (t === "TH" && th) || (t === "TV" && tv) || t === echelle || (t === "SOX" && sox));
    if (actives.length > 0) configurations.push(actives);
  }
  verifier(configurations.length === 23, "23 configurations");
  for (const actives of configurations) {
    const x = await nouveau(actives, 424242, { aide: true });
    verifier(x.ligne.generateur_id === "gen8" && JSON.stringify(x.ligne.configuration) === JSON.stringify({ actives }) && JSON.stringify(x.ligne.champs_attendus) === '["expression","chaine"]', `${actives.join("+")} : générateur, configuration figée, champs attendus`);
    verifier(typeof x.ligne.composition_id === "string", `${actives.join("+")} : exercice lié à sa ligne de composition`);
    const g = await x.lire();
    verifier(g.ecrans.length === 1 && g.ecrans[0].champ === "expression" && g.champ_courant === "expression", `${actives.join("+")} : seul l'écran 1 est servi au départ`);
    verifier(g.champs.length === 2 && g.champs[0].poids === 3 && g.champs[1].poids === 2, `${actives.join("+")} : poids 3 et 2 servis pour les deux champs`);
    const brut = JSON.stringify(g);
    verifier(!brut.includes('"annotations"') && !brut.includes("annotations_figure") && !brut.includes("S(") && !brut.includes("A(") && !/"aide":/.test(brut), `${actives.join("+")} : ni aide ni coordonnée de S/A dans l'exercice servi`);
    verifier(g.ecrans.every((e: any) => verifierBalisageMath(e.consigne).length === 0 && verifierBalisageMath(e.question ?? "").length === 0) && g.ecrans[0].figure?.type === "graphe_parabole" && g.ecrans[0].aide_paliers === 2, `${actives.join("+")} : figure servie, deux paliers d'aide annoncés`);
    verifier(g.champs.every((c: any) => c.solution_attendue === null && c.score === null), `${actives.join("+")} : aucune solution servie au départ`);
  }

  // ── 4. Cascade et chaînes de bout en bout, sous les trois régimes ──
  const CAS: { actives: Transformation[]; nom: string }[] = [
    { actives: ["TH"], nom: "TH seul" },
    { actives: ["TV", "SOX"], nom: "TV+SOX" },
    { actives: ["EV"], nom: "EV seul" },
    { actives: ["TH", "TV", "CV", "SOX"], nom: "TH+TV+CV+SOX" },
  ];
  for (const regime of REGIMES) {
    for (const cas of CAS) {
      const lieu = `${regime.nom} · ${cas.nom}`;
      const immediat = regime.o.feedback ?? true;

      // 4a. Réponse JUSTE à l'écran 1, puis chaîne juste.
      {
        const x = await nouveau(cas.actives, 777, regime.o);
        const r1 = await x.poster("expression", saisie(polynomeDe(x.f)));
        verifier(r1.statut === 200 && (immediat ? r1.corps.statut === "correct" : !("statut" in r1.corps)), `${lieu} : réponse juste enregistrée (${immediat ? "verdict" : "rien révélé"})`);
        const g = await x.lire();
        verifier(g.ecrans.map((e: any) => e.champ).join() === "expression,chaine" && g.champ_courant === "chaine", `${lieu} : l'écran 2 est servi après l'écran 1`);
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
        const r1 = await x.poster("expression", saisie(polynomeDe(gEleve)));
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
        await y.poster("expression", saisie(polynomeDe(gEleve)));
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
    await x.poster("expression", saisie(polynomeDe(x.f)));
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

  // ── 6. Aide de l'écran 1 : deux paliers, dans l'ordre, pénalité unique ; aucune aide à l'écran 2 ──
  {
    const x = await nouveau(["TH", "TV"], 1212, { feedback: true, visible: true, aide: true });
    const hors = await x.aide("expression", 2);
    verifier(hors.statut !== null && hors.statut >= 400 && x.aidesUtilisees().length === 0, `palier 2 avant le palier 1 : refusé, rien enregistré (${hors.statut})`);
    const p1 = await x.aide("expression", 1);
    verifier(p1.statut === 200 && p1.corps.aide?.type === "annotations_figure" && p1.corps.aide.palier === 1 && p1.corps.aide.annotations.length === 1 && p1.corps.aide.annotations[0].genre === "point", `palier 1 : le sommet seul (${p1.statut})`);
    const p2 = await x.aide("expression", 2);
    verifier(p2.statut === 200 && p2.corps.aide.palier === 2 && p2.corps.aide.annotations.length === 4, "palier 2 : annotations cumulées (S, A, deux vecteurs)");
    verifier(x.aidesUtilisees().length === 1 && x.aidesUtilisees()[0]!.palier === 2, "une seule ligne d'usage, palier le plus élevé atteint");
    const g = await x.lire();
    verifier(g.champs[0].aide_utilisee === true && g.champs[0].aide_palier === 2, "GET : palier atteint exposé");
    await x.poster("expression", saisie(polynomeDe(x.f)));
    const a2 = await x.aide("chaine");
    verifier(a2.statut !== null && a2.statut >= 400 && x.aidesUtilisees().every((l) => l.champ !== "chaine"), `écran 2 : aucune aide (${a2.statut})`);
  }

  // ── 7. Requêtes forgées : l'écran 2 avant l'écran 1 ; clé en trop ──
  {
    const x = await nouveau(["TH"], 4343, { feedback: true, visible: true });
    const t = await x.poster("chaine", chaineBrute([{ t: "TH", e: polynomeDe({ a: rat(1), p: rat(1), q: rat(0) }) }]));
    verifier(t.statut !== null && t.statut >= 400 && x.lignesReponses("chaine").length === 0, `écran 2 avant l'écran 1 : refusé, rien enregistré (${t.statut})`);
    const extra = await appeler("reponses", "POST", { jeton: jetonEleve, corps: { exercice_assigne_id: x.id, champ: "expression", reponse_brute: "x^2", brouillon: "(x-1)^2" } });
    verifier(extra.statut === 400, "clé supplémentaire : 400");
  }

  // ── 8. Configuration FIGÉE : l'API refuse de modifier une tâche assignée ; même une altération directe de la ligne de composition ne change rien pour l'exercice assigné ──
  {
    const x = await nouveau(["TH"], 5656);
    const avant = JSON.stringify(await x.lire());
    const patch = await appeler(`taches/${x.tache}`, "PATCH", { jeton: jetonProf, corps: { nom: "gen8 modifiée", composition: [{ variante_id: VARIANTE, nombre_exercices: 1, configuration: { actives: ["TV", "SOX"] } }] } });
    verifier(patch.statut === 400, `PATCH d'une tâche assignée : refusé (${patch.statut})`);
    const ligneComposition = s.base.table("taches_composition").find((l) => l.tache_id === x.tache)!;
    ligneComposition.configuration = { actives: ["TV", "SOX"] }; // altération hors API
    verifier(JSON.stringify(await x.lire()) === avant, "l'exercice déjà assigné ne bouge pas : la configuration est lue sur l'exercice, jamais sur la ligne de composition");
    await x.poster("expression", saisie(polynomeDe(x.f)));
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
    console.log(`OK : ${nb} vérifications (gen8 dans le vrai routeur : câblage, 23 configurations, cascade de l'écran 2 sous les trois régimes, option 4, hors sujet, aide à deux paliers, configuration figée)`);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
