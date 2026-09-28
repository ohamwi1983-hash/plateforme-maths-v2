import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../../supabaseAdmin";
import { elevesDeLaClasse } from "../../../elevesDeLaClasse";
import { calculerProfilCompetences } from "../../../profilCompetences";
import { ORDRE_CATEGORIES } from "../../../categoriesCompetences";
import { recupererToutesLesLignes } from "../../../supabasePagination";

/**
 * GET /api/classes/:id/profil — retour utilisateur ("la même chose [l'arbre] pour le profil de
 * compétences complet de la classe"). Même construction que `GET /api/profs/eleves/:id/profil`
 * (lib/routes/profs/eleves/profil.ts) — même correctif "toutes les occurrences comptent" (cas
 * "Nathan"), même filtrage central des codes masqués (`separerBugsDetectes`,
 * lib/profilCompetences.ts) — mais agrège TOUS les élèves inscrits dans la classe plutôt qu'un
 * seul, en une SEULE passe `calculerProfilCompetences` sur l'ensemble de leurs `bug_detecte`
 * (jamais un profil par élève puis fusionné a posteriori : le comptage d'occurrences doit porter
 * sur l'ensemble de la classe directement, sinon un même code à 1 occurrence chez 2 élèves
 * distincts se retrouverait à tort "en_observation" au lieu de "non_maitrisee").
 *
 * Vérification d'appartenance : `classes.prof_id === prof.id` directement (même garde que
 * `exercicesEtElevesParClasse`, lib/routes/profs/resultats.ts) — 404 générique si la classe
 * n'appartient pas à ce prof, jamais un statut distinguant "existe mais pas à vous".
 *
 * Isolation entre profs (même principe que le profil élève) : n'agrège QUE les exercices générés
 * par des tâches appartenant à CE prof, même si un élève de cette classe est aussi inscrit chez un
 * autre prof.
 */
export const gererClassesIdProfil = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
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
  const classeId = params.id;

  const { data: classe, error: erreurClasse } = await admin.from("classes").select("id").eq("id", classeId).eq("prof_id", prof.id).maybeSingle();
  if (erreurClasse || !classe) {
    res.status(404).json({ erreur: "Classe introuvable" });
    return;
  }

  const resultatEleves = await elevesDeLaClasse(admin, classeId);
  if (!resultatEleves.ok) {
    res.status(500).json({ erreur: "Échec de récupération des élèves", detail: resultatEleves.erreur });
    return;
  }
  const eleveIds = resultatEleves.eleves.map((e) => e.id);

  const { data: tachesDuProf, error: erreurTaches } = await admin.from("taches").select("id").eq("prof_id", prof.id);
  if (erreurTaches) {
    res.status(500).json({ erreur: "Échec de récupération des tâches", detail: erreurTaches.message });
    return;
  }
  const tacheIds = (tachesDuProf ?? []).map((t) => t.id as string);

  // Correctif (pagination défensive, même classe de bug que `compterReponsesAvecBug`,
  // `lib/routes/profs/tableau-de-bord.ts` — voir RAPPORT.md) : une classe entière, toutes tâches
  // confondues, peut dépasser la limite PostgREST de 1000 lignes tout comme un prof entier.
  let exercicesBruts: { id: string }[];
  let reponsesBrutes: { bug_detecte: string | null }[];
  try {
    exercicesBruts = await recupererToutesLesLignes(() =>
      admin
        .from("exercices_assignes")
        .select("id")
        .in("eleve_id", eleveIds.length > 0 ? eleveIds : [""])
        .in("tache_id", tacheIds.length > 0 ? tacheIds : [""]),
    );
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des exercices", detail: e instanceof Error ? e.message : String(e) });
    return;
  }
  const exerciceIds = exercicesBruts.map((e) => e.id);

  try {
    reponsesBrutes = await recupererToutesLesLignes(() =>
      admin
        .from("reponses")
        .select("bug_detecte")
        .in("exercice_assigne_id", exerciceIds.length > 0 ? exerciceIds : [""]),
    );
  } catch (e) {
    res.status(500).json({ erreur: "Échec de récupération des réponses", detail: e instanceof Error ? e.message : String(e) });
    return;
  }

  const tousLesBugsDetectes = reponsesBrutes.map((r) => r.bug_detecte ?? null);
  const competences = calculerProfilCompetences(tousLesBugsDetectes);
  res.status(200).json({ competences, ordreCategories: ORDRE_CATEGORIES, nombreEleves: eleveIds.length });
});
