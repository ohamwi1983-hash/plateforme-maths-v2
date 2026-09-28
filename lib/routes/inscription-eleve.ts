import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { supabaseAdmin } from "../supabaseAdmin";
import { provisionnerEleve } from "../provisionnerEleve";

interface CorpsInscription {
  code: string;
  nom: string;
  prenom: string;
  motDePasse: string;
  email?: string;
}

const MOT_DE_PASSE_MIN = 6;

function estCorpsValide(corps: unknown): corps is CorpsInscription {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return (
    typeof c.code === "string" &&
    c.code.trim() !== "" &&
    typeof c.nom === "string" &&
    c.nom.trim() !== "" &&
    typeof c.prenom === "string" &&
    c.prenom.trim() !== "" &&
    typeof c.motDePasse === "string" &&
    c.motDePasse.length >= MOT_DE_PASSE_MIN &&
    (c.email === undefined || typeof c.email === "string")
  );
}

/**
 * POST /api/inscription-eleve — inscription élève par code de classe (prompt "Authentification
 * élève", Étape 3). Connecte immédiatement l'élève après création (point 6 : "l'élève arrive
 * directement sur son espace, pas besoin de se reconnecter juste après s'être inscrit").
 */
export const gererInscriptionEleve = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { code, nom, prenom, motDePasse, email? } — mot de passe : 6 caractères minimum" });
    return;
  }

  const admin = supabaseAdmin();
  const nom = req.body.nom.trim();
  const prenom = req.body.prenom.trim();
  const email = req.body.email?.trim() || undefined;

  const { data: classe, error: erreurClasse } = await admin
    .from("classes")
    .select("id")
    .eq("code", req.body.code.trim().toUpperCase())
    .maybeSingle();
  if (erreurClasse || !classe) {
    res.status(404).json({ erreur: "Code de classe invalide" });
    return;
  }

  const resultat = await provisionnerEleve(admin, classe.id, nom, prenom, req.body.motDePasse, email);
  if (!resultat.ok) {
    res.status(500).json({ erreur: resultat.erreur, detail: resultat.detail });
    return;
  }

  const { data: session, error: erreurConnexion } = await admin.auth.signInWithPassword({
    email: resultat.resultat.email,
    password: req.body.motDePasse,
  });
  if (erreurConnexion || !session.session) {
    res.status(500).json({ erreur: "Compte créé mais connexion automatique échouée : " + (erreurConnexion?.message ?? "inconnu") });
    return;
  }

  res.status(201).json({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    eleve: { id: resultat.resultat.id, nom, prenom, affichage: resultat.resultat.affichage },
  });
});
