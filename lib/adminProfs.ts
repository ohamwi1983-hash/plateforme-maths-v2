import type { ReponseHttp } from "./httpTypes";
import type { supabaseAdmin } from "./supabaseAdmin";

/** Fonctions communes aux routes `/api/admin/profs/*` (RAPPORT §26). */

export const MOT_DE_PASSE_MIN_PROF = 6;

/** Durée de bannissement Supabase Auth d'un compte désactivé (~100 ans, réversible par `BAN_LEVE`). */
export const BAN_DESACTIVATION = "876000h";
export const BAN_LEVE = "none";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_SIMPLE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValide(email: unknown): email is string {
  return typeof email === "string" && EMAIL_SIMPLE.test(email.trim());
}

export interface CibleProf {
  id: string;
  nom: string;
  actif: boolean;
  est_admin: boolean;
}

/**
 * Charge la ligne `profs` visée par une action admin. 404 « Professeur introuvable » si l'identifiant n'est pas un
 * UUID (jamais envoyé à PostgREST : erreur de syntaxe sinon) ou n'existe pas ; 500 si la lecture échoue.
 */
export async function chargerCibleProf(admin: ReturnType<typeof supabaseAdmin>, id: string | undefined, res: ReponseHttp): Promise<CibleProf | null> {
  if (typeof id !== "string" || !UUID.test(id)) {
    res.status(404).json({ erreur: "Professeur introuvable" });
    return null;
  }
  const { data, error } = await admin.from("profs").select("id, nom, actif, est_admin").eq("id", id).maybeSingle();
  if (error) {
    res.status(500).json({ erreur: "Échec de lecture du professeur", detail: error.message });
    return null;
  }
  if (!data) {
    res.status(404).json({ erreur: "Professeur introuvable" });
    return null;
  }
  const ligne = data as { id: string; nom: string | null; actif: boolean | null; est_admin: boolean | null };
  return { id: ligne.id, nom: ligne.nom ?? "", actif: ligne.actif !== false, est_admin: ligne.est_admin === true };
}
