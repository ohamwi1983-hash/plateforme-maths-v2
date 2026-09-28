import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { classifierTache, tacheEstComplete, exerciceEstComplet, type CategorieOuNonCommencee } from "../../tableauDeBord";
import { chargerContexteTache, etatTentativesAvecChrono, type ContexteTache } from "../../etatExercice";
import { recupererToutesLesLignes } from "../../supabasePagination";
import type { LigneDebutEcran } from "../../moteurTentatives";
import { calculerProfilCompetences, calculerEvolutionCompetences, calculerSegmentsCompetence, type ReponsePourSegmentsCompetence } from "../../profilCompetences";
import { calculerTendanceScore, type ScoreTache } from "../../historiqueTaches";
import { calculerTendanceTemps, type ExerciceTempsPourTendance } from "../../tendanceTemps";
import { tempsTotalExerciceDepuisReponses, type LigneReponseTemps } from "../../tempsExercice";
import { ORDRE_CATEGORIES } from "../../categoriesCompetences";
import type { StatutVerification } from "../../../src/moteur/statutVerification";

interface ExerciceBrut {
  id: string;
  tache_id: string;
  champs_attendus: string[] | null;
  variante_id: string;
  date_creation: string;
}

interface ReponseBrute {
  exercice_assigne_id: string;
  champ: string;
  statut: StatutVerification;
  bug_detecte: string | null;
  horodatage: string;
  duree_ecoulee_secondes: number | null;
}

/**
 * GET /api/eleves/mes-resultats — prompt "Onglets Tableau de bord/Résultats élève" (côté élève) :
 * "il faudrait une version adaptée à l'élève où il verrait ses scores et sa progression/évolution
 * (dans ses scores). Il verrait aussi les compétences non maîtrisées et l'évolution (le fait qu'il
 * arrive ou non à les combler)" — demande explicite de l'utilisateur, verbatim.
 *
 * `competences`/`evolution` portent sur TOUTES les réponses de l'élève (tâches en cours incluses,
 * pas seulement notées) — même périmètre que `GET /api/profs/eleves/:id/profil` côté prof (aucun
 * filtre de complétion là non plus), pour ne jamais faire disparaître une lacune manifestée sur une
 * tâche pas encore terminée. `historiqueTaches`, en revanche, ne porte QUE sur les tâches déjà
 * NOTÉES (`effectuees`/`anterieures`, jamais `en_cours` : un score partiel sur une tâche en cours de
 * résolution n'est pas un résultat, c'est un état intermédiaire) — même classification que
 * `GET /api/eleves/tableau-de-bord` (`classifierTache`/`tacheEstComplete`, `lib/tableauDeBord.ts`),
 * réutilisée telle quelle plutôt que redéfinie ici.
 *
 * Score par tâche : dernier `statut` connu par `(exercice_assigne_id, champ)` parmi `champs_attendus`
 * (une tâche notée a par définition tous ses champs terminés, révélés ou réussis) — jamais gated par
 * `feedback_immediat`/`reponse_visible` (contrairement à `ChampVue.statut` de tableau-de-bord.ts,
 * pensé pour l'affichage PENDANT la résolution) : une tâche déjà notée a de toute façon tout révélé
 * (`REGLAGES_FORCEES_ANTERIEURES` ou tentatives épuisées), donc aucune divergence en pratique.
 */
