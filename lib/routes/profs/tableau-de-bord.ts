import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { elevesDeLaClasse } from "../../elevesDeLaClasse";
import { tempsTotalExerciceDepuisReponses, moyenne, type LigneReponseTemps } from "../../tempsExercice";
import { labelPourVariante } from "../../catalogueGenerateurs";
import { recupererToutesLesLignes } from "../../supabasePagination";

type AdminClient = ReturnType<typeof supabaseAdmin>;

export interface ClasseVueTableauDeBord {
  nom: string;
  code: string | null;
  nombreElevesActifs: number;
}

export interface EntreeTempsVarianteProf {
  variante_id: string;
  label: string;
  occurrences: number;
  tempsMoyenSecondes: number;
}

export interface TableauDeBordProf {
  nombreClasses: number;
  nombreTachesEnCours: number;
  reponsesAvecBug: number;
  classes: ClasseVueTableauDeBord[];
  tempsParVariante: EntreeTempsVarianteProf[];
}

/**
 * Une tâche compte comme "en cours" (Étape 1) dès qu'AU MOINS UNE de ses assignations a
 * `date_echeance` nulle ou strictement postérieure à `maintenant` — même principe que
 * `classifierTache` (lib/tableauDeBord.ts, `dateEcheance === null || dateEcheance > maintenant`
 * est exactement l'inverse de sa condition "anterieures", `<=`), mais au niveau de la tâche
 * entière (au moins une assignation qualifiante parmi potentiellement plusieurs classes), pas
 * d'un exercice individuel — un concept distinct, pas de réutilisation directe de cette fonction
 * ici. Fonction pure (testée par `scripts/smoke-test.ts`, sans dépendance DB) : une tâche avec
 * une assignation en retard sur une classe MAIS une autre encore ouverte sur une autre classe doit
 * compter comme "en cours" (Étape 3, cas explicitement demandé) — le `Set` ci-dessous, qui
 * n'ajoute qu'une fois par tâche dès la 1ère assignation qualifiante rencontrée, le garantit sans
 * jamais retirer une tâche déjà ajoutée à cause d'une autre assignation en retard. Une tâche sans
 * aucune assignation (jamais dans `assignations`) ne produit jamais d'entrée, donc ne compte
 * jamais (Étape 1 : "une tâche jamais assignée ne compte pas").
 */
export function nombreTachesEnCoursDepuisAssignations(
  assignations: { tache_id: string; date_echeance: string | null }[],
  maintenant: Date,
): number {
  const tachesEnCours = new Set<string>();
  for (const a of assignations) {
    if (a.date_echeance === null || new Date(a.date_echeance).getTime() > maintenant.getTime()) {
      tachesEnCours.add(a.tache_id);
    }
  }
  return tachesEnCours.size;
}

async function compterTachesEnCours(admin: AdminClient, tacheIds: string[]): Promise<number> {
  if (tacheIds.length === 0) return 0;
  const { data, error } = await admin.from("taches_assignations").select("tache_id, date_echeance").in("tache_id", tacheIds);
  if (error) throw new Error(error.message);
  return nombreTachesEnCoursDepuisAssignations(
    (data ?? []).map((a) => ({ tache_id: a.tache_id as string, date_echeance: a.date_echeance as string | null })),
    new Date(),
  );
}

/**
 * `reponsesAvecBug` (Étape 1) : le prompt suggère le chemin `reponses -> exercices_assignes ->
 * eleves -> inscriptions -> classes -> prof_id`, en autorisant explicitement un "chemin
 * équivalent selon le schéma réellement confirmé". Utilisé ici : `reponses ->
 * exercices_assignes -> tache_id`, filtré sur les tâches DÉJÀ connues comme appartenant au prof
 * (`taches.prof_id`, même colonne que `chargerTacheDuProf` utilise déjà pour trancher la
 * propriété d'une tâche ailleurs dans ce dépôt). Path plus direct ET plus sûr que celui suggéré :
 * un élève inscrit dans plusieurs classes (le schéma `inscriptions` l'autorise, clé primaire
 * composite eleve_id+classe_id) ferait remonter, via eleves -> inscriptions -> classes, TOUTES ses
 * classes plutôt que la seule classe à laquelle la tâche a réellement été assignée — un chemin
 * `taches.prof_id` ne peut pas se tromper de cette façon, la propriété d'une tâche est
 * non-ambiguë par construction (`taches.prof_id`, colonne `not null` unique par ligne).
 */
/** Fonction pure (testée par `scripts/smoke-test.ts`) : compte les lignes où `bug_detecte` n'est PAS nul — comparaison explicite `!== null`, jamais une simple troncature JS (`bug_detecte` est toujours soit `null` soit une chaîne non vide par construction, voir supabase/schema.sql, mais `!== null` reste la traduction directe et sans ambiguïté de l'énoncé de l'Étape 1). */
export function compterBugsDepuisReponses(reponses: { bug_detecte: string | null }[]): number {
  return reponses.filter((r) => r.bug_detecte !== null).length;
}

