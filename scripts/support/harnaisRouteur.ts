/**
 * Harnais partagé par les tests de phase 2 : exécute le VRAI `api/router.ts` (compilé/tsx) contre
 * une `BaseMemoire`, l'authentification étant injectée via `require.cache` (même idiome que
 * `scripts/test-routeur.ts`). Jeton d'authentification : `prof:<id>` ou `eleve:<id>`.
 */
import { BaseMemoire } from "./fauxSupabase";

const cheminSupabaseAdmin = require.resolve("../../lib/supabaseAdmin");

export function installerBase(base: BaseMemoire): void {
  const lireJeton = (entete: string | undefined, prefixe: string): string | null => {
    const jeton = entete?.startsWith("Bearer ") ? entete.slice(7) : "";
    return jeton.startsWith(prefixe + ":") ? jeton.slice(prefixe.length + 1) : null;
  };
  require.cache[cheminSupabaseAdmin] = {
    id: cheminSupabaseAdmin,
    filename: cheminSupabaseAdmin,
    loaded: true,
    exports: {
      supabaseAdmin: () => base,
      profAuthentifie: async (entete?: string) => {
        const id = lireJeton(entete, "prof");
        return id && base.table("profs").some((p) => p.id === id) ? { id } : null;
      },
      eleveAuthentifie: async (entete?: string) => {
        const id = lireJeton(entete, "eleve");
        return id && base.table("eleves").some((e) => e.id === id) ? { id } : null;
      },
    },
  } as any;
  // Les modules de lib/ importent `supabaseAdmin` par référence au chargement : purge pour forcer la
  // résolution vers le faux, y compris pour ceux déjà chargés par un import précédent.
  for (const chemin of Object.keys(require.cache)) {
    if (chemin.includes("/lib/") || chemin.includes("/api/router")) {
      if (chemin !== cheminSupabaseAdmin) delete require.cache[chemin];
    }
  }
}

export async function appeler(
  chemin: string,
  methode: string,
  options: { jeton?: string; corps?: unknown } = {},
): Promise<{ statut: number | null; corps: any }> {
  const { default: routeur } = require("../../api/router");
  const req = {
    method: methode,
    headers: options.jeton ? { authorization: `Bearer ${options.jeton}` } : {},
    query: { path: chemin },
    body: options.corps ?? {},
  };
  let statut: number | null = null;
  let corps: any = null;
  const res = {
    status(code: number) {
      statut = code;
      return this;
    },
    json(objet: unknown) {
      corps = objet;
    },
    end() {},
  };
  await routeur(req, res);
  return { statut, corps };
}

export interface Scenario {
  base: BaseMemoire;
  profId: string;
  autreProfId: string;
  classeId: string;
  eleveIds: string[];
}

/** Prof + classe + 2 élèves inscrits + un 2e prof (pour les contrôles de propriété). */
export function creerScenario(): Scenario {
  const base = new BaseMemoire();
  const profId = base.inserer("profs", { id: "prof-1" }).id;
  const autreProfId = base.inserer("profs", { id: "prof-2" }).id;
  const classeId = base.inserer("classes", { id: "classe-1", prof_id: profId, nom: "4A" }).id;
  const eleveIds = ["eleve-1", "eleve-2"].map((id) => base.inserer("eleves", { id, nom: id, prenom: "Test", actif: true }).id as string);
  for (const eleve_id of eleveIds) base.inserer("inscriptions", { eleve_id, classe_id: classeId });
  return { base, profId, autreProfId, classeId, eleveIds };
}

export interface OptionsTache {
  variantes?: { variante_id: string; nombre_exercices: number; chrono_duree_secondes?: number | null }[];
  feedback_immediat?: boolean;
  reponse_visible?: boolean;
  tentatives_supplementaires?: number;
  aide_activee?: boolean;
  aide_penalite_pourcent?: number;
  chrono_mode?: string;
  chrono_duree_secondes?: number | null;
  nom?: string;
}

export function creerTache(s: Scenario, o: OptionsTache = {}): string {
  const tache = s.base.inserer("taches", {
    prof_id: s.profId,
    nom: o.nom ?? "Tâche témoin",
    feedback_immediat: o.feedback_immediat ?? true,
    reponse_visible: o.reponse_visible ?? false,
    tentatives_supplementaires: o.tentatives_supplementaires ?? 0,
    aide_activee: o.aide_activee ?? false,
    aide_penalite_pourcent: o.aide_penalite_pourcent ?? 0,
    afficher_recapitulatif: false,
    chrono_mode: o.chrono_mode ?? "aucun",
    chrono_duree_secondes: o.chrono_duree_secondes ?? null,
    est_apercu: false,
  });
  for (const v of o.variantes ?? [{ variante_id: "_temoin_technique_v1", nombre_exercices: 1 }]) {
    s.base.inserer("taches_composition", { tache_id: tache.id, generateur_id: v.variante_id.startsWith("_temoin") ? "_temoin_technique" : "gen7", variante_id: v.variante_id, nombre_exercices: v.nombre_exercices, chrono_duree_secondes: v.chrono_duree_secondes ?? null });
  }
  return tache.id as string;
}
