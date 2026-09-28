import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { classesDuProfPourEleve } from "../../eleveDuProf";

interface CorpsReset {
  eleve_id: string;
  nouveauMotDePasse: string;
}

const MOT_DE_PASSE_MIN = 6;

function estCorpsValide(corps: unknown): corps is CorpsReset {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.eleve_id === "string" && c.eleve_id.trim() !== "" && typeof c.nouveauMotDePasse === "string" && c.nouveauMotDePasse.length >= MOT_DE_PASSE_MIN;
}

/**
 * POST /api/profs/reset-mdp-eleve — réinitialisation de mot de passe d'un élève par le prof
 * (prompt "Authentification élève", Étape 3) : "Vérifie que l'élève appartient bien à une classe
 * du prof authentifié avant d'agir" — jointure `inscriptions` -> `classes.prof_id`, l'élève peut
 * être inscrit à plusieurs classes, une seule suffit à autoriser l'action si elle appartient au
 * prof authentifié.
 *
 * **Correctif (prompt "Inscription professeur", Étape 1 — test d'isolation dédié)** : cet endpoint
 * dupliquait auparavant en ligne la logique de `classesDuProfPourEleve` (extraite de ce fichier même
 * pour "Gestion de classe étendue", voir `lib/eleveDuProf.ts` : "non refactoré ici pour rester
 * minimal sur un endpoint déjà livré et testé") — MAIS avec un code HTTP différent pour le cas
 * "élève appartenant à un AUTRE prof" : 403 "Cet élève n'appartient à aucune de vos classes"
 * (confirmant son existence) plutôt que le 404 générique "Élève introuvable" utilisé par
 * `desactiver-eleve.ts`/`transferer-eleve.ts` pour exactement le même scénario. Trouvé par
 * exécution réelle du test d'isolation dédié (`scripts/test-isolation-profs.ts`), pas supposé :
 * l'action elle-même restait bien bloquée (aucune fuite de mot de passe), mais la réponse
 * distinguait "existe ailleurs" de "n'existe pas du tout", contrairement au principe déjà établi et
 * documenté ailleurs dans ce dépôt ("ne jamais confirmer l'existence d'une ressource d'un autre
 * prof"). Réutilise désormais `classesDuProfPourEleve` comme les 2 autres endpoints, 404 uniforme.
 */
export const gererProfsResetMdpEleve = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
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
    res.status(400).json({ erreur: "Corps invalide : { eleve_id, nouveauMotDePasse } — mot de passe : 6 caractères minimum" });
    return;
  }

  const admin = supabaseAdmin();
  const { eleve_id: eleveId } = req.body;

  const classeIds = await classesDuProfPourEleve(admin, eleveId, prof.id);
  if (classeIds.length === 0) {
    res.status(404).json({ erreur: "Élève introuvable" });
    return;
  }

  const { error: erreurMaj } = await admin.auth.admin.updateUserById(eleveId, { password: req.body.nouveauMotDePasse });
  if (erreurMaj) {
    res.status(500).json({ erreur: "Échec de réinitialisation : " + erreurMaj.message });
    return;
  }

  res.status(200).json({ ok: true });
});
