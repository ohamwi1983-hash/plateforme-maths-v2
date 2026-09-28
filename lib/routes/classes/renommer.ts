import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";

interface CorpsRenommer {
  classe_id: string;
  nom: string;
}

function estCorpsValide(corps: unknown): corps is CorpsRenommer {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.classe_id === "string" && c.classe_id.trim() !== "" && typeof c.nom === "string" && c.nom.trim() !== "";
}

/**
 * POST /api/classes/renommer — refonte "Onglet Classes" (Option C, crayon jaune à gauche de
 * l'intitulé dans le bandeau de la classe active). Même convention que
 * `lib/routes/classes/regenerer-code.ts` (fichier jumeau, même vérification d'appartenance au prof
 * authentifié, même 404 générique "introuvable" plutôt que 403 pour ne pas confirmer l'existence
 * d'une classe d'un autre prof).
 */
export const gererClassesRenommer = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
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
    res.status(400).json({ erreur: "Corps invalide : { classe_id: string, nom: string }" });
    return;
  }

  const admin = supabaseAdmin();

  const { data: classe, error: erreurClasse } = await admin.from("classes").select("id, prof_id").eq("id", req.body.classe_id).maybeSingle();
  if (erreurClasse || !classe || classe.prof_id !== prof.id) {
    res.status(404).json({ erreur: "Classe introuvable" });
    return;
  }

  const nom = req.body.nom.trim();
  const { data: classeMaj, error: erreurMaj } = await admin.from("classes").update({ nom }).eq("id", classe.id).select("id, nom, code").single();
  if (erreurMaj || !classeMaj) {
    res.status(500).json({ erreur: "Échec du renommage", detail: erreurMaj?.message });
    return;
  }

  res.status(200).json(classeMaj);
});
