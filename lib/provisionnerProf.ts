import { supabaseAdmin } from "./supabaseAdmin";

type Admin = ReturnType<typeof supabaseAdmin>;

export type ResultatProvisionnementProf =
  | { ok: true; id: string }
  | { ok: false; etape: "auth" | "profil"; message: string; doublon: boolean };

const MESSAGE_DOUBLON = /already|registered|exists|duplicate/i;

/**
 * Création d'un compte professeur : utilisateur Supabase Auth (e-mail confirmé) PUIS ligne `profs` — partagée par
 * `POST /api/inscription-prof` et `POST /api/admin/profs/creer` (RAPPORT §26, jamais deux copies). Ne prend PAS
 * `est_admin` : un compte créé par cette voie n'est jamais admin (colonne à `false` par défaut, promotion = SQL manuel).
 * Si l'insertion `profs` échoue, le compte Auth est SUPPRIMÉ (compensation) : sans cela il resterait orphelin et
 * bloquerait l'e-mail pour toujours ; l'échec de cette suppression est signalé dans `message`.
 */
export async function provisionnerProf(admin: Admin, e: { email: string; motDePasse: string; nom: string }): Promise<ResultatProvisionnementProf> {
  const { data: userData, error: erreurCreation } = await admin.auth.admin.createUser({ email: e.email, password: e.motDePasse, email_confirm: true });
  if (erreurCreation || !userData.user) {
    const message = erreurCreation?.message ?? "inconnu";
    return { ok: false, etape: "auth", message, doublon: MESSAGE_DOUBLON.test(message) };
  }

  const id = userData.user.id;
  const { error: erreurProf } = await admin.from("profs").insert({ id, nom: e.nom });
  if (erreurProf) {
    const { error: erreurNettoyage } = await admin.auth.admin.deleteUser(id);
    const suffixe = erreurNettoyage ? ` (le compte Auth ${id} n'a pas pu être supprimé : ${erreurNettoyage.message})` : "";
    return { ok: false, etape: "profil", message: erreurProf.message + suffixe, doublon: false };
  }
  return { ok: true, id };
}
