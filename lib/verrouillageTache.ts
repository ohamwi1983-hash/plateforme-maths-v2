import { supabaseAdmin } from "./supabaseAdmin";
import { exerciceEstComplet, tacheEstComplete, classifierTache, type CategorieOuNonCommencee } from "./tableauDeBord";
import { calculerEtatChampTentatives, tentativesMaxEffectif } from "./moteurTentatives";
import type { StatutVerification } from "../src/moteur/statutVerification";

type AdminClient = ReturnType<typeof supabaseAdmin>;

export async function categorieTachePourEleve(admin: AdminClient, tacheId: string, eleveId: string): Promise<CategorieOuNonCommencee> {
  const { data: inscriptions, error: erreurInscriptions } = await admin.from("inscriptions").select("classe_id").eq("eleve_id", eleveId);
  if (erreurInscriptions) throw new Error(erreurInscriptions.message);
  const classeIds = (inscriptions ?? []).map((i) => i.classe_id as string);

  const { data: assignations, error: erreurAssignations } = await admin
    .from("taches_assignations")
    .select("date_echeance, date_debut")
    .eq("tache_id", tacheId)
    .in("classe_id", classeIds.length > 0 ? classeIds : [""]);
  if (erreurAssignations) throw new Error(erreurAssignations.message);
  // Phase 2 : assignation par ÉLÈVE (`taches_assignations_eleves`, prompt "Assigner à des élèves
  // spécifiques") prise en compte au même titre que l'assignation par classe — sans elle, un élève
  // assigné individuellement était classé avec une fenêtre de dates vide (jamais "pas commencée",
  // jamais "antérieure"). Fenêtres concaténées (classe puis élève) ; la dernière est retenue, même
  // règle que pour plusieurs assignations par classe.
  const { data: assignationsEleve, error: erreurAssignationsEleve } = await admin
    .from("taches_assignations_eleves")
    .select("date_echeance, date_debut")
    .eq("tache_id", tacheId)
    .eq("eleve_id", eleveId);
  if (erreurAssignationsEleve) throw new Error(erreurAssignationsEleve.message);
  const toutesAssignations = [...(assignations ?? []), ...(assignationsEleve ?? [])];
  const derniereAssignation = toutesAssignations.length > 0 ? toutesAssignations[toutesAssignations.length - 1] : null;
  const dateEcheance = (derniereAssignation?.date_echeance as string | null | undefined) ?? null;
  const dateDebut = (derniereAssignation?.date_debut as string | undefined) ?? new Date(0).toISOString();

  // Prompt "Tentatives, aide, récapitulatif" (3/3) — bug trouvé en testant ce prompt (voir
  // RAPPORT.md) : "un champ a reçu au moins une soumission" (ce que cette fonction vérifiait avant
  // ce correctif, via `champsRepondus` construit sur la seule présence d'une ligne `reponses`)
  // suffisait tant qu'aucune tentative multiple n'était permise — une réponse fausse verrouillait
  // déjà le champ côté client. Ce n'est plus vrai depuis les tentatives multiples : un champ ayant
  // reçu UNE tentative ratée (tentatives restantes) compte alors, à tort, comme "répondu", ce qui
  // rendait la tâche entière "complète" dès la 1re tentative sur son dernier champ non répondu — et
  // `POST /api/reponses` rejetait ensuite toute nouvelle tentative légitime avec "Tâche déjà
  // entièrement complétée". Il faut donc désormais l'état TERMINÉ du moteur de tentatives (réussi ou
  // révélé, voir lib/moteurTentatives.ts), pas la simple présence d'une ligne — même correctif que
  // lib/routes/eleves/tableau-de-bord.ts.
  const { data: tache, error: erreurTache } = await admin
    .from("taches")
    .select("feedback_immediat, tentatives_supplementaires, aide_penalite_pourcent")
    .eq("id", tacheId)
    .maybeSingle();
  if (erreurTache) throw new Error(erreurTache.message);
  const tentativesMax = tentativesMaxEffectif((tache?.feedback_immediat as boolean | undefined) ?? true, (tache?.tentatives_supplementaires as number | undefined) ?? 0);
  const aidePenalitePourcent = (tache?.aide_penalite_pourcent as number | undefined) ?? 0;

  const { data: exercices, error: erreurExercices } = await admin
    .from("exercices_assignes")
    .select("id, champs_attendus")
    .eq("tache_id", tacheId)
    .eq("eleve_id", eleveId);
  if (erreurExercices) throw new Error(erreurExercices.message);
  const exercicesDeLaTache = exercices ?? [];
  const exerciceIds = exercicesDeLaTache.map((e) => e.id as string);

  let reponses: { exercice_assigne_id: string; champ: string; statut: StatutVerification; indice_utilise: boolean; fraction_correcte: number | null }[] = [];
  if (exerciceIds.length > 0) {
    const { data, error: erreurReponses } = await admin
      .from("reponses")
      .select("exercice_assigne_id, champ, statut, indice_utilise, fraction_correcte")
      .in("exercice_assigne_id", exerciceIds)
      .order("horodatage", { ascending: true });
    if (erreurReponses) throw new Error(erreurReponses.message);
    reponses = data ?? [];
  }

  // Historique chronologique croissant par (exercice_assigne_id, champ) — même construction que
  // `historiqueParCle` dans lib/routes/eleves/tableau-de-bord.ts, nécessaire à
  // `calculerEtatChampTentatives` (compte les tentatives ratées dans l'ordre où elles ont eu lieu).
  const historiqueParCle = new Map<string, { statut: StatutVerification; indice_utilise: boolean; fraction_correcte: number | null }[]>();
  for (const r of reponses) {
    const cle = `${r.exercice_assigne_id}:${r.champ}`;
    if (!historiqueParCle.has(cle)) historiqueParCle.set(cle, []);
    historiqueParCle.get(cle)!.push({ statut: r.statut, indice_utilise: r.indice_utilise, fraction_correcte: r.fraction_correcte });
  }

  const champsTermineParExercice = new Map<string, Set<string>>();
  for (const ex of exercicesDeLaTache) {
    const champsAttendus = (ex.champs_attendus as string[] | null) ?? [];
    for (const champ of champsAttendus) {
      const historique = historiqueParCle.get(`${ex.id}:${champ}`) ?? [];
      const aideUtilisee = historique.some((h) => h.indice_utilise);
      const etat = calculerEtatChampTentatives(historique.map((h) => h.statut), tentativesMax, aideUtilisee, aidePenalitePourcent, false, historique.map((h) => h.fraction_correcte));
      if (etat.terminee) {
        if (!champsTermineParExercice.has(ex.id as string)) champsTermineParExercice.set(ex.id as string, new Set());
        champsTermineParExercice.get(ex.id as string)!.add(champ);
      }
    }
  }

  const completions = exercicesDeLaTache.map((ex) => {
    const champsAttendus = ex.champs_attendus as string[] | null;
    return champsAttendus === null ? false : exerciceEstComplet(champsAttendus, champsTermineParExercice.get(ex.id as string) ?? new Set());
  });
  const complete = tacheEstComplete(completions);

  return classifierTache(dateDebut, dateEcheance, complete, new Date());
}
