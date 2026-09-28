import type { supabaseAdmin } from "./supabaseAdmin";
import type { IdentiteEleve } from "./homonymes";

export interface EleveGlobal extends IdentiteEleve {
  id: string;
  actif: boolean;
}

export type ResultatTousLesEleves = { ok: true; eleves: EleveGlobal[] } | { ok: false; erreur: string };

/**
 * Tous les élèves de la plateforme (id/nom/prénom/actif) — lecture directe de la table `eleves`,
 * sans passer par `inscriptions`/`classes`. Prompt "Connexion élève sans code", Étape 1 :
 * "conséquence technique nécessaire, pas optionnelle" — sans code à la connexion, nom+prénom
 * doivent désigner un ensemble borné de comptes sur TOUTE la plateforme, pas seulement au sein
 * d'une classe. Consommée par `provisionnerEleve.ts` (suffixe d'affichage à la création, désormais
 * global) et `lib/routes/connexion-eleve.ts` (liste des candidats à la connexion).
 *
 * Ne remplace PAS `elevesDeLaClasse.ts` : les opérations professeur sur un élève existant
 * (modifier/transférer/désactiver) restent scopées à ses propres classes, explicitement exclues de
 * ce prompt ("seule la connexion élève elle-même change de périmètre") — elles continuent d'utiliser
 * `elevesDeLaClasse`, inchangé.
 */
export async function tousLesEleves(admin: ReturnType<typeof supabaseAdmin>): Promise<ResultatTousLesEleves> {
  const { data, error } = (await admin.from("eleves").select("id, nom, prenom, actif")) as {
    data: EleveGlobal[] | null;
    error: { message: string } | null;
  };
  if (error) return { ok: false, erreur: error.message };
  return { ok: true, eleves: data ?? [] };
}
