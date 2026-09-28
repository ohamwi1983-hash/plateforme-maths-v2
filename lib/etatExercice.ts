import type { supabaseAdmin } from "./supabaseAdmin";
import type { EcranDeclare, Generateur } from "./contratGenerateur";
import { chercherGenerateur } from "./registreGenerateurs";
import { estGraineValide } from "./prng";
import {
  calculerChronoExpire,
  calculerEtatChampTentatives,
  horodatageDebutPertinent,
  tentativesMaxEffectif,
  type ChronoMode,
  type EtatChampTentatives,
  type LigneDebutEcran,
} from "./moteurTentatives";
import { resoudreChronoDureeSecondes } from "./resoudreChronoDureeSecondes";
import type { StatutVerification } from "../src/moteur/statutVerification";
import type { ReglagesCorrection } from "./reglagesCorrection";
import type { DerniereReponse } from "./tableauDeBord";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/** Ligne `exercices_assignes` utile à l'exécution d'un générateur. */
export interface LigneExerciceAssigne {
  id: string;
  tache_id: string;
  eleve_id: string;
  generateur_id: string;
  variante_id: string;
  graine: number | null;
  champs_attendus: string[] | null;
}

export const COLONNES_EXERCICE_ASSIGNE = "id, tache_id, eleve_id, generateur_id, variante_id, graine, champs_attendus";

export interface ExerciceRegenere {
  ligne: LigneExerciceAssigne;
  generateur: Generateur<any>;
  exercice: unknown;
  ecrans: EcranDeclare[];
}

/**
 * Régénère l'exercice d'une ligne `exercices_assignes` via le REGISTRE (jamais une chaîne de tests
 * sur `variante_id`). `null` si la variante n'est pas au registre ou si la ligne n'a pas de graine
 * (ligne historique, non exécutable) — l'appelant décide du statut HTTP.
 */
export function regenererExercice(ligne: LigneExerciceAssigne): ExerciceRegenere | null {
  const generateur = chercherGenerateur(ligne.variante_id);
  // Postgres `bigint` remonte en nombre via PostgREST ; tolère aussi une chaîne numérique.
  const graine = ligne.graine === null || ligne.graine === undefined ? null : Number(ligne.graine);
  if (!generateur || graine === null || !estGraineValide(graine)) return null;
  const exercice = generateur.generer(graine);
  return { ligne, generateur, exercice, ecrans: generateur.ecrans(exercice) };
}

export interface ContexteTache {
  nom: string;
  reglages: ReglagesCorrection;
  tentativesMax: number;
  aideActivee: boolean;
  aidePenalitePourcent: number;
  chronoMode: ChronoMode;
  chronoDureeSecondes: number | null;
}

export async function chargerContexteTache(admin: AdminClient, tacheId: string, varianteId: string): Promise<ContexteTache | null> {
  const { data: tache, error } = await admin
    .from("taches")
    .select("nom, feedback_immediat, reponse_visible, tentatives_supplementaires, aide_activee, aide_penalite_pourcent, chrono_mode, chrono_duree_secondes")
    .eq("id", tacheId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!tache) return null;
  const chronoMode = tache.chrono_mode as ChronoMode;
  const chronoDureeSecondes = await resoudreChronoDureeSecondes(admin, tacheId, varianteId, chronoMode, tache.chrono_duree_secondes as number | null);
  return {
    nom: tache.nom as string,
    reglages: { feedback_immediat: tache.feedback_immediat as boolean, reponse_visible: tache.reponse_visible as boolean },
    tentativesMax: tentativesMaxEffectif(tache.feedback_immediat as boolean, tache.tentatives_supplementaires as number),
    aideActivee: tache.aide_activee as boolean,
    aidePenalitePourcent: tache.aide_penalite_pourcent as number,
    chronoMode,
    chronoDureeSecondes,
  };
}

export interface LigneReponse {
  exercice_assigne_id: string;
  champ: string;
  valeur_saisie: string;
  statut: StatutVerification;
  indice_utilise: boolean;
}

export interface DonneesExercice {
  /** Historique chronologique croissant, par champ. */
  reponsesParChamp: Map<string, LigneReponse[]>;
  debuts: LigneDebutEcran[];
  champsAvecAide: Set<string>;
}

