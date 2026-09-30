import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { supabaseAdmin } from "../supabaseAdmin";
import { provisionnerProf } from "../provisionnerProf";

interface CorpsInscriptionProf {
  codeInvitation: string;
  email: string;
  motDePasse: string;
  nom: string;
}

const MOT_DE_PASSE_MIN = 6;

function estCorpsValide(corps: unknown): corps is CorpsInscriptionProf {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return (
    typeof c.codeInvitation === "string" &&
    c.codeInvitation.trim() !== "" &&
    typeof c.email === "string" &&
    c.email.trim() !== "" &&
    typeof c.motDePasse === "string" &&
    c.motDePasse.length >= MOT_DE_PASSE_MIN &&
    typeof c.nom === "string" &&
    c.nom.trim() !== ""
  );
}

/**
 * POST /api/inscription-prof — inscription professeur par code d'invitation (prompt "Inscription
 * professeur (par invitation)", Étape 3). Rôle admin-prof (RAPPORT §26) : un admin génère désormais les
 * codes par `POST /api/admin/profs/inviter` (liés à un e-mail : `email_cible`, contrôlé ci-dessous) ; les codes
 * historiques insérés directement dans `invitations_prof` (Supabase Table Editor) restent valables, sans e-mail lié,
 * donc `codeInvitation` n'est PAS normalisé ici (ni trim ni casse forcée au-delà de
 * `.trim()` sur la comparaison) contrairement aux codes de classe (`eleves`, 6 caractères, casse
 * forcée) : rien n'impose ce format à un code d'invitation, laissé au choix de qui l'insère.
 *
 * **Préalable bloquant de ce prompt** : le test d'isolation dédié entre 2 comptes professeurs
 * (`scripts/test-isolation-profs.ts`, Étape 1) est passé — voir RAPPORT.md pour le détail complet,
 * y compris un bug réel trouvé et corrigé (`lib/routes/profs/reset-mdp-eleve.ts`, confirmait
 * l'existence d'un élève d'un autre prof via un 403 distinctif plutôt que le 404 générique attendu).
 * Cet endpoint peut donc être construit sur cette fondation.
 *
 * Usage unique (Étape 2, `utilise boolean not null default false`) : le code est marqué
 * `utilise = true` juste après la création du compte (ordre identique à `provisionnerEleve.ts` —
 * compte Auth/ligne métier d'abord, puis la marque d'utilisation), jamais avant — un échec de
 * création de compte laisse le code réutilisable plutôt que de le brûler pour rien. Fenêtre de
 * concurrence non traitée (2 requêtes simultanées sur le même code pourraient toutes deux passer la
 * vérification avant que l'une ne marque `utilise = true`) — limite documentée, pas corrigée : hors
 * du texte de ce prompt, et le volume d'inscriptions professeur de ce pilote (par invitation
 * manuelle, une à la fois) rend ce scénario improbable en pratique.
 */
export const gererInscriptionProf = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { codeInvitation, email, motDePasse, nom } — mot de passe : 6 caractères minimum" });
    return;
  }

  const admin = supabaseAdmin();
  const code = req.body.codeInvitation.trim();
  const email = req.body.email.trim();
  const nom = req.body.nom.trim();

  const { data: invitation, error: erreurInvitation } = await admin
    .from("invitations_prof")
    .select("code, utilise, email_cible")
    .eq("code", code)
    .maybeSingle();
  // Une panne de la base n'est PAS « code invalide » : elle remonte en 500 (journalisé par `avecGestionErreurs`), sinon un
  // professeur muni d'un code valide croirait son code faux pendant une panne (et rien n'apparaîtrait dans les journaux).
  if (erreurInvitation) throw new Error(`Lecture du code d'invitation impossible : ${erreurInvitation.message}`);
  if (!invitation) {
    res.status(404).json({ erreur: "Code d'invitation invalide" });
    return;
  }
  // Rôle admin-prof (RAPPORT §26) : code lié à un e-mail (généré par un admin). Discordance = MÊME 404 générique que
  // « code inexistant », et AVANT le test « déjà utilisé » : ni l'existence, ni l'état du code ne fuient à qui n'est pas
  // la personne visée. `email_cible` nul = code historique inséré en SQL, utilisable par n'importe qui.
  const emailCible = (invitation as { email_cible?: string | null }).email_cible;
  if (typeof emailCible === "string" && emailCible.trim() !== "" && emailCible.trim().toLowerCase() !== email.toLowerCase()) {
    res.status(404).json({ erreur: "Code d'invitation invalide" });
    return;
  }
  if (invitation.utilise) {
    res.status(400).json({ erreur: "Ce code d'invitation a déjà été utilisé" });
    return;
  }

  const resultat = await provisionnerProf(admin, { email, motDePasse: req.body.motDePasse, nom });
  if (!resultat.ok) {
    res.status(500).json({ erreur: resultat.etape === "auth" ? "Échec de création du compte" : "Échec de création du professeur", detail: resultat.message });
    return;
  }

  const { error: erreurMajInvitation } = await admin.from("invitations_prof").update({ utilise: true }).eq("code", code);
  if (erreurMajInvitation) {
    res.status(500).json({ erreur: "Compte créé mais code d'invitation non marqué comme utilisé", detail: erreurMajInvitation.message });
    return;
  }

  const { data: session, error: erreurConnexion } = await admin.auth.signInWithPassword({ email, password: req.body.motDePasse });
  if (erreurConnexion || !session.session) {
    res.status(500).json({ erreur: "Compte créé mais connexion automatique échouée : " + (erreurConnexion?.message ?? "inconnu") });
    return;
  }

  res.status(201).json({
    access_token: session.session.access_token,
    refresh_token: session.session.refresh_token,
    prof: { id: resultat.id, nom, email },
  });
});
