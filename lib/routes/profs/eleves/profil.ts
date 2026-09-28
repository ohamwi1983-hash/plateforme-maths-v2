import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../../supabaseAdmin";
import { classesDuProfPourEleve } from "../../../eleveDuProf";
import { calculerProfilCompetences, tempsMoyenParCompetence } from "../../../profilCompetences";
import { ORDRE_CATEGORIES } from "../../../categoriesCompetences";
import { classeUniqueDeEleve } from "../../../classeUniqueDeEleve";
import { tempsTotalExerciceDepuisReponses, moyenne, mediane, type LigneReponseTemps } from "../../../tempsExercice";
import { labelPourVariante } from "../../../catalogueGenerateurs";
import { recupererToutesLesLignes } from "../../../supabasePagination";

/**
 * GET /api/profs/eleves/:id/profil — prompt "Profil de compétences élève", Étape 3. Vérification
 * d'appartenance réutilisée telle quelle depuis `lib/eleveDuProf.ts` (même garde que
 * `PATCH /api/profs/eleves/:id`/désactivation/transfert/reset-mdp — jamais redéfinie séparément),
 * pas dupliquée : 404 générique "Élève introuvable" si l'élève n'appartient à aucune classe de ce
 * prof, jamais un statut distinguant "existe mais pas à vous" (principe déjà établi partout
 * ailleurs dans ce dépôt).
 *
 * Isolation entre profs (élève inscrit chez plusieurs profs, cas marginal comme déjà noté dans
 * `[id].ts`) : le profil n'agrège QUE les exercices générés par des tâches appartenant à CE prof
 * (`taches.prof_id`) — jamais les tâches d'un autre prof, même si l'élève y est aussi inscrit.
 *
 * **Correctif (signalé par l'utilisateur, cas réel "Nathan"/FC_CE_FANTOME)** : comptait auparavant
 * seulement la DERNIÈRE soumission par `(exercice_assigne_id, champ)` (même convention que
 * `resumeBugs` de `gererProfsResultats`, `lib/routes/profs/resultats.ts`) — "plus représentatif
 * d'un bug persistant qu'un comptage qui grossirait à chaque nouvel essai". Ce raisonnement ne tient
 * plus depuis que les tentatives multiples sur un même champ sont la norme (prompt "Tentatives,
 * aide, récapitulatif", 3/3) : un élève qui déclenche 2 fois le même bug sur 2 champs distincts
 * AVANT de se corriger sur chacun voyait ces 2 occurrences réelles disparaître entièrement (aucune
 * des 2 n'étant la dernière soumission de son champ) — vérifié par exécution du pipeline réel contre
 * des fixtures reconstituant ce cas exact. Décision explicite de l'utilisateur : "un élève qui s'est
 * trompé deux fois avant de réussir a bien manifesté cette lacune deux fois, peu importe qu'il ait
 * fini par se corriger" — compte désormais TOUTES les occurrences historiques de `bug_detecte`,
 * une par ligne `reponses`, jamais dédupliquées par champ. Même changement appliqué à `resumeBugs`
 * dans `resultats.ts` (décision explicite : "pas de traitement différent entre les deux écrans pour
 * la même donnée sous-jacente") — seul le détail par champ de `resultats.ts` (état COURANT d'un
 * champ, pas un comptage) reste sur la dernière soumission, hors du périmètre de ce correctif.
 */
