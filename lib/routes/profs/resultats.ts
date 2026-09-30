import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { chargerTacheDuProf } from "../../tacheDuProf";
import { elevesDeLaClasse } from "../../elevesDeLaClasse";
import { exerciceEstComplet } from "../../tableauDeBord";
import { champsTermines, chargerContexteTache, type ContexteTache } from "../../etatExercice";
import type { LigneDebutEcran } from "../../moteurTentatives";
import type { StatutVerification } from "../../../src/moteur/statutVerification";
import { separerBugsDetectes, calculerProfilCompetences, type CompetenceProfil } from "../../profilCompetences";
import { DICTIONNAIRE_COMPETENCES } from "../../dictionnaireCompetences";
import { EXPLICATIONS_COMPETENCES } from "../../explicationsCompetences";
import { lirePropre } from "../../tablePropre";
import { ORDRE_CATEGORIES } from "../../categoriesCompetences";
import { recupererToutesLesLignes } from "../../supabasePagination";
import { tempsTotalExerciceDepuisReponses, type LigneReponseTemps } from "../../tempsExercice";
import { poidsDansMap, poidsDesChampsDeLigne } from "../../poidsEcran";

type AdminClient = ReturnType<typeof supabaseAdmin>;

interface ExerciceBrut {
  id: string;
  tache_id: string;
  eleve_id: string;
  variante_id: string;
  champs_attendus: string[] | null;
  /** Pour retrouver le poids de chaque écran (RAPPORT §17) ; `null` = ligne historique, poids 1. */
  graine: number | null;
}

interface EleveBrut {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
}

interface ChampResultat {
  champ: string;
  statut: string;
  bug_detecte: string | null;
  /**
   * Poids de l'écran dans le score (RAPPORT §17, `lib/poidsEcran.ts`) : donnée pour les agrégations
   * côté client (`public/moteur/scorePondere.js`), jamais affichée. Ne dépend pas des réponses de
   * l'élève (rien à masquer). 1 sans poids déclaré / ligne historique.
   */
  poids: number;
}

interface ExerciceResultat {
  id: string;
  tache_id: string;
  nom_tache: string;
  /**
   * Prompt "Refonte Résultats — correctifs ronde 2" — date de création de la TÂCHE (pas de
   * l'exercice, qui n'en porte pas), pour trier "la liste des tâches" du mode "Par classe" de la
   * plus récente à la plus ancienne côté client. Résolue ici (même `taches` déjà chargée pour
   * `nom_tache`, aucune requête supplémentaire).
   */
  date_creation_tache: string;
  variante_id: string;
  complet: boolean;
  champs: ChampResultat[];
  /**
   * Retour utilisateur ("compétences maîtrisées ou non") — profil de compétences BORNÉ à CET
   * exercice (même fonction pure `calculerProfilCompetences` que `EleveResultat.competences`,
   * simplement appelée sur un sous-ensemble plus étroit de `bugsDetectesParEleve` : les occurrences
   * de CET exercice seulement, pas tout le périmètre de la requête). Alimente le détail affiché au
   * clic sur un exercice (mode "Par tâche") et, agrégé côté client par `tache_id`, le détail
   * affiché au clic sur une tâche (mode "Par classe") — jamais une 2e requête, la même donnée brute
   * que `EleveResultat.competences` est simplement reventilée une granularité plus fine.
   */
  competences: CompetenceProfil[];
  /**
   * Retour utilisateur ("afficher le temps global de chaque exercice") — même fonction pure
   * `tempsTotalExerciceDepuisReponses` (lib/tempsExercice.ts) déjà utilisée par
   * `GET /api/profs/tableau-de-bord`/`GET /api/profs/eleves/:id/profil` : PAS une somme de
   * `duree_ecoulee_secondes` sur toutes les lignes `reponses` de l'exercice (piège documenté en
   * tête de ce fichier — plusieurs tentatives sur un même champ partagent le même `debuts_ecran`,
   * donc une somme brute compterait plusieurs fois le même intervalle). `null` si aucun champ de
   * cet exercice n'a de durée exploitable, jamais `0`.
   */
  temps_total: number | null;
}

