import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { generateurIdPourVariante } from "../../catalogueGenerateurs";
import { estCorpsValide, validerComposition } from "../../validationCorpsTaches";
import { tacheEstAssignee } from "../../tacheAssignee";
import { chargerTacheDuProf } from "../../tacheDuProf";

/**
 * PATCH /api/taches/:id — prompt "Séparer création et assignation de tâche", Étape 2/3 : modifie
 * nom/composition/réglages d'une tâche. Rejette (400, message explicite) si elle est assignée
 * (`tacheEstAssignee`, seule source de vérité, jamais redéfinie ici) — vérifié CÔTÉ SERVEUR, pas
 * seulement caché dans l'interface (Étape 2 : "cette règle est vérifiée côté serveur"). Remplace
 * la composition entière (supprime les lignes `taches_composition` existantes, insère les
 * nouvelles) plutôt qu'un correctif partiel — le corps attendu est le même que `POST /api/taches`
 * (Étape 4 : le même formulaire de composition, réutilisé pour créer ET modifier).
 */
async function modifierTache(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const admin = supabaseAdmin();
  const tache = await chargerTacheDuProf(admin, params.id, prof.id);
  if (!tache) {
    res.status(404).json({ erreur: "Tâche introuvable" });
    return;
  }

  if (await tacheEstAssignee(admin, tache.id)) {
    res.status(400).json({ erreur: "Cette tâche est déjà assignée à au moins une classe et n'est plus modifiable." });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { nom: string, composition: [{ variante_id, nombre_exercices }] }" });
    return;
  }

  const resultatComposition = validerComposition(req.body.composition);
  if (!resultatComposition.ok) {
    res.status(400).json({ erreur: resultatComposition.erreur });
    return;
  }
  const composition = resultatComposition.composition;

  const { error: erreurMaj } = await admin
    .from("taches")
    .update({
      nom: req.body.nom,
      feedback_immediat: req.body.feedback_immediat ?? true,
      reponse_visible: req.body.reponse_visible ?? false,
      tentatives_supplementaires: req.body.tentatives_supplementaires ?? 0,
      aide_activee: req.body.aide_activee ?? false,
      aide_penalite_pourcent: req.body.aide_penalite_pourcent ?? 0,
      afficher_recapitulatif: req.body.afficher_recapitulatif ?? false,
      chrono_mode: req.body.chrono_mode ?? "aucun",
      chrono_duree_secondes: req.body.chrono_duree_secondes ?? null,
      autoriser_retour_arriere: req.body.autoriser_retour_arriere ?? false,
    })
    .eq("id", tache.id);
  if (erreurMaj) {
    res.status(500).json({ erreur: "Échec de la modification de la tâche", detail: erreurMaj.message });
    return;
  }

  const { error: erreurSuppression } = await admin.from("taches_composition").delete().eq("tache_id", tache.id);
  if (erreurSuppression) {
    res.status(500).json({ erreur: "Échec du remplacement de la composition", detail: erreurSuppression.message });
    return;
  }

  const lignes = composition.map((ligne) => ({
    tache_id: tache.id,
    generateur_id: generateurIdPourVariante(ligne.variante_id),
    variante_id: ligne.variante_id,
    nombre_exercices: ligne.nombre_exercices,
    // Correctif "Chrono par variante" : même règle qu'à la création (POST /api/taches) — `null`
    // si absente du corps, repli sur `taches.chrono_duree_secondes` (voir
    // lib/resoudreChronoDureeSecondes.ts).
    chrono_duree_secondes: ligne.chrono_duree_secondes ?? null,
  }));
  const { error: erreurInsertion } = await admin.from("taches_composition").insert(lignes);
  if (erreurInsertion) {
    res.status(500).json({ erreur: "Échec du remplacement de la composition", detail: erreurInsertion.message });
    return;
  }

  res.status(200).json({ id: tache.id });
}

/**
 * DELETE /api/taches/:id — même verrouillage que `PATCH` (Étape 2). "Aucune cascade complexe à
 * gérer dans ce cas précis" (Étape 3) : une tâche jamais assignée n'a par construction aucun
 * `exercices_assignes`/`reponses` (générés uniquement par `POST /api/assignations`, jamais par
 * `POST /api/taches`) — seules les lignes `taches_composition` doivent être supprimées, avant la
 * tâche elle-même (`taches_composition.tache_id references taches(id)` sans `on delete cascade`,
 * voir supabase/schema.sql : l'ordre est obligatoire, pas une précaution superflue).
 */
async function supprimerTache(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const admin = supabaseAdmin();
  const tache = await chargerTacheDuProf(admin, params.id, prof.id);
  if (!tache) {
    res.status(404).json({ erreur: "Tâche introuvable" });
    return;
  }

  if (await tacheEstAssignee(admin, tache.id)) {
    res.status(400).json({ erreur: "Cette tâche est déjà assignée à au moins une classe et n'est plus supprimable." });
    return;
  }

  const { error: erreurSuppressionComposition } = await admin.from("taches_composition").delete().eq("tache_id", tache.id);
  if (erreurSuppressionComposition) {
    res.status(500).json({ erreur: "Échec de la suppression de la composition", detail: erreurSuppressionComposition.message });
    return;
  }

  const { error: erreurSuppressionTache } = await admin.from("taches").delete().eq("id", tache.id);
  if (erreurSuppressionTache) {
    res.status(500).json({ erreur: "Échec de la suppression de la tâche", detail: erreurSuppressionTache.message });
    return;
  }

  res.status(200).json({ ok: true });
}

export const gererTachesId = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method === "PATCH") {
    await modifierTache(req, res, params);
    return;
  }
  if (req.method === "DELETE") {
    await supprimerTache(req, res, params);
    return;
  }
  res.status(405).json({ erreur: "Méthode non autorisée" });
});
