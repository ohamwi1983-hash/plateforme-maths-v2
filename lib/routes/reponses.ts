import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { verifierAvecControle } from "../registreGenerateurs";
import { partiesFaussesDe } from "../partiesFausses";
import { solutionStructureeSiMontree } from "../solutionStructuree";
import { calculerEtatExercice, chargerContexteTache, chargerDonneesExercice, COLONNES_EXERCICE_ASSIGNE, projeterExercice, regenererExercice, revelationFinDeTache, tacheEstCompletePourEleve, type LigneExerciceAssigne } from "../etatExercice";
import { calculerDureeEcouleeSecondes, horodatageDebutPertinent } from "../moteurTentatives";
import { construireChampVue, REGLAGES_FORCEES_ANTERIEURES } from "../tableauDeBord";
import { joindreBugsDetectes } from "../profilCompetences";
import { categorieTachePourEleve } from "../verrouillageTache";
import { dependancesTerminees } from "../cascadeEcrans";
import { amontsTransitifs } from "../reponsesValides";

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
  if (avant.retourArriere) {
    // Retour en arrière (RAPPORT §37) : un exercice rendu ou dont le chrono global est écoulé ne se modifie plus ; sinon on peut
    // soumettre l'écran courant OU modifier un écran déjà répondu (`modifiable`), jamais un écran pas encore atteint.
    if (avant.exerciceVerrouille) {
      res.status(409).json({ erreur: "Cet exercice est rendu ou son temps est écoulé : il n'est plus modifiable" });
      return;
    }
    if (!champAvant.modifiable && avant.champCourant !== champ) {
      res.status(409).json({ erreur: "Ce champ n'est pas l'écran courant de l'exercice", champ_courant: avant.champCourant });
      return;
    }
  } else {
    if (champAvant.verrouille) {
      res.status(409).json({ erreur: "Ce champ est déjà terminé" });
      return;
    }
    // Un champ n'est soumis que dans l'ordre déclaré par le générateur (`etatActuel`).
    if (avant.champCourant !== champ) {
      res.status(409).json({ erreur: "Ce champ n'est pas l'écran courant de l'exercice", champ_courant: avant.champCourant });
      return;
    }
  }

  // Cascade (RAPPORT §18) : la vérification se fait sur l'exercice PROJETÉ (données issues des réponses
  // confirmées), jamais sur la chaîne officiellement correcte. Un écran dépendant n'existe pas avant que ses
  // prédécesseurs soient terminés.
  const champsTerminesAvant = new Set(avant.reponsesConfirmees.map((r) => r.champ));
  if (!dependancesTerminees(regenere.ecrans.find((e) => e.champ === champ)!, champsTerminesAvant)) {
    res.status(409).json({ erreur: "Cet écran dépend d'écrans précédents pas encore terminés", champ_courant: avant.champCourant });
    return;
  }
  // Retour en arrière : on vérifie sur les seules réponses de l'AMONT de l'écran (jamais sur celle d'un écran aval, ni sur l'ancienne
  // réponse de l'écran lui-même) ; sans retour, tous les écrans terminés sont déjà en amont de l'écran courant : filtre sans effet.
  const amontDuChamp = amontsTransitifs(regenere.ecrans).get(champ) ?? new Set<string>();
  const projete = projeterExercice(regenere, avant.retourArriere ? avant.reponsesConfirmees.filter((r) => amontDuChamp.has(r.champ)) : avant.reponsesConfirmees, contexte);
  const resultat = verifierAvecControle(regenere.generateur, projete.exercice, champ, reponse_brute);
  const debutChamp = horodatageDebutPertinent("par_ecran", champ, donnees.debuts);
  const aideUtilisee = donnees.champsAvecAide.has(champ);

  // Retour en arrière, D7 : re-soumettre EXACTEMENT la même réponse (aux espaces de bord près) ne touche à rien — aucune ligne
  // écrite, donc aucun écran aval invalidé (l'ordre d'insertion est ce qui invalide, `lib/reponsesValides.ts`).
  const identique = avant.retourArriere && champAvant.modifiable && champAvant.derniere !== null && champAvant.derniere.valeur_saisie.trim() === reponse_brute.trim();
  let apres = avant;
  if (!identique) {
    const fractionCorrecte = resultat.statut === "not_equivalent" ? (resultat.fractionCorrecte ?? null) : null; // Score partiel (RAPPORT §16) : stockée pour le calcul serveur du score, JAMAIS renvoyée plus bas.
    const { error: erreurInsertion } = await admin.from("reponses").insert({
      exercice_assigne_id,
      champ,
      valeur_saisie: reponse_brute,
      statut: resultat.statut,
      bug_detecte: joindreBugsDetectes(resultat.codesCompetence),
      indice_utilise: aideUtilisee,
      duree_ecoulee_secondes: calculerDureeEcouleeSecondes(debutChamp, maintenant),
      fraction_correcte: fractionCorrecte,
    });
    if (erreurInsertion) throw new Error(erreurInsertion.message);

    const ligneInseree = { exercice_assigne_id, champ, valeur_saisie: reponse_brute, statut: resultat.statut, indice_utilise: aideUtilisee, fraction_correcte: fractionCorrecte };
    donnees.reponsesParChamp.set(champ, [...(donnees.reponsesParChamp.get(champ) ?? []), ligneInseree]);
    donnees.lignesChronologiques.push(ligneInseree);
    apres = calculerEtatExercice(regenere, donnees, contexte, maintenant);
  }
  const champApres = apres.champs.find((c) => c.champ === champ)!;
  // Écrans aval qui avaient une réponse valide et n'en ont plus : la conséquence de la modification (à re-répondre), déterminée par
  // les seuls choix de l'élève — pas un verdict — donc sans risque de révélation.
  const champsInvalides = avant.champs.filter((c) => c.champ !== champ && c.verrouille && !apres.champs.find((a) => a.champ === c.champ)!.verrouille).map((c) => c.champ);

  // Même gating que le tableau de bord (`construireChampVue` -> `construireReponseHttpReponses`) :
  // `feedback_immediat`/`reponse_visible`, révélation forcée à l'épuisement des tentatives (sous
  // correction immédiate active seulement). Sous correction immédiate COUPÉE, rien n'est révélé — ni
  // verdict, ni solution, ni `revele` — avant que la tâche ENTIÈRE soit terminée : un échec n'est pas
  // plus visible qu'une réussite. La réponse qui termine la tâche révèle alors son champ (le reste se
  // consulte via GET /api/exercices/:id, qui révèle tout à ce moment-là).
  const tacheTerminee = apres.termine && (await tacheEstCompletePourEleve(admin, ligne.tache_id as string, eleve.id, maintenant));
  const reveleTout = revelationFinDeTache(contexte, tacheTerminee);
  const reponseRetenue = identique ? { valeur_saisie: champAvant.derniere!.valeur_saisie, statut: champAvant.derniere!.statut } : { valeur_saisie: reponse_brute, statut: resultat.statut };
  const vue = construireChampVue(champ, reponseRetenue, regenere.generateur.solutionAttendue(projete.exercice, champ), reveleTout ? REGLAGES_FORCEES_ANTERIEURES : contexte.reglages, reveleTout, champApres.etat);
  const solutionStructuree = solutionStructureeSiMontree(regenere.generateur, projete.exercice, champ, vue.solution_attendue);
  // `verrouille` pour le client = « ne peut plus être modifié » : un champ répondu mais modifiable (retour en arrière) n'est pas verrouillé.
  const verrouilleClient = champApres.verrouille && !champApres.modifiable;
  res.status(200).json({
    ...(vue.statut !== null ? { statut: vue.statut } : {}),
    ...(vue.solution_attendue !== null ? { solution_attendue: vue.solution_attendue } : {}),
    ...(solutionStructuree !== null ? { solution_structuree: solutionStructuree } : {}),
    ...(resultat.statut === "parse_error" && contexte.reglages.feedback_immediat ? { message_erreur: resultat.messageErreur } : {}),
    // Parties à surligner en rouge (RAPPORT §52) : sous correction immédiate seulement (porte unique : `lib/partiesFausses.ts`).
    ...(() => {
      const parties = identique ? null : partiesFaussesDe(resultat, contexte.reglages.feedback_immediat);
      return parties !== null ? { parties_fausses: parties } : {};
    })(),
    enregistree: true,
    verrouille: verrouilleClient,
    revele: vue.revele,
    tache_terminee: tacheTerminee,
    tentatives_restantes: verrouilleClient ? 0 : champApres.modifiable ? 1 : Math.max(0, contexte.tentativesMax - champApres.etat.tentativesUtilisees),
    champ_courant: apres.champCourant,
    exercice_termine: apres.termine,
    ...(avant.retourArriere ? { modifiable: champApres.modifiable, pret_a_rendre: apres.pretARendre, champs_invalides: champsInvalides, inchangee: identique } : {}),
  });
});
