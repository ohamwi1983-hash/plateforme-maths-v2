import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../../supabaseAdmin";

/**
 * GET /api/exercices — liste les exercices assignés à l'élève authentifié (id, variante_id,
 * date de création — jamais enonce ni solution ici, seulement de quoi peupler la liste avant
 * d'ouvrir un exercice via GET /api/exercices/:id).
 * Ajout pragmatique non listé explicitement à l'Étape 4 (prompt gen1), nécessaire pour que la page
 * élève (Étape 6 : "liste ses exercices assignés") ait quelque chose à lister — voir le rapport de
 * fin.
 *
 * Authentification ajoutée pour "Authentification élève et réglages de correction" : `eleve_id`
 * n'est plus un paramètre de requête fourni par le client (spoofable), mais dérivé du token —
 * voir `eleveAuthentifie` (lib/supabaseAdmin.ts) pour la justification complète.
 */
export const gererExercicesIndex = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
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
  const { data: exercices, error } = await admin
    .from("exercices_assignes")
    .select("id, variante_id, date_creation")
    .eq("eleve_id", eleve.id)
    .order("date_creation", { ascending: false });
  if (error) {
    res.status(500).json({ erreur: "Échec de récupération des exercices", detail: error.message });
    return;
  }

  res.status(200).json(exercices ?? []);
});