interface EleveResultat {
  id: string;
  nom: string;
  prenom: string;
  actif: boolean;
  exercices: ExerciceResultat[];
  /**
   * Prompt "Refonte Résultats (Option C)" — profil de compétences de CET élève, borné au périmètre
   * de la requête (tâche ou classe demandée), jamais son historique complet chez ce prof (à la
   * différence de `GET /api/profs/eleves/:id/profil`, hors périmètre ici). Réutilise
   * `calculerProfilCompetences` telle quelle (même fonction pure que le profil élève, même
   * comptage "TOUTES les occurrences historiques" — voir le correctif Nathan documenté plus bas) :
   * un code y apparaît seulement s'il a été déclenché au moins une fois par CET élève dans ce
   * périmètre (`statut: "en_observation"` à 1 occurrence, `"non_maitrisee"` à 2+). Un code du
   * périmètre absent de ce tableau signifie "aucun bug détecté pour cet élève sur cette
   * compétence" — le client (matrice "Par compétence") distingue ensuite "aucun souci" de "aucun
   * exercice dans ce périmètre" via `exercices.length`, jamais recalculé ici une 2e fois.
   */
  competences: CompetenceProfil[];
}

/**
 * Prompt "Refonte Résultats (Option C)" — une entrée du résumé agrégé, libellé résolu ici
 * (`DICTIONNAIRE_COMPETENCES`) pour la même raison que `CompetenceProfil.libelle`
 * (`lib/profilCompetences.ts`) : un seul appelant HTTP suffit, jamais de 2e dictionnaire à dupliquer
 * dans `public/prof.html`. Remplace l'ancien `resume_bugs: Record<string, number>` (codes bruts
 * sans libellé, jamais affichés proprement côté client) — trié occurrences décroissantes, ordre
 * réutilisé tel quel par le client comme ordre des colonnes de la matrice "Par compétence".
 */
interface ResumeBugEntree {
  code: string;
  libelle: string;
  occurrences: number;
  /**
   * Retour utilisateur ("un '?' à côté des compétences maîtrisées ou non qui explique en quoi
   * consiste cette compétence") — mêmes champs, même source (`EXPLICATIONS_COMPETENCES`,
   * `lib/explicationsCompetences.ts`) et même convention d'absence que `CompetenceProfil.explication`/
   * `.exemple` (`lib/profilCompetences.ts`) : `undefined` (jamais une chaîne vide) pour un code sans
   * entrée dans ce dictionnaire, le client décide alors de ne pas afficher de bouton "?" plutôt que
   * d'en afficher un désactivé. Résolu ici pour que le client réutilise directement
   * `construireExplicationCompetence` (déjà écrite pour `CompetenceProfil`) sur ces entrées aussi,
   * sans dupliquer de dictionnaire.
   */
  explication?: string;
  exemple?: string;
}

/** Mode `tache_id` (Étape 2) : tous les exercices de cette tâche, quelle que soit la classe. */
async function exercicesEtElevesParTache(
  admin: AdminClient,
  tacheId: string,
  profId: string,
): Promise<{ exercicesBruts: ExerciceBrut[]; elevesBruts: EleveBrut[] } | null> {
  const tache = await chargerTacheDuProf(admin, tacheId, profId);
  if (!tache) return null;

  const { data: exercicesBruts, error } = await admin
    .from("exercices_assignes")
    .select("id, tache_id, eleve_id, variante_id, champs_attendus, graine")
    .eq("tache_id", tacheId)
    .returns<ExerciceBrut[]>();
  if (error) throw new Error(error.message);

  const eleveIds = [...new Set((exercicesBruts ?? []).map((e) => e.eleve_id))];
  const { data: elevesBruts, error: erreurEleves } = await admin
    .from("eleves")
    .select("id, nom, prenom, actif")
    .in("id", eleveIds.length > 0 ? eleveIds : [""])
    .returns<EleveBrut[]>();
  if (erreurEleves) throw new Error(erreurEleves.message);

  return { exercicesBruts: exercicesBruts ?? [], elevesBruts: elevesBruts ?? [] };
}

