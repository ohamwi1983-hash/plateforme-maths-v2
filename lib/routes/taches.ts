import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { lignesDeComposition } from "../lignesComposition";
import { estCorpsValide, validerComposition } from "../validationCorpsTaches";

interface LigneCompositionBrute {
  id: string;
  tache_id: string;
  variante_id: string;
  nombre_exercices: number;
  chrono_duree_secondes: number | null;
  configuration: unknown;
}

interface LigneAssignationBrute {
  tache_id: string;
  classe_id: string;
  date_debut: string;
  date_echeance: string | null;
}

interface LigneAssignationEleveBrute {
  tache_id: string;
  eleve_id: string;
  date_debut: string;
  date_echeance: string | null;
}

/**
 * GET /api/taches — prompt "Séparer création et assignation de tâche", Étape 3 : liste les tâches
 * du prof authentifié, chacune avec sa composition, ses réglages, et `assignee` (`true` si au
 * moins une ligne `taches_assignations` OU `taches_assignations_eleves` existe pour elle — même
 * règle que `lib/tacheAssignee.ts`, mais calculée ici en une seule requête groupée sur tout
 * `tacheIds` plutôt qu'en appelant cette fonction tâche par tâche, pour éviter N+1 requêtes sur
 * une liste ; `PATCH`/`DELETE` /api/taches/:id, qui ne traitent qu'une tâche à la fois, appellent
 * `tacheEstAssignee` directement).
 *
 * Étendu pour "Liste des tâches" (table triable/filtrable, public/prof.html) : ajoute
 * `date_creation` (colonne réelle de `taches`, jusqu'ici jamais sélectionnée ni renvoyée — vérifié
 * par lecture avant d'écrire, voir RAPPORT.md) et `assignations` — le détail PAR CLASSE
 * (`classe_id`/`classe_nom`/`date_debut`/`date_echeance`), pas un booléen ni une paire de dates
 * agrégée : une tâche peut être assignée à plusieurs classes avec des fenêtres différentes
 * (`taches_assignations`, une ligne par classe — voir supabase/schema.sql), donc c'est au client
 * de décider comment représenter le cas à plusieurs classes (fenêtre globale + détail par classe
 * dans l'aperçu déjà validé), jamais résumé/perdu côté serveur.
 *
 * Étendu pour "Assigner à des élèves spécifiques" : `assignations` fusionne désormais les 2
 * mécanismes — chaque entrée porte SOIT `classe_id`/`classe_nom` (assignation par classe, `null`
 * pour `eleve_id`/`eleve_nom`) SOIT `eleve_id`/`eleve_nom` (assignation par élève, `null` pour
 * `classe_id`/`classe_nom`), jamais les deux à la fois — le client (calculerStatutTache,
 * fenetreDatesTache) reste agnostique au type puisqu'il ne lit que `date_debut`/`date_echeance`.
 */
