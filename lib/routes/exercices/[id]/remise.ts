import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../../../supabaseAdmin";
import { calculerEtatExercice, chargerContexteTache, chargerDonneesExercice, COLONNES_EXERCICE_ASSIGNE, regenererExercice, tacheEstCompletePourEleve, type LigneExerciceAssigne } from "../../../etatExercice";
import { categorieTachePourEleve } from "../../../verrouillageTache";

/**
 * POST /api/exercices/:id/remise — l'élève rend l'exercice (retour en arrière, RAPPORT §37, D3) : `exercices_assignes.remis_le`
 * est posé, l'exercice ne se modifie plus et — c'est ce qui compte — devient TERMINÉ. Sans cette étape explicite, la dernière
 * réponse d'un élève ferait tout révéler d'un coup (corrections, verdicts) sans qu'il ait pu relire ses réponses.
 *
 * Refus : réglage inactif (409), écrans sans réponse valide (409 — l'élève doit avoir répondu à tout), tâche pas commencée ou
 * échue (403). Idempotent : rendre un exercice déjà rendu répond 200 sans rien réécrire. Corps ignoré.
 */
export const gererExercicesIdRemise = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const eleve = await eleveAuthentifie(req.headers.authorization as string | undefined);
  if (!eleve) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }
  const id = params.id;
  if (typeof id !== "string") {
    res.status(400).json({ erreur: "Identifiant d'exercice manquant" });
    return;
  }
  const admin = supabaseAdmin();
  const { data: ligne, error } = await admin.from("exercices_assignes").select(COLONNES_EXERCICE_ASSIGNE).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ligne || ligne.eleve_id !== eleve.id) {
    res.status(404).json({ erreur: "Exercice introuvable" });
    return;
  }
  const regenere = regenererExercice(ligne as unknown as LigneExerciceAssigne);
  if (!regenere) {
    res.status(409).json({ erreur: "Exercice non exécutable (générateur inconnu du registre ou graine absente)" });
    return;
  }
  const categorie = await categorieTachePourEleve(admin, ligne.tache_id as string, eleve.id);
  if (categorie === "pas_commencee") {
    res.status(403).json({ erreur: "Cette tâche n'a pas encore commencé" });
    return;
  }
  if (categorie === "anterieures") {
    res.status(403).json({ erreur: "L'échéance de cette tâche est dépassée" });
    return;
  }
  const contexte = await chargerContexteTache(admin, ligne.tache_id as string, ligne.variante_id as string);
  if (!contexte) {
    res.status(404).json({ erreur: "Tâche associée introuvable" });
    return;
  }
  if (!contexte.retourArriere) {
    res.status(409).json({ erreur: "Cette tâche ne prévoit pas de remise : ses réponses sont définitives" });
    return;
  }
  const maintenant = new Date();
  const etat = calculerEtatExercice(regenere, await chargerDonneesExercice(admin, id), contexte, maintenant);
  if (!etat.exerciceVerrouille) {
    if (!etat.pretARendre) {
      res.status(409).json({ erreur: "Il reste des écrans sans réponse : réponds à tous les écrans avant de rendre l'exercice", champ_courant: etat.champCourant });
      return;
    }
    const { error: erreurMaj } = await admin.from("exercices_assignes").update({ remis_le: maintenant.toISOString() }).eq("id", id);
    if (erreurMaj) throw new Error(erreurMaj.message);
  }
  const tacheTerminee = await tacheEstCompletePourEleve(admin, ligne.tache_id as string, eleve.id, maintenant);
  res.status(200).json({ remis: true, exercice_termine: true, tache_terminee: tacheTerminee });
});
