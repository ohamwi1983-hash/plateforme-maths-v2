import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { genererCodeClasseUnique } from "../../codeClasse";

interface CorpsRegenererCode {
  classe_id: string;
}

function estCorpsValide(corps: unknown): corps is CorpsRegenererCode {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.classe_id === "string" && c.classe_id.trim() !== "";
}

/**
 * POST /api/classes/regenerer-code — prompt "Gestion de classe et formulaire de tâche
 * généralisé", Étape 2 : `{classe_id}`, vérifie que la classe appartient bien au prof authentifié
 * avant d'agir (même convention que `api/assignations.ts` pour `tache.prof_id !== prof.id` : 404
 * "introuvable" plutôt que 403, pour ne pas confirmer l'existence d'une classe d'un autre prof).
 * "Aucune conséquence sur les élèves déjà inscrits (le code ne sert qu'à l'inscription/la
 * connexion, jamais après)" — vérifié : `code` n'est lu nulle part ailleurs que
 * `connexion-eleve.ts`/`inscription-eleve.ts`, jamais par un élève déjà authentifié (dont la
 * session dépend de `eleves.id`/`inscriptions.classe_id`, jamais de `classes.code`).
 */
export const gererClassesRegenererCode = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
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
    res.status(400).json({ erreur: "Corps invalide : { classe_id: string }" });
    return;
  }

  const admin = supabaseAdmin();

  const { data: classe, error: erreurClasse } = await admin.from("classes").select("id, prof_id, est_test").eq("id", req.body.classe_id).maybeSingle();
  if (erreurClasse || !classe || classe.prof_id !== prof.id) {
    res.status(404).json({ erreur: "Classe introuvable" });
    return;
  }
  if (classe.est_test === true) {
    res.status(400).json({ erreur: "Une classe de test n'a pas de code d'inscription (RAPPORT §61)." });
    return;
  }

  const code = await genererCodeClasseUnique(admin);
  const { data: classeMaj, error: erreurMaj } = await admin.from("classes").update({ code }).eq("id", classe.id).select("id, nom, code").single();
  if (erreurMaj || !classeMaj) {
    res.status(500).json({ erreur: "Échec de régénération du code", detail: erreurMaj?.message });
    return;
  }

  res.status(200).json(classeMaj);
});