/** Lecture bornée à UN exercice (jamais soumise au plafond de 1000 lignes). */
export async function chargerDonneesExercice(admin: AdminClient, exerciceId: string): Promise<DonneesExercice> {
  const { data: reponses, error: erreurReponses } = await admin
    .from("reponses")
    .select("exercice_assigne_id, champ, valeur_saisie, statut, indice_utilise")
    .eq("exercice_assigne_id", exerciceId)
    .order("horodatage", { ascending: true });
  if (erreurReponses) throw new Error(erreurReponses.message);
  const { data: debuts, error: erreurDebuts } = await admin.from("debuts_ecran").select("champ, horodatage_debut").eq("exercice_assigne_id", exerciceId);
  if (erreurDebuts) throw new Error(erreurDebuts.message);
  const { data: aides, error: erreurAides } = await admin.from("aides_utilisees").select("champ").eq("exercice_assigne_id", exerciceId);
  if (erreurAides) throw new Error(erreurAides.message);

  const reponsesParChamp = new Map<string, LigneReponse[]>();
  for (const r of (reponses ?? []) as LigneReponse[]) {
    if (!reponsesParChamp.has(r.champ)) reponsesParChamp.set(r.champ, []);
    reponsesParChamp.get(r.champ)!.push(r);
  }
  return {
    reponsesParChamp,
    debuts: (debuts ?? []) as LigneDebutEcran[],
    champsAvecAide: new Set((aides ?? []).map((a) => a.champ as string)),
  };
}

export interface EtatChamp {
  champ: string;
  etat: EtatChampTentatives;
  historique: LigneReponse[];
  derniere: DerniereReponse | null;
  aideUtilisee: boolean;
}

/**
 * État de tentatives d'un champ = MÊME dérivation que partout ailleurs (`calculerEtatChampTentatives`),
 * avec le chrono appliqué SEULEMENT à un champ pas encore terminé : `calculerEtatChampTentatives(…,
 * true)` court-circuite l'historique (score 0, révélé) — appliqué tel quel à un champ déjà réussi, il
 * transformerait une bonne réponse en révélation une fois le chrono écoulé.
 *
 * Point UNIQUE de cette dérivation : réutilisé par `calculerEtatChamp` (GET exercice, POST réponse,
 * tableau de bord) et par `GET /api/eleves/mes-resultats` (complétion d'une tâche) — jamais une
 * seconde version de la règle « un champ est terminé quand… ».
 */
export function etatTentativesAvecChrono(
  champ: string,
  statutsChronologiques: readonly StatutVerification[],
  aideUtilisee: boolean,
  debuts: readonly LigneDebutEcran[],
  contexte: Pick<ContexteTache, "tentativesMax" | "aidePenalitePourcent" | "chronoMode" | "chronoDureeSecondes">,
  maintenant: Date,
): EtatChampTentatives {
  const normal = calculerEtatChampTentatives(statutsChronologiques, contexte.tentativesMax, aideUtilisee, contexte.aidePenalitePourcent, false);
  if (normal.terminee) return normal;
  const debut = horodatageDebutPertinent(contexte.chronoMode, champ, debuts);
  const expire = calculerChronoExpire(contexte.chronoMode, contexte.chronoDureeSecondes, debut, maintenant);
  return expire ? calculerEtatChampTentatives(statutsChronologiques, contexte.tentativesMax, aideUtilisee, contexte.aidePenalitePourcent, true) : normal;
}

export function calculerEtatChamp(champ: string, donnees: DonneesExercice, contexte: ContexteTache, maintenant: Date): EtatChamp {
  const historique = donnees.reponsesParChamp.get(champ) ?? [];
  const aideUtilisee = donnees.champsAvecAide.has(champ) || historique.some((h) => h.indice_utilise);
  const etat = etatTentativesAvecChrono(champ, historique.map((h) => h.statut), aideUtilisee, donnees.debuts, contexte, maintenant);
  const derniereLigne = historique.length > 0 ? historique[historique.length - 1] : null;
  return {
    champ,
    etat,
    historique,
    derniere: derniereLigne ? { valeur_saisie: derniereLigne.valeur_saisie, statut: derniereLigne.statut } : null,
    aideUtilisee,
  };
}

