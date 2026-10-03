import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../supabaseAdmin";
import { exigerAdmin } from "../../../adminAuth";
import { supprimerClasseDeTest } from "../../../suppressionClasseTest";

/**
 * DELETE /api/admin/classes-test/:id — suppression IRRÉVERSIBLE d'une classe de test et de tout ce qui en dépend (RAPPORT §61, `lib/suppressionClasseTest.ts`). Réservée aux admins, et à SES classes de
 * test : la classe d'un autre professeur, ou une classe qui n'est pas marquée `est_test`, répond 404 sans rien toucher. Un élève de la classe inscrit ailleurs : 409, rien n'est supprimé.
 */
export const gererAdminClassesTestSuppression = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "DELETE") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;
  const admin = supabaseAdmin();

  const { data: classe, error } = await admin.from("classes").select("id, prof_id, est_test").eq("id", params.id).maybeSingle();
  if (error) {
    res.status(500).json({ erreur: "Échec de lecture de la classe", detail: error.message });
    return;
  }
  if (!classe || classe.prof_id !== moi.id || classe.est_test !== true) {
    res.status(404).json({ erreur: "Classe de test introuvable" });
    return;
  }

  const resultat = await supprimerClasseDeTest(admin, classe.id as string);
  if (!resultat.ok) {
    res.status(resultat.statut).json({ erreur: resultat.erreur, ...(resultat.elevesPartages ? { eleves_partages: resultat.elevesPartages } : {}) });
    return;
  }
  res.status(200).json({ ok: true, eleves_supprimes: resultat.eleves, exercices_supprimes: resultat.exercices, ...(resultat.comptesAuthNonSupprimes.length > 0 ? { comptes_auth_non_supprimes: resultat.comptesAuthNonSupprimes } : {}) });
});
