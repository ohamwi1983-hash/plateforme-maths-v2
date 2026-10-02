import { supabaseAdmin } from "./supabaseAdmin";
import type { ChronoMode } from "./moteurTentatives";

type AdminClient = ReturnType<typeof supabaseAdmin>;

/**
 * Correctif "Chrono par variante" — point UNIQUE de résolution de la durée de chrono applicable à
 * un (tache_id, variante_id) donné, réutilisé tel quel aux 3 endroits qui lisaient jusqu'ici
 * `chrono_duree_secondes` directement depuis `taches` (`POST /api/reponses/debut-ecran`, `POST
 * /api/reponses`, `GET /api/eleves/tableau-de-bord`) — jamais une 2e logique parallèle.
 *
 * Portée : uniquement pertinente en mode `"par_ecran"` (Étape "Portée" du prompt) — en mode
 * `"global"`, un seul budget partagé s'applique, la surcharge par variante n'a pas de sens et est
 * ignorée sans même interroger `taches_composition`. En mode `"aucun"`, `chronoDureeSecondesTache`
 * vaut déjà `null` (voir supabase/schema.sql, `chrono_duree_secondes` reste `null` tant que
 * `chrono_mode='aucun'`) : retourné tel quel, même chemin que `"global"`.
 *
 * RAPPORT §55 : avec `compositionId` (exercices assignés depuis cette version), la résolution se fait PAR LIGNE ; la règle « première valeur non nulle » ci-dessous ne
 * subsiste que pour les exercices historiques (`compositionId = null`).
 *
 * Décision actée sur les doublons (`taches_composition` n'a aucune contrainte d'unicité sur
 * `(tache_id, variante_id)`, voir supabase/schema.sql) : si plusieurs lignes correspondantes
 * existent avec des `chrono_duree_secondes` différents, la première valeur NON NULLE trouvée est
 * retenue — pas de contrainte d'unicité ajoutée par ce correctif, règle de repli documentée ici et
 * dans RAPPORT.md plutôt que silencieusement livrée à l'ordre de retour de la base.
 */
export async function resoudreChronoDureeSecondes(
  admin: AdminClient,
  tacheId: string,
  varianteId: string,
  chronoMode: ChronoMode,
  chronoDureeSecondesTache: number | null,
  compositionId: string | null = null,
): Promise<number | null> {
  if (chronoMode !== "par_ecran") return chronoDureeSecondesTache;
  if (compositionId !== null) {
    // RAPPORT §55 : l'exercice connaît sa ligne de composition — la durée est celle de CETTE ligne (deux lignes de même variante, deux durées), repli sur la tâche.
    const { data: ligne } = await admin.from("taches_composition").select("chrono_duree_secondes").eq("id", compositionId).eq("tache_id", tacheId).maybeSingle();
    return (ligne?.chrono_duree_secondes as number | null | undefined) ?? chronoDureeSecondesTache;
  }
  const { data } = await admin
    .from("taches_composition")
    .select("chrono_duree_secondes")
    .eq("tache_id", tacheId)
    .eq("variante_id", varianteId)
    .not("chrono_duree_secondes", "is", null)
    .limit(1)
    .maybeSingle();
  return (data?.chrono_duree_secondes as number | null | undefined) ?? chronoDureeSecondesTache;
}
