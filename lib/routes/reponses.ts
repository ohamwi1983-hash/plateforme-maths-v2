import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { verifierAvecControle } from "../registreGenerateurs";
import { calculerEtatExercice, chargerContexteTache, chargerDonneesExercice, COLONNES_EXERCICE_ASSIGNE, regenererExercice, type LigneExerciceAssigne } from "../etatExercice";
import { calculerDureeEcouleeSecondes, horodatageDebutPertinent } from "../moteurTentatives";
import { construireChampVue } from "../tableauDeBord";
import { joindreBugsDetectes } from "../profilCompetences";
import { categorieTachePourEleve } from "../verrouillageTache";

/**
 * POST /api/reponses — enregistre et vérifie UNE réponse confirmée (dispatcher générique, phase 2).
 * Aucune branche par générateur : l'exercice est régénéré depuis `exercices_assignes.graine` via le
 * registre (lib/registreGenerateurs.ts), `verifierAvecControle` fait la vérification, tout le reste
 * (tentatives, aide, chrono, feedback) réutilise les modules déjà livrés en phase 1.
 *
 * Règle « état local d'édition ≠ réponse » (lib/contratGenerateur.ts) : le corps est EXACTEMENT
 * `{ exercice_assigne_id, champ, reponse_brute }` — toute autre clé est rejetée (400), un brouillon
 * ou un état d'édition ne peut pas être transmis par ce canal.
 */

const CLES_AUTORISEES = new Set(["exercice_assigne_id", "champ", "reponse_brute"]);
export const TAILLE_MAX_REPONSE_BRUTE = 4000;

interface CorpsReponse {
  exercice_assigne_id: string;
  champ: string;
  reponse_brute: string;
}

function analyserCorps(corps: unknown): { ok: true; corps: CorpsReponse } | { ok: false; erreur: string } {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return { ok: false, erreur: "Corps invalide : { exercice_assigne_id, champ, reponse_brute }" };
  const c = corps as Record<string, unknown>;
  const clesInconnues = Object.keys(c).filter((k) => !CLES_AUTORISEES.has(k));
  if (clesInconnues.length > 0) return { ok: false, erreur: `Champ(s) non autorisé(s) : ${clesInconnues.join(", ")} — seule une réponse confirmée peut être envoyée` };
  if (typeof c.exercice_assigne_id !== "string" || typeof c.champ !== "string" || typeof c.reponse_brute !== "string") {
    return { ok: false, erreur: "Corps invalide : { exercice_assigne_id, champ, reponse_brute } (chaînes)" };
  }
  if (c.reponse_brute.trim() === "") return { ok: false, erreur: "Réponse vide" };
  if (c.reponse_brute.length > TAILLE_MAX_REPONSE_BRUTE) return { ok: false, erreur: "Réponse trop longue" };
  return { ok: true, corps: { exercice_assigne_id: c.exercice_assigne_id, champ: c.champ, reponse_brute: c.reponse_brute } };
}

