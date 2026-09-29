import type { RequeteHttp, ReponseHttp } from "./httpTypes";
import { profAuthentifie } from "./supabaseAdmin";
import type { ProfAuthentifie } from "./authProf";

/**
 * Garde de TOUTES les routes `/api/admin/*` (RAPPORT §26) — vérification SERVEUR de `profs.est_admin`, relue en
 * base à chaque requête. 401 = non authentifié (ou compte désactivé), 403 = authentifié mais non admin :
 * un refus explicite, jamais une erreur générique. Renvoie le prof admin, ou `null` après avoir répondu.
 */
export async function exigerAdmin(req: RequeteHttp, res: ReponseHttp): Promise<ProfAuthentifie | null> {
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return null;
  }
  if (!prof.estAdmin) {
    res.status(403).json({ erreur: "Réservé aux administrateurs" });
    return null;
  }
  return prof;
}
