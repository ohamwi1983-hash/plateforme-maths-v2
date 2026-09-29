import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../supabaseAdmin";
import { exigerAdmin } from "../../../adminAuth";
import { recupererToutesLesLignes } from "../../../supabasePagination";

interface LigneProf {
  id: string;
  nom: string | null;
  actif: boolean | null;
  est_admin: boolean | null;
}

const TAILLE_LOT_EMAILS = 10;

/**
 * GET /api/admin/profs — liste des professeurs (RAPPORT §26) : nom, email, actif, est_admin. Réservé aux admins
 * (`exigerAdmin` : 401/403). `profs` n'a pas d'email : il vient de Supabase Auth (`getUserById`, par lots) ; un compte
 * Auth illisible donne `email: null` sans faire échouer la liste.
 */
export const gererAdminProfsListe = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const admin = supabaseAdmin();
  const lignes = await recupererToutesLesLignes<LigneProf>(() => admin.from("profs").select("id, nom, actif, est_admin").order("nom", { ascending: true }));

  const emails = new Map<string, string | null>();
  for (let i = 0; i < lignes.length; i += TAILLE_LOT_EMAILS) {
    await Promise.all(
      lignes.slice(i, i + TAILLE_LOT_EMAILS).map(async (l) => {
        const { data, error } = await admin.auth.admin.getUserById(l.id);
        emails.set(l.id, error || !data.user ? null : (data.user.email ?? null));
      }),
    );
  }

  res.status(200).json({
    profs: lignes.map((l) => ({ id: l.id, nom: l.nom ?? "", email: emails.get(l.id) ?? null, actif: l.actif !== false, est_admin: l.est_admin === true })),
  });
});