export const gererReponses = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const eleve = await eleveAuthentifie(req.headers.authorization as string | undefined);
  if (!eleve) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }
  const analyse = analyserCorps(req.body);
  if (!analyse.ok) {
    res.status(400).json({ erreur: analyse.erreur });
    return;
  }
  const { exercice_assigne_id, champ, reponse_brute } = analyse.corps;

  const admin = supabaseAdmin();
  const { data: ligne, error: erreurLigne } = await admin.from("exercices_assignes").select(COLONNES_EXERCICE_ASSIGNE).eq("id", exercice_assigne_id).maybeSingle();
  if (erreurLigne) throw new Error(erreurLigne.message);
  if (!ligne || ligne.eleve_id !== eleve.id) {
    res.status(404).json({ erreur: "Exercice assigné introuvable" });
    return;
  }
  const regenere = regenererExercice(ligne as unknown as LigneExerciceAssigne);
  if (!regenere) {
    res.status(409).json({ erreur: "Exercice non exécutable (générateur inconnu du registre ou graine absente)" });
    return;
  }
  if (!regenere.ecrans.some((e) => e.champ === champ)) {
    res.status(400).json({ erreur: `Champ inconnu pour cet exercice : ${champ}` });
    return;
  }

  const categorie = await categorieTachePourEleve(admin, ligne.tache_id as string, eleve.id);
  if (categorie === "pas_commencee") {
    res.status(403).json({ erreur: "Cette tâche n'a pas encore commencé" });
    return;
  }
  if (categorie === "anterieures") {
    res.status(403).json({ erreur: "L'échéance de cette tâche est dépassée" });
    return;
  }

  const contexte = await chargerContexteTache(admin, ligne.tache_id as string, ligne.variante_id as string);
  if (!contexte) {
    res.status(404).json({ erreur: "Tâche associée introuvable" });
    return;
  }
  const donnees = await chargerDonneesExercice(admin, exercice_assigne_id);
  const maintenant = new Date();

  const avant = calculerEtatExercice(regenere, donnees, contexte, maintenant);
  const champAvant = avant.champs.find((c) => c.champ === champ)!;
  if (champAvant.verrouille) {
    res.status(409).json({ erreur: "Ce champ est déjà terminé" });
    return;
  }
  // Un champ n'est soumis que dans l'ordre déclaré par le générateur (`etatActuel`).
  if (avant.champCourant !== champ) {
    res.status(409).json({ erreur: "Ce champ n'est pas l'écran courant de l'exercice", champ_courant: avant.champCourant });
    return;
  }

  const resultat = verifierAvecControle(regenere.generateur, regenere.exercice, champ, reponse_brute);
  const debutChamp = horodatageDebutPertinent("par_ecran", champ, donnees.debuts);
  const aideUtilisee = donnees.champsAvecAide.has(champ);
  const { error: erreurInsertion } = await admin.from("reponses").insert({
    exercice_assigne_id,
    champ,
    valeur_saisie: reponse_brute,
    statut: resultat.statut,
    bug_detecte: joindreBugsDetectes(resultat.codesCompetence),
    indice_utilise: aideUtilisee,
    duree_ecoulee_secondes: calculerDureeEcouleeSecondes(debutChamp, maintenant),
  });
  if (erreurInsertion) throw new Error(erreurInsertion.message);

  const historiqueApres = [...(donnees.reponsesParChamp.get(champ) ?? []), { exercice_assigne_id, champ, valeur_saisie: reponse_brute, statut: resultat.statut, indice_utilise: aideUtilisee }];
  donnees.reponsesParChamp.set(champ, historiqueApres);
  const apres = calculerEtatExercice(regenere, donnees, contexte, maintenant);
  const champApres = apres.champs.find((c) => c.champ === champ)!;

  // Même gating que le tableau de bord (`construireChampVue` -> `construireReponseHttpReponses`) :
  // `feedback_immediat`/`reponse_visible`, révélation forcée à l'épuisement des tentatives.
  const vue = construireChampVue(champ, { valeur_saisie: reponse_brute, statut: resultat.statut }, regenere.generateur.solutionAttendue(regenere.exercice, champ), contexte.reglages, false, champApres.etat);
  res.status(200).json({
    ...(vue.statut !== null ? { statut: vue.statut } : {}),
    ...(vue.solution_attendue !== null ? { solution_attendue: vue.solution_attendue } : {}),
    ...(resultat.statut === "parse_error" && contexte.reglages.feedback_immediat ? { message_erreur: resultat.messageErreur } : {}),
    enregistree: true,
    verrouille: champApres.verrouille,
    revele: champApres.etat.revelee,
    tentatives_restantes: champApres.verrouille ? 0 : Math.max(0, contexte.tentativesMax - champApres.etat.tentativesUtilisees),
    champ_courant: apres.champCourant,
    exercice_termine: apres.termine,
  });
});
