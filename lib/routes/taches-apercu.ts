import { randomBytes } from "node:crypto";
import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { chercherGenerateur } from "../registreGenerateurs";
import { estCorpsValide, validerComposition } from "../validationCorpsTaches";
import { genererEmailSynthetique } from "../emailSynthetique";
import { recupererToutesLesLignes } from "../supabasePagination";
import { tirerGraine } from "../prng";

/**
 * POST /api/taches/apercu — « Aperçu » du formulaire de composition (RAPPORT §36). Génère une tâche ÉPHÉMÈRE (`taches.est_apercu`) avec
 * exactement la composition et les réglages du formulaire (mêmes `estCorpsValide` / `validerComposition` que `POST /api/taches`),
 * l'assigne au seul ÉLÈVE FANTÔME du professeur (`profs.eleve_apercu_id` : un vrai compte Auth + une vraie ligne `eleves`, jamais
 * inscrit à une classe) et renvoie une session fraîche pour ce compte. `prof.html` ouvre alors `eleve.html?apercu=1` : le professeur
 * voit sa tâche EXACTEMENT comme un élève, par le même moteur (aucun endpoint élève ne sait qu'il sert un aperçu).
 *
 * Mécanisme de l'ancien pilote (`lib/routes/taches-apercu.ts` @ 6acc102, lecture seule), avec ces écarts délibérés :
 *  - les exercices viennent du REGISTRE (`chercherGenerateur`, `tirerGraine`), jamais d'une chaîne de tests sur la variante ; une
 *    composition qui contient une variante sans générateur exécutable est refusée en 409 (`variantes_indisponibles`), AVANT toute écriture,
 *    comme `POST /api/assignations` ;
 *  - le tableau de bord élève de ce dépôt ne montre une tâche que si elle a une fenêtre d'assignation : une ligne
 *    `taches_assignations_eleves` est donc créée pour le fantôme (l'ancien pilote n'en avait pas besoin) ;
 *  - la suppression de l'aperçu précédent couvre aussi `aides_utilisees` et `taches_assignations_eleves` (absentes de l'ancien pilote :
 *    l'oubli aurait fait échouer le 2e aperçu dès qu'une aide avait été demandée) et se fait par lots (limite d'URL de `.in()`) ;
 *  - l'élève fantôme est créé avec compensation (compte Auth supprimé si une écriture suivante échoue), et son mot de passe vient de
 *    `crypto.randomBytes`, pas de `Math.random` ;
 *  - après `signInWithPassword`, AUCUN accès aux données avec ce même client (RAPPORT §23-D).
 *
 * Les réponses du professeur pendant l'aperçu sont bien écrites dans `reponses` (POST /api/reponses ne distingue pas un aperçu) mais
 * ne sont jamais analysées : le fantôme n'est dans aucune classe (invisible des listes et résultats par classe / élève) et la tâche est
 * exclue des vues professeur par `est_apercu` (`lib/routes/taches.ts`, `lib/tacheDuProf.ts`, `lib/routes/profs/tableau-de-bord.ts`).
 * Limite connue : deux aperçus SIMULTANÉS d'un professeur qui n'a pas encore de fantôme pourraient en créer deux (le dernier lié gagne) ;
 * hors de portée d'un usage manuel, un seul clic à la fois.
 */

const TAILLE_LOT_SUPPRESSION = 100;

type Admin = ReturnType<typeof supabaseAdmin>;