export const gererProfsElevesProfil = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
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
  const eleveId = params.id;
  const classeIds = await classesDuProfPourEleve(admin, eleveId, prof.id);
  if (classeIds.length === 0) {
    res.status(404).json({ erreur: "Élève introuvable" });
    return;
  }

  const { data: tachesDuProf, error: erreurTaches } = await admin.from("taches").select("id").eq("prof_id", prof.id);
  if (erreurTaches) {
    res.status(500).json({ erreur: "Échec de récupération des tâches", detail: erreurTaches.message });
    return;
  }
  const tacheIds = (tachesDuProf ?? []).map((t) => t.id as string);

  const { data: exercicesBruts, error: erreurExercices } = await admin
    .from("exercices_assignes")
    .select("id, variante_id")
    .eq("eleve_id", eleveId)
    .in("tache_id", tacheIds.length > 0 ? tacheIds : [""]);
  if (erreurExercices) {
    res.status(500).json({ erreur: "Échec de récupération des exercices", detail: erreurExercices.message });
    return;
  }
  const exerciceIds = (exercicesBruts ?? []).map((e) => e.id as string);

  // `champ`/`exercice_assigne_id`/l'ordre chronologique ne servent plus à rien pour `bug_detecte`
  // depuis le correctif documenté au-dessus (toutes les occurrences comptent, jamais dédupliquées
  // par champ) — mais restent nécessaires pour le nouveau calcul de temps par variante ci-dessous
  // (prompt "Temps de réponse par type d'exercice — profil élève"), d'où leur ajout au select.
  const { data: reponsesBrutes, error: erreurReponses } = await admin
    .from("reponses")
    .select("bug_detecte, champ, duree_ecoulee_secondes, horodatage, exercice_assigne_id")
    .in("exercice_assigne_id", exerciceIds.length > 0 ? exerciceIds : [""]);
  if (erreurReponses) {
    res.status(500).json({ erreur: "Échec de récupération des réponses", detail: erreurReponses.message });
    return;
  }

  const tousLesBugsDetectes = (reponsesBrutes ?? []).map((r) => (r.bug_detecte as string | null) ?? null);
  const competencesBrutes = calculerProfilCompetences(tousLesBugsDetectes);

  // Prompt "Temps moyen par compétence — profil élève (renfort factuel, pas un nouveau diagnostic)" :
  // `bug_detecte`/`duree_ecoulee_secondes` coexistent déjà sur les mêmes lignes `reponsesBrutes`
  // (aucune requête supplémentaire nécessaire) — un fait de plus à côté du nombre d'occurrences déjà
  // affiché, jamais une comparaison ni un seuil.
  const tempsParCode = tempsMoyenParCompetence(
    (reponsesBrutes ?? []).map((r) => ({ bugDetecte: r.bug_detecte as string | null, dureeEcouleeSecondes: r.duree_ecoulee_secondes as number | null })),
  );
  const competences = competencesBrutes.map((c) => {
    const tempsMoyenSecondes = tempsParCode.get(c.code);
    return tempsMoyenSecondes === undefined ? c : { ...c, tempsMoyenSecondes };
  });

  const tempsParVariante = await calculerTempsParVariante(admin, eleveId, exercicesBruts ?? [], reponsesBrutes ?? [], tacheIds);

  // Prompt "Catégorisation des compétences + regroupement du profil élève (Option B)" — ordre
  // canonique des catégories (`lib/categoriesCompetences.ts`) renvoyé avec le profil, pour que le
  // client (public/prof.html, sans bundler) puisse regrouper les cartes dans le bon ordre sans
  // dupliquer `CATEGORIES_COMPETENCES` — chaque `competence.categorie`/`sousCategorie` est déjà
  // résolue par `calculerProfilCompetences` ci-dessus.
  res.status(200).json({ competences, ordreCategories: ORDRE_CATEGORIES, tempsParVariante });
});

interface ExerciceBrut {
  id: string;
  variante_id: string;
}

interface EntreeTempsParVariante {
  variante_id: string;
  label: string;
  tempsMoyenEleve: number | null;
  medianeClasse: number | null;
}

/**
 * Prompt "Temps de réponse par type d'exercice — profil élève" : volet A (moyenne de l'élève par
 * variante, toutes tâches confondues) + volet B (médiane de la classe sur la même variante,
 * uniquement si `classeUniqueDeEleve` renvoie une classe non ambiguë — §2 du prompt).
 */
