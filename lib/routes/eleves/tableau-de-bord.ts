import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { recupererToutesLesLignes } from "../../supabasePagination";
import { calculerEtatExercice, chargerContexteTache, COLONNES_EXERCICE_ASSIGNE, donneesDepuisLignes, projeterExercice, regenererExercice, revelationFinDeTache, type ContexteTache, type DonneesExercice, type LigneExerciceAssigne, type LigneReponse } from "../../etatExercice";
import { poidsDansMap, poidsDesEcrans } from "../../poidsEcran";
import { calculerSerieActuelle, classifierTache, construireChampVue, REGLAGES_FORCEES_ANTERIEURES, resumeExercice, resumeTache, tacheEstComplete, type CategorieTableauDeBord, type ResumeProgression } from "../../tableauDeBord";
import type { LigneDebutEcran } from "../../moteurTentatives";
import { labelPourVariante } from "../../catalogueGenerateurs";
import type { StatutVerification } from "../../../src/moteur/statutVerification";

/**
 * GET /api/eleves/tableau-de-bord — tâches de l'élève classées en_cours / effectuees / anterieures
 * (jamais stockées : reclassées à chaque appel, `classifierTache`), `serieActuelle`, et pour chaque
 * exercice la vue de ses champs. Tout passe par le REGISTRE (lib/registreGenerateurs.ts) via
 * `regenererExercice` : plus aucun ensemble de variantes codé en dur ici. Un exercice sans
 * générateur exécutable (ligne historique sans graine, variante retirée) est ignoré plutôt que de
 * faire échouer tout le tableau de bord.
 *
 * Lectures non bornées à un exercice (toutes les réponses de l'élève, tous ses exercices) :
 * `recupererToutesLesLignes` (plafond silencieux de 1000 lignes de PostgREST).
 */

interface FenetreAssignation {
  date_debut: string;
  date_echeance: string | null;
}