async function obtenirOuCreerEleveApercu(admin: Admin, profId: string): Promise<{ id: string } | { erreur: string }> {
  const { data: ligneProf, error: erreurProf } = await admin.from("profs").select("eleve_apercu_id").eq("id", profId).single();
  if (erreurProf || !ligneProf) return { erreur: "Échec de lecture du professeur : " + (erreurProf?.message ?? "introuvable") };
  if (ligneProf.eleve_apercu_id) return { id: ligneProf.eleve_apercu_id as string };

  const { data: utilisateur, error: erreurCreation } = await admin.auth.admin.createUser({
    email: genererEmailSynthetique("Aperçu", "Professeur"),
    password: randomBytes(18).toString("base64url") + "Aa1!",
    email_confirm: true,
  });
  if (erreurCreation || !utilisateur.user) return { erreur: "Échec de création de l'élève fantôme : " + (erreurCreation?.message ?? "inconnu") };
  const id = utilisateur.user.id as string;

  const defaire = async (supprimerLigneEleve: boolean): Promise<void> => {
    if (supprimerLigneEleve) await admin.from("eleves").delete().eq("id", id);
    await admin.auth.admin.deleteUser(id);
  };
  const { error: erreurEleve } = await admin.from("eleves").insert({ id, nom: "Aperçu", prenom: "Professeur" });
  if (erreurEleve) {
    await defaire(false);
    return { erreur: "Échec de création de la ligne élève fantôme : " + erreurEleve.message };
  }
  const { error: erreurLiaison } = await admin.from("profs").update({ eleve_apercu_id: id }).eq("id", profId);
  if (erreurLiaison) {
    await defaire(true);
    return { erreur: "Échec de liaison de l'élève fantôme au professeur : " + erreurLiaison.message };
  }
  return { id };
}

/** Supprime l'aperçu précédent du professeur (au plus UN vivant à la fois). Renvoie un message d'erreur, ou `null`. */
async function supprimerAncienApercu(admin: Admin, profId: string): Promise<string | null> {
  const { data: anciennes, error } = await admin.from("taches").select("id").eq("prof_id", profId).eq("est_apercu", true);
  if (error) return "Échec de lecture des anciens aperçus : " + error.message;
  const tacheIds = (anciennes ?? []).map((t) => t.id as string);
  if (tacheIds.length === 0) return null;

  const exercices = await recupererToutesLesLignes<{ id: string }>(() => admin.from("exercices_assignes").select("id").in("tache_id", tacheIds));
  const exerciceIds = exercices.map((e) => e.id);
  // Ordre imposé par les clés étrangères : tout ce qui référence `exercices_assignes`, puis `exercices_assignes`, puis ce qui référence `taches`.
  for (const table of ["reponses", "debuts_ecran", "aides_utilisees"] as const) {
    for (let i = 0; i < exerciceIds.length; i += TAILLE_LOT_SUPPRESSION) {
      const { error: erreurTable } = await admin.from(table).delete().in("exercice_assigne_id", exerciceIds.slice(i, i + TAILLE_LOT_SUPPRESSION));
      if (erreurTable) return `Échec de suppression de ${table} de l'ancien aperçu : ` + erreurTable.message;
    }
  }
  for (const table of ["exercices_assignes", "taches_assignations_eleves", "taches_composition"] as const) {
    const { error: erreurTable } = await admin.from(table).delete().in("tache_id", tacheIds);
    if (erreurTable) return `Échec de suppression de ${table} de l'ancien aperçu : ` + erreurTable.message;
  }
  const { error: erreurTaches } = await admin.from("taches").delete().in("id", tacheIds);
  if (erreurTaches) return "Échec de suppression de l'ancienne tâche d'aperçu : " + erreurTaches.message;
  return null;
}