async function listerTaches(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  const admin = supabaseAdmin();

  const { data: taches, error: erreurTaches } = await admin
    .from("taches")
    .select(
      "id, nom, date_creation, feedback_immediat, reponse_visible, tentatives_supplementaires, aide_activee, aide_penalite_pourcent, afficher_recapitulatif, chrono_mode, chrono_duree_secondes, autoriser_retour_arriere",
    )
    .eq("prof_id", prof.id)
    // Prompt "Aperçu d'une tâche avant création" : exclut la tâche d'aperçu éphémère du prof
    // (`POST /api/taches/apercu`, `est_apercu: true`) — jamais listée avec les vraies tâches, ni
    // proposable dans "Assigner une tâche" (voir supabase/schema.sql).
    .eq("est_apercu", false);
  if (erreurTaches) {
    res.status(500).json({ erreur: "Échec de récupération des tâches", detail: erreurTaches.message });
    return;
  }
  if (!taches || taches.length === 0) {
    res.status(200).json([]);
    return;
  }

  const tacheIds = taches.map((t) => t.id as string);

  const { data: compositions, error: erreurCompositions } = await admin
    .from("taches_composition")
    .select("id, tache_id, variante_id, nombre_exercices, chrono_duree_secondes, configuration")
    .in("tache_id", tacheIds)
    .returns<LigneCompositionBrute[]>();
  if (erreurCompositions) {
    res.status(500).json({ erreur: "Échec de récupération de la composition des tâches", detail: erreurCompositions.message });
    return;
  }

  const { data: assignations, error: erreurAssignations } = await admin
    .from("taches_assignations")
    .select("tache_id, classe_id, date_debut, date_echeance")
    .in("tache_id", tacheIds)
    .returns<LigneAssignationBrute[]>();
  if (erreurAssignations) {
    res.status(500).json({ erreur: "Échec de récupération des assignations", detail: erreurAssignations.message });
    return;
  }

  const { data: assignationsEleves, error: erreurAssignationsEleves } = await admin
    .from("taches_assignations_eleves")
    .select("tache_id, eleve_id, date_debut, date_echeance")
    .in("tache_id", tacheIds)
    .returns<LigneAssignationEleveBrute[]>();
  if (erreurAssignationsEleves) {
    res.status(500).json({ erreur: "Échec de récupération des assignations par élève", detail: erreurAssignationsEleves.message });
    return;
  }

  const tacheIdsAssignees = new Set([
    ...(assignations ?? []).map((a) => a.tache_id),
    ...(assignationsEleves ?? []).map((a) => a.tache_id),
  ]);

  // Noms de classe pour l'affichage (jamais juste l'id) — requête séparée plutôt qu'une jointure
  // Supabase, aucune jointure de ce type n'étant déjà utilisée ailleurs dans ce dépôt.
  const classeIds = [...new Set((assignations ?? []).map((a) => a.classe_id))];
  const classeNomParId = new Map<string, string>();
  if (classeIds.length > 0) {
    const { data: classesAssignees, error: erreurClasses } = await admin.from("classes").select("id, nom").in("id", classeIds);
    if (erreurClasses) {
      res.status(500).json({ erreur: "Échec de récupération des classes assignées", detail: erreurClasses.message });
      return;
    }
    for (const c of classesAssignees ?? []) classeNomParId.set(c.id as string, c.nom as string);
  }

  // Mêmes principes pour les noms d'élève (prompt "Assigner à des élèves spécifiques") : requête
  // séparée, jamais de jointure Supabase.
  const eleveIds = [...new Set((assignationsEleves ?? []).map((a) => a.eleve_id))];
  const eleveNomParId = new Map<string, string>();
  if (eleveIds.length > 0) {
    const { data: elevesAssignes, error: erreurEleves } = await admin.from("eleves").select("id, nom, prenom").in("id", eleveIds);
    if (erreurEleves) {
      res.status(500).json({ erreur: "Échec de récupération des élèves assignés", detail: erreurEleves.message });
      return;
    }
    for (const e of elevesAssignes ?? []) eleveNomParId.set(e.id as string, `${e.prenom as string} ${e.nom as string}`);
  }

  const compositionParTache = new Map<string, { id: string; variante_id: string; nombre_exercices: number; chrono_duree_secondes: number | null; configuration: unknown }[]>();
  for (const ligne of compositions ?? []) {
    if (!compositionParTache.has(ligne.tache_id)) compositionParTache.set(ligne.tache_id, []);
    compositionParTache.get(ligne.tache_id)!.push({
      id: ligne.id,
      variante_id: ligne.variante_id,
      // Configuration canonique de la ligne (RAPPORT §55), `null` pour un générateur sans configuration : restaurée telle quelle par Modifier / Dupliquer.
      configuration: ligne.configuration ?? null,
      nombre_exercices: ligne.nombre_exercices,
      // Correctif "Chrono par variante" : surcharge par ligne, exposée telle quelle au client —
      // `null` si aucune n'a été réglée pour cette ligne (repli sur le réglage de tâche).
      chrono_duree_secondes: ligne.chrono_duree_secondes,
    });
  }

  interface EntreeAssignation {
    classe_id: string | null;
    classe_nom: string | null;
    eleve_id: string | null;
    eleve_nom: string | null;
    date_debut: string;
    date_echeance: string | null;
  }
  const assignationsParTache = new Map<string, EntreeAssignation[]>();
  for (const a of assignations ?? []) {
    if (!assignationsParTache.has(a.tache_id)) assignationsParTache.set(a.tache_id, []);
    assignationsParTache.get(a.tache_id)!.push({
      classe_id: a.classe_id,
      classe_nom: classeNomParId.get(a.classe_id) ?? "",
      eleve_id: null,
      eleve_nom: null,
      date_debut: a.date_debut,
      date_echeance: a.date_echeance,
    });
  }
  for (const a of assignationsEleves ?? []) {
    if (!assignationsParTache.has(a.tache_id)) assignationsParTache.set(a.tache_id, []);
    assignationsParTache.get(a.tache_id)!.push({
      classe_id: null,
      classe_nom: null,
      eleve_id: a.eleve_id,
      eleve_nom: eleveNomParId.get(a.eleve_id) ?? "",
      date_debut: a.date_debut,
      date_echeance: a.date_echeance,
    });
  }

  const resultat = taches.map((t) => ({
    id: t.id,
    nom: t.nom,
    date_creation: t.date_creation,
    feedback_immediat: t.feedback_immediat,
    reponse_visible: t.reponse_visible,
    tentatives_supplementaires: t.tentatives_supplementaires,
    aide_activee: t.aide_activee,
    aide_penalite_pourcent: t.aide_penalite_pourcent,
    afficher_recapitulatif: t.afficher_recapitulatif,
    chrono_mode: t.chrono_mode,
    chrono_duree_secondes: t.chrono_duree_secondes,
    autoriser_retour_arriere: t.autoriser_retour_arriere,
    composition: compositionParTache.get(t.id as string) ?? [],
    assignee: tacheIdsAssignees.has(t.id as string),
    assignations: assignationsParTache.get(t.id as string) ?? [],
  }));

  res.status(200).json(resultat);
}