interface ExerciceIdBrut {
  id: string;
}
interface BugDetecteBrut {
  bug_detecte: string | null;
}

/**
 * Correctif (bug identique confirmé actif en production, même prof que `calculerTempsParVarianteProf`
 * ci-dessous — 1391+ réponses réelles, largement au-dessus de la limite PostgREST de 1000) :
 * requêtes `exercices_assignes`/`reponses` désormais paginées via `recupererToutesLesLignes`
 * (voir `lib/supabasePagination.ts`) — avant ce correctif, `reponsesAvecBug` sous-comptait
 * silencieusement dès qu'un prof dépassait ce volume.
 */
async function compterReponsesAvecBug(admin: AdminClient, tacheIds: string[]): Promise<number> {
  if (tacheIds.length === 0) return 0;
  const exercicesAssignes = await recupererToutesLesLignes<ExerciceIdBrut>(() => admin.from("exercices_assignes").select("id").in("tache_id", tacheIds));
  const exerciceIds = exercicesAssignes.map((e) => e.id);
  if (exerciceIds.length === 0) return 0;

  const reponses = await recupererToutesLesLignes<BugDetecteBrut>(() => admin.from("reponses").select("bug_detecte").in("exercice_assigne_id", exerciceIds));
  return compterBugsDepuisReponses(reponses);
}

/**
 * Prompt "Vue contenu — temps moyen par variante, toutes classes confondues" : aucune convention
 * de seuil minimal d'occurrences trouvée ailleurs dans ce dépôt pour ce genre de calcul (le seuil
 * le plus proche, `SEUIL_BRUIT_POINTS`/`SEUIL_AMELIORATION_POURCENT` de `lib/historiqueTaches.ts`/
 * `lib/tendanceTemps.ts`, porte sur un écart significatif, pas une taille d'échantillon minimale) —
 * valeur par défaut du prompt (5) conservée telle quelle, documentée ici plutôt qu'inventée
 * silencieusement.
 */
const SEUIL_MIN_OCCURRENCES_TEMPS_VARIANTE = 5;

interface ExerciceBrutTempsVariante {
  id: string;
  variante_id: string;
}

/**
 * Bug réel trouvé (diagnostic §"pas assez de données" pour toutes les variantes, prof à plus de
 * 1000 réponses) : PostgREST/Supabase plafonne silencieusement toute requête `select` à 1000
 * lignes par défaut, sans jamais renvoyer d'erreur — un `.select()...in()` non paginé sur une table
 * qui dépasse ce volume tronque le résultat sans que rien ne le signale, faussant tout calcul en
 * aval (ici, `af_mise_en_evidence` retombait sous `SEUIL_MIN_OCCURRENCES_TEMPS_VARIANTE` alors que
 * 7 occurrences réelles existaient). `recupererToutesLesLignes` (`lib/supabasePagination.ts`,
 * importée en tête de fichier) pagine via `.range()` par lots jusqu'à épuisement — voir ce module
 * partagé pour le détail, et RAPPORT.md pour la leçon durable qui en découle (toute nouvelle
 * requête sur `reponses`/`exercices_assignes` non bornée à un seul élève/exercice doit
 * systématiquement l'utiliser, jamais copier un patron existant sans vérifier s'il est lui-même
 * déjà paginé — c'est exactement comme ça que ce bug s'est propagé une première fois, dans
 * `compterReponsesAvecBug` ci-dessus).
 *
 * Réplique le patron de `compterReponsesAvecBug` ci-dessus (3 hops `taches`(prof_id) déjà résolu
 * en `tacheIds` -> `exercices_assignes` -> `reponses`, un seul `.in(...)` par étape, aucune boucle
 * par élève) et le groupement Map par `exercice_assigne_id` + `tempsTotalExerciceDepuisReponses`
 * déjà établis par le volet B de `lib/routes/profs/eleves/profil.ts` (`calculerTempsParVariante`) —
 * appliqué ici à TOUTES les tâches du prof plutôt qu'à une seule classe. Les deux requêtes sont
 * désormais paginées via `recupererToutesLesLignes` (voir commentaire ci-dessus) : `reponses` peut
 * dépasser 1000 lignes dès qu'un prof cumule un historique important (déjà observé en prod, 35
 * tâches) ; `exercices_assignes` reste par précaution sous la même protection, même si son volume
 * actuel (206 lignes chez ce même prof) reste sous la limite — rien ne garantit qu'il y reste.
 */
