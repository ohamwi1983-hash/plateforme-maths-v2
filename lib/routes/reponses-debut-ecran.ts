import type { RequeteHttp, ReponseHttp } from "../httpTypes";
import { avecGestionErreurs } from "../avecGestionErreurs";
import { eleveAuthentifie, supabaseAdmin } from "../supabaseAdmin";
import { horodatageDebutPertinent, calculerSecondesRestantes, type ChronoMode, type LigneDebutEcran } from "../moteurTentatives";
import { resoudreChronoDureeSecondes } from "../resoudreChronoDureeSecondes";

/**
 * Correctif "Chrono de réponse" (révision "horodatage de départ côté serveur") — `POST
 * /api/reponses/debut-ecran` : signal d'affichage d'écran, SANS AUCUNE VALEUR DE TEMPS dans le
 * corps de la requête (le client ne fournit jamais de durée ni d'horodatage — c'est précisément ce
 * que corrige cette révision par rapport au correctif initial, où `Date.now()` était mesuré côté
 * client puis envoyé, falsifiable via la console développeur).
 *
 * 1. `upsert(..., { onConflict: "exercice_assigne_id,champ", ignoreDuplicates: true })` — traduit
 *    `insert ... on conflict (exercice_assigne_id, champ) do nothing` (supabase/schema.sql) : la
 *    première écriture gagne, un appel répété pour le même (exercice_assigne_id, champ) — écran
 *    rouvert, page rechargée, double clic — n'écrase jamais l'horodatage déjà enregistré.
 * 2. Relit `chrono_mode`/`chrono_duree_secondes` de la tâche concernée.
 * 3. `chrono_mode="aucun"` -> `{ secondes_restantes: null }`.
 * 4. Sinon, relit `debuts_ecran` (upsert ci-dessus inclus, donc toujours au moins 1 ligne pour ce
 *    champ à ce stade) et calcule `secondes_restantes` via `horodatageDebutPertinent`/
 *    `calculerSecondesRestantes` (`lib/moteurTentatives.ts`) — MÊME dérivation que celle réutilisée
 *    par `lib/routes/reponses.ts`/`lib/routes/eleves/tableau-de-bord.ts` pour `chronoExpire`, jamais
 *    une 2e logique parallèle.
 */

interface CorpsDebutEcran {
  exercice_assigne_id: string;
  champ: string;
}

function estCorpsValide(corps: unknown): corps is CorpsDebutEcran {
  if (typeof corps !== "object" || corps === null) return false;
  const c = corps as Record<string, unknown>;
  return typeof c.exercice_assigne_id === "string" && typeof c.champ === "string";
}

export const gererReponsesDebutEcran = avecGestionErreurs(async function handler(req: RequeteHttp, res: ReponseHttp): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ erreur: "Méthode non autorisée" });
    return;
  }

  const eleve = await eleveAuthentifie(req.headers.authorization as string | undefined);
  if (!eleve) {
    res.status(401).json({ erreur: "Non authentifié" });
    return;
  }

  if (!estCorpsValide(req.body)) {
    res.status(400).json({ erreur: "Corps invalide : { exercice_assigne_id, champ }" });
    return;
  }
  const { exercice_assigne_id, champ } = req.body;
  const admin = supabaseAdmin();

  const { data: exerciceAssigne, error } = await admin
    .from("exercices_assignes")
    .select("tache_id, eleve_id, variante_id")
    .eq("id", exercice_assigne_id)
    .maybeSingle();
  if (error || !exerciceAssigne || exerciceAssigne.eleve_id !== eleve.id) {
    res.status(404).json({ erreur: "Exercice assigné introuvable" });
    return;
  }

  const { error: erreurUpsert } = await admin
    .from("debuts_ecran")
    .upsert({ exercice_assigne_id, champ }, { onConflict: "exercice_assigne_id,champ", ignoreDuplicates: true });
  if (erreurUpsert) {
    res.status(500).json({ erreur: "Échec d'enregistrement du début d'écran", detail: erreurUpsert.message });
    return;
  }

  const { data: tache, error: erreurTache } = await admin
    .from("taches")
    .select("chrono_mode, chrono_duree_secondes")
    .eq("id", exerciceAssigne.tache_id)
    .maybeSingle();
  if (erreurTache || !tache) {
    res.status(404).json({ erreur: "Tâche associée introuvable" });
    return;
  }

  const chronoMode = tache.chrono_mode as ChronoMode;
  // Correctif "Chrono par variante" : surcharge par ligne de composition (`taches_composition`),
  // repli sur `chrono_duree_secondes` de la tâche si absente — voir
  // lib/resoudreChronoDureeSecondes.ts, seul point de cette résolution, réutilisé identiquement
  // aux 2 autres sites (lib/routes/reponses.ts, lib/routes/eleves/tableau-de-bord.ts).
  const chronoDureeSecondes = await resoudreChronoDureeSecondes(
    admin,
    exerciceAssigne.tache_id as string,
    exerciceAssigne.variante_id as string,
    chronoMode,
    tache.chrono_duree_secondes as number | null,
  );
  if (chronoMode === "aucun" || chronoDureeSecondes === null) {
    res.status(200).json({ secondes_restantes: null });
    return;
  }

  const { data: debutsEcranBruts, error: erreurDebuts } = await admin
    .from("debuts_ecran")
    .select("champ, horodatage_debut")
    .eq("exercice_assigne_id", exercice_assigne_id)
    .returns<LigneDebutEcran[]>();
  if (erreurDebuts) {
    res.status(500).json({ erreur: "Échec de lecture des débuts d'écran", detail: erreurDebuts.message });
    return;
  }

  const debut = horodatageDebutPertinent(chronoMode, champ, debutsEcranBruts ?? []);
  // Ne devrait jamais être `null` ici (l'upsert ci-dessus garantit au moins une ligne pour CE champ,
  // et le mode "par_ecran"/"global" en dépend directement ou via son minimum) — mais défensif plutôt
  // qu'une exception si une incohérence de données survenait malgré tout.
  const secondesRestantes = debut === null ? chronoDureeSecondes : calculerSecondesRestantes(chronoDureeSecondes, debut, new Date());
  res.status(200).json({ secondes_restantes: secondesRestantes });
});