async function creerApercu(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }
  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { nom: string, composition: [{ variante_id, nombre_exercices }] }" });
    return;
  }
  const resultatComposition = validerComposition(req.body.composition);
  if (!resultatComposition.ok) {
    res.status(400).json({ erreur: resultatComposition.erreur });
    return;
  }
  const composition = resultatComposition.composition;

  // Seul le REGISTRE sait exécuter : refus avant toute écriture (l'aperçu précédent reste alors en place).
  const sansGenerateur = composition.filter((l) => !chercherGenerateur(l.variante_id)).map((l) => l.variante_id as string);
  if (sansGenerateur.length > 0) {
    res.status(409).json({ erreur: "Aperçu impossible : générateur pas encore disponible pour : " + sansGenerateur.join(", "), variantes_indisponibles: sansGenerateur });
    return;
  }

  const admin = supabaseAdmin();
  const erreurSuppression = await supprimerAncienApercu(admin, prof.id);
  if (erreurSuppression) {
    res.status(500).json({ erreur: erreurSuppression });
    return;
  }
  const eleve = await obtenirOuCreerEleveApercu(admin, prof.id);
  if ("erreur" in eleve) {
    res.status(500).json({ erreur: eleve.erreur });
    return;
  }

  const { data: tache, error: erreurTache } = await admin
    .from("taches")
    .insert({
      prof_id: prof.id,
      nom: req.body.nom,
      feedback_immediat: req.body.feedback_immediat ?? true,
      reponse_visible: req.body.reponse_visible ?? false,
      tentatives_supplementaires: req.body.tentatives_supplementaires ?? 0,
      aide_activee: req.body.aide_activee ?? false,
      aide_penalite_pourcent: req.body.aide_penalite_pourcent ?? 0,
      afficher_recapitulatif: req.body.afficher_recapitulatif ?? false,
      chrono_mode: req.body.chrono_mode ?? "aucun",
      chrono_duree_secondes: req.body.chrono_duree_secondes ?? null,
      est_apercu: true,
    })
    .select("id")
    .single();
  if (erreurTache || !tache) {
    res.status(500).json({ erreur: "Échec de création de la tâche d'aperçu", detail: erreurTache?.message });
    return;
  }
  const tacheId = tache.id as string;

  const { error: erreurComposition } = await admin.from("taches_composition").insert(
    composition.map((ligne) => ({
      tache_id: tacheId,
      generateur_id: chercherGenerateur(ligne.variante_id)!.generateur_id,
      variante_id: ligne.variante_id,
      nombre_exercices: ligne.nombre_exercices,
      chrono_duree_secondes: ligne.chrono_duree_secondes ?? null,
    })),
  );
  if (erreurComposition) {
    res.status(500).json({ erreur: "Échec de création de la composition de l'aperçu", detail: erreurComposition.message });
    return;
  }

  const lignes: Record<string, unknown>[] = [];
  for (const ligne of composition) {
    const generateur = chercherGenerateur(ligne.variante_id)!;
    for (let i = 0; i < ligne.nombre_exercices; i++) {
      const graine = tirerGraine();
      lignes.push({
        tache_id: tacheId,
        eleve_id: eleve.id,
        generateur_id: generateur.generateur_id,
        variante_id: generateur.variante_id,
        graine,
        champs_attendus: generateur.ecrans(generateur.generer(graine)).map((e) => e.champ),
      });
    }
  }
  const { error: erreurExercices } = await admin.from("exercices_assignes").insert(lignes);
  if (erreurExercices) {
    res.status(500).json({ erreur: "Échec de génération des exercices de l'aperçu", detail: erreurExercices.message });
    return;
  }

  // Fenêtre d'assignation du fantôme : sans elle le tableau de bord élève ignore la tâche.
  const { error: erreurFenetre } = await admin.from("taches_assignations_eleves").insert({ tache_id: tacheId, eleve_id: eleve.id, date_debut: new Date().toISOString() });
  if (erreurFenetre) {
    res.status(500).json({ erreur: "Échec d'assignation de l'aperçu", detail: erreurFenetre.message });
    return;
  }

  // Session fraîche : mot de passe réinitialisé à CHAQUE aperçu (aucun état mémorisé), puis connexion. DERNIER usage de ce client :
  // après `signInWithPassword`, il n'a plus les droits `service_role` (RAPPORT §23-D).
  const motDePasse = randomBytes(18).toString("base64url") + "Aa1!";
  const { data: compte, error: erreurMotDePasse } = await admin.auth.admin.updateUserById(eleve.id, { password: motDePasse });
  if (erreurMotDePasse || !compte.user?.email) {
    res.status(500).json({ erreur: "Échec de préparation de la session de l'élève fantôme", detail: erreurMotDePasse?.message });
    return;
  }
  const { data: session, error: erreurConnexion } = await admin.auth.signInWithPassword({ email: compte.user.email, password: motDePasse });
  if (erreurConnexion || !session.session) {
    res.status(500).json({ erreur: "Échec de connexion de l'élève fantôme", detail: erreurConnexion?.message });
    return;
  }

  res.status(201).json({ tache_id: tacheId, access_token: session.session.access_token, refresh_token: session.session.refresh_token });
}

export const gererTachesApercu = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method === "POST") {
    await creerApercu(req, res);
    return;
  }
  res.status(405).json({ erreur: "Méthode non autorisée" });
});
