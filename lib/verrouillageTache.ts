import { supabaseAdmin } from "./supabaseAdmin";
import { exerciceEstComplet, tacheEstComplete, classifierTache, type CategorieOuNonCommencee } from "./tableauDeBord";
import { tentativesMaxEffectif, type LigneDebutEcran } from "./moteurTentatives";
import { chargerContexteTache, champsTermines, type ContexteTache } from "./etatExercice";
import { recupererToutesLesLignes } from "./supabasePagination";
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

  // Prompt "Tentatives, aide, récapitulatif" (3/3) — bug trouvé en testant ce prompt (voir RAPPORT.md) : « un champ a reçu au
  // moins une soumission » ne suffit plus depuis les tentatives multiples ; il faut l'état TERMINÉ du moteur de tentatives.
  // RAPPORT §37 : cet état est désormais calculé par `champsTermines` (lib/etatExercice.ts), DÉFINITION UNIQUE partagée avec
  // `calculerEtatExercice` et `mes-resultats`. Avant, ce fichier avait sa propre boucle et IGNORAIT l'expiration du chrono :
  // une tâche dont les champs avaient tous expiré restait « en cours » ici alors que le tableau de bord la disait terminée.
  const { data: exercices, error: erreurExercices } = await admin
    .from("exercices_assignes")
    .select("id, champs_attendus, variante_id")
    .eq("tache_id", tacheId)
    .eq("eleve_id", eleveId);
  if (erreurExercices) throw new Error(erreurExercices.message);
  const exercicesDeLaTache = exercices ?? [];
  const exerciceIds = exercicesDeLaTache.map((e) => e.id as string);

  const historiqueParExercice = new Map<string, Map<string, { statut: StatutVerification; fraction_correcte: number | null }[]>>();
  const debutsParExercice = new Map<string, LigneDebutEcran[]>();
  if (exerciceIds.length > 0) {
    const reponses = await recupererToutesLesLignes<{ exercice_assigne_id: string; champ: string; statut: StatutVerification; fraction_correcte: number | null }>(() =>
      admin.from("reponses").select("exercice_assigne_id, champ, statut, fraction_correcte").in("exercice_assigne_id", exerciceIds).order("horodatage", { ascending: true }),
    );
    for (const r of reponses) {
      if (!historiqueParExercice.has(r.exercice_assigne_id)) historiqueParExercice.set(r.exercice_assigne_id, new Map());
      const parChamp = historiqueParExercice.get(r.exercice_assigne_id)!;
      if (!parChamp.has(r.champ)) parChamp.set(r.champ, []);
      parChamp.get(r.champ)!.push({ statut: r.statut, fraction_correcte: r.fraction_correcte });
    }
    const debuts = await recupererToutesLesLignes<LigneDebutEcran & { exercice_assigne_id: string }>(() => admin.from("debuts_ecran").select("exercice_assigne_id, champ, horodatage_debut").in("exercice_assigne_id", exerciceIds));
    for (const d of debuts) {
      if (!debutsParExercice.has(d.exercice_assigne_id)) debutsParExercice.set(d.exercice_assigne_id, []);
      debutsParExercice.get(d.exercice_assigne_id)!.push({ champ: d.champ, horodatage_debut: d.horodatage_debut });
    }
  }

  // Contexte (tentatives, chrono) par variante ; tâche introuvable : réglages par défaut du schéma (comportement d'origine).
  const contextes = new Map<string, Pick<ContexteTache, "tentativesMax" | "aidePenalitePourcent" | "chronoMode" | "chronoDureeSecondes">>();
  const maintenant = new Date();
  const completions: boolean[] = [];
  for (const ex of exercicesDeLaTache) {
    const champsAttendus = ex.champs_attendus as string[] | null;
    if (champsAttendus === null) {
      completions.push(false);
      continue;
    }
    const varianteId = ex.variante_id as string;
    if (!contextes.has(varianteId)) {
      const contexte = await chargerContexteTache(admin, tacheId, varianteId);
      contextes.set(varianteId, contexte ?? { tentativesMax: tentativesMaxEffectif(true, 0), aidePenalitePourcent: 0, chronoMode: "aucun", chronoDureeSecondes: null });
    }
    const termines = champsTermines(champsAttendus, historiqueParExercice.get(ex.id as string) ?? new Map(), debutsParExercice.get(ex.id as string) ?? [], contextes.get(varianteId)!, maintenant);
    completions.push(exerciceEstComplet(champsAttendus, termines));
  }
  const complete = tacheEstComplete(completions);

  return classifierTache(dateDebut, dateEcheance, complete, maintenant);
}
