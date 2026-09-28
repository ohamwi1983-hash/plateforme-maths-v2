import type { supabaseAdmin } from "./supabaseAdmin";

/**
 * 6 caractères alphanumériques majuscules, excluant les caractères ambigus à l'oral/à l'écrit
 * (prompt "Authentification élève", Étape 2) : 0/O, 1/I/L. A-Z (26) + 0-9 (10) - {0,O,1,I,L} = 31
 * caractères restants.
 */
const CARACTERES = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGUEUR = 6;
const TENTATIVES_MAX = 10;

export function genererCodeClasse(): string {
  let code = "";
  for (let i = 0; i < LONGUEUR; i++) {
    code += CARACTERES[Math.floor(Math.random() * CARACTERES.length)];
  }
  return code;
}

/**
 * Génère un code de classe garanti unique (Étape 2 : "unicité vérifiée avant insertion — retirer
 * si collision, régénérer"). 31^6 ≈ 887 millions de combinaisons : une collision est virtuellement
 * impossible dès la 1ère tentative à cette échelle, `TENTATIVES_MAX` n'est qu'un garde-fou.
 */
export async function genererCodeClasseUnique(admin: ReturnType<typeof supabaseAdmin>): Promise<string> {
  for (let tentative = 0; tentative < TENTATIVES_MAX; tentative++) {
    const candidat = genererCodeClasse();
    const { data } = await admin.from("classes").select("id").eq("code", candidat).maybeSingle();
    if (!data) return candidat;
  }
  throw new Error(`Impossible de générer un code de classe unique après ${TENTATIVES_MAX} tentatives`);
}