/** Mode `classe_id` (Étape 2) : tous les élèves inscrits à cette classe (actifs ou non, voir `elevesDeLaClasse`), toutes leurs tâches confondues. */
async function exercicesEtElevesParClasse(
  admin: AdminClient,
  classeId: string,
  profId: string,
): Promise<{ exercicesBruts: ExerciceBrut[]; elevesBruts: EleveBrut[] } | null> {
  const { data: classe, error: erreurClasse } = await admin.from("classes").select("id").eq("id", classeId).eq("prof_id", profId).maybeSingle();
  if (erreurClasse || !classe) return null;

  const resultatEleves = await elevesDeLaClasse(admin, classe.id);
  if (!resultatEleves.ok) throw new Error(resultatEleves.erreur);
  const elevesBruts = resultatEleves.eleves;

  const eleveIds = elevesBruts.map((e) => e.id);
  // Correctif (pagination défensive, même classe de bug que `compterReponsesAvecBug`,
  // `lib/routes/profs/tableau-de-bord.ts` — voir RAPPORT.md) : une classe entière, toutes tâches
  // confondues, peut dépasser la limite PostgREST de 1000 lignes.
  const exercicesBruts = await recupererToutesLesLignes<ExerciceBrut>(() =>
    admin
      .from("exercices_assignes")
      .select("id, tache_id, eleve_id, variante_id, champs_attendus, graine")
      .in("eleve_id", eleveIds.length > 0 ? eleveIds : [""]),
  );

  return { exercicesBruts, elevesBruts };
}

/**
 * GET /api/profs/resultats — prompt "Écran résultats (professeur)", Étape 2. Deux modes
 * mutuellement exclusifs : `tache_id` OU `classe_id`. Lecture seule (Portée explicite) — aucune
 * écriture nulle part dans ce fichier.
 *
 * **Contrairement à `GET /api/eleves` (gestion de classe, qui filtre les élèves désactivés),
 * inclut délibérément les élèves désactivés** — "c'est le sens même de la désactivation plutôt que
 * la suppression" (prompt). `actif` est renvoyé par élève pour que l'interface les marque
 * visuellement, jamais pour les exclure.
 *
 * Par champ déjà répondu, le DÉTAIL affiché (`champs: ChampResultat[]`) reste la DERNIÈRE soumission
 * (`statut`, `bug_detecte`) — jamais l'historique complet — même technique que
 * `lib/routes/eleves/tableau-de-bord.ts` (tri décroissant sur `horodatage`, on garde la 1re
 * rencontrée par clé `exercice:champ`) : c'est l'état COURANT du champ qu'on affiche, pas un
 * comptage, donc une seule ligne par champ a du sens ici. Non extraite en commun avec ce fichier :
 * le tableau de bord élève est explicitement hors périmètre de ce prompt, et sa forme
 * (`DerniereReponse`) ne porte pas `bug_detecte`, propre à cet écran.
 *
 * **Résumé agrégé (`resume_bugs`) — correctif (signalé par l'utilisateur, cas réel
 * "Nathan"/FC_CE_FANTOME, voir `lib/routes/profs/eleves/profil.ts`)** : comptait auparavant sur ce
 * même ensemble de dernières soumissions par champ, pas sur l'historique complet — un bug déclenché
 * 2 fois sur 2 champs distincts, chacun ensuite corrigé, disparaissait alors entièrement du résumé.
 * Décision explicite de l'utilisateur, appliquée identiquement ici et dans `profil.ts` ("pas de
 * traitement différent entre les deux écrans pour la même donnée sous-jacente") : `resume_bugs`
 * compte désormais TOUTES les occurrences historiques de `bug_detecte`, une par ligne `reponses`,
 * indépendamment du détail par champ ci-dessus (qui, lui, reste sur la dernière soumission — deux
 * besoins différents sur la même donnée brute, jamais une 2e requête).
 */
