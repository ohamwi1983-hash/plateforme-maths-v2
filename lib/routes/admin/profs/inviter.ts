import { randomUUID } from "node:crypto";
import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../supabaseAdmin";
import { exigerAdmin } from "../../../adminAuth";
import { emailValide } from "../../../adminProfs";

/**
 * POST /api/admin/profs/inviter — génère un code d'invitation LIÉ à un e-mail (RAPPORT §26, remplace l'insertion SQL
 * manuelle) : `{ email }` EXACTEMENT. Le code (`randomUUID`, même forme que les codes historiques) n'est renvoyé
 * qu'ici, une seule fois ; `POST /api/inscription-prof` refuse tout autre e-mail avec le 404 générique.
 */
export const gererAdminProfsInviter = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const c = req.body as Record<string, unknown> | null;
  if (typeof c !== "object" || c === null || Array.isArray(c) || Object.keys(c).some((k) => k !== "email") || !emailValide(c.email)) {
    res.status(400).json({ erreur: "Corps invalide : { email } — un e-mail valide, rien d'autre" });
    return;
  }

  const email = c.email.trim().toLowerCase();
  const code = randomUUID();
  const { error } = await supabaseAdmin().from("invitations_prof").insert({ code, email_cible: email, cree_par: moi.id });
  if (error) {
    res.status(500).json({ erreur: "Échec de création du code d'invitation", detail: error.message });
    return;
  }
  res.status(201).json({ code, email });
});
