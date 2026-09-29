import type { RequeteHttp, ReponseHttp } from "../../../../httpTypes";
import { avecGestionErreurs } from "../../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../../supabaseAdmin";
import { exigerAdmin } from "../../../../adminAuth";
import { BAN_DESACTIVATION, chargerCibleProf } from "../../../../adminProfs";

/**
 * POST /api/admin/profs/:id/desactiver — désactive un compte professeur (RAPPORT §26), jamais une suppression :
 * classes, tâches, élèves et réponses restent intacts. Contrairement au patron élève (`desactiver-eleve.ts` : drapeau
 * seul, appliqué à la connexion serveur), le prof se connecte DIRECTEMENT depuis le navigateur ; deux verrous :
 * (1) `profs.actif = false` — refusé aussitôt par `profAuthentifie` (401 partout) ; (2) bannissement Supabase Auth
 * (plus de nouvelle connexion ni de renouvellement de jeton). Garde-fous : jamais soi-même, jamais un admin.
 */
export const gererAdminProfsDesactiver = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const admin = supabaseAdmin();
  const cible = await chargerCibleProf(admin, params.id, res);
  if (!cible) return;
  if (cible.id === moi.id) {
    res.status(403).json({ erreur: "Vous ne pouvez pas désactiver votre propre compte" });
    return;
  }
  if (cible.est_admin) {
    res.status(403).json({ erreur: "Un compte administrateur ne peut pas être désactivé par cette voie" });
    return;
  }

  const { error } = await admin.from("profs").update({ actif: false }).eq("id", cible.id);
  if (error) {
    res.status(500).json({ erreur: "Échec de la désactivation", detail: error.message });
    return;
  }
  const { error: erreurBan } = await admin.auth.admin.updateUserById(cible.id, { ban_duration: BAN_DESACTIVATION });
  if (erreurBan) {
    res.status(500).json({ erreur: "Compte désactivé, mais le bannissement Supabase Auth a échoué (le compte reste refusé par l'API)", detail: erreurBan.message });
    return;
  }
  res.status(200).json({ ok: true });
});
