import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { provisionnerEleve } from "../../provisionnerEleve";

interface CorpsCreerEleve {
  classe_id: string;
  nom: string;
  prenom: string;
  motDePasse: string;
  email?: string;
}

const MOT_DE_PASSE_MIN = 6;

function estCorpsValide(corps: unknown): corps is CorpsCreerEleve {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return (
    typeof c.classe_id === "string" &&
    c.classe_id.trim() !== "" &&
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
 * POST /api/profs/creer-eleve — création manuelle d'un élève par le prof (prompt "Authentification
 * élève", Étape 3) : "même chemin que l'inscription... mais motDePasse fourni par le prof". Ne
 * renvoie pas de session (c'est le prof qui est connecté, pas l'élève).
 */
export const gererProfsCreerEleve = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { classe_id, nom, prenom, motDePasse, email? } — mot de passe : 6 caractères minimum" });
    return;
  }

  const admin = supabaseAdmin();
  const nom = req.body.nom.trim();
  const prenom = req.body.prenom.trim();
  const email = req.body.email?.trim() || undefined;

  const { data: classe, error: erreurClasse } = await admin
    .from("classes")
    .select("id")
    .eq("id", req.body.classe_id)
    .eq("prof_id", prof.id)
    .maybeSingle();
  if (erreurClasse || !classe) {
    res.status(404).json({ erreur: "Classe introuvable" });
    return;
  }

  const resultat = await provisionnerEleve(admin, classe.id, nom, prenom, req.body.motDePasse, email);
  if (!resultat.ok) {
    res.status(500).json({ erreur: resultat.erreur, detail: resultat.detail });
    return;
  }

  res.status(201).json({ id: resultat.resultat.id, affichage: resultat.resultat.affichage });
});
