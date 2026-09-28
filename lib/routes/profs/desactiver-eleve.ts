import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { classesDuProfPourEleve } from "../../eleveDuProf";

interface CorpsDesactiver {
  eleve_id: string;
}

function estCorpsValide(corps: unknown): corps is CorpsDesactiver {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.eleve_id === "string" && c.eleve_id.trim() !== "";
}

/**
 * POST /api/profs/desactiver-eleve — prompt "Gestion de classe étendue", Étape 2 : désactivation
 * d'un compte élève (jamais une suppression, "déjà tranché" — voir RAPPORT.md). `actif = false`
 * seulement : aucune ligne `exercices_assignes`/`reponses` touchée, aucune suppression
 * d'`inscriptions` — l'élève reste inscrit, seulement bloqué à la connexion
 * (`lib/routes/connexion-eleve.ts`) et masqué des listes actives (`lib/routes/eleves.ts`).
 */
export const gererProfsDesactiverEleve = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
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
    res.status(400).json({ erreur: "Corps invalide : { eleve_id }" });
    return;
  }

  const admin = supabaseAdmin();
  const classeIds = await classesDuProfPourEleve(admin, req.body.eleve_id, prof.id);
  if (classeIds.length === 0) {
    res.status(404).json({ erreur: "Élève introuvable" });
    return;
  }

  const { error } = await admin.from("eleves").update({ actif: false }).eq("id", req.body.eleve_id);
  if (error) {
    res.status(500).json({ erreur: "Échec de la désactivation", detail: error.message });
    return;
  }

  res.status(200).json({ ok: true });
});
