import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { lireSupabaseUrl } from "../urlSupabase";

/**
 * GET /api/config — expose au navigateur l'URL du projet Supabase et sa clé publique `anon`
 * (conçue pour être publique — jamais la clé `service_role`), pour que la page prof (Étape 6)
 * puisse s'authentifier via Supabase Auth email/mot de passe sans clé codée en dur dans le HTML.
 */
export const gererConfig = avecGestionErreurs(function handler(req: RequeteHttp, res: ReponseHttp): void {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  res.status(200).json({
    supabaseUrl: lireSupabaseUrl(), // le navigateur construit /auth/v1 lui-même : même normalisation que le serveur (RAPPORT §25)
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
  });
});