export interface EtatExerciceComplet {
  champs: (EtatChamp & { verrouille: boolean })[];
  /** Champs terminés/verrouillés, dernière soumission — seule entrée passée à `Generateur.etatActuel`. */
  reponsesConfirmees: ReponseConfirmeeInterne[];
  champCourant: string | null;
  termine: boolean;
}

type ReponseConfirmeeInterne = { champ: string; reponseBrute: string; statut: StatutVerification };

/**
 * État complet d'un exercice, dérivé UNIQUEMENT de la graine (via le générateur), des réponses déjà
 * enregistrées et des réglages de tâche — jamais d'une saisie en cours (règle « état local d'édition
 * ≠ réponse », lib/contratGenerateur.ts).
 *
 * `verrouille` : champ sur lequel le client ne doit plus proposer de saisie = champ terminé par le
 * moteur de tentatives (réussi ou révélé). Sans correction immédiate, `tentativesMax` vaut 1
 * (`tentativesMaxEffectif`, lib/moteurTentatives.ts) : la première réponse termine donc le champ, sans
 * cas particulier ici — client, tableau de bord et résultats voient la même chose.
 */
export function calculerEtatExercice(regenere: ExerciceRegenere, donnees: DonneesExercice, contexte: ContexteTache, maintenant: Date): EtatExerciceComplet {
  const champs = regenere.ecrans.map((ecran) => {
    const etat = calculerEtatChamp(ecran.champ, donnees, contexte, maintenant);
    return { ...etat, verrouille: etat.etat.terminee };
  });
  const reponsesConfirmees: ReponseConfirmeeInterne[] = champs
    .filter((c) => c.verrouille)
    .map((c) => ({ champ: c.champ, reponseBrute: c.derniere?.valeur_saisie ?? "", statut: c.derniere?.statut ?? "not_equivalent" }));
  const { champCourant } = regenere.generateur.etatActuel(regenere.exercice, reponsesConfirmees);
  return { champs, reponsesConfirmees, champCourant, termine: champs.every((c) => c.verrouille) };
}

/**
 * Révélation de FIN DE TÂCHE sous correction immédiate coupée : sans correction immédiate, ni le
 * verdict ni la solution d'un champ ne sont montrés avant que la tâche ENTIÈRE soit terminée (tous ses
 * exercices, pour cet élève) — jamais à l'épuisement d'un seul champ. Une fois la tâche terminée, tout
 * est révélé d'un coup. Sous correction immédiate active, la règle ne s'applique pas (`false`).
 */
export function revelationFinDeTache(contexte: Pick<ContexteTache, "reglages">, tacheComplete: boolean): boolean {
  return tacheComplete && !contexte.reglages.feedback_immediat;
}

/**
 * Une tâche est complète pour un élève quand chacun de ses exercices exécutables est terminé
 * (`calculerEtatExercice(...).termine`) — même critère que `GET /api/eleves/tableau-de-bord`
 * (`tacheEstComplete`). Une tâche sans aucun exercice exécutable n'est jamais complète.
 */
export async function tacheEstCompletePourEleve(admin: AdminClient, tacheId: string, eleveId: string, maintenant: Date): Promise<boolean> {
  const { data, error } = await admin.from("exercices_assignes").select(COLONNES_EXERCICE_ASSIGNE).eq("tache_id", tacheId).eq("eleve_id", eleveId);
  if (error) throw new Error(error.message);
  let nbExecutables = 0;
  const contextes = new Map<string, ContexteTache | null>();
  for (const ligne of (data ?? []) as unknown as LigneExerciceAssigne[]) {
    const regenere = regenererExercice(ligne);
    if (!regenere) continue;
    if (!contextes.has(ligne.variante_id)) contextes.set(ligne.variante_id, await chargerContexteTache(admin, tacheId, ligne.variante_id));
    const contexte = contextes.get(ligne.variante_id);
    if (!contexte) continue;
    nbExecutables++;
    const donnees = await chargerDonneesExercice(admin, ligne.id);
    if (!calculerEtatExercice(regenere, donnees, contexte, maintenant).termine) return false;
  }
  return nbExecutables > 0;
}