/**
 * POST /api/taches — crée une tâche + ses lignes taches_composition (Étape 4, prompt gen1).
 * Étendu pour "Authentification élève et réglages de correction" (Étape 4) : accepte désormais
 * `feedback_immediat`/`reponse_visible` dans le corps, persistés sur la ligne `taches` elle-même
 * (lus ensuite par api/reponses.ts pour chaque exercice qui en dépend).
 *
 * Étendu pour "Séparer création et assignation de tâche" (Étape 0/3) : n'a JAMAIS accepté
 * `classe_id`/`date_echeance` — vérifié par relecture, pas supposé (voir RAPPORT.md) — donc rien à
 * retirer ici ; seul `prof.html` enchaînait déjà cet appel avec `POST /api/assignations` en une
 * seule action utilisateur, désormais découplé (Étape 4).
 */
async function creerTache(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { nom: string, composition: [{ variante_id, nombre_exercices }] }" });
    return;
  }

  const resultatComposition = validerComposition(req.body.composition, req.body.chrono_mode ?? "aucun");
  if (!resultatComposition.ok) {
    res.status(400).json({ erreur: resultatComposition.erreur });
    return;
  }
  const composition = resultatComposition.composition;

  const admin = supabaseAdmin();

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
      autoriser_retour_arriere: req.body.autoriser_retour_arriere ?? false,
    })
    .select("id")
    .single();
  if (erreurTache || !tache) {
    res.status(500).json({ erreur: "Échec de création de la tâche", detail: erreurTache?.message });
    return;
  }

  const lignes = lignesDeComposition(tache.id as string, composition);
  const { error: erreurComposition } = await admin.from("taches_composition").insert(lignes);
  if (erreurComposition) {
    res.status(500).json({ erreur: "Échec de création de la composition de la tâche", detail: erreurComposition.message });
    return;
  }

  res.status(201).json({ id: tache.id });
}

export const gererTaches = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method === "GET") {
    await listerTaches(req, res);
    return;
  }
  if (req.method === "POST") {
    await creerTache(req, res);
    return;
  }
  res.status(405).json({ erreur: "Méthode non autorisée" });
});
