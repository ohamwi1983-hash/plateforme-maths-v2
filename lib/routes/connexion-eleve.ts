import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { supabaseAdmin } from "../supabaseAdmin";
import { filtrerHomonymes } from "../homonymes";
import { tousLesEleves } from "../tousLesEleves";

interface CorpsConnexion {
  nom: string;
  prenom: string;
  motDePasse: string;
}

const MESSAGE_GENERIQUE = "Identifiants incorrects";
const MESSAGE_DESACTIVE = "Ce compte a été désactivé — contacte ton professeur";

function estCorpsValide(corps: unknown): corps is CorpsConnexion {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return (
    typeof c.nom === "string" &&
    c.nom.trim() !== "" &&
    typeof c.prenom === "string" &&
    c.prenom.trim() !== "" &&
    typeof c.motDePasse === "string" &&
    c.motDePasse !== ""
  );
}

/**
 * POST /api/connexion-eleve — connexion élève par nom + prénom + mot de passe **sans code de
 * classe** (prompt "Connexion élève sans code + page d'accueil", Étape 2 : "le code de classe n'est
 * nécessaire qu'à l'inscription — plus jamais redemandé à la connexion"). Avant cette tâche, `code`
 * était requis et servait à scoper la recherche de candidats à une seule classe (voir historique
 * Git) — supprimé ici, ainsi que toute résolution `code -> classe_id`. "Introuvable → message
 * générique, ne jamais révéler si c'est le nom ou le mot de passe qui est en cause" (prompt
 * "Authentification élève", Étape 3, point 2 — inchangé par cette tâche).
 *
 * **Désambiguïsation d'homonymes, désormais GLOBALE** (prompt "Connexion élève sans code", Étape 1 :
 * "conséquence technique nécessaire, pas optionnelle" — sans code, nom+prénom seuls doivent désigner
 * un ensemble borné de comptes sur TOUTE la plateforme, pas seulement une classe) : candidats
 * recherchés via `tousLesEleves` (toute la table `eleves`), plus `elevesDeLaClasse` scopée à une
 * classe résolue par code. Le mécanisme de test tour à tour par mot de passe (`filtrerHomonymes` +
 * boucle `signInWithPassword`) est réutilisé tel quel (demande exacte de l'Étape 2), seul le
 * périmètre des candidats s'élargit.
 *
 * **Limite documentée, signalée mais pas corrigée ici** (prompt, Étape 2, demande exacte) : le
 * nombre de candidats testés par tentative de connexion croît désormais avec le nombre TOTAL
 * d'élèves de la plateforme, plus seulement d'une classe — sans impact aujourd'hui vu le volume,
 * mais à garder en tête si la plateforme grandit, en particulier combiné à l'absence de limitation
 * de débit déjà notée séparément (voir RAPPORT.md, sections antérieures).
 */
export const gererConnexionEleve = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { nom, prenom, motDePasse }" });
    return;
  }

  const admin = supabaseAdmin();
  const nom = req.body.nom.trim();
  const prenom = req.body.prenom.trim();

  const resultatExistants = await tousLesEleves(admin);
  if (!resultatExistants.ok) {
    res.status(401).json({ erreur: MESSAGE_GENERIQUE });
    return;
  }

  // Les comptes désactivés restent candidats ici (jamais filtrés en amont) — voir la vérification
  // `actif` ci-dessous, APRÈS un mot de passe reconnu valide : un candidat désactivé essayé avec un
  // mauvais mot de passe continue de tomber dans le message générique, exactement comme un
  // nom/prénom introuvable (jamais révéler "ce compte existe et est désactivé" à qui n'a pas déjà
  // le bon mot de passe).
  const candidats = filtrerHomonymes(resultatExistants.eleves, { nom, prenom });

  for (const candidat of candidats) {
    const { data: userData, error: erreurUser } = await admin.auth.admin.getUserById(candidat.id);
    if (erreurUser || !userData.user?.email) continue;

    const { data: session, error: erreurConnexion } = await admin.auth.signInWithPassword({
      email: userData.user.email,
      password: req.body.motDePasse,
    });
    if (!erreurConnexion && session.session) {
      // Prompt "Gestion de classe étendue", Étape 2 : "contrairement à un nom/prénom introuvable,
      // ce n'est pas un cas où il faut rester générique, un élève désactivé sait déjà qu'il
      // existe" — mais seulement une fois le mot de passe confirmé (voir commentaire ci-dessus).
      if (!candidat.actif) {
        res.status(403).json({ erreur: MESSAGE_DESACTIVE });
        return;
      }
      res.status(200).json({
        access_token: session.session.access_token,
        refresh_token: session.session.refresh_token,
        eleve: { id: candidat.id, nom: candidat.nom, prenom: candidat.prenom },
      });
      return;
    }
  }

  res.status(401).json({ erreur: MESSAGE_GENERIQUE });
});