export const gererProfsResultats = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const tacheId = typeof req.query.tache_id === "string" ? req.query.tache_id : undefined;
  const classeId = typeof req.query.classe_id === "string" ? req.query.classe_id : undefined;
  const nombreFournis = [tacheId, classeId].filter((v) => v !== undefined).length;
  if (nombreFournis !== 1) {
    res.status(400).json({ erreur: "Fournir exactement un paramètre : tache_id OU classe_id" });
    return;
  }

  const admin = supabaseAdmin();

  let resultat: { exercicesBruts: ExerciceBrut[]; elevesBruts: EleveBrut[] } | null;
  try {
    resultat = tacheId !== undefined ? await exercicesEtElevesParTache(admin, tacheId, prof.id) : await exercicesEtElevesParClasse(admin, classeId as string, prof.id);
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des résultats", detail: (e as Error).message });
    return;
  }
  if (!resultat) {
    res.status(404).json({ erreur: tacheId !== undefined ? "Tâche introuvable" : "Classe introuvable" });
    return;
  }
  const { exercicesBruts, elevesBruts } = resultat;

  const tacheIds = [...new Set(exercicesBruts.map((e) => e.tache_id))];
  const { data: taches, error: erreurTaches } = await admin.from("taches").select("id, nom, date_creation").in("id", tacheIds.length > 0 ? tacheIds : [""]);
  if (erreurTaches) {
    res.status(500).json({ erreur: "Échec de récupération des tâches", detail: erreurTaches.message });
    return;
  }
  const nomTacheParId = new Map<string, string>((taches ?? []).map((t) => [t.id as string, t.nom as string]));
  const dateTacheParId = new Map<string, string>((taches ?? []).map((t) => [t.id as string, t.date_creation as string]));

  const exerciceIds = exercicesBruts.map((e) => e.id);
  // Correctif (pagination défensive — voir RAPPORT.md) : le mode `classe_id` (contrairement au mode
  // `tache_id`, borné à une seule tâche) peut porter sur un volume de réponses qui dépasse la
  // limite PostgREST de 1000 lignes.
  let reponsesBrutes: { exercice_assigne_id: string; champ: string; statut: string; bug_detecte: string | null; duree_ecoulee_secondes: number | null; horodatage: string; fraction_correcte: number | null }[];
  try {
    reponsesBrutes = await recupererToutesLesLignes(() =>
      admin
        .from("reponses")
        .select("exercice_assigne_id, champ, statut, bug_detecte, duree_ecoulee_secondes, horodatage, fraction_correcte")
        .in("exercice_assigne_id", exerciceIds.length > 0 ? exerciceIds : [""])
        .order("horodatage", { ascending: false }),
    );
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des réponses", detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  // Débuts d'écran (chrono) : nécessaires à la définition UNIQUE de « champ terminé » (RAPPORT §37).
  let debutsBruts: (LigneDebutEcran & { exercice_assigne_id: string })[];
  try {
    debutsBruts = await recupererToutesLesLignes<LigneDebutEcran & { exercice_assigne_id: string }>(() =>
      admin.from("debuts_ecran").select("exercice_assigne_id, champ, horodatage_debut").in("exercice_assigne_id", exerciceIds.length > 0 ? exerciceIds : [""]),
    );
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des débuts d'écran", detail: e instanceof Error ? e.message : String(e) });
    return;
  }
  const debutsParExercice = new Map<string, LigneDebutEcran[]>();
  for (const d of debutsBruts) {
    if (!debutsParExercice.has(d.exercice_assigne_id)) debutsParExercice.set(d.exercice_assigne_id, []);
    debutsParExercice.get(d.exercice_assigne_id)!.push({ champ: d.champ, horodatage_debut: d.horodatage_debut });
  }
  // Historique par exercice puis champ, du plus ancien au plus récent (`reponsesBrutes` est trié du plus récent au plus ancien).
  const historiqueParExercice = new Map<string, Map<string, { statut: StatutVerification; fraction_correcte: number | null }[]>>();
  for (const r of [...reponsesBrutes].reverse()) {
    if (!historiqueParExercice.has(r.exercice_assigne_id)) historiqueParExercice.set(r.exercice_assigne_id, new Map());
    const parChamp = historiqueParExercice.get(r.exercice_assigne_id)!;
    if (!parChamp.has(r.champ)) parChamp.set(r.champ, []);
    parChamp.get(r.champ)!.push({ statut: r.statut as StatutVerification, fraction_correcte: r.fraction_correcte ?? null });
  }
  const contextesParTacheVariante = new Map<string, ContexteTache | null>();
  const contexteDe = async (tacheIdEx: string, varianteId: string): Promise<ContexteTache | null> => {
    const cle = `${tacheIdEx}:${varianteId}`;
    if (!contextesParTacheVariante.has(cle)) contextesParTacheVariante.set(cle, await chargerContexteTache(admin, tacheIdEx, varianteId));
    return contextesParTacheVariante.get(cle)!;
  };
  const maintenant = new Date();
  const champsTerminesParExercice = new Map<string, Set<string>>();
  try {
    for (const ex of exercicesBruts) {
      const contexte = ex.champs_attendus === null ? null : await contexteDe(ex.tache_id, ex.variante_id);
      if (ex.champs_attendus === null || contexte === null) continue;
      champsTerminesParExercice.set(ex.id, champsTermines(ex.champs_attendus, historiqueParExercice.get(ex.id) ?? new Map(), debutsParExercice.get(ex.id) ?? [], contexte, maintenant));
    }
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des réglages de tâche", detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  const derniereSoumissionParCle = new Map<string, { statut: string; bug_detecte: string | null }>();
  const champsReponduParExercice = new Map<string, Set<string>>();
  // `resumeBugs` — voir le correctif documenté au-dessus : TOUTES les occurrences historiques,
  // jamais dédupliquées par champ (donc calculées séparément de `derniereSoumissionParCle`
  // ci-dessus, qui reste dédupliquée pour le détail par champ affiché plus bas).
  // `Map` (et non un objet littéral) : un code « constructor » ne doit pas lire `Object.prototype.constructor` (RAPPORT.md §20).
  const resumeBugs = new Map<string, number>();
  // Prompt "Refonte Résultats (Option C)" — `bug_detecte` de CHAQUE soumission, groupé par élève
  // (via `eleveIdParExerciceId`), pour nourrir `calculerProfilCompetences` par élève ci-dessous.
  // Même donnée brute que `resumeBugs` (TOUTES les occurrences, jamais dédupliquées par champ),
  // simplement reventilée par élève plutôt qu'agrégée pour tout le périmètre — une seule passe sur
  // `reponsesBrutes`, jamais une 2e requête.
  const eleveIdParExerciceId = new Map<string, string>(exercicesBruts.map((ex) => [ex.id, ex.eleve_id]));
  const bugsDetectesParEleve = new Map<string, (string | null)[]>();
  /**
   * Retour utilisateur ("compétences maîtrisées ou non" au clic sur un exercice/une tâche) — même
   * donnée brute que `bugsDetectesParEleve` ci-dessus, reventilée par `exercice_assigne_id` plutôt
   * que par élève, dans la MÊME passe sur `reponsesBrutes` (jamais une 2e requête ni un 2e parcours).
   */
  const bugsDetectesParExercice = new Map<string, (string | null)[]>();
  // Retour utilisateur ("afficher le temps global de chaque exercice") — `duree_ecoulee_secondes`
  // groupée par exercice pour `tempsTotalExerciceDepuisReponses` ci-dessous, même patron que
  // `calculerTempsParVariante` (lib/routes/profs/eleves/profil.ts) : aucune 2e requête, les lignes
  // brutes portent déjà `duree_ecoulee_secondes`/`horodatage`.
  const reponsesTempsParExercice = new Map<string, LigneReponseTemps[]>();
  for (const r of reponsesBrutes ?? []) {
    const exerciceId = r.exercice_assigne_id as string;
    const champ = r.champ as string;
    const cle = `${exerciceId}:${champ}`;
    if (!derniereSoumissionParCle.has(cle)) {
      derniereSoumissionParCle.set(cle, { statut: r.statut as string, bug_detecte: (r.bug_detecte as string | null) ?? null });
    }
    if (!champsReponduParExercice.has(exerciceId)) champsReponduParExercice.set(exerciceId, new Set());
    champsReponduParExercice.get(exerciceId)!.add(champ);

    const eleveId = eleveIdParExerciceId.get(exerciceId);
    if (eleveId !== undefined) {
      if (!bugsDetectesParEleve.has(eleveId)) bugsDetectesParEleve.set(eleveId, []);
      bugsDetectesParEleve.get(eleveId)!.push((r.bug_detecte as string | null) ?? null);
    }
    if (!bugsDetectesParExercice.has(exerciceId)) bugsDetectesParExercice.set(exerciceId, []);
    bugsDetectesParExercice.get(exerciceId)!.push((r.bug_detecte as string | null) ?? null);

    if (!reponsesTempsParExercice.has(exerciceId)) reponsesTempsParExercice.set(exerciceId, []);
    reponsesTempsParExercice.get(exerciceId)!.push({ champ, duree_ecoulee_secondes: (r.duree_ecoulee_secondes as number | null) ?? null, horodatage: r.horodatage as string });

    // Prompts "Câblage taxonomie compétences — gen8/gen9" : `bug_detecte` peut désormais joindre
    // plusieurs codes pour une même soumission (`separerBugsDetectes`, `lib/profilCompetences.ts`)
    // — même correctif "TOUTES les occurrences comptent" que `calculerProfilCompetences`, appliqué
    // ici au niveau du code individuel plutôt que de la valeur brute jointe (sinon "CODE1,CODE2"
    // deviendrait sa propre clé distincte de "CODE1" et "CODE2" pris isolément ailleurs).
    for (const code of separerBugsDetectes((r.bug_detecte as string | null) ?? null)) {
      resumeBugs.set(code, (resumeBugs.get(code) ?? 0) + 1);
    }
  }

  const exercicesParEleve = new Map<string, ExerciceBrut[]>();
  for (const ex of exercicesBruts) {
    if (!exercicesParEleve.has(ex.eleve_id)) exercicesParEleve.set(ex.eleve_id, []);
    exercicesParEleve.get(ex.eleve_id)!.push(ex);
  }

  const eleves: EleveResultat[] = elevesBruts.map((eleve) => {
    const competences = calculerProfilCompetences(bugsDetectesParEleve.get(eleve.id) ?? []);
    const exercices: ExerciceResultat[] = (exercicesParEleve.get(eleve.id) ?? []).map((ex) => {
      const champsRepondus = champsReponduParExercice.get(ex.id) ?? new Set<string>();
      const poidsParChamp = poidsDesChampsDeLigne(ex);
      const champs: ChampResultat[] = [...champsRepondus].map((champ) => {
        const soumission = derniereSoumissionParCle.get(`${ex.id}:${champ}`)!;
        return { champ, statut: soumission.statut, bug_detecte: soumission.bug_detecte, poids: poidsDansMap(poidsParChamp, champ) };
      });
      return {
        id: ex.id,
        tache_id: ex.tache_id,
        nom_tache: nomTacheParId.get(ex.tache_id) ?? "(tâche introuvable)",
        date_creation_tache: dateTacheParId.get(ex.tache_id) ?? "",
        variante_id: ex.variante_id,
        // Définition UNIQUE (RAPPORT §37) : « complet » = chaque champ attendu est TERMINÉ (réussi, tentatives épuisées ou chrono écoulé), plus « a une réponse ».
        complet: ex.champs_attendus !== null && exerciceEstComplet(ex.champs_attendus, champsTerminesParExercice.get(ex.id) ?? new Set()),
        champs,
        competences: calculerProfilCompetences(bugsDetectesParExercice.get(ex.id) ?? []),
        temps_total: tempsTotalExerciceDepuisReponses(reponsesTempsParExercice.get(ex.id) ?? []),
      };
    });
    return { id: eleve.id, nom: eleve.nom, prenom: eleve.prenom, actif: eleve.actif, exercices, competences };
  });

  const resumeBugsTrie: ResumeBugEntree[] = [...resumeBugs.entries()]
    .map(([code, occurrences]) => ({
      code,
      libelle: lirePropre(DICTIONNAIRE_COMPETENCES, code)?.libelle ?? code,
      occurrences,
      explication: lirePropre(EXPLICATIONS_COMPETENCES, code)?.explication,
      exemple: lirePropre(EXPLICATIONS_COMPETENCES, code)?.exemple,
    }))
    .sort((a, b) => b.occurrences - a.occurrences);

  /**
   * Tâche "Imprimer un rapport de résultats" — `ordreCategories` ajouté ici pour que l'écran
   * d'impression (prof.html) construise ses 3 gabarits (résumé/détaillé/radiale) à partir de CETTE
   * seule réponse, sans requête supplémentaire par élève : même convention que
   * `GET /api/profs/eleves/:id/profil`/`GET /api/classes/:id/profil` (`ORDRE_CATEGORIES` résolu
   * serveur, jamais reconstruit côté client), simplement ajoutée ici où elle manquait — chaque
   * `EleveResultat.competences` porte déjà `categorie`/`sousCategorie` via `calculerProfilCompetences`.
   */
  res.status(200).json({ eleves, resume_bugs: resumeBugsTrie, ordreCategories: ORDRE_CATEGORIES });
});