export const gererElevesMesResultats = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const eleve = await eleveAuthentifie(req.headers.authorization as string | undefined);
  if (!eleve) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const admin = supabaseAdmin();

  const { data: exercicesBruts, error: erreurExercices } = await admin
    .from("exercices_assignes")
    .select("id, tache_id, champs_attendus, variante_id, date_creation")
    .eq("eleve_id", eleve.id)
    .returns<ExerciceBrut[]>();
  if (erreurExercices) {
    res.status(500).json({ erreur: "Échec de récupération des exercices", detail: erreurExercices.message });
    return;
  }
  if (!exercicesBruts || exercicesBruts.length === 0) {
    res.status(200).json({ competences: [], evolution: [], historiqueTaches: [], tendanceScore: "stable", tendanceTemps: null, ordreCategories: ORDRE_CATEGORIES });
    return;
  }

  const exerciceIds = exercicesBruts.map((e) => e.id);
  const tacheIds = [...new Set(exercicesBruts.map((e) => e.tache_id))];
  const tacheIdParExercice = new Map(exercicesBruts.map((e) => [e.id, e.tache_id]));

  const { data: taches, error: erreurTaches } = await admin.from("taches").select("id, nom").in("id", tacheIds);
  if (erreurTaches) {
    res.status(500).json({ erreur: "Échec de récupération des tâches", detail: erreurTaches.message });
    return;
  }
  const nomParTache = new Map((taches ?? []).map((t) => [t.id as string, t.nom as string]));

  const { data: inscriptions, error: erreurInscriptions } = await admin.from("inscriptions").select("classe_id").eq("eleve_id", eleve.id);
  if (erreurInscriptions) {
    res.status(500).json({ erreur: "Échec de récupération des classes de l'élève", detail: erreurInscriptions.message });
    return;
  }
  const classeIds = (inscriptions ?? []).map((i) => i.classe_id as string);

  const { data: assignations, error: erreurAssignations } = await admin
    .from("taches_assignations")
    .select("tache_id, date_echeance, date_debut")
    .in("tache_id", tacheIds)
    .in("classe_id", classeIds.length > 0 ? classeIds : [""]);
  if (erreurAssignations) {
    res.status(500).json({ erreur: "Échec de récupération des échéances", detail: erreurAssignations.message });
    return;
  }
  const echeanceParTache = new Map<string, string | null>((assignations ?? []).map((a) => [a.tache_id as string, a.date_echeance as string | null]));
  const debutParTache = new Map<string, string>((assignations ?? []).map((a) => [a.tache_id as string, (a.date_debut as string | undefined) ?? new Date(0).toISOString()]));
  // Assignation par ÉLÈVE (`taches_assignations_eleves`) prise en compte au même titre que par classe
  // (même correction que `categorieTachePourEleve`, lib/verrouillageTache.ts) : sans elle, une tâche
  // assignée individuellement était classée avec une fenêtre de dates vide.
  const { data: assignationsEleve, error: erreurAssignationsEleve } = await admin
    .from("taches_assignations_eleves")
    .select("tache_id, date_echeance, date_debut")
    .eq("eleve_id", eleve.id)
    .in("tache_id", tacheIds);
  if (erreurAssignationsEleve) {
    res.status(500).json({ erreur: "Échec de récupération des assignations individuelles", detail: erreurAssignationsEleve.message });
    return;
  }
  for (const a of assignationsEleve ?? []) {
    echeanceParTache.set(a.tache_id as string, (a.date_echeance as string | null) ?? null);
    debutParTache.set(a.tache_id as string, (a.date_debut as string | undefined) ?? new Date(0).toISOString());
  }

  // Ordre chronologique CROISSANT (ancien -> récent) — nécessaire à `calculerEvolutionCompetences`
  // (le split ancien/récent en dépend) et à la construction de `derniereHorodatageParTache`/
  // `derniereStatutParCle` ci-dessous (dernière écriture = la plus récente, en itérant dans cet ordre).
  const { data: reponsesBrutes, error: erreurReponses } = await admin
    .from("reponses")
    .select("exercice_assigne_id, champ, statut, bug_detecte, horodatage, duree_ecoulee_secondes")
    .in("exercice_assigne_id", exerciceIds)
    .order("horodatage", { ascending: true })
    .returns<ReponseBrute[]>();
  if (erreurReponses) {
    res.status(500).json({ erreur: "Échec de récupération des réponses", detail: erreurReponses.message });
    return;
  }

  const bugsChronologiques: (string | null)[] = [];
  const derniereStatutParCle = new Map<string, StatutVerification>();
  // Historique chronologique des statuts par (exercice, champ) — nécessaire à l'état du moteur de
  // tentatives (un champ n'est « terminé » que réussi ou révélé, jamais dès la 1re réponse).
  const historiqueStatutsParCle = new Map<string, StatutVerification[]>();
  const derniereHorodatageParTache = new Map<string, string>();
  // Tâche "barre de progression segmentée" (§160/§161) : construite dans la MÊME passe (le score
  // d'un segment ne dépend plus, depuis §161, du statut FINAL d'une clé — seulement du nombre
  // d'exercices distincts concernés — donc plus besoin d'attendre que `derniereStatutParCle` soit
  // complètement peuplée avant de lire une clé). Une réponse dont la tâche est introuvable (ne
  // devrait pas arriver) est ignorée plutôt que de faire échouer tout l'endpoint, même convention
  // que `historiqueTaches` plus bas.
  const reponsesPourSegments: ReponsePourSegmentsCompetence[] = [];
  // Prompt "Tendance du temps de réponse — onglet Résultats (côté élève)" : lignes groupées par
  // exercice pour `tempsTotalExerciceDepuisReponses` (lib/tempsExercice.ts, réutilisée telle
  // quelle) — même dédoublonnage par champ que côté prof (§188), nécessaire ici aussi puisque les
  // tentatives multiples sur un même champ partagent le même `debuts_ecran`.
  const reponsesTempsParExercice = new Map<string, LigneReponseTemps[]>();
  for (const r of reponsesBrutes ?? []) {
    bugsChronologiques.push(r.bug_detecte);
    derniereStatutParCle.set(`${r.exercice_assigne_id}:${r.champ}`, r.statut);
    const cleHistorique = `${r.exercice_assigne_id}:${r.champ}`;
    if (!historiqueStatutsParCle.has(cleHistorique)) historiqueStatutsParCle.set(cleHistorique, []);
    historiqueStatutsParCle.get(cleHistorique)!.push(r.statut);
    const tacheId = tacheIdParExercice.get(r.exercice_assigne_id);
    if (tacheId) derniereHorodatageParTache.set(tacheId, r.horodatage);
    const nomTache = tacheId ? nomParTache.get(tacheId) : undefined;
    if (tacheId && nomTache) reponsesPourSegments.push({ tacheId, nomTache, exerciceAssigneId: r.exercice_assigne_id, champ: r.champ, bugDetecte: r.bug_detecte });

    const ligneTemps = reponsesTempsParExercice.get(r.exercice_assigne_id) ?? [];
    ligneTemps.push({ champ: r.champ, duree_ecoulee_secondes: r.duree_ecoulee_secondes, horodatage: r.horodatage });
    reponsesTempsParExercice.set(r.exercice_assigne_id, ligneTemps);
  }

  // Débuts d'écran de l'élève (chrono) : un champ dont le chrono est écoulé est terminé (révélé) même
  // sans réponse — même règle que le tableau de bord (`etatTentativesAvecChrono`).
  const debutsBruts = await recupererToutesLesLignes<LigneDebutEcran & { exercice_assigne_id: string }>(() =>
    admin.from("debuts_ecran").select("exercice_assigne_id, champ, horodatage_debut").in("exercice_assigne_id", exerciceIds),
  );
  const debutsParExercice = new Map<string, LigneDebutEcran[]>();
  for (const d of debutsBruts) {
    if (!debutsParExercice.has(d.exercice_assigne_id)) debutsParExercice.set(d.exercice_assigne_id, []);
    debutsParExercice.get(d.exercice_assigne_id)!.push({ champ: d.champ, horodatage_debut: d.horodatage_debut });
  }
  const contextesParTacheVariante = new Map<string, ContexteTache | null>();

  const exercicesParTache = new Map<string, ExerciceBrut[]>();
  for (const ex of exercicesBruts) {
    if (!exercicesParTache.has(ex.tache_id)) exercicesParTache.set(ex.tache_id, []);
    exercicesParTache.get(ex.tache_id)!.push(ex);
  }

  const maintenant = new Date();
  const historiqueTaches: (ScoreTache & { pourcentage: number })[] = [];
  for (const [tacheId, exercicesDeLaTache] of exercicesParTache) {
    const nomTache = nomParTache.get(tacheId);
    if (!nomTache) continue; // tâche introuvable (ne devrait pas arriver) : ignorée plutôt que de faire échouer tout l'endpoint

    // Complétion : un champ est terminé quand le moteur de tentatives le dit (réussi, ou révélé par
    // épuisement des tentatives ou chrono écoulé) — PAS dès la première réponse : avec des tentatives
    // supplémentaires, une réponse ratée laisse le champ ouvert. Même dérivation que
    // `GET /api/eleves/tableau-de-bord` et `POST /api/reponses` (`etatTentativesAvecChrono`,
    // lib/etatExercice.ts). Un champ_attendus manquant — ligne créée avant le correctif documenté là-bas
    // — reste traité comme jamais complet, jamais vacuously complet.
    // Limite connue : le verrouillage côté client sous `feedback_immediat=false` (lib/etatExercice.ts,
    // `verrouille`) n'est PAS compté ici — décision de conception en attente (voir RAPPORT.md §11).
    const champsTermineParExercice = new Map<string, Set<string>>();
    for (const ex of exercicesDeLaTache) {
      const cleContexte = `${tacheId}:${ex.variante_id}`;
      if (!contextesParTacheVariante.has(cleContexte)) contextesParTacheVariante.set(cleContexte, await chargerContexteTache(admin, tacheId, ex.variante_id));
      const contexte = contextesParTacheVariante.get(cleContexte);
      if (!contexte) continue; // tâche introuvable : déjà écartée plus haut, défensif
      for (const champ of ex.champs_attendus ?? []) {
        const statuts = historiqueStatutsParCle.get(`${ex.id}:${champ}`) ?? [];
        const etat = etatTentativesAvecChrono(champ, statuts, false, debutsParExercice.get(ex.id) ?? [], contexte, maintenant);
        if (etat.terminee) {
          if (!champsTermineParExercice.has(ex.id)) champsTermineParExercice.set(ex.id, new Set());
          champsTermineParExercice.get(ex.id)!.add(champ);
        }
      }
    }
    const completions = exercicesDeLaTache.map((ex) => (ex.champs_attendus === null ? false : exerciceEstComplet(ex.champs_attendus, champsTermineParExercice.get(ex.id) ?? new Set())));
    const complete = tacheEstComplete(completions);
    const categorie: CategorieOuNonCommencee = classifierTache(debutParTache.get(tacheId) ?? new Date(0).toISOString(), echeanceParTache.get(tacheId) ?? null, complete, maintenant);
    if (categorie !== "effectuees" && categorie !== "anterieures") continue; // ni "en_cours" (pas encore noté) ni "pas_commencee"

    let correct = 0;
    let total = 0;
    for (const ex of exercicesDeLaTache) {
      for (const champ of ex.champs_attendus ?? []) {
        // Tâche notée = tous ses champs terminés : un champ sans aucune réponse est alors un champ
        // révélé par le chrono — il compte comme raté (score 0), jamais ignoré du total.
        const statut = derniereStatutParCle.get(`${ex.id}:${champ}`);
        total++;
        if (statut === "correct") correct++;
      }
    }
    if (total === 0) continue;
    historiqueTaches.push({
      tacheId,
      nomTache,
      date: derniereHorodatageParTache.get(tacheId) ?? maintenant.toISOString(),
      correct,
      total,
      pourcentage: Math.round((correct / total) * 100),
    });
  }
  historiqueTaches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Segments par tâche (§160, retour utilisateur explicite sur la barre de progression) : attaché
  // uniquement aux compétences `non_maitrisee` (mêmes codes que `evolution` ci-dessous) — inutile de
  // calculer des segments pour une compétence `en_observation`, jamais montrée dans "Compétences à
  // travailler" côté client.
  const competences = calculerProfilCompetences(bugsChronologiques).map((c) =>
    c.statut === "non_maitrisee" ? { ...c, segments: calculerSegmentsCompetence(reponsesPourSegments, c.code) } : c,
  );
  const evolution = calculerEvolutionCompetences(bugsChronologiques);
  const tendanceScore = calculerTendanceScore(historiqueTaches);

  // Prompt "Tendance du temps de réponse — onglet Résultats (côté élève)" : même périmètre que
  // `competences`/`evolution` ci-dessus (TOUS les exercices de l'élève, tâches en cours incluses —
  // aucune restriction à "notée" dans le prompt, contrairement à `historiqueTaches`) — un exercice
  // sans donnée de temps exploitable (`tempsTotal: null`) est filtré par `calculerTendanceTemps`
  // elle-même, pas ici.
  const exercicesPourTendanceTemps: ExerciceTempsPourTendance[] = exercicesBruts.map((ex) => ({
    varianteId: ex.variante_id,
    dateCreation: ex.date_creation,
    tempsTotal: tempsTotalExerciceDepuisReponses(reponsesTempsParExercice.get(ex.id) ?? []),
  }));
  const tendanceTemps = calculerTendanceTemps(exercicesPourTendanceTemps);

  res.status(200).json({ competences, evolution, historiqueTaches, tendanceScore, tendanceTemps, ordreCategories: ORDRE_CATEGORIES });
});
