import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { profAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { chargerTacheDuProf } from "../tacheDuProf";
import { classesDuProfPourEleve } from "../eleveDuProf";
import { elevesDeLaClasse } from "../elevesDeLaClasse";
import { chercherGenerateur } from "../registreGenerateurs";
import { tirerGraine } from "../prng";

/**
 * POST /api/assignations — assigne une tâche déjà créée à une classe (`classe_id`) OU à des élèves
 * précis (`eleve_ids`), avec fenêtre de dates optionnelle, et génère les exercices : pour chaque
 * élève cible et chaque ligne de composition, `nombre_exercices` lignes `exercices_assignes` portant
 * une graine (`lib/prng.ts`) et les `champs_attendus` déclarés par le générateur. L'exercice lui-même
 * n'est PAS stocké (régénéré depuis la graine, lib/contratGenerateur.ts).
 *
 * Générateurs résolus par le REGISTRE (lib/registreGenerateurs.ts), jamais par le catalogue affiché :
 * une variante cataloguée mais sans générateur exécutable (gen7 avant la phase 3) fait échouer
 * l'assignation en 409, avant toute écriture.
 *
 * Idempotence : un élève qui a déjà des exercices pour cette tâche n'en reçoit pas de nouveaux (les
 * tâches assignées sont verrouillées, `lib/tacheAssignee.ts` : leur composition ne change plus) — la
 * ligne d'assignation (fenêtre de dates) est en revanche toujours enregistrée.
 * Ordre d'écriture : exercices d'abord, assignation ensuite — un échec à mi-parcours laisse des
 * exercices orphelins et invisibles, jamais une tâche « assignée » sans exercice (donc verrouillée à vie).
 */

interface CorpsAssignation {
  tache_id: string;
  classe_id?: string;
  eleve_ids?: string[];
  date_debut?: string;
  date_echeance?: string;
}

function dateIsoValide(v: unknown): v is string {
  return typeof v === "string" && !Number.isNaN(new Date(v).getTime());
}

function analyserCorps(corps: unknown): { ok: true; corps: CorpsAssignation } | { ok: false; erreur: string } {
  if (typeof corps !== "object" || corps === null || Array.isArray(corps)) return { ok: false, erreur: "Corps invalide" };
  const c = corps as Record<string, unknown>;
  if (typeof c.tache_id !== "string" || c.tache_id === "") return { ok: false, erreur: "tache_id manquant" };
  const parClasse = c.classe_id !== undefined;
  const parEleves = c.eleve_ids !== undefined;
  if (parClasse === parEleves) return { ok: false, erreur: "Fournir soit classe_id, soit eleve_ids (exactement un des deux)" };
  if (parClasse && typeof c.classe_id !== "string") return { ok: false, erreur: "classe_id invalide" };
  if (parEleves && (!Array.isArray(c.eleve_ids) || c.eleve_ids.length === 0 || !c.eleve_ids.every((e) => typeof e === "string"))) return { ok: false, erreur: "eleve_ids invalide (tableau non vide de chaînes)" };
  if (c.date_debut !== undefined && !dateIsoValide(c.date_debut)) return { ok: false, erreur: "date_debut invalide" };
  if (c.date_echeance !== undefined && !dateIsoValide(c.date_echeance)) return { ok: false, erreur: "date_echeance invalide" };
  if (c.date_debut !== undefined && c.date_echeance !== undefined && new Date(c.date_echeance as string) <= new Date(c.date_debut as string)) {
    return { ok: false, erreur: "date_echeance doit être postérieure à date_debut" };
  }
  return {
    ok: true,
    corps: {
      tache_id: c.tache_id,
      classe_id: c.classe_id as string | undefined,
      eleve_ids: c.eleve_ids as string[] | undefined,
      date_debut: c.date_debut as string | undefined,
      date_echeance: c.date_echeance as string | undefined,
    },
  };
}

export const gererAssignations = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }
  const prof = await profAuthentifie(req.headers.authorization as string | undefined);
  if (!prof) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }
  const analyse = analyserCorps(req.body);
  if (!analyse.ok) {
    res.status(400).json({ erreur: analyse.erreur });
    return;
  }
  const corps = analyse.corps;
  const admin = supabaseAdmin();

  const tache = await chargerTacheDuProf(admin, corps.tache_id, prof.id);
  if (!tache) {
    res.status(404).json({ erreur: "Tâche introuvable" });
    return;
  }

  // Cibles : élèves de la classe (du prof) ou élèves listés (chacun dans une classe du prof).
  let eleveIds: string[];
  if (corps.classe_id !== undefined) {
    const { data: classe, error } = await admin.from("classes").select("id").eq("id", corps.classe_id).eq("prof_id", prof.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!classe) {
      res.status(404).json({ erreur: "Classe introuvable" });
      return;
    }
    const resultat = await elevesDeLaClasse(admin, corps.classe_id);
    if (!resultat.ok) throw new Error(resultat.erreur);
    eleveIds = resultat.eleves.filter((e) => e.actif).map((e) => e.id);
  } else {
    eleveIds = [...new Set(corps.eleve_ids!)];
    for (const eleveId of eleveIds) {
      if ((await classesDuProfPourEleve(admin, eleveId, prof.id)).length === 0) {
        res.status(404).json({ erreur: `Élève introuvable dans vos classes : ${eleveId}` });
        return;
      }
    }
  }

  const { data: composition, error: erreurComposition } = await admin.from("taches_composition").select("generateur_id, variante_id, nombre_exercices").eq("tache_id", corps.tache_id);
  if (erreurComposition) throw new Error(erreurComposition.message);
  if (!composition || composition.length === 0) {
    res.status(400).json({ erreur: "Cette tâche n'a aucune composition" });
    return;
  }
  const sansGenerateur = composition.filter((l) => !chercherGenerateur(l.variante_id as string)).map((l) => l.variante_id as string);
  if (sansGenerateur.length > 0) {
    res.status(409).json({ erreur: "Générateur pas encore disponible pour : " + sansGenerateur.join(", "), variantes_indisponibles: sansGenerateur });
    return;
  }

  const { data: dejaGeneres, error: erreurDeja } = await admin.from("exercices_assignes").select("eleve_id").eq("tache_id", corps.tache_id);
  if (erreurDeja) throw new Error(erreurDeja.message);
  const elevesDejaServis = new Set((dejaGeneres ?? []).map((l) => l.eleve_id as string));

  const lignes: Record<string, unknown>[] = [];
  for (const eleveId of eleveIds) {
    if (elevesDejaServis.has(eleveId)) continue;
    for (const ligne of composition) {
      const generateur = chercherGenerateur(ligne.variante_id as string)!;
      for (let i = 0; i < (ligne.nombre_exercices as number); i++) {
        const graine = tirerGraine();
        const exercice = generateur.generer(graine);
        lignes.push({
          tache_id: corps.tache_id,
          eleve_id: eleveId,
          generateur_id: generateur.generateur_id,
          variante_id: generateur.variante_id,
          graine,
          champs_attendus: generateur.ecrans(exercice).map((e) => e.champ),
        });
      }
    }
  }
  if (lignes.length > 0) {
    const { error } = await admin.from("exercices_assignes").insert(lignes);
    if (error) throw new Error(error.message);
  }

  const fenetre = { ...(corps.date_debut !== undefined ? { date_debut: corps.date_debut } : {}), ...(corps.date_echeance !== undefined ? { date_echeance: corps.date_echeance } : {}) };
  if (corps.classe_id !== undefined) {
    const { error } = await admin.from("taches_assignations").insert({ tache_id: corps.tache_id, classe_id: corps.classe_id, ...fenetre });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("taches_assignations_eleves").insert(eleveIds.map((eleve_id) => ({ tache_id: corps.tache_id, eleve_id, ...fenetre })));
    if (error) throw new Error(error.message);
  }

  res.status(201).json({ nombre_exercices_generes: lignes.length, eleves_concernes: eleveIds.length });
});
