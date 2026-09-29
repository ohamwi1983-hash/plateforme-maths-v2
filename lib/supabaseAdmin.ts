import { createClient } from "@supabase/supabase-js";
import { lireSupabaseUrl } from "./urlSupabase";

/**
 * Client serveur uniquement (clé service_role) — jamais exposé au navigateur. Contourne RLS : les 13 tables
 * ont RLS activé SANS police (RAPPORT §22-§23), donc ce client est le SEUL chemin d'accès aux données.
 *
 * PIÈGE (mesuré, RAPPORT §23-D) : après `admin.auth.signInWithPassword(...)`, les `admin.from(...)` du MÊME client
 * partent avec le JWT de l'utilisateur (rôle `authenticated`) : RLS s'applique alors, sans police = 0 ligne. Faire
 * tous les accès aux données AVANT un `signInWithPassword`, ou en créer un autre `supabaseAdmin()`.
 * `scripts/test-rls-schema.ts` le vérifie statiquement.
 */
export function supabaseAdmin() {
  const url = lireSupabaseUrl(); // sans suffixe /rest/v1 : le client ajoute le sien (RAPPORT §25)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans l'environnement");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Authentifie le prof à partir du header Authorization: Bearer <jwt> (Supabase Auth,
 * email/mot de passe — Étape 2). Un seul compte professeur pour ce pilote : la seule
 * vérification nécessaire est que le token soit valide et corresponde à une ligne `profs`.
 */
export async function profAuthentifie(authHeader: string | undefined): Promise<{ id: string } | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  if (!token) return null;

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: prof, error: profError } = await admin.from("profs").select("id").eq("id", userData.user.id).maybeSingle();
  if (profError || !prof) return null;

  return { id: prof.id as string };
}

/**
 * Authentifie l'élève à partir du header Authorization: Bearer <jwt> (Supabase Auth,
 * nom+prénom+mot de passe — prompt "Authentification élève", Étape 3). Même principe que
 * `profAuthentifie` : le token doit être valide ET correspondre à une ligne `eleves`.
 *
 * Ajout au-delà du texte littéral du prompt (Étape 4/5 ne mentionnent que api/reponses.ts) : sans
 * vérifier que l'appelant EST bien l'élève concerné sur `GET /api/exercices`, `GET
 * /api/exercices/:id` et `POST /api/reponses`, la nouvelle authentification élève ne changerait
 * rien en pratique — ces 3 endpoints acceptaient jusqu'ici n'importe quel `eleve_id`/
 * `exercice_assigne_id` fourni par le client, sans aucune vérification. Contredit l'objectif même
 * du prompt ("remplacer... aucune authentification réelle"). Voir RAPPORT.md.
 */
export async function eleveAuthentifie(authHeader: string | undefined): Promise<{ id: string } | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : undefined;
  if (!token) return null;

  const admin = supabaseAdmin();
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return null;

  const { data: eleve, error: eleveError } = await admin.from("eleves").select("id").eq("id", userData.user.id).maybeSingle();
  if (eleveError || !eleve) return null;

  return { id: eleve.id as string };
}
