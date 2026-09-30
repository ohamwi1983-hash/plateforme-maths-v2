import type { supabaseAdmin } from "./supabaseAdmin";
import type { EcranDeclare, Generateur, ReponseConfirmee } from "./contratGenerateur";
import { validerDependances } from "./cascadeEcrans";
import { amontsTransitifs, dernieresReponsesValides } from "./reponsesValides";
import { chercherGenerateur } from "./registreGenerateurs";
import { estGraineValide } from "./prng";
import {
  calculerChronoExpire,
  calculerEtatChampTentatives,
  horodatageDebutPertinent,
  retourArriereEffectif,
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
  /** Retour en arrière (RAPPORT §37) : instant de remise de l'exercice ; nul/absent = pas rendu. */
  remis_le?: string | null;
}

export const COLONNES_EXERCICE_ASSIGNE = "id, tache_id, eleve_id, generateur_id, variante_id, graine, champs_attendus, remis_le";

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

/**
 * Écrans déclarés d'une ligne `exercices_assignes` (`variante_id` + `graine`), pour les lecteurs qui n'ont besoin que de leur
 * STRUCTURE (`dependDe`) sans exécuter l'exercice — même repli que `poidsDesChampsDeLigne` : ligne non exécutable -> `null`.
 */
export function ecransDeLigne(ligne: { variante_id: string; graine?: number | string | null }): EcranDeclare[] | null {
  const generateur = chercherGenerateur(ligne.variante_id);
  const graine = ligne.graine === null || ligne.graine === undefined ? null : Number(ligne.graine);
  if (!generateur || graine === null || !estGraineValide(graine)) return null;
  return generateur.ecrans(generateur.generer(graine));
}

/** Exercice tel que l'ÉLÈVE le voit (RAPPORT §18) : les données dérivées d'un écran précédent viennent de ses réponses confirmées. */
export interface ExerciceProjete {
  exercice: unknown;
  ecrans: EcranDeclare[];
}

/**
 * Point UNIQUE de projection de la cascade : `ecrans`, `verifier`, `solutionAttendue` et l'aide (les six
 * sites : GET exercice, POST réponse ×2, POST aide, tableau de bord) reçoivent l'exercice projeté, jamais
 * `regenere.exercice`. Sans `projeter` (tous les générateurs sans écran dépendant) : l'exercice brut,
 * inchangé et sans coût. Le réglage utilisé est `feedback_immediat` de la TÂCHE (statique), jamais l'état
 * de révélation d'un champ (qui bascule à la fin de la tâche et changerait l'énoncé déjà vu).
 * Une déclaration incohérente (`dependDe` mal formé, ou sans `projeter`) est un bug de générateur : échec bruyant.
 */
export function projeterExercice(regenere: ExerciceRegenere, reponsesConfirmees: readonly ReponseConfirmee[], contexte: { reglages: { feedback_immediat: boolean } }): ExerciceProjete {
  const problemes = validerDependances(regenere.ecrans);
  if (problemes.length > 0) throw new Error(`${regenere.generateur.variante_id} : dépendances d'écrans invalides : ${problemes.join(" ; ")}`);
  if (!regenere.generateur.projeter) {
    if (regenere.ecrans.some((e) => e.dependDe !== undefined)) throw new Error(`${regenere.generateur.variante_id} : un écran déclare dependDe mais le générateur n'a pas de projeter()`);
    return { exercice: regenere.exercice, ecrans: regenere.ecrans };
  }
  const exercice = regenere.generateur.projeter(regenere.exercice, [...reponsesConfirmees], { correctionImmediate: contexte.reglages.feedback_immediat });
  const ecrans = regenere.generateur.ecrans(exercice);
  if (ecrans.map((e) => e.champ).join("\u0000") !== regenere.ecrans.map((e) => e.champ).join("\u0000")) {
    throw new Error(`${regenere.generateur.variante_id} : la projection ne doit jamais changer la liste des champs (champs_attendus est figé à l'assignation)`);
  }
  return { exercice, ecrans };
}