async function calculerTempsParVarianteProf(admin: AdminClient, tacheIds: string[]): Promise<EntreeTempsVarianteProf[]> {
  if (tacheIds.length === 0) return [];
  const exercices = await recupererToutesLesLignes<ExerciceBrutTempsVariante>(() =>
    admin.from("exercices_assignes").select("id, variante_id").in("tache_id", tacheIds),
  );
  const exerciceIds = exercices.map((e) => e.id);
  if (exerciceIds.length === 0) return [];

  const reponsesBrutes = await recupererToutesLesLignes<LigneReponseTemps & { exercice_assigne_id: string }>(() =>
    admin.from("reponses").select("champ, duree_ecoulee_secondes, horodatage, exercice_assigne_id").in("exercice_assigne_id", exerciceIds),
  );

  const reponsesParExercice = new Map<string, LigneReponseTemps[]>();
  for (const r of reponsesBrutes) {
    const liste = reponsesParExercice.get(r.exercice_assigne_id) ?? [];
    liste.push(r);
    reponsesParExercice.set(r.exercice_assigne_id, liste);
  }

  const tempsParVariante = new Map<string, number[]>();
  for (const ex of exercices) {
    const temps = tempsTotalExerciceDepuisReponses(reponsesParExercice.get(ex.id) ?? []);
    if (temps === null) continue;
    const liste = tempsParVariante.get(ex.variante_id) ?? [];
    liste.push(temps);
    tempsParVariante.set(ex.variante_id, liste);
  }

  const entrees: EntreeTempsVarianteProf[] = [];
  for (const [varianteId, temps] of tempsParVariante) {
    if (temps.length < SEUIL_MIN_OCCURRENCES_TEMPS_VARIANTE) continue; // échantillon jugé trop peu fiable, exclue plutôt qu'affichée
    const tempsMoyenSecondes = moyenne(temps);
    if (tempsMoyenSecondes === null) continue; // ne peut pas arriver ici (temps.length >= SEUIL > 0), garde de type
    entrees.push({ variante_id: varianteId, label: labelPourVariante(varianteId) ?? varianteId, occurrences: temps.length, tempsMoyenSecondes });
  }
  entrees.sort((a, b) => b.tempsMoyenSecondes - a.tempsMoyenSecondes); // du plus long au plus court
  return entrees;
}

/**
 * GET /api/profs/tableau-de-bord — prompt "Tableau de bord professeur" (2/5), Étape 1. Portée
 * explicite : uniquement le contenu du 4e onglet côté prof — le tableau de bord élève (anneaux de
 * progression) et l'écran d'exercice pas-à-pas restent hors périmètre (prompts suivants de cette
 * séquence).
 */
export const gererProfsTableauDeBord = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const admin = supabaseAdmin();

  const { data: classesBrutes, error: erreurClasses } = await admin.from("classes").select("id, nom, code").eq("prof_id", prof.id);
  if (erreurClasses) {
    res.status(500).json({ erreur: "Échec de récupération des classes", detail: erreurClasses.message });
    return;
  }

  // Nombre d'élèves actifs par classe : réutilise `elevesDeLaClasse` (déjà testée, prompt "Écran
  // résultats (professeur)") plutôt que d'écrire une 2e requête groupée équivalente — le nombre de
  // classes par prof reste faible dans ce pilote (un seul prof), le coût du N+1 est négligible ici,
  // et ça évite de dupliquer une 2e fois la jointure inscriptions -> eleves déjà extraite.
  const classes: ClasseVueTableauDeBord[] = [];
  for (const classe of classesBrutes ?? []) {
    const resultatEleves = await elevesDeLaClasse(admin, classe.id as string);
    if (!resultatEleves.ok) {
      res.status(500).json({ erreur: "Échec de récupération des élèves d'une classe", detail: resultatEleves.erreur });
      return;
    }
    classes.push({
      nom: classe.nom as string,
      code: classe.code as string | null,
      nombreElevesActifs: resultatEleves.eleves.filter((e) => e.actif).length,
    });
  }

  // Prompt "Aperçu d'une tâche avant création" : exclut la tâche d'aperçu éphémère du prof
  // (`est_apercu`) — sinon ses propres réponses de test remonteraient dans `reponsesAvecBug`
  // ci-dessous (voir `lib/routes/taches-apercu.ts`).
  const { data: tachesBrutes, error: erreurTaches } = await admin.from("taches").select("id").eq("prof_id", prof.id).eq("est_apercu", false);
  if (erreurTaches) {
    res.status(500).json({ erreur: "Échec de récupération des tâches", detail: erreurTaches.message });
    return;
  }
  const tacheIds = (tachesBrutes ?? []).map((t) => t.id as string);

  let nombreTachesEnCours: number;
  let reponsesAvecBug: number;
  let tempsParVariante: EntreeTempsVarianteProf[];
  try {
    nombreTachesEnCours = await compterTachesEnCours(admin, tacheIds);
    reponsesAvecBug = await compterReponsesAvecBug(admin, tacheIds);
    tempsParVariante = await calculerTempsParVarianteProf(admin, tacheIds);
  } catch (e) {
    res.status(500).json({ erreur: "Échec de calcul des statistiques", detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  const resultat: TableauDeBordProf = {
    nombreClasses: (classesBrutes ?? []).length,
    nombreTachesEnCours,
    reponsesAvecBug,
    classes,
    tempsParVariante,
  };
  res.status(200).json(resultat);
});
