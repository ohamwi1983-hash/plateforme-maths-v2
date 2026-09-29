import type { RequeteHttp, ReponseHttp } from "../../../../httpTypes";
import { avecGestionErreurs } from "../../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../../supabaseAdmin";
import { exigerAdmin } from "../../../../adminAuth";
import { BAN_LEVE, chargerCibleProf } from "../../../../adminProfs";

/**
 * POST /api/admin/profs/:id/reactiver — inverse de `desactiver` (RAPPORT §26) : lève le bannissement Auth PUIS
 * remet `actif = true` (si la seconde étape échoue, le compte reste refusé par l'API : état sûr).
 */
export const gererAdminProfsReactiver = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const admin = supabaseAdmin();
  const cible = await chargerCibleProf(admin, params.id, res);
  if (!cible) return;

  const { error: erreurBan } = await admin.auth.admin.updateUserById(cible.id, { ban_duration: BAN_LEVE });
  if (erreurBan) {
    res.status(500).json({ erreur: "Échec de la levée du bannissement Supabase Auth", detail: erreurBan.message });
    return;
  }
  const { error } = await admin.from("profs").update({ actif: true }).eq("id", cible.id);
  if (error) {
    res.status(500).json({ erreur: "Bannissement levé, mais la réactivation a échoué (le compte reste refusé par l'API)", detail: error.message });
    return;
  }
  res.status(200).json({ ok: true });
});