export const gererElevesTableauDeBord = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
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
  const maintenant = new Date();

  // Fenêtres de dates par tâche : assignations par classe, puis par élève (la dernière l'emporte).
  const fenetres = new Map<string, FenetreAssignation>();
  const { data: inscriptions, error: erreurInscriptions } = await admin.from("inscriptions").select("classe_id").eq("eleve_id", eleve.id);
  if (erreurInscriptions) throw new Error(erreurInscriptions.message);
  const classeIds = (inscriptions ?? []).map((i) => i.classe_id as string);
  if (classeIds.length > 0) {
    const { data, error } = await admin.from("taches_assignations").select("tache_id, date_debut, date_echeance").in("classe_id", classeIds);
    if (error) throw new Error(error.message);
    for (const a of data ?? []) fenetres.set(a.tache_id as string, { date_debut: a.date_debut as string, date_echeance: (a.date_echeance as string | null) ?? null });
  }
  const { data: assignationsEleve, error: erreurAssignationsEleve } = await admin.from("taches_assignations_eleves").select("tache_id, date_debut, date_echeance").eq("eleve_id", eleve.id);
  if (erreurAssignationsEleve) throw new Error(erreurAssignationsEleve.message);
  for (const a of assignationsEleve ?? []) fenetres.set(a.tache_id as string, { date_debut: a.date_debut as string, date_echeance: (a.date_echeance as string | null) ?? null });

  const lignesExercices = await recupererToutesLesLignes<LigneExerciceAssigne & { date_creation: string }>(() =>
    admin.from("exercices_assignes").select(`${COLONNES_EXERCICE_ASSIGNE}, date_creation`).eq("eleve_id", eleve.id).order("date_creation", { ascending: true }),
  );
  const exerciceIds = lignesExercices.map((l) => l.id);

  const reponsesToutes: (LigneReponse & { horodatage: string })[] = [];
  const debutsParExercice = new Map<string, LigneDebutEcran[]>();
  const aidesParExercice = new Map<string, Set<string>>();
  if (exerciceIds.length > 0) {
    reponsesToutes.push(
      ...(await recupererToutesLesLignes<LigneReponse & { horodatage: string }>(() =>
        admin.from("reponses").select("exercice_assigne_id, champ, valeur_saisie, statut, indice_utilise, fraction_correcte, horodatage").in("exercice_assigne_id", exerciceIds).order("horodatage", { ascending: true }),
      )),
    );
    const debuts = await recupererToutesLesLignes<LigneDebutEcran & { exercice_assigne_id: string }>(() => admin.from("debuts_ecran").select("exercice_assigne_id, champ, horodatage_debut").in("exercice_assigne_id", exerciceIds));
    for (const d of debuts) {
      if (!debutsParExercice.has(d.exercice_assigne_id)) debutsParExercice.set(d.exercice_assigne_id, []);
      debutsParExercice.get(d.exercice_assigne_id)!.push({ champ: d.champ, horodatage_debut: d.horodatage_debut });
    }
    const aides = await recupererToutesLesLignes<{ exercice_assigne_id: string; champ: string }>(() => admin.from("aides_utilisees").select("exercice_assigne_id, champ").in("exercice_assigne_id", exerciceIds));
    for (const a of aides) {
      if (!aidesParExercice.has(a.exercice_assigne_id)) aidesParExercice.set(a.exercice_assigne_id, new Set());
      aidesParExercice.get(a.exercice_assigne_id)!.add(a.champ);
    }
  }
  // Lignes par exercice, chronologique croissant (l'ordre d'insertion sert à la validité sous retour en arrière, RAPPORT §37).
  const lignesParExercice = new Map<string, LigneReponse[]>();
  for (const r of reponsesToutes) {
    if (!lignesParExercice.has(r.exercice_assigne_id)) lignesParExercice.set(r.exercice_assigne_id, []);
    lignesParExercice.get(r.exercice_assigne_id)!.push(r);
  }

  const exercicesParTache = new Map<string, LigneExerciceAssigne[]>();
  for (const l of lignesExercices) {
    if (!exercicesParTache.has(l.tache_id)) exercicesParTache.set(l.tache_id, []);
    exercicesParTache.get(l.tache_id)!.push(l);
  }

  const sortie: Record<CategorieTableauDeBord, unknown[]> = { en_cours: [], effectuees: [], anterieures: [] };
  const cacheContextes = new Map<string, ContexteTache | null>();
  // Exercices dont les verdicts sont MASQUÉS : correction immédiate coupée et tâche ni terminée ni échue.
  // Leurs réponses ne comptent pas dans la série (sinon un échec caché ferait retomber la série à 0).
  const exercicesMasques = new Set<string>();

  for (const [tacheId, exercices] of exercicesParTache) {
    const fenetre = fenetres.get(tacheId);
    if (!fenetre) continue; // exercices générés mais tâche jamais assignée à cet élève (ne devrait pas arriver)

    const vuesExercices: { id: string; variante_id: string; libelle: string | null; champs: unknown[]; termine: boolean; resume: ResumeProgression }[] = [];
    let contexteTache: ContexteTache | null = null;
    // La catégorie dépend de la complétion, elle-même dépendante des états : deux passes.
    const etats = [];
    for (const ligne of exercices) {
      const regenere = regenererExercice(ligne);
      if (!regenere) continue;
      const cle = `${tacheId}:${ligne.variante_id}`;
      if (!cacheContextes.has(cle)) cacheContextes.set(cle, await chargerContexteTache(admin, tacheId, ligne.variante_id));
      const contexte = cacheContextes.get(cle)!;
      if (!contexte) continue;
      contexteTache = contexte;
      const donnees: DonneesExercice = donneesDepuisLignes(lignesParExercice.get(ligne.id) ?? [], debutsParExercice.get(ligne.id) ?? [], aidesParExercice.get(ligne.id) ?? new Set());
      etats.push({ ligne, regenere, contexte, etat: calculerEtatExercice(regenere, donnees, contexte, maintenant) });
    }
    if (etats.length === 0 || !contexteTache) continue;

    const complete = tacheEstComplete(etats.map((e) => e.etat.termine));
    const categorie = classifierTache(fenetre.date_debut, fenetre.date_echeance, complete, maintenant);
    if (categorie === "pas_commencee") continue;
    const anterieure = categorie === "anterieures";
    // Sous correction immédiate coupée, la révélation n'a lieu qu'à la fin de la TÂCHE entière (ou à
    // l'échéance) : tout est alors révélé d'un coup, jamais champ par champ.
    const reveleTout = anterieure || revelationFinDeTache(contexteTache, complete);
    if (!contexteTache.reglages.feedback_immediat && !reveleTout) for (const { ligne } of etats) exercicesMasques.add(ligne.id);

    for (const { ligne, regenere, contexte, etat } of etats) {
      const reglages = reveleTout ? REGLAGES_FORCEES_ANTERIEURES : contexte.reglages;
      const champsTermines = new Set(etat.champs.filter((c) => c.verrouille).map((c) => c.champ));
      const projete = projeterExercice(regenere, etat.reponsesConfirmees, contexte); // cascade (RAPPORT §18) : solutions bâties sur les réponses confirmées
      const poidsParChamp = poidsDesEcrans(regenere.ecrans); // RAPPORT §17 : donnée pour l'agrégation client, indépendante des réponses (rien à masquer)
      vuesExercices.push({
        id: ligne.id,
        variante_id: ligne.variante_id,
        libelle: labelPourVariante(ligne.variante_id),
        termine: etat.termine,
        resume: resumeExercice(regenere.ecrans.map((e) => e.champ), champsTermines),
        champs: etat.champs.map((c) => ({ ...construireChampVue(c.champ, c.derniere, regenere.generateur.solutionAttendue(projete.exercice, c.champ), reglages, reveleTout, c.etat), verrouille: c.verrouille, poids: poidsDansMap(poidsParChamp, c.champ) })),
      });
    }

    sortie[categorie].push({
      tache_id: tacheId,
      nom_tache: contexteTache.nom,
      chrono_mode: contexteTache.chronoMode,
      // Réglages effectifs de la tâche (l'élève les vit déjà) : l'aperçu professeur les rappelle dans son bandeau (RAPPORT §40).
      correction_immediate: contexteTache.reglages.feedback_immediat,
      retour_arriere: contexteTache.retourArriere,
      date_debut: fenetre.date_debut,
      date_echeance: fenetre.date_echeance,
      resume: resumeTache(vuesExercices.map((v) => v.resume)),
      exercices: vuesExercices.map(({ resume: _resume, ...v }) => v),
    });
  }

  const statutsRecentsD: StatutVerification[] = [...reponsesToutes].reverse().filter((r) => !exercicesMasques.has(r.exercice_assigne_id)).map((r) => r.statut);
  res.status(200).json({ ...sortie, serieActuelle: calculerSerieActuelle(statutsRecentsD) });
});