export interface ContexteTache {
  nom: string;
  reglages: ReglagesCorrection;
  tentativesMax: number;
  aideActivee: boolean;
  aidePenalitePourcent: number;
  chronoMode: ChronoMode;
  chronoDureeSecondes: number | null;
  /** Retour en arrière EFFECTIF (`retourArriereEffectif`, RAPPORT §37) : réglage de la tâche ET correction immédiate coupée. */
  retourArriere: boolean;
}

export async function chargerContexteTache(admin: AdminClient, tacheId: string, varianteId: string): Promise<ContexteTache | null> {
  const { data: tache, error } = await admin
    .from("taches")
    .select("nom, feedback_immediat, reponse_visible, tentatives_supplementaires, aide_activee, aide_penalite_pourcent, chrono_mode, chrono_duree_secondes, autoriser_retour_arriere")
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
    retourArriere: retourArriereEffectif(tache.feedback_immediat as boolean, tache.autoriser_retour_arriere === true),
  };
}

export interface LigneReponse {
  exercice_assigne_id: string;
  champ: string;
  valeur_saisie: string;
  statut: StatutVerification;
  indice_utilise: boolean;
  /** Score partiel (RAPPORT §16) : `null`/absent = pas de fraction. Jamais exposée par une réponse HTTP. */
  fraction_correcte?: number | null;
}

export interface DonneesExercice {
  /** TOUTES les lignes de l'exercice, chronologique croissant, tous champs confondus (ordre d'insertion : base de la validité, `lib/reponsesValides.ts`). */
  lignesChronologiques: LigneReponse[];
  /** Historique chronologique croissant, par champ. */
  reponsesParChamp: Map<string, LigneReponse[]>;
  debuts: LigneDebutEcran[];
  champsAvecAide: Set<string>;
}

/** Lecture bornée à UN exercice (jamais soumise au plafond de 1000 lignes). */
export async function chargerDonneesExercice(admin: AdminClient, exerciceId: string): Promise<DonneesExercice> {
  const { data: reponses, error: erreurReponses } = await admin
    .from("reponses")
    .select("exercice_assigne_id, champ, valeur_saisie, statut, indice_utilise, fraction_correcte")
    .eq("exercice_assigne_id", exerciceId)
    .order("horodatage", { ascending: true });
  if (erreurReponses) throw new Error(erreurReponses.message);
  const { data: debuts, error: erreurDebuts } = await admin.from("debuts_ecran").select("champ, horodatage_debut").eq("exercice_assigne_id", exerciceId);
  if (erreurDebuts) throw new Error(erreurDebuts.message);
  const { data: aides, error: erreurAides } = await admin.from("aides_utilisees").select("champ").eq("exercice_assigne_id", exerciceId);
  if (erreurAides) throw new Error(erreurAides.message);

  return donneesDepuisLignes(
    (reponses ?? []) as LigneReponse[],
    (debuts ?? []) as LigneDebutEcran[],
    new Set((aides ?? []).map((a) => a.champ as string)),
  );
}

