import type { RequeteHttp, ReponseHttp } from "../../httpTypes";
import { avecGestionErreurs } from "../../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../../supabaseAdmin";
import { ecransServis } from "../../cascadeEcrans";
import { resoudreRangees } from "../../structureTableau";
import { calculerEtatExercice, chargerContexteTache, chargerDonneesExercice, COLONNES_EXERCICE_ASSIGNE, projeterExercice, regenererExercice, revelationFinDeTache, tacheEstCompletePourEleve, type LigneExerciceAssigne } from "../../etatExercice";
import { aidePresente } from "../../aideTypee";
import { construireChampVue, REGLAGES_FORCEES_ANTERIEURES } from "../../tableauDeBord";
import { categorieTachePourEleve } from "../../verrouillageTache";

/**
 * GET /api/exercices/:id — exercice assigné à l'élève authentifié, RÉGÉNÉRÉ depuis sa graine via le
 * registre (phase 2), sous la forme que consomme le moteur client (`public/moteur/`) :
 * `ecrans` (déclaratifs, SANS le texte d'aide — servi par `POST /api/reponses/aide`, qui en enregistre
 * l'usage — et jamais de solution), l'état de chaque champ (statut/solution soumis aux mêmes règles
 * de gating que le tableau de bord, `construireChampVue`), le champ courant, et les réglages de
 * tâche utiles à l'affichage (tentatives, aide, chrono).
 *
 * Authentification : `eleve_id` de l'exercice doit correspondre à l'élève authentifié.
 */
export const gererExercicesId = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp, params: Record<string, string>): Promise<void> {
  if (req.method !== "GET") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const eleve = await eleveAuthentifie(req.headers.authorization as string | undefined);
  if (!eleve) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }
  const id = params.id;
  if (typeof id !== "string") {
    res.status(400).json({ erreur: "Identifiant d'exercice manquant" });
    return;
  }

  const admin = supabaseAdmin();
  const { data: ligne, error } = await admin.from("exercices_assignes").select(COLONNES_EXERCICE_ASSIGNE).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ligne || ligne.eleve_id !== eleve.id) {
    res.status(404).json({ erreur: "Exercice introuvable" });
    return;
  }
  const regenere = regenererExercice(ligne as unknown as LigneExerciceAssigne);
  if (!regenere) {
    res.status(409).json({ erreur: "Exercice non exécutable (générateur inconnu du registre ou graine absente)" });
    return;
  }
  const categorie = await categorieTachePourEleve(admin, ligne.tache_id as string, eleve.id);
  if (categorie === "pas_commencee") {
    res.status(403).json({ erreur: "Cette tâche n'a pas encore commencé" });
    return;
  }
  const contexte = await chargerContexteTache(admin, ligne.tache_id as string, ligne.variante_id as string);
  if (!contexte) {
    res.status(404).json({ erreur: "Tâche associée introuvable" });
    return;
  }
  const donnees = await chargerDonneesExercice(admin, id);
  const etat = calculerEtatExercice(regenere, donnees, contexte, new Date());
  // Cascade (RAPPORT §18) : énoncés, solutions et aides bâtis sur les réponses CONFIRMÉES ; un écran dépendant
  // n'est envoyé qu'une fois ses prédécesseurs terminés (tâche antérieure : consultation, tout est servi).
  const projete = projeterExercice(regenere, etat.reponsesConfirmees, contexte);

  const anterieure = categorie === "anterieures";
  // Sous correction immédiate coupée : rien n'est révélé avant la fin de la TÂCHE entière, puis tout l'est.
  const finDeTache = !anterieure && revelationFinDeTache(contexte, etat.termine && (await tacheEstCompletePourEleve(admin, ligne.tache_id as string, eleve.id, new Date())));
  const reveleTout = anterieure || finDeTache;
  const reglages = reveleTout ? REGLAGES_FORCEES_ANTERIEURES : contexte.reglages;
  const champs = etat.champs.map((c) => {
    const vue = construireChampVue(c.champ, c.derniere, regenere.generateur.solutionAttendue(projete.exercice, c.champ), reglages, reveleTout, c.etat);
    return {
      champ: c.champ,
      valeur_saisie: vue.valeur_saisie,
      statut: vue.statut,
      solution_attendue: vue.solution_attendue,
      revele: vue.revele,
      verrouille: c.verrouille || anterieure,
      tentatives_restantes: c.verrouille || anterieure ? 0 : Math.max(0, contexte.tentativesMax - c.etat.tentativesUtilisees),
      aide_utilisee: c.aideUtilisee,
    };
  });

  res.status(200).json({
    id: ligne.id,
    generateur_id: ligne.generateur_id,
    variante_id: ligne.variante_id,
    tache: {
      nom: contexte.nom,
      tentatives_max: contexte.tentativesMax,
      aide_activee: contexte.aideActivee,
      aide_penalite_pourcent: contexte.aidePenalitePourcent,
      chrono_mode: contexte.chronoMode,
      chrono_duree_secondes: contexte.chronoDureeSecondes,
    },
    saisie_possible: !anterieure,
    ecrans: ecransServis(projete.ecrans, new Set(etat.reponsesConfirmees.map((r) => r.champ)), anterieure).map((ecran) => {
      const { aide, ...publics } = ecran;
      // Tableau de signes (RAPPORT §30) : le navigateur reçoit la structure DÉJÀ résolue (cases, fusions, alphabets) — il ne la recalcule pas.
      const servi = ecran.type === "tableau_signes" ? { ...publics, rangees: resoudreRangees(ecran) } : publics;
      return { ...servi, aide_disponible: contexte.aideActivee && aidePresente(aide) };
    }),
    champs,
    champ_courant: anterieure ? null : etat.champCourant,
    exercice_termine: etat.termine || anterieure,
  });
});
