// Test permanent — prompt "Vue contenu — temps moyen par variante, toutes classes confondues" :
// exerce le VRAI handler compilé (GET /api/profs/tableau-de-bord, étendu avec `tempsParVariante`)
// contre une fausse base en mémoire, même technique que scripts/test-tableau-de-bord-prof.ts (non
// dupliquée ici : harnais dédié, plus simple, car ce fichier ne porte que sur les 2 nouveaux
// scénarios — la non-régression du reste du tableau de bord est déjà couverte par ce script-là).

export {};

const cheminSupabaseAdmin = require.resolve("../lib/supabaseAdmin");
const PROF_ID = "prof-uuid-tdb-temps-variante";

type Ligne = Record<string, any>;

function creerBaseEnMemoire() {
  const tables: Record<string, Ligne[]> = {
    classes: [],
    eleves: [],
    inscriptions: [],
    taches: [],
    taches_assignations: [],
    exercices_assignes: [],
    reponses: [],
  };

  function construireAdmin() {
    return {
      from(table: string) {
        if (!(table in tables)) throw new Error("Table non simulée dans ce test : " + table);
        const filtres: ((ligne: Ligne) => boolean)[] = [];
        // `elevesDeLaClasse` (lib/elevesDeLaClasse.ts, déjà appelée par gererProfsTableauDeBord
        // pour nombreElevesActifs, hors périmètre de ce prompt mais toujours invoquée) attend un
        // embed `eleves(...)` sur `inscriptions` — même simulation que
        // scripts/test-tableau-de-bord-prof.ts, reprise à l'identique (grep avant de dupliquer :
        // même technique, pas une réinvention).
        let embedEleves = false;
        const materialiser = (lignes: Ligne[]): Ligne[] =>
          embedEleves && table === "inscriptions" ? lignes.map((l) => ({ ...l, eleves: tables.eleves.find((e) => e.id === l.eleve_id) ?? null })) : lignes;
        const lignesFiltrees = () => materialiser(tables[table].filter((ligne) => filtres.every((f) => f(ligne))));

        const chaine: any = {
          select: (cols?: string) => {
            if (typeof cols === "string" && /eleves\(/.test(cols)) embedEleves = true;
            return chaine;
          },
          eq: (col: string, val: unknown) => {
            filtres.push((l) => l[col] === val);
            return chaine;
          },
          in: (col: string, vals: unknown[]) => {
            filtres.push((l) => vals.includes(l[col]));
            return chaine;
          },
          // Correctif "pagination 1000 lignes" : `recupererToutesLesLignes` (tableau-de-bord.ts)
          // appelle systématiquement `.range()` — le simuler ici plutôt que de le rendre optionnel,
          // pour exercer le VRAI chemin de code (une seule page suffit à ces fixtures, sous 1000).
          range: (debut: number, fin: number) => Promise.resolve({ data: lignesFiltrees().slice(debut, fin + 1), error: null }),
          then: (resolve: any) => resolve({ data: lignesFiltrees(), error: null }),
        };
        return chaine;
      },
    };
  }

  return { tables, admin: construireAdmin() };
}

const { tables, admin } = creerBaseEnMemoire();

require.cache[cheminSupabaseAdmin] = {
  id: cheminSupabaseAdmin,
  filename: cheminSupabaseAdmin,
  loaded: true,
  exports: {
    supabaseAdmin: () => admin,
    profAuthentifie: async (authHeader: string | undefined) => (authHeader === "Bearer prof" ? { id: PROF_ID } : null),
    eleveAuthentifie: async () => null,
  },
} as any;

async function appeler(): Promise<any> {
  const cheminHandler = "../lib/routes/profs/tableau-de-bord";
  delete require.cache[require.resolve(cheminHandler)];
  const handler = require(cheminHandler).gererProfsTableauDeBord;
  let corps: any = null;
  const res = {
    status() {
      return this;
    },
    json(objet: unknown) {
      corps = objet;
    },
  };
  await handler({ method: "GET", headers: { authorization: "Bearer prof" } }, res, {});
  return corps;
}

/** Un exercice + une réponse ("c1", durée exacte) pour une variante/tâche/élève donnés. */
function pousserExercice(id: string, tacheId: string, eleveId: string, varianteId: string, duree: number, horodatage: string) {
  tables.exercices_assignes.push({ id, tache_id: tacheId, eleve_id: eleveId, variante_id: varianteId });
  tables.reponses.push({ id: `r-${id}`, exercice_assigne_id: id, champ: "c1", duree_ecoulee_secondes: duree, horodatage, bug_detecte: null });
}

async function main() {
  // --- Fixtures : 2 classes, chacune avec sa propre tâche, DU MÊME PROF ---
  tables.classes.push({ id: "classe-a", prof_id: PROF_ID, nom: "4Ga", code: "AAA111" });
  tables.classes.push({ id: "classe-b", prof_id: PROF_ID, nom: "4Gb", code: "BBB222" });
  tables.eleves.push({ id: "eleve-1", nom: "Martin", prenom: "Léa", actif: true });
  tables.eleves.push({ id: "eleve-2", nom: "Dupont", prenom: "Noah", actif: true });
  tables.eleves.push({ id: "eleve-3", nom: "Petit", prenom: "Sami", actif: true });
  tables.eleves.push({ id: "eleve-4", nom: "Roy", prenom: "Ana", actif: true });
  tables.inscriptions.push({ eleve_id: "eleve-1", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-2", classe_id: "classe-a" });
  tables.inscriptions.push({ eleve_id: "eleve-3", classe_id: "classe-b" });
  tables.inscriptions.push({ eleve_id: "eleve-4", classe_id: "classe-b" });
  tables.taches.push({ id: "tache-a", prof_id: PROF_ID, nom: "Devoir classe A", est_apercu: false });
  tables.taches.push({ id: "tache-b", prof_id: PROF_ID, nom: "Devoir classe B", est_apercu: false });

  // --- Scénario 1 : variante "v1", 5 occurrences RÉPARTIES SUR LES 2 CLASSES (3 via tache-a/
  // classe-a, 2 via tache-b/classe-b) -> au-dessus du seuil, moyenne = (10+20+30+40+50)/5 = 30.
  // Si l'agrégation ne couvrait qu'une seule classe, cette moyenne serait fausse (ou la variante
  // absente, faute d'atteindre le seuil de 5 sur une classe seule).
  pousserExercice("ex-v1-1", "tache-a", "eleve-1", "v1", 10, "2026-01-01T00:00:00.000Z");
  pousserExercice("ex-v1-2", "tache-a", "eleve-2", "v1", 20, "2026-01-01T00:01:00.000Z");
  pousserExercice("ex-v1-3", "tache-a", "eleve-1", "v1", 30, "2026-01-01T00:02:00.000Z");
  pousserExercice("ex-v1-4", "tache-b", "eleve-3", "v1", 40, "2026-01-01T00:03:00.000Z");
  pousserExercice("ex-v1-5", "tache-b", "eleve-4", "v1", 50, "2026-01-01T00:04:00.000Z");

  // --- Scénario 2 : variante "v2", seulement 3 occurrences (< seuil 5) -> DOIT être absente du
  // résultat, quelle que soit sa moyenne (ici délibérément très longue, 999s, pour vérifier que ce
  // n'est PAS un filtre sur la durée qui l'exclut, seulement le nombre d'occurrences).
  pousserExercice("ex-v2-1", "tache-a", "eleve-1", "v2", 999, "2026-01-01T00:05:00.000Z");
  pousserExercice("ex-v2-2", "tache-a", "eleve-2", "v2", 999, "2026-01-01T00:06:00.000Z");
  pousserExercice("ex-v2-3", "tache-b", "eleve-3", "v2", 999, "2026-01-01T00:07:00.000Z");

  const corps = await appeler();
  const parVariante = Object.fromEntries((corps.tempsParVariante as any[]).map((e) => [e.variante_id, e]));

  if (!parVariante.v1) throw new Error(`Scénario 1 : "v1" attendue présente (5 occurrences, seuil atteint), obtenu ${JSON.stringify(corps.tempsParVariante)}`);
  if (parVariante.v1.occurrences !== 5 || parVariante.v1.tempsMoyenSecondes !== 30) {
    throw new Error(`Scénario 1 : "v1" attendue {occurrences:5, tempsMoyenSecondes:30} (agrégée sur les 2 classes), obtenu ${JSON.stringify(parVariante.v1)}`);
  }
  console.log("OK : scénario 1 — agrégation couvre bien les 2 classes du prof (5 occurrences, moyenne 30s), pas une seule");

  if (parVariante.v2) throw new Error(`Scénario 2 : "v2" attendue ABSENTE (3 occurrences < seuil 5), obtenu présente : ${JSON.stringify(parVariante.v2)}`);
  console.log("OK : scénario 2 — variante sous le seuil de 5 occurrences correctement exclue (peu importe sa durée)");

  // Trié du plus long au plus court : v1 (30s) devrait être seule entrée ici puisque v2 est exclue.
  if (corps.tempsParVariante.length !== 1) throw new Error(`Résultat attendu à 1 entrée (seule "v1" au-dessus du seuil), obtenu ${corps.tempsParVariante.length}`);
  console.log("OK : tri par temps moyen décroissant — une seule entrée qualifiante, à sa place");

  // --- Non-régression : le reste du tableau de bord (classes, tâches, nombreElevesActifs)
  // reste bien présent et cohérent (vérifié en détail par scripts/test-tableau-de-bord-prof.ts,
  // simple garde ici que rien n'a disparu du corps de réponse).
  if (corps.nombreClasses !== 2 || !Array.isArray(corps.classes) || corps.classes.length !== 2) {
    throw new Error(`Non-régression : nombreClasses/classes attendus inchangés (2 classes), obtenu ${JSON.stringify({ nombreClasses: corps.nombreClasses, classes: corps.classes })}`);
  }
  console.log("OK : non-régression — nombreClasses/classes toujours présents et corrects à côté de tempsParVariante");

  console.log("TOUS LES TESTS DE TEMPS-PAR-VARIANTE (TABLEAU DE BORD PROF) PASSENT");
}

main().catch((e) => {
  console.error("ECHEC :", e.message);
  process.exit(1);
});
