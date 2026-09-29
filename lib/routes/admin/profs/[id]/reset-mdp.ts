import type { RequeteHttp, ReponseHttp } from "../../../../httpTypes";
import { avecGestionErreurs } from "../../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../../supabaseAdmin";
import { exigerAdmin } from "../../../../adminAuth";
import { chargerCibleProf, MOT_DE_PASSE_MIN_PROF } from "../../../../adminProfs";

/**
 * POST /api/admin/profs/:id/reset-mdp — réinitialise le mot de passe d'un professeur (RAPPORT §26), même mécanisme
 * que `reset-mdp-eleve.ts` (`auth.admin.updateUserById`). Corps : `{ nouveauMotDePasse }` (6 caractères minimum).
 * Garde-fou : JAMAIS sur un compte administrateur (y compris le sien) — sinon un admin pourrait prendre le contrôle
 * d'un autre admin, alors que seul le propriétaire du projet accorde ce statut. Réinitialiser le mot de passe d'un prof
 * ordinaire permet de se connecter à son compte : pouvoir inhérent à la fonction, sans journal d'audit (RAPPORT §26).
 */
export const gererAdminProfsResetMdp = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const admin = supabaseAdmin();
  const cible = await chargerCibleProf(admin, params.id, res);
  if (!cible) return;

  const c = req.body as Record<string, unknown> | null;
  if (typeof c !== "object" || c === null || typeof c.nouveauMotDePasse !== "string" || c.nouveauMotDePasse.length < MOT_DE_PASSE_MIN_PROF) {
    res.status(400).json({ erreur: `Corps invalide : { nouveauMotDePasse } — ${MOT_DE_PASSE_MIN_PROF} caractères minimum` });
    return;
  }
  if (cible.est_admin) {
    res.status(403).json({ erreur: "Le mot de passe d'un compte administrateur ne se réinitialise pas par cette voie" });
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(cible.id, { password: c.nouveauMotDePasse });
  if (error) {
    res.status(500).json({ erreur: "Échec de réinitialisation : " + error.message });
    return;
  }
  res.status(200).json({ ok: true });
});