/** Construit `DonneesExercice` depuis les lignes brutes (chronologique croissant) — point unique du regroupement par champ. */
export function donneesDepuisLignes(lignesChronologiques: LigneReponse[], debuts: LigneDebutEcran[], champsAvecAide: Set<string>): DonneesExercice {
  const reponsesParChamp = new Map<string, LigneReponse[]>();
  for (const r of lignesChronologiques) {
    if (!reponsesParChamp.has(r.champ)) reponsesParChamp.set(r.champ, []);
    reponsesParChamp.get(r.champ)!.push(r);
  }
  return {
    lignesChronologiques,
    reponsesParChamp,
    debuts,
    champsAvecAide,
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
  /** Fractions (`reponses.fraction_correcte`) dans le MÊME ordre que `statutsChronologiques` ; omises = comportement d'origine. */
  fractionsChronologiques?: readonly (number | null | undefined)[],
): EtatChampTentatives {
  const normal = calculerEtatChampTentatives(statutsChronologiques, contexte.tentativesMax, aideUtilisee, contexte.aidePenalitePourcent, false, fractionsChronologiques);
  if (normal.terminee) return normal;
  const debut = horodatageDebutPertinent(contexte.chronoMode, champ, debuts);
  const expire = calculerChronoExpire(contexte.chronoMode, contexte.chronoDureeSecondes, debut, maintenant);
  return expire ? calculerEtatChampTentatives(statutsChronologiques, contexte.tentativesMax, aideUtilisee, contexte.aidePenalitePourcent, true, fractionsChronologiques) : normal;
}

/**
 * DÉFINITION UNIQUE de « ce champ est terminé » pour tout appelant qui ne dispose que de l'historique brut d'un exercice
 * (`verrouillageTache.ts`, `GET /api/eleves/mes-resultats`, `GET /api/profs/resultats`) : réussi, révélé par épuisement des
 * tentatives, OU révélé par l'expiration du chrono (`etatTentativesAvecChrono`, MÊME dérivation que `calculerEtatChamp`).
 * L'usage d'aide n'intervient que dans le score, jamais dans `terminee` : il n'est donc pas un paramètre ici.
 * `historiqueParChamp` : statuts (et fractions) dans l'ordre chronologique croissant, par champ.
 */
export function champsTermines(
  champsAttendus: readonly string[],
  historiqueParChamp: ReadonlyMap<string, readonly { statut: StatutVerification; fraction_correcte?: number | null }[]>,
  debuts: readonly LigneDebutEcran[],
  contexte: Pick<ContexteTache, "tentativesMax" | "aidePenalitePourcent" | "chronoMode" | "chronoDureeSecondes"> & { retourArriere?: boolean },
  maintenant: Date,
  /** `exercices_assignes.remis_le` non nul (retour en arrière, RAPPORT §37). */
  remis = false,
): Set<string> {
  // Retour en arrière : répondre ne TERMINE pas un champ (il reste modifiable) ; l'exercice est terminé — tous ses champs à la
  // fois — quand il est rendu ou que le chrono global est écoulé, jamais avant (D1/D3). L'historique n'intervient plus ici.
  if (contexte.retourArriere) return exerciceVerrouille(remis, contexte, debuts, maintenant) ? new Set(champsAttendus) : new Set();
  const termines = new Set<string>();
  for (const champ of champsAttendus) {
    const historique = historiqueParChamp.get(champ) ?? [];
    const etat = etatTentativesAvecChrono(champ, historique.map((h) => h.statut), false, debuts, contexte, maintenant, historique.map((h) => h.fraction_correcte));
    if (etat.terminee) termines.add(champ);
  }
  return termines;
}

/** Vrai si le chrono GLOBAL de la tâche est écoulé pour cet exercice (`false` pour tout autre mode ou si le chrono n'a pas démarré). */
export function chronoGlobalExpire(contexte: Pick<ContexteTache, "chronoMode" | "chronoDureeSecondes">, debuts: readonly LigneDebutEcran[], maintenant: Date): boolean {
  return contexte.chronoMode === "global" && calculerChronoExpire("global", contexte.chronoDureeSecondes, horodatageDebutPertinent("global", "", debuts), maintenant);
}

/**
 * Sous retour en arrière, l'exercice n'accepte plus aucune modification (D1) quand il est RENDU ou que son chrono global est
 * écoulé (l'échéance de la tâche est traitée à part, par `categorieTachePourEleve`). Point unique de cette règle.
 */
export function exerciceVerrouille(remis: boolean, contexte: Pick<ContexteTache, "chronoMode" | "chronoDureeSecondes">, debuts: readonly LigneDebutEcran[], maintenant: Date): boolean {
  return remis || chronoGlobalExpire(contexte, debuts, maintenant);
}

/**
 * Données EFFECTIVES sous retour en arrière : pour chaque écran, seulement sa dernière ligne si elle est valide
 * (`lib/reponsesValides.ts`). Les lignes périmées ne comptent plus pour l'état ; elles restent en base (statistiques, D8).
 */
export function donneesEffectives(ecrans: readonly EcranDeclare[], donnees: DonneesExercice): DonneesExercice {
  const valides = dernieresReponsesValides(amontsTransitifs(ecrans), donnees.lignesChronologiques);
  const lignesChronologiques = donnees.lignesChronologiques.filter((l) => valides.get(l.champ) === l);
  const reponsesParChamp = new Map<string, LigneReponse[]>();
  for (const [champ, ligne] of valides) reponsesParChamp.set(champ, [ligne]);
  return { lignesChronologiques, reponsesParChamp, debuts: donnees.debuts, champsAvecAide: donnees.champsAvecAide };
}

export function calculerEtatChamp(champ: string, donnees: DonneesExercice, contexte: ContexteTache, maintenant: Date): EtatChamp {
  const historique = donnees.reponsesParChamp.get(champ) ?? [];
  const aideUtilisee = donnees.champsAvecAide.has(champ) || historique.some((h) => h.indice_utilise);
  const etat = etatTentativesAvecChrono(champ, historique.map((h) => h.statut), aideUtilisee, donnees.debuts, contexte, maintenant, historique.map((h) => h.fraction_correcte));
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
  /**
   * `verrouille` = champ TERMINÉ pour le moteur (réussi, révélé, ou — sous retour en arrière — répondu). `modifiable` : sous retour
   * en arrière, champ répondu que l'élève peut encore modifier (jamais vrai sans retour, ni une fois l'exercice rendu / expiré).
   */
  champs: (EtatChamp & { verrouille: boolean; modifiable: boolean })[];
  /** Retour en arrière effectif pour cette tâche. */
  retourArriere: boolean;
  /** Retour en arrière : exercice rendu ou chrono global écoulé (plus aucune modification). Toujours `false` sans retour. */
  exerciceVerrouille: boolean;
  /** Retour en arrière : tous les écrans ont une réponse valide et l'exercice n'est pas encore rendu (« Rendre cet exercice » proposé). */
  pretARendre: boolean;
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
  const retour = contexte.retourArriere;
  // Retour en arrière (RAPPORT §37) : l'état se calcule sur la dernière réponse VALIDE de chaque écran (un seul essai effectif) ;
  // sans retour, exactement l'historique complet comme avant.
  const verrou = retour && exerciceVerrouille(regenere.ligne.remis_le != null, contexte, donnees.debuts, maintenant);
  const effectives = retour ? donneesEffectives(regenere.ecrans, donnees) : donnees;
  const champs = regenere.ecrans.map((ecran) => {
    const etat = calculerEtatChamp(ecran.champ, effectives, contexte, maintenant);
    const repondu = (effectives.reponsesParChamp.get(ecran.champ)?.length ?? 0) > 0;
    return { ...etat, verrouille: etat.etat.terminee, modifiable: retour && !verrou && repondu };
  });
  const reponsesConfirmees: ReponseConfirmeeInterne[] = champs
    .filter((c) => c.verrouille)
    .map((c) => ({ champ: c.champ, reponseBrute: c.derniere?.valeur_saisie ?? "", statut: c.derniere?.statut ?? "not_equivalent" }));
  const { champCourant } = regenere.generateur.etatActuel(regenere.exercice, reponsesConfirmees);
  // Sous retour en arrière, avoir répondu à tout ne termine PAS l'exercice : il faut le rendre (sinon la dernière réponse ferait
  // tout révéler d'un coup, sans que l'élève ait pu relire) — ou que le chrono global l'ait clos.
  const pretARendre = retour && !verrou && champs.every((c) => c.modifiable);
  return { champs, retourArriere: retour, exerciceVerrouille: verrou, pretARendre, reponsesConfirmees, champCourant, termine: champs.every((c) => c.verrouille) && (!retour || verrou) };
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