async function calculerTempsParVariante(
  admin: ReturnType<typeof supabaseAdmin>,
  eleveId: string,
  exercicesBruts: ExerciceBrut[],
  reponsesBrutes: LigneReponseTemps[],
  tacheIds: string[]
): Promise<EntreeTempsParVariante[]> {
  const reponsesParExercice = new Map<string, LigneReponseTemps[]>();
  for (const r of reponsesBrutes as (LigneReponseTemps & { exercice_assigne_id: string })[]) {
    const liste = reponsesParExercice.get(r.exercice_assigne_id) ?? [];
    liste.push(r);
    reponsesParExercice.set(r.exercice_assigne_id, liste);
  }

  const tempsParExerciceEleve = new Map<string, number>();
  for (const ex of exercicesBruts) {
    const temps = tempsTotalExerciceDepuisReponses(reponsesParExercice.get(ex.id) ?? []);
    if (temps !== null) tempsParExerciceEleve.set(ex.id, temps);
  }

  const tempsParVarianteEleve = new Map<string, number[]>();
  for (const ex of exercicesBruts) {
    const temps = tempsParExerciceEleve.get(ex.id);
    if (temps === undefined) continue;
    const liste = tempsParVarianteEleve.get(ex.variante_id) ?? [];
    liste.push(temps);
    tempsParVarianteEleve.set(ex.variante_id, liste);
  }

  const classeId = await classeUniqueDeEleve(admin, eleveId);
  const tempsParVarianteClasse = new Map<string, number[]>();
  if (classeId !== null) {
    const { data: inscriptionsClasse } = await admin.from("inscriptions").select("eleve_id").eq("classe_id", classeId);
    const eleveIdsClasse = (inscriptionsClasse ?? []).map((i) => i.eleve_id as string).filter((id) => id !== eleveId);

    if (eleveIdsClasse.length > 0) {
      // Correctif (pagination défensive, même classe de bug que `compterReponsesAvecBug`,
      // `lib/routes/profs/tableau-de-bord.ts` — voir RAPPORT.md) : cette classe entière (moins
      // l'élève courant), toutes tâches confondues, peut dépasser la limite PostgREST de 1000.
      const exercicesClasse = await recupererToutesLesLignes<ExerciceBrut>(() =>
        admin
          .from("exercices_assignes")
          .select("id, variante_id")
          .in("eleve_id", eleveIdsClasse)
          .in("tache_id", tacheIds.length > 0 ? tacheIds : [""]),
      );
      const exerciceClasseIds = exercicesClasse.map((e) => e.id);

      if (exerciceClasseIds.length > 0) {
        const reponsesClasseBrutes = await recupererToutesLesLignes<LigneReponseTemps & { exercice_assigne_id: string }>(() =>
          admin.from("reponses").select("champ, duree_ecoulee_secondes, horodatage, exercice_assigne_id").in("exercice_assigne_id", exerciceClasseIds),
        );

        const reponsesParExerciceClasse = new Map<string, LigneReponseTemps[]>();
        for (const r of reponsesClasseBrutes) {
          const liste = reponsesParExerciceClasse.get(r.exercice_assigne_id) ?? [];
          liste.push(r);
          reponsesParExerciceClasse.set(r.exercice_assigne_id, liste);
        }

        for (const ex of exercicesClasse) {
          const temps = tempsTotalExerciceDepuisReponses(reponsesParExerciceClasse.get(ex.id) ?? []);
          if (temps === null) continue;
          const liste = tempsParVarianteClasse.get(ex.variante_id) ?? [];
          liste.push(temps);
          tempsParVarianteClasse.set(ex.variante_id, liste);
        }
      }
    }
  }

  // Une seule variante par entrée retenue : celles que l'ÉLÈVE a effectivement faites — jamais une
  // variante où seule la classe a des données (le volet A affiche "à côté des scores déjà présents
  // sur son profil", donc uniquement les exercices que cet élève a lui-même réalisés).
  const entrees: EntreeTempsParVariante[] = [];
  for (const varianteId of tempsParVarianteEleve.keys()) {
    entrees.push({
      variante_id: varianteId,
      label: labelPourVariante(varianteId) ?? varianteId,
      tempsMoyenEleve: moyenne(tempsParVarianteEleve.get(varianteId) ?? []),
      medianeClasse: mediane(tempsParVarianteClasse.get(varianteId) ?? []),
    });
  }
  return entrees;
}
