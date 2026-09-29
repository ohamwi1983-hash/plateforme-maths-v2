import type { RequeteHttp, ReponseHttp } from "../../../httpTypes";
import { avecGestionErreurs } from "../../../avecGestionErreurs";
import { supabaseAdmin } from "../../../supabaseAdmin";
import { exigerAdmin } from "../../../adminAuth";
import { provisionnerProf } from "../../../provisionnerProf";
import { emailValide, MOT_DE_PASSE_MIN_PROF } from "../../../adminProfs";

const CLES_AUTORISEES = new Set(["email", "motDePasse", "nom"]);

/**
 * POST /api/admin/profs/creer — création directe d'un compte professeur par un admin (RAPPORT §26) :
 * `{ email, motDePasse, nom }` EXACTEMENT. Toute autre clé est refusée (400), `est_admin` en tête : un compte créé par
 * cette voie n'est JAMAIS admin (`provisionnerProf` ne connaît pas cette colonne). 409 si l'e-mail est déjà pris.
 */
export const gererAdminProfsCreer = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const moi = await exigerAdmin(req, res);
  if (!moi) return;

  const corps = req.body;
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) {
    res.status(400).json({ erreur: "Corps invalide : { email, motDePasse, nom }" });
    return;
  }
  const c = corps as Record<string, unknown>;
  const inconnues = Object.keys(c).filter((k) => !CLES_AUTORISEES.has(k));
  if (inconnues.length > 0) {
    res.status(400).json({ erreur: `Champ(s) non autorisé(s) : ${inconnues.join(", ")}` });
    return;
  }
  if (!emailValide(c.email) || typeof c.nom !== "string" || c.nom.trim() === "" || typeof c.motDePasse !== "string" || c.motDePasse.length < MOT_DE_PASSE_MIN_PROF) {
    res.status(400).json({ erreur: `Corps invalide : { email, motDePasse, nom } — e-mail valide, nom non vide, mot de passe : ${MOT_DE_PASSE_MIN_PROF} caractères minimum` });
    return;
  }

  const email = c.email.trim();
  const nom = c.nom.trim();
  const resultat = await provisionnerProf(supabaseAdmin(), { email, motDePasse: c.motDePasse, nom });
  if (!resultat.ok) {
    if (resultat.doublon) {
      res.status(409).json({ erreur: "Un compte existe déjà avec cet e-mail" });
      return;
    }
    res.status(500).json({ erreur: resultat.etape === "auth" ? "Échec de création du compte" : "Échec de création du professeur", detail: resultat.message });
    return;
  }
  res.status(201).json({ id: resultat.id, nom, email });
});
