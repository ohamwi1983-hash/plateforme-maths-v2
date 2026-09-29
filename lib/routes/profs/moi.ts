import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie } from "../../supabaseAdmin";

/**
 * GET /api/profs/moi — identité du prof connecté, dont `est_admin` (RAPPORT §26). C'est la SEULE source de cette
 * information pour l'interface (jamais déduite côté client) : elle ne sert qu'à afficher ou masquer l'onglet
 * « Administration » ; les routes `/api/admin/*` re-vérifient de toute façon `est_admin` côté serveur.
 */
export const gererProfsMoi = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }
  res.status(200).json({ id: prof.id, nom: prof.nom, est_admin: prof.estAdmin });
});
